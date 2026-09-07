/**
 * Weekly FSD sync runner: filter → attach SERVICE_ID → collapse → diff → review queue.
 * Never publishes a catalog snapshot.
 */

import { parse } from "csv-parse/sync";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { buildFsdImportReport, partitionFsdPoriruaRows } from "./fsd-import.mjs";
import { FSD_CSV_URL } from "./config.mjs";
import { orgClusterKey } from "./lib/org-cluster.mjs";
import { collapseFsdRows, serviceIdOf } from "./fsd-sync-collapse.mjs";
import {
  buildFsdFingerprint,
  diffFsdCatalog,
  fingerprintsEqualIgnoringFields,
  isIncludedCountBelowSanityThreshold,
} from "./fsd-sync-diff.mjs";
import { closePool, getPool, mapServiceRow, withTransaction } from "./lib/db.mjs";
import { publicServiceId } from "./lib/listing-identity.mjs";
import { slugId } from "./lib/normalize.mjs";

export function parseFsdCsvText(csvText) {
  return parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    trim: true,
  });
}

/**
 * Caller must attach SERVICE_ID / FSD_ID from the CSV before collapse.
 * Do not derive SERVICE_ID from FSD_ID — mapFsdRowToService may fall back to FSD_ID for `id`.
 */
export function attachFsdIdentity(mapped, csvRow) {
  return {
    ...mapped,
    SERVICE_ID: String(csvRow?.SERVICE_ID ?? "").trim(),
    FSD_ID: String(csvRow?.FSD_ID ?? "").trim(),
    LATITUDE: csvRow?.LATITUDE,
    LONGITUDE: csvRow?.LONGITUDE,
  };
}

export function missingServiceIdCount(mappedRows = []) {
  return mappedRows.filter((row) => !String(row?.SERVICE_ID ?? "").trim()).length;
}

/**
 * Included Porirua rows only, with CSV identity attached.
 * Excluded national rows never reach collapse/diff.
 */
export function includedRowsForCollapse(csvText, report) {
  const { includedRows } = partitionFsdPoriruaRows(parseFsdCsvText(csvText));
  const services = report?.services ?? [];
  if (includedRows.length !== services.length) {
    throw new Error(
      `included CSV rows (${includedRows.length}) != report.services (${services.length})`
    );
  }
  return includedRows.map((csvRow, index) => attachFsdIdentity(services[index], csvRow));
}

export function shouldQueueDiffItem(item, dbRow) {
  if (!item || item.kind === "unchanged") return false;
  if (item.kind === "new" || item.kind === "removed" || item.kind === "geocode_flag") {
    return true;
  }
  if (item.kind !== "changed") return false;
  const locked = item.proposed?.locked_fields ?? [];
  if (locked.length === 0) return true;
  const incoming = item.proposed?.after;
  const baseline = dbRow?.raw_import;
  if (!incoming || !baseline) return true;
  return !fingerprintsEqualIgnoringFields(incoming, baseline, locked);
}

/**
 * Three-way lock rule — enabled in the weekly runner after the live-dev
 * dry-run (1 newly queued item: FSD 2964 address/lat/lng).
 *
 * Queue a locked field only when incoming is not the editor patch and not
 * the last folded government value (`raw_import`).
 */
export function shouldQueueDiffItemThreeWay(item, dbRow, patch = {}) {
  if (!item || item.kind === "unchanged") return false;
  if (item.kind === "new" || item.kind === "removed" || item.kind === "geocode_flag") {
    return true;
  }
  if (item.kind !== "changed") return false;
  const locked = new Set(item.proposed?.locked_fields ?? []);
  const incoming = item.proposed?.after;
  const baseline = dbRow?.raw_import;
  if (!incoming || !baseline) return true;

  const incomingFp = buildFsdFingerprint(incoming);
  const rawFp = buildFsdFingerprint(baseline);
  const patchFp = buildFsdFingerprint({ ...baseline, ...patch });

  const drifted = Object.keys(incomingFp).filter(
    (field) => JSON.stringify(incomingFp[field]) !== JSON.stringify(rawFp[field])
  );
  if (drifted.length === 0) return false;

  return drifted.some((field) => {
    if (!locked.has(field)) return true;
    const incomingVal = JSON.stringify(incomingFp[field]);
    const matchesPatch = incomingVal === JSON.stringify(patchFp[field]);
    const matchesRaw = incomingVal === JSON.stringify(rawFp[field]);
    return !matchesPatch && !matchesRaw;
  });
}

export function threeWayQueuedFields(item, dbRow, patch = {}) {
  if (!item || item.kind !== "changed") return [];
  const locked = new Set(item.proposed?.locked_fields ?? []);
  const incoming = item.proposed?.after;
  const baseline = dbRow?.raw_import;
  if (!incoming || !baseline) return [];
  const incomingFp = buildFsdFingerprint(incoming);
  const rawFp = buildFsdFingerprint(baseline);
  const patchFp = buildFsdFingerprint({ ...baseline, ...patch });
  return Object.keys(incomingFp).filter((field) => {
    if (JSON.stringify(incomingFp[field]) === JSON.stringify(rawFp[field])) return false;
    if (!locked.has(field)) return true;
    const incomingVal = JSON.stringify(incomingFp[field]);
    return (
      incomingVal !== JSON.stringify(patchFp[field]) &&
      incomingVal !== JSON.stringify(rawFp[field])
    );
  });
}

export function geocodeFlagCodeOf(proposed) {
  return proposed?.geocode_flag?.code ?? null;
}

/**
 * One pending row per entity+kind. A geocode_flag already accepted or rejected
 * for the same code stays quiet; a different code is new information.
 *
 * @returns {"insert"|"refresh"|"skip"}
 */
export function decideQueueWrite(item, { pending = null, ruledGeocodeCodes = new Set() } = {}) {
  if (item?.kind === "geocode_flag") {
    if (pending) return "refresh";
    const code = geocodeFlagCodeOf(item.proposed);
    if (code && ruledGeocodeCodes.has(code)) return "skip";
    return "insert";
  }
  if (pending) return "refresh";
  return "insert";
}

function emptyKindCounts() {
  return { new: 0, changed: 0, removed: 0, unchanged: 0, geocode_flag: 0 };
}

function asJson(value) {
  return value == null ? null : JSON.stringify(value);
}

export async function loadLastSuccessfulIncludedCount(db) {
  const result = await db.query(
    `SELECT stats
       FROM import_runs
      WHERE source = 'fsd' AND status = 'success'
      ORDER BY finished_at DESC NULLS LAST, started_at DESC
      LIMIT 1`
  );
  const stats = result.rows[0]?.stats ?? {};
  const value = stats.includedCount ?? stats.included_count;
  return Number.isFinite(Number(value)) ? Number(value) : null;
}

export async function loadLastSourceCounts(db) {
  const result = await db.query(
    `SELECT stats
       FROM import_runs
      WHERE stats ? 'community'
      ORDER BY started_at DESC
      LIMIT 1`
  );
  const stats = result.rows[0]?.stats ?? {};
  return {
    community: stats.community ?? 0,
    duplicatesHidden: stats.duplicatesHidden ?? 0,
  };
}

export async function loadFsdRowsForDiff(db) {
  const services = await db.query(
    `SELECT * FROM services
      WHERE fsd_service_id IS NOT NULL AND btrim(fsd_service_id) <> ''`
  );
  const overrides = await db.query(`SELECT * FROM overrides`);
  const byTarget = new Map();
  for (const row of overrides.rows) {
    if (!byTarget.has(row.target_id)) byTarget.set(row.target_id, []);
    byTarget.get(row.target_id).push(row);
  }

  return services.rows.map((row) => {
    const mapped = mapServiceRow(row);
    const keys = new Set(
      [row.id, row.line_id, row.fsd_service_id ? `fsd-${row.fsd_service_id}` : null].filter(Boolean)
    );
    const attached = [];
    const seen = new Set();
    for (const key of keys) {
      for (const entry of byTarget.get(key) ?? []) {
        if (seen.has(entry.id)) continue;
        seen.add(entry.id);
        attached.push(entry);
      }
    }
    return {
      ...mapped,
      fsd_service_id: row.fsd_service_id,
      status: row.status,
      raw_import: row.raw_import,
      overrides: attached,
    };
  });
}

export async function findOrCreateOrganization(db, incoming) {
  const clusterKey = orgClusterKey({
    name: incoming.name,
    phone: incoming.phone,
    address: incoming.address,
    lat: incoming.lat,
    lng: incoming.lng,
  });
  const existing = await db.query(
    `SELECT * FROM organizations
      WHERE cluster_key = $1 AND merged_into IS NULL
      ORDER BY CASE status WHEN 'published' THEN 0 WHEN 'draft' THEN 1 ELSE 2 END, created_at
      LIMIT 1`,
    [clusterKey]
  );
  if (existing.rowCount) {
    return { organization: existing.rows[0], created: false, clusterKey };
  }

  const serviceId = serviceIdOf(incoming);
  const publicId = incoming.id || slugId(serviceId || incoming.name || "provider", "fsd-");
  const id = publicId;
  await db.query(
    `INSERT INTO organizations (
       id, public_id, render_grain, name, description, phone, url, address, lat, lng,
       source_primary, status, cluster_key
     ) VALUES ($1, $2, 'flat', $3, $4, $5, $6, $7, $8, $9, 'fsd', 'draft', $10)`,
    [
      id,
      publicId,
      incoming.name ?? "",
      incoming.description ?? "",
      incoming.phone ?? "",
      incoming.url ?? "",
      incoming.address ?? "",
      incoming.lat ?? null,
      incoming.lng ?? null,
      clusterKey,
    ]
  );
  return {
    organization: { id, public_id: publicId, status: "draft", cluster_key: clusterKey },
    created: true,
    clusterKey,
  };
}

function incomingFingerprint(after) {
  return {
    name: after.name ?? "",
    serviceName: after.serviceName ?? "",
    description: after.description ?? "",
    phone: after.phone ?? "",
    url: after.url ?? "",
    address: after.address ?? "",
    lat: after.lat ?? null,
    lng: after.lng ?? null,
    categories: after.categories ?? [],
    fsd_service_id: after.fsd_service_id ?? after.SERVICE_ID ?? null,
    fsd_legacy_id: after.fsd_legacy_id ?? after.FSD_ID ?? null,
  };
}

async function insertNewService(db, incoming, organizationId, after) {
  const id = publicServiceId(incoming);
  const serviceId = serviceIdOf(incoming);
  await db.query(
    `INSERT INTO services (
       id, organization_id, line_id, title, service_name, description,
       phone, url, address, lat, lng, categories, badges, source,
       fsd_service_id, fsd_legacy_id, status, raw_import, sort_key
     ) VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, '[]'::jsonb, 'fsd',
       $13, $14, 'pending_review', $15::jsonb, 0
     )`,
    [
      id,
      organizationId,
      id,
      incoming.serviceName || incoming.name || "",
      incoming.serviceName ?? "",
      incoming.description ?? "",
      incoming.phone ?? "",
      incoming.url ?? "",
      incoming.address ?? "",
      incoming.lat ?? null,
      incoming.lng ?? null,
      asJson(incoming.categories ?? []),
      serviceId || null,
      incoming.FSD_ID || incoming.fsd_legacy_id || null,
      asJson(incomingFingerprint(after ?? incoming)),
    ]
  );
  return id;
}

async function insertQueueItem(db, importRunId, item, entityId) {
  const inserted = await db.query(
    `INSERT INTO review_queue_items (
       import_run_id, entity_type, entity_id, kind, proposed, status
     ) VALUES ($1, 'service', $2, $3, $4::jsonb, 'pending')
     RETURNING *`,
    [importRunId, entityId, item.kind, asJson(item.proposed ?? {})]
  );
  return inserted.rows[0];
}

async function findPendingQueueItem(db, entityId, kind) {
  const result = await db.query(
    `SELECT * FROM review_queue_items
      WHERE entity_type = 'service' AND entity_id = $1 AND kind = $2 AND status = 'pending'
      ORDER BY updated_at DESC, created_at DESC
      LIMIT 1`,
    [entityId, kind]
  );
  return result.rows[0] ?? null;
}

async function loadRuledGeocodeCodes(db, entityId) {
  const result = await db.query(
    `SELECT proposed FROM review_queue_items
      WHERE entity_type = 'service' AND entity_id = $1 AND kind = 'geocode_flag'
        AND status IN ('accepted', 'rejected')`,
    [entityId]
  );
  return new Set(result.rows.map((row) => geocodeFlagCodeOf(row.proposed)).filter(Boolean));
}

async function refreshQueueItem(db, pendingId, importRunId, item) {
  const updated = await db.query(
    `UPDATE review_queue_items
        SET proposed = $2::jsonb, import_run_id = $3, updated_at = now()
      WHERE id = $1
      RETURNING *`,
    [pendingId, asJson(item.proposed ?? {}), importRunId]
  );
  return updated.rows[0];
}

async function upsertQueueItem(db, importRunId, item, entityId) {
  const pending = await findPendingQueueItem(db, entityId, item.kind);
  const ruledGeocodeCodes =
    item.kind === "geocode_flag" ? await loadRuledGeocodeCodes(db, entityId) : new Set();
  const decision = decideQueueWrite(item, { pending, ruledGeocodeCodes });
  if (decision === "skip") return { queued: false, skipped: true };
  if (decision === "refresh") {
    return { queued: true, refreshed: true, queueItem: await refreshQueueItem(db, pending.id, importRunId, item) };
  }
  return { queued: true, refreshed: false, queueItem: await insertQueueItem(db, importRunId, item, entityId) };
}

function openPatchFromRow(dbRow) {
  const patches = (dbRow?.overrides ?? []).filter((entry) => {
    const type = String(entry?.action ?? entry?.type ?? entry?.kind ?? "").toLowerCase();
    if (type !== "patch") return false;
    if (entry.open === true) return true;
    if (entry.open === false) return false;
    if (entry.status == null) return true;
    return String(entry.status).toLowerCase() === "open";
  });
  return Object.assign(
    {},
    ...patches.map((entry) => (entry.patch && typeof entry.patch === "object" ? entry.patch : {}))
  );
}

function withReviewableFields(item, dbRow, patch) {
  if (item.kind !== "changed") return item;
  const reviewable = threeWayQueuedFields(item, dbRow, patch);
  return {
    ...item,
    proposed: {
      ...(item.proposed && typeof item.proposed === "object" ? item.proposed : {}),
      reviewable_fields: reviewable,
    },
  };
}

/** Live listing columns at queue time — what this week's diff was computed against. */
function liveListingSnapshot(dbRow) {
  if (!dbRow) return {};
  return {
    name: dbRow.name ?? "",
    title: dbRow.title ?? "",
    serviceName: dbRow.service_name ?? dbRow.serviceName ?? "",
    description: dbRow.description ?? "",
    phone: dbRow.phone ?? "",
    url: dbRow.url ?? "",
    address: dbRow.address ?? "",
    lat: dbRow.lat ?? null,
    lng: dbRow.lng ?? null,
    categories: dbRow.categories ?? [],
  };
}

function withQueuedBefore(item, dbRow) {
  if (item.kind === "new") return item;
  if (!dbRow) return item;
  return {
    ...item,
    proposed: {
      ...(item.proposed && typeof item.proposed === "object" ? item.proposed : {}),
      before: liveListingSnapshot(dbRow),
    },
  };
}

async function applyDiffItem(db, importRunId, item, dbByServiceId, collapsedByServiceId) {
  const dbRow = dbByServiceId.get(item.serviceId);
  const patch = openPatchFromRow(dbRow);
  if (!shouldQueueDiffItemThreeWay(item, dbRow, patch)) {
    return { queued: false };
  }
  item = withQueuedBefore(withReviewableFields(item, dbRow, patch), dbRow);

  if (item.kind === "new") {
    const incoming = collapsedByServiceId.get(item.serviceId);
    let entityId = dbRow?.id;
    if (!entityId) {
      const { organization } = await findOrCreateOrganization(db, incoming);
      entityId = await insertNewService(db, incoming, organization.id, item.proposed?.after);
    }
    const written = await upsertQueueItem(db, importRunId, item, entityId);
    return { ...written, entityId };
  }

  if (item.kind === "changed") {
    if (dbRow?.status !== "hidden") {
      await db.query(
        `UPDATE services
            SET status = 'pending_review', updated_at = now()
          WHERE fsd_service_id = $1`,
        [item.serviceId]
      );
    }
    const written = await upsertQueueItem(db, importRunId, item, dbRow.id);
    return { ...written, entityId: dbRow.id };
  }

  if (item.kind === "removed") {
    const written = await upsertQueueItem(db, importRunId, item, dbRow.id);
    return { ...written, entityId: dbRow.id };
  }

  if (item.kind === "geocode_flag") {
    const written = await upsertQueueItem(db, importRunId, item, dbRow.id);
    return { ...written, entityId: dbRow.id };
  }

  return { queued: false };
}

async function insertRunningImport(db, fsdCsvUrl) {
  const inserted = await db.query(
    `INSERT INTO import_runs (source, status, fsd_csv_url, stats)
     VALUES ('fsd', 'running', $1, '{}'::jsonb)
     RETURNING id`,
    [fsdCsvUrl ?? null]
  );
  return inserted.rows[0].id;
}

async function finalizeImportRun(db, id, { status, stats, errorMessage }) {
  await db.query(
    `UPDATE import_runs
        SET status = $2,
            finished_at = now(),
            stats = $3::jsonb,
            error_message = $4
      WHERE id = $1`,
    [id, status, asJson(stats ?? {}), errorMessage ?? null]
  );
}

async function countSnapshots(db) {
  const result = await db.query(`SELECT count(*)::int AS n FROM catalog_snapshots`);
  return result.rows[0].n;
}

export async function runFsdSync({
  csvText,
  db,
  fsdCsvUrl = null,
  fetchCsv = null,
} = {}) {
  if (!db) throw new Error("runFsdSync requires db");
  const importRunId = await insertRunningImport(db, fsdCsvUrl);
  const kinds = emptyKindCounts();
  let stats = {
    totalCsvRows: 0,
    includedCount: 0,
    excludedCount: 0,
    geocodeFlagCount: 0,
    missingServiceIdCount: 0,
    collapsedCount: 0,
    queued: 0,
    fsd: 0,
    community: 0,
    duplicatesHidden: 0,
    ...kinds,
  };

  try {
    let text = csvText;
    if (text == null) {
      const url = fsdCsvUrl || FSD_CSV_URL;
      const fetcher = fetchCsv ?? (async (target) => {
        const res = await fetch(target);
        if (!res.ok) throw new Error(`Failed to fetch FSD CSV: ${res.status} ${res.statusText}`);
        return res.text();
      });
      text = await fetcher(url);
      if (!fsdCsvUrl) fsdCsvUrl = url;
    }

    const report = buildFsdImportReport(text, { fsdCsvUrl });
    const mapped = includedRowsForCollapse(text, report);
    const priorCounts = await loadLastSourceCounts(db);
    stats = {
      ...stats,
      totalCsvRows: report.totalCsvRows,
      includedCount: report.includedCount,
      excludedCount: report.excludedCount,
      geocodeFlagCount: report.geocodeFlagCount,
      missingServiceIdCount: missingServiceIdCount(mapped),
      fsd: report.includedCount,
      community: priorCounts.community,
      duplicatesHidden: priorCounts.duplicatesHidden,
    };

    const lastIncluded = await loadLastSuccessfulIncludedCount(db);
    if (isIncludedCountBelowSanityThreshold(report.includedCount, lastIncluded)) {
      stats.sanity_aborted = true;
      stats.alert = true;
      stats.lastSuccessfulIncludedCount = lastIncluded;
      stats.removed = 0;
      stats.queued = 0;
      const alert = {
        type: "sanity_abort",
        includedCount: report.includedCount,
        lastSuccessfulIncludedCount: lastIncluded,
      };
      const errorMessage = `Sanity abort: included count ${report.includedCount} is below 75% of last successful ${lastIncluded}`;
      console.error(errorMessage);
      await finalizeImportRun(db, importRunId, { status: "failed", stats, errorMessage });
      return {
        importRunId,
        status: "failed",
        stats,
        alert,
        items: [],
        queued: [],
        published: false,
      };
    }

    const collapsed = collapseFsdRows(mapped);
    stats.collapsedCount = collapsed.length;
    const dbRows = await loadFsdRowsForDiff(db);
    const items = diffFsdCatalog(collapsed, dbRows);
    const snapshotsBefore = await countSnapshots(db);

    const dbByServiceId = new Map(dbRows.map((row) => [String(row.fsd_service_id), row]));
    const collapsedByServiceId = new Map(collapsed.map((row) => [serviceIdOf(row), row]));
    const queued = [];

    await withTransaction(async (tx) => {
      for (const item of items) {
        if (Object.hasOwn(kinds, item.kind)) kinds[item.kind] += 1;
        const applied = await applyDiffItem(tx, importRunId, item, dbByServiceId, collapsedByServiceId);
        if (applied.queued) {
          queued.push(applied.queueItem);
        }
      }
    }, db);

    stats = { ...stats, ...kinds, queued: queued.length };
    await finalizeImportRun(db, importRunId, { status: "success", stats });
    const snapshotsAfter = await countSnapshots(db);

    return {
      importRunId,
      status: "success",
      stats,
      alert: null,
      items,
      queued,
      published: false,
      snapshotCreated: snapshotsAfter !== snapshotsBefore,
    };
  } catch (error) {
    await finalizeImportRun(db, importRunId, {
      status: "failed",
      stats,
      errorMessage: String(error?.message ?? error),
    });
    throw error;
  }
}

async function main() {
  const url = process.env.FSD_CSV_URL || FSD_CSV_URL;
  const pool = getPool();
  try {
    const result = await runFsdSync({ db: pool, fsdCsvUrl: url });
    console.log(
      JSON.stringify({
        importRunId: result.importRunId,
        status: result.status,
        stats: result.stats,
        alert: result.alert,
        published: result.published,
      })
    );
    if (result.status === "failed") process.exitCode = 1;
  } finally {
    await closePool();
  }
}

const modulePath = pathToFileURL(path.resolve(process.argv[1] ?? "")).href;
if (import.meta.url === modulePath) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
