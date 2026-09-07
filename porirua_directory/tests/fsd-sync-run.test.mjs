import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildFsdImportReport } from "../scripts/fsd-import.mjs";
import { catalogToRows } from "../scripts/catalog-rows.mjs";
import { FSD_CSV_URL } from "../scripts/config.mjs";
import { bootstrapFromJson } from "../scripts/db-import-from-json.mjs";
import { orgClusterKey } from "../scripts/lib/org-cluster.mjs";
import { approveReviewItem, rejectReviewItem } from "../scripts/approve-review.mjs";
import { GEOCODE_QA_REASON } from "../scripts/fsd-geocode-qa.mjs";
import {
  attachFsdIdentity,
  decideQueueWrite,
  includedRowsForCollapse,
  missingServiceIdCount,
  runFsdSync,
  shouldQueueDiffItem,
} from "../scripts/fsd-sync-run.mjs";
import { collapseFsdRows, serviceIdOf } from "../scripts/fsd-sync-collapse.mjs";
import { buildFsdFingerprint, diffFsdCatalog } from "../scripts/fsd-sync-diff.mjs";
import { getCurrentSnapshot, publishCatalog, rowsForSnapshot } from "../scripts/publish-catalog.mjs";
import { mapOrganizationRow, mapServiceRow } from "../scripts/lib/db.mjs";
import { withSyncDatabase } from "./helpers/sync-postgres.mjs";

const HEADER = [
  "FSD_ID",
  "SERVICE_ID",
  "PROVIDER_NAME",
  "SERVICE_NAME",
  "SERVICE_DETAIL",
  "PUBLISHED_PHONE_1",
  "PROVIDER_WEBSITE_1",
  "PHYSICAL_DISTRICT",
  "PHYSICAL_ADDRESS",
  "LATITUDE",
  "LONGITUDE",
  "LEVEL_1_CATEGORY",
];

export function fsdCsv(rows) {
  const lines = [HEADER.map((h) => `"${h}"`).join(",")];
  for (const row of rows) {
    lines.push(
      HEADER.map((h) => `"${String(row[h] ?? "").replaceAll('"', '""')}"`).join(",")
    );
  }
  return `${lines.join("\n")}\n`;
}

export const PORIRUA_FOOD = {
  FSD_ID: "9001",
  SERVICE_ID: "9001-line-a",
  PROVIDER_NAME: "Test Provider",
  SERVICE_NAME: "Food bank",
  SERVICE_DETAIL: "Help with food",
  PUBLISHED_PHONE_1: "04 123 4567",
  PROVIDER_WEBSITE_1: "https://example.org",
  PHYSICAL_DISTRICT: "Porirua",
  PHYSICAL_ADDRESS: "1 Main St, Porirua",
  LATITUDE: "-41.13",
  LONGITUDE: "174.84",
  LEVEL_1_CATEGORY: "Food",
};

export const WELLINGTON_ONLY = {
  FSD_ID: "9002",
  SERVICE_ID: "well-only",
  PROVIDER_NAME: "Wellington Only Service",
  SERVICE_NAME: "Counselling",
  SERVICE_DETAIL: "Region-wide",
  PUBLISHED_PHONE_1: "04 999 0000",
  PHYSICAL_DISTRICT: "",
  PHYSICAL_ADDRESS: "100 Lambton Quay, Wellington",
  LATITUDE: "-41.28",
  LONGITUDE: "174.77",
  LEVEL_1_CATEGORY: "Support",
};

/** In-Porirua district, marine pin — fingerprint-stable geocode_flag fixture. */
export const MARINE_PIN = {
  FSD_ID: "4690",
  SERVICE_ID: "9004-marine",
  PROVIDER_NAME: "Marine Pin Trust",
  SERVICE_NAME: "Support group",
  SERVICE_DETAIL: "Respiratory support.",
  PUBLISHED_PHONE_1: "04 237 6892",
  PHYSICAL_DISTRICT: "Porirua City",
  PHYSICAL_ADDRESS: "",
  LATITUDE: "-41.080194",
  LONGITUDE: "174.760239",
  LEVEL_1_CATEGORY: "Health",
};

export const TITAHI_CLINIC = {
  FSD_ID: "9003",
  SERVICE_ID: "9003-clinic",
  PROVIDER_NAME: "Titahi Bay Community",
  SERVICE_NAME: "Clinic",
  SERVICE_DETAIL: "Free nurse",
  PHYSICAL_DISTRICT: "",
  PHYSICAL_ADDRESS: "5 Beach Road, Titahi Bay",
  LATITUDE: "-41.10",
  LONGITUDE: "174.82",
  LEVEL_1_CATEGORY: "Health",
};

test("attachFsdIdentity copies SERVICE_ID and FSD_ID from the CSV row", () => {
  const mapped = { id: "fsd-9001-line-a", fsdServiceId: "9001", name: "Test Provider" };
  const attached = attachFsdIdentity(mapped, PORIRUA_FOOD);
  assert.equal(attached.SERVICE_ID, "9001-line-a");
  assert.equal(attached.FSD_ID, "9001");
  assert.equal(attached.LATITUDE, "-41.13");
  assert.equal(attached.LONGITUDE, "174.84");
});

test("includedRowsForCollapse attaches identity and counts missing SERVICE_ID", () => {
  const missingId = { ...PORIRUA_FOOD, SERVICE_ID: "" };
  const csv = fsdCsv([missingId, TITAHI_CLINIC]);
  const report = buildFsdImportReport(csv);
  const mapped = includedRowsForCollapse(csv, report);
  assert.equal(mapped.length, 2);
  assert.equal(mapped[0].SERVICE_ID, "");
  assert.equal(mapped[0].FSD_ID, "9001");
  assert.equal(mapped[1].SERVICE_ID, "9003-clinic");
  assert.equal(missingServiceIdCount(mapped), 1);
});

test("diff receives only Porirua-included rows, not the rest of the national feed", () => {
  const csv = fsdCsv([PORIRUA_FOOD, WELLINGTON_ONLY, TITAHI_CLINIC]);
  const report = buildFsdImportReport(csv);
  assert.equal(report.includedCount, 2);
  assert.equal(report.excludedCount, 1);

  const mapped = includedRowsForCollapse(csv, report);
  const serviceIds = mapped.map((row) => serviceIdOf(row)).sort();
  assert.deepEqual(serviceIds, ["9001-line-a", "9003-clinic"]);
  assert.ok(!serviceIds.includes("well-only"));

  const collapsed = collapseFsdRows(mapped);
  const items = diffFsdCatalog(collapsed, []);
  const kinds = Object.fromEntries(items.map((item) => [item.serviceId, item.kind]));
  assert.equal(kinds["9001-line-a"], "new");
  assert.equal(kinds["9003-clinic"], "new");
  assert.equal(kinds["well-only"], undefined);
  assert.equal(items.filter((item) => item.kind === "new").length, 2);
});

function fingerprintFromCsv(row) {
  const report = buildFsdImportReport(fsdCsv([row]));
  const [mapped] = includedRowsForCollapse(fsdCsv([row]), report);
  const [collapsed] = collapseFsdRows([mapped]);
  return {
    name: collapsed.name,
    serviceName: collapsed.serviceName ?? "",
    description: collapsed.description ?? "",
    phone: collapsed.phone ?? "",
    url: collapsed.url ?? "",
    address: collapsed.address ?? "",
    lat: collapsed.lat ?? null,
    lng: collapsed.lng ?? null,
    categories: collapsed.categories ?? [],
    fsd_service_id: collapsed.SERVICE_ID,
    fsd_legacy_id: collapsed.FSD_ID,
  };
}

async function insertFsdService(
  client,
  {
    csvRow,
    status = "published",
    orgStatus = "published",
    rawImport,
    description,
    phone,
    address,
    lat,
    lng,
    categories,
  }
) {
  const fp = fingerprintFromCsv(csvRow);
  const orgId = `fsd-${csvRow.SERVICE_ID}`;
  const clusterKey = orgClusterKey({
    name: fp.name,
    phone: fp.phone,
    address: address ?? fp.address,
    lat: lat ?? fp.lat,
    lng: lng ?? fp.lng,
  });
  await client.query(
    `INSERT INTO organizations (
       id, public_id, render_grain, name, phone, url, address, lat, lng,
       source_primary, status, cluster_key
     ) VALUES ($1, $1, 'flat', $2, $3, $4, $5, $6, $7, 'fsd', $8, $9)`,
    [
      orgId,
      fp.name,
      phone ?? fp.phone,
      fp.url,
      address ?? fp.address,
      lat ?? fp.lat,
      lng ?? fp.lng,
      orgStatus,
      clusterKey,
    ]
  );
  await client.query(
    `INSERT INTO services (
       id, organization_id, line_id, title, service_name, description,
       phone, url, address, lat, lng, categories, source,
       fsd_service_id, fsd_legacy_id, status, raw_import
     ) VALUES (
       $1, $1, $1, $2, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, 'fsd',
       $10, $11, $12, $13::jsonb
     )`,
    [
      orgId,
      fp.serviceName,
      description ?? fp.description,
      phone ?? fp.phone,
      fp.url,
      address ?? fp.address,
      lat ?? fp.lat,
      lng ?? fp.lng,
      JSON.stringify(categories ?? fp.categories),
      csvRow.SERVICE_ID,
      csvRow.FSD_ID,
      status,
      JSON.stringify(rawImport ?? fp),
    ]
  );
  return orgId;
}

async function importRunCount(client) {
  const result = await client.query(`SELECT count(*)::int AS n FROM import_runs WHERE source = 'fsd'`);
  return result.rows[0].n;
}

test("shouldQueueDiffItem skips a change that only touches locked patch fields", () => {
  const item = {
    kind: "changed",
    serviceId: "2964",
    proposed: {
      after: { address: "FSD address", lat: -41.08, lng: 174.76, categories: ["health"] },
      locked_fields: ["address", "lat", "lng"],
    },
  };
  const dbRow = {
    raw_import: {
      address: "22 Ngāti Toa Street, Takapūwāhia, Porirua",
      lat: -41.1248,
      lng: 174.835605,
      categories: ["health"],
    },
  };
  assert.equal(shouldQueueDiffItem(item, dbRow), false);
});

test("a new SERVICE_ID soft-matches an organization on orgClusterKey", async (t) => {
  await withSyncDatabase(t, async (client) => {
    await insertFsdService(client, { csvRow: PORIRUA_FOOD });
    const sibling = {
      ...PORIRUA_FOOD,
      FSD_ID: "9100",
      SERVICE_ID: "9100-sibling",
      SERVICE_NAME: "Meal parcels",
      SERVICE_DETAIL: "Extra food help",
      LEVEL_1_CATEGORY: "Food",
    };
    const result = await runFsdSync({ db: client, csvText: fsdCsv([PORIRUA_FOOD, sibling]) });
    assert.equal(result.status, "success");
    const created = await client.query(
      `SELECT * FROM services WHERE fsd_service_id = '9100-sibling'`
    );
    assert.equal(created.rowCount, 1);
    assert.equal(created.rows[0].organization_id, "fsd-9001-line-a");
    assert.equal(created.rows[0].status, "pending_review");
    const orgs = await client.query(`SELECT status FROM organizations WHERE id = $1`, [
      created.rows[0].organization_id,
    ]);
    assert.equal(orgs.rows[0].status, "published");
  });
});

test("a new SERVICE_ID without a cluster match creates a draft org that never snapshots", async (t) => {
  await withSyncDatabase(t, async (client) => {
    const result = await runFsdSync({ db: client, csvText: fsdCsv([TITAHI_CLINIC]) });
    assert.equal(result.status, "success");
    const org = await client.query(`SELECT * FROM organizations WHERE source_primary = 'fsd'`);
    assert.equal(org.rowCount, 1);
    assert.equal(org.rows[0].status, "draft");
    assert.ok(org.rows[0].cluster_key);
    const service = await client.query(`SELECT * FROM services WHERE fsd_service_id = '9003-clinic'`);
    assert.equal(service.rows[0].organization_id, org.rows[0].id);
    assert.equal(service.rows[0].status, "pending_review");
    assert.ok(service.rows[0].raw_import);
    assert.equal(service.rows[0].raw_import.name, "Titahi Bay Community");
    assert.equal(service.rows[0].raw_import.fsd_service_id, "9003-clinic");
    const snapshot = rowsForSnapshot(
      org.rows.map(mapOrganizationRow),
      service.rows.map(mapServiceRow)
    );
    assert.equal(snapshot.organizations.length, 0);
    assert.equal(snapshot.services.length, 0);
    assert.equal(result.published, false);
    assert.equal(result.snapshotCreated, false);
    const snaps = await client.query(`SELECT count(*)::int AS n FROM catalog_snapshots`);
    assert.equal(snaps.rows[0].n, 0);
  });
});

test("a changed record stays published and keeps live columns", async (t) => {
  await withSyncDatabase(t, async (client) => {
    const raw = fingerprintFromCsv(PORIRUA_FOOD);
    await insertFsdService(client, {
      csvRow: PORIRUA_FOOD,
      description: "Last accepted food text",
      rawImport: { ...raw, description: "Last accepted food text" },
    });
    const incoming = { ...PORIRUA_FOOD, SERVICE_DETAIL: "Updated food help from FSD" };
    const result = await runFsdSync({ db: client, csvText: fsdCsv([incoming]) });
    const service = await client.query(`SELECT * FROM services WHERE fsd_service_id = '9001-line-a'`);
    assert.equal(service.rows[0].status, "published");
    assert.equal(service.rows[0].description, "Last accepted food text");
    const queue = await client.query(
      `SELECT * FROM review_queue_items WHERE kind = 'changed'`
    );
    assert.equal(queue.rowCount, 1);
    assert.equal(queue.rows[0].proposed.after.description, "Updated food help from FSD");
    assert.equal(result.stats.changed, 1);
    assert.equal(result.published, false);
  });
});

function snapshotServiceIds(envelope) {
  const ids = new Set();
  for (const entry of envelope?.services ?? []) {
    if (entry.id) ids.add(entry.id);
    if (entry.lineId) ids.add(entry.lineId);
    for (const line of entry.services ?? []) {
      if (line.id) ids.add(line.id);
      if (line.lineId) ids.add(line.lineId);
    }
  }
  return ids;
}

test("a queued change does not drop a previously snapshotted service from the next snapshot", async (t) => {
  await withSyncDatabase(t, async (client) => {
    const rawFood = fingerprintFromCsv(PORIRUA_FOOD);
    const rawClinic = fingerprintFromCsv(TITAHI_CLINIC);
    await insertFsdService(client, {
      csvRow: PORIRUA_FOOD,
      description: "Last accepted food text",
      rawImport: { ...rawFood, description: "Last accepted food text" },
    });
    await insertFsdService(client, { csvRow: TITAHI_CLINIC, rawImport: rawClinic });
    const first = await publishCatalog({ db: client, publishedBy: "seed", purge: async () => {} });
    const beforeIds = snapshotServiceIds(first.envelope);
    assert.ok(beforeIds.has("fsd-9001-line-a"));
    assert.ok(beforeIds.has("fsd-9003-clinic"));

    const incoming = { ...PORIRUA_FOOD, SERVICE_DETAIL: "Updated food help from FSD" };
    const synced = await runFsdSync({
      db: client,
      csvText: fsdCsv([incoming, TITAHI_CLINIC]),
    });
    assert.equal(synced.stats.changed, 1);
    assert.equal(synced.stats.unchanged, 1);
    const queue = await client.query(
      `SELECT kind, status FROM review_queue_items WHERE entity_id = 'fsd-9001-line-a'`
    );
    assert.equal(queue.rowCount, 1);
    assert.equal(queue.rows[0].kind, "changed");
    assert.equal(queue.rows[0].status, "pending");

    const next = await publishCatalog({ db: client, publishedBy: "after-sync", purge: async () => {} });
    const afterIds = snapshotServiceIds(next.envelope);
    for (const id of beforeIds) {
      assert.ok(afterIds.has(id), `${id} disappeared from the snapshot after being queued for review`);
    }
  });
});

test("a removed record is queued and never auto-hidden", async (t) => {
  await withSyncDatabase(t, async (client) => {
    await insertFsdService(client, { csvRow: PORIRUA_FOOD });
    await insertFsdService(client, { csvRow: TITAHI_CLINIC });
    const result = await runFsdSync({ db: client, csvText: fsdCsv([PORIRUA_FOOD]) });
    const clinic = await client.query(`SELECT status FROM services WHERE fsd_service_id = '9003-clinic'`);
    assert.equal(clinic.rows[0].status, "published");
    const removed = await client.query(
      `SELECT * FROM review_queue_items WHERE kind = 'removed'`
    );
    assert.equal(removed.rowCount, 1);
    assert.equal(removed.rows[0].entity_id, "fsd-9003-clinic");
    assert.equal(removed.rows[0].proposed.auto_hide, false);
    assert.equal(result.stats.removed, 1);
  });
});

test("community rows are not treated as FSD removals", async (t) => {
  await withSyncDatabase(t, async (client) => {
    await client.query(
      `INSERT INTO organizations (id, public_id, render_grain, name, cluster_key, status, source_primary)
       VALUES ('community-garden', 'community-garden', 'flat', 'Garden', 'community-key', 'published', 'community')`
    );
    await client.query(
      `INSERT INTO services (id, organization_id, line_id, title, source, status)
       VALUES ('community-garden', 'community-garden', 'community-garden', 'Garden', 'community', 'published')`
    );
    await insertFsdService(client, { csvRow: PORIRUA_FOOD });
    const result = await runFsdSync({ db: client, csvText: fsdCsv([PORIRUA_FOOD]) });
    const removed = result.items.filter((item) => item.kind === "removed");
    assert.equal(removed.length, 0);
    const community = await client.query(`SELECT status FROM services WHERE id = 'community-garden'`);
    assert.equal(community.rows[0].status, "published");
  });
});

test("hidden status is a lock: incoming is queued but status stays hidden", async (t) => {
  await withSyncDatabase(t, async (client) => {
    const raw = fingerprintFromCsv(PORIRUA_FOOD);
    await insertFsdService(client, {
      csvRow: PORIRUA_FOOD,
      status: "hidden",
      rawImport: { ...raw, phone: "04 000 0000" },
    });
    const result = await runFsdSync({
      db: client,
      csvText: fsdCsv([{ ...PORIRUA_FOOD, PUBLISHED_PHONE_1: "04 123 4567" }]),
    });
    const service = await client.query(`SELECT status, phone FROM services WHERE fsd_service_id = '9001-line-a'`);
    assert.equal(service.rows[0].status, "hidden");
    const queue = await client.query(`SELECT proposed FROM review_queue_items WHERE kind = 'changed'`);
    assert.equal(queue.rowCount, 1);
    assert.equal(queue.rows[0].proposed.blocked_by_hidden, true);
    assert.equal(result.published, false);
  });
});

test("open patch keeps live columns and queues a third-value conflict", async (t) => {
  await withSyncDatabase(t, async (client) => {
    const curated = {
      address: "22 Ngāti Toa Street, Takapūwāhia, Porirua",
      lat: -41.1248,
      lng: 174.835605,
    };
    const csvRow = {
      FSD_ID: "4690",
      SERVICE_ID: "2964",
      PROVIDER_NAME: "Porirua Respiritory Support group - Ora Toa",
      SERVICE_NAME: "Support group - Ora Toa",
      SERVICE_DETAIL: "Respiratory support group.",
      PUBLISHED_PHONE_1: "04 237 6892",
      PHYSICAL_DISTRICT: "Porirua City",
      PHYSICAL_ADDRESS: "",
      LATITUDE: "-41.080194",
      LONGITUDE: "174.760239",
      LEVEL_1_CATEGORY: "Health",
    };
    const raw = fingerprintFromCsv(csvRow);
    await insertFsdService(client, {
      csvRow,
      address: curated.address,
      lat: curated.lat,
      lng: curated.lng,
      rawImport: { ...raw, ...curated },
    });
    const { overrides } = catalogToRows({ services: [] }, { patches: { "fsd-2964": curated } });
    await client.query(
      `INSERT INTO overrides (id, target_type, target_id, action, patch, status)
       VALUES ('service:fsd-2964:patch', $1, $2, $3, $4::jsonb, 'open')`,
      [overrides[0].target_type, overrides[0].target_id, overrides[0].action, JSON.stringify(overrides[0].patch)]
    );

    const result = await runFsdSync({ db: client, csvText: fsdCsv([csvRow]) });
    const service = await client.query(`SELECT status, address, lat, lng FROM services WHERE id = 'fsd-2964'`);
    assert.equal(service.rows[0].status, "published");
    assert.equal(service.rows[0].address, curated.address);
    assert.equal(Number(service.rows[0].lat), curated.lat);
    const queued = result.queued.filter((row) => row.entity_id === "fsd-2964");
    assert.equal(queued.length, 1);
    assert.ok((queued[0].proposed.locked_fields ?? []).includes("address"));
    assert.ok((queued[0].proposed.reviewable_fields ?? []).includes("address"));
    assert.equal(queued[0].proposed.before.address, curated.address);
    assert.equal(Number(queued[0].proposed.before.lat), curated.lat);
  });
});

test("sanity abort below 75% writes one failed import_runs row and zero removals", async (t) => {
  await withSyncDatabase(t, async (client) => {
    await insertFsdService(client, { csvRow: PORIRUA_FOOD });
    await insertFsdService(client, { csvRow: TITAHI_CLINIC });
    await client.query(
      `INSERT INTO import_runs (source, status, finished_at, stats)
       VALUES ('fsd', 'success', now(), '{"includedCount": 100}'::jsonb)`
    );
    const snapsBefore = await client.query(`SELECT count(*)::int AS n FROM catalog_snapshots`);
    const result = await runFsdSync({ db: client, csvText: fsdCsv([PORIRUA_FOOD]) });
    assert.equal(result.status, "failed");
    assert.equal(result.alert?.type, "sanity_abort");
    assert.equal(result.stats.alert, true);
    assert.equal(result.stats.removed, 0);
    assert.equal(result.stats.queued, 0);
    const removals = await client.query(`SELECT * FROM review_queue_items WHERE kind = 'removed'`);
    assert.equal(removals.rowCount, 0);
    const clinic = await client.query(`SELECT status FROM services WHERE fsd_service_id = '9003-clinic'`);
    assert.equal(clinic.rows[0].status, "published");
    const runs = await client.query(
      `SELECT status, stats, error_message FROM import_runs WHERE source = 'fsd' ORDER BY started_at`
    );
    assert.equal(runs.rowCount, 2);
    assert.equal(runs.rows[1].status, "failed");
    assert.equal(runs.rows[1].stats.includedCount, 1);
    assert.match(runs.rows[1].error_message, /Sanity abort/);
    const snapsAfter = await client.query(`SELECT count(*)::int AS n FROM catalog_snapshots`);
    assert.equal(snapsAfter.rows[0].n, snapsBefore.rows[0].n);
  });
});

test("exactly one import_runs row per run, including on failure, and the job never publishes", async (t) => {
  await withSyncDatabase(t, async (client) => {
    await insertFsdService(client, { csvRow: PORIRUA_FOOD });
    await publishCatalog({ db: client, publishedBy: "test", purge: async () => {} });
    const currentBefore = await getCurrentSnapshot(client);
    assert.ok(currentBefore);

    const before = await importRunCount(client);
    const ok = await runFsdSync({ db: client, csvText: fsdCsv([PORIRUA_FOOD]) });
    assert.equal(ok.status, "success");
    assert.equal(await importRunCount(client), before + 1);
    assert.equal(ok.published, false);
    assert.equal(ok.snapshotCreated, false);

    const currentAfter = await getCurrentSnapshot(client);
    assert.equal(Number(currentAfter.version), Number(currentBefore.version));
    assert.deepEqual(currentAfter.envelope.services, currentBefore.envelope.services);

    const failed = await runFsdSync({
      db: client,
      csvText: "not,a,valid\n",
    }).catch((error) => error);
    assert.ok(failed instanceof Error || failed?.status === "failed" || (await importRunCount(client)) >= before + 2);
    assert.equal(await importRunCount(client), before + 2);
    const last = await client.query(
      `SELECT status, stats FROM import_runs WHERE source = 'fsd' ORDER BY started_at DESC LIMIT 1`
    );
    assert.ok(last.rows[0].stats);
    assert.ok(Object.hasOwn(last.rows[0].stats, "includedCount"));
  });
});

test("sync then approve then publish moves a change live and approval refreshes raw_import", async (t) => {
  await withSyncDatabase(t, async (client) => {
    const raw = fingerprintFromCsv(PORIRUA_FOOD);
    await insertFsdService(client, {
      csvRow: PORIRUA_FOOD,
      categories: ["food"],
      rawImport: { ...raw, categories: ["food"] },
    });
    await publishCatalog({ db: client, publishedBy: "seed", purge: async () => {} });
    const before = await getCurrentSnapshot(client);

    const withHealth = {
      ...PORIRUA_FOOD,
      LEVEL_1_CATEGORY: "Health",
    };
    const first = await runFsdSync({ db: client, csvText: fsdCsv([withHealth]) });
    assert.equal(first.stats.changed, 1);
    const queue = await client.query(
      `SELECT * FROM review_queue_items WHERE kind = 'changed' AND status = 'pending'`
    );
    assert.equal(queue.rowCount, 1);
    assert.deepEqual(queue.rows[0].proposed.before?.categories, ["food"]);

    await approveReviewItem({ db: client, queueItemId: queue.rows[0].id });
    const service = await client.query(`SELECT * FROM services WHERE fsd_service_id = '9001-line-a'`);
    assert.equal(service.rows[0].status, "published");
    assert.ok(service.rows[0].categories.includes("health"));
    assert.ok(service.rows[0].raw_import.categories.includes("health"));

    const published = await publishCatalog({ db: client, publishedBy: "editor", purge: async () => {} });
    assert.notEqual(Number(published.version), Number(before.version));
    const live = published.envelope.services.find((entry) => entry.id === "fsd-9001-line-a" || entry.services);
    const line =
      published.envelope.services.find((entry) => entry.id === "fsd-9001-line-a") ??
      published.envelope.services
        .flatMap((entry) => entry.services ?? [])
        .find((entry) => entry.id === "fsd-9001-line-a" || entry.lineId === "fsd-9001-line-a");
    assert.ok(line || live);
    const categories = line?.categories ?? live?.categories;
    assert.ok(categories.includes("health"));

    const second = await runFsdSync({ db: client, csvText: fsdCsv([withHealth]) });
    assert.equal(second.stats.changed, 0);
    assert.equal(second.stats.unchanged, 1);
    const pending = await client.query(
      `SELECT count(*)::int AS n FROM review_queue_items WHERE status = 'pending'`
    );
    assert.equal(pending.rows[0].n, 0);
  });
});

test("first real-feed sync after bootstrap is ~18 items, 17 category enrichments, Ngāti Toa locked", async (t) => {
  await withSyncDatabase(t, async (client) => {
    const dataDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../data");
    const envelope = JSON.parse(await fs.readFile(path.join(dataDir, "services.json"), "utf8"));
    const overrides = JSON.parse(await fs.readFile(path.join(dataDir, "overrides.json"), "utf8"));
    await bootstrapFromJson({ envelope, overrides, db: client });

    let csvText;
    try {
      const res = await fetch(FSD_CSV_URL, { signal: AbortSignal.timeout(45000) });
      if (!res.ok) {
        t.skip(`live FSD CSV not reachable (${res.status})`);
        return;
      }
      csvText = await res.text();
    } catch (error) {
      t.skip(`live FSD CSV not reachable (${error.message})`);
      return;
    }

    const result = await runFsdSync({ db: client, csvText, fsdCsvUrl: FSD_CSV_URL });
    assert.equal(result.status, "success");
    assert.equal(result.published, false);
    assert.equal(result.stats.collapsedCount, 162);

    const changed = result.items.filter((item) => item.kind === "changed");
    const unchanged = result.items.filter((item) => item.kind === "unchanged");
    const geocode = result.items.filter((item) => item.kind === "geocode_flag");
    const news = result.items.filter((item) => item.kind === "new");
    const removed = result.items.filter((item) => item.kind === "removed");
    if (changed.length === 162) {
      assert.fail("SERVICE_ID matching is broken: every FSD line was flagged changed");
    }
    if (changed.length === 0 && geocode.length === 0) {
      assert.fail("diff compared a record against itself instead of raw_import");
    }
    assert.equal(news.length, 0);
    assert.equal(removed.length, 0);
    // Simulation treated geocode-only rows as stable (~144). Live split: unchanged + geocode_flag.
    assert.ok(
      unchanged.length + geocode.length >= 140,
      `expected ~144 fingerprint-stable rows, got unchanged=${unchanged.length} geocode=${geocode.length}`
    );

    const rawRows = await client.query(
      `SELECT fsd_service_id, raw_import FROM services WHERE fsd_service_id = ANY($1)`,
      [changed.map((item) => item.serviceId)]
    );
    const rawById = new Map(rawRows.rows.map((row) => [row.fsd_service_id, row.raw_import]));
    const categoryOnly = changed.filter((item) => {
      if ((item.proposed.locked_fields ?? []).length) return false;
      const incoming = buildFsdFingerprint(item.proposed.after);
      const baseline = buildFsdFingerprint(rawById.get(item.serviceId));
      return Object.keys(incoming).every(
        (field) => field === "categories" || JSON.stringify(incoming[field]) === JSON.stringify(baseline[field])
      );
    });
    assert.ok(
      categoryOnly.length >= 15 && categoryOnly.length <= 20,
      `expected ~17 category enrichments, got ${categoryOnly.length}`
    );

    const work = changed.find((item) => item.serviceId === "17534");
    if (work) assert.ok(work.proposed.after.categories.includes("work"));
    const littleShadow = changed.find((item) => item.serviceId === "15904");
    if (littleShadow) assert.ok(littleShadow.proposed.after.categories.includes("health"));

    const oraToa = result.items.find((item) => item.serviceId === "2964");
    assert.ok(oraToa);
    if (oraToa.kind === "changed") {
      assert.ok((oraToa.proposed.locked_fields ?? []).includes("address"));
    }
    const queuedOra = result.queued.find((row) => row.entity_id === "fsd-2964");
    assert.ok(queuedOra, "three-way rule should queue the curated Ora Toa address conflict");
    const proposed = queuedOra.proposed ?? {};
    assert.ok((proposed.locked_fields ?? []).includes("address"));
    assert.ok((proposed.reviewable_fields ?? []).includes("address"));
    assert.ok(proposed.before && typeof proposed.before === "object");
    assert.ok(Object.keys(proposed.before).length > 0);
    assert.equal(result.queued.length, result.stats.queued);
  });
});

test("rejecting a new SERVICE_ID keeps it off the next snapshot and does not re-queue it as new", async (t) => {
  await withSyncDatabase(t, async (client) => {
    await runFsdSync({ db: client, csvText: fsdCsv([TITAHI_CLINIC]) });
    const queue = await client.query(
      `SELECT id FROM review_queue_items WHERE kind = 'new' AND status = 'pending'`
    );
    assert.equal(queue.rowCount, 1);
    await rejectReviewItem({ db: client, queueItemId: queue.rows[0].id });

    const service = await client.query(`SELECT status FROM services WHERE id = 'fsd-9003-clinic'`);
    assert.equal(service.rows[0].status, "hidden");
    const afterReject = await publishCatalog({
      db: client,
      publishedBy: "after-reject",
      purge: async () => {},
    });
    const afterRejectIds = snapshotServiceIds(afterReject.envelope);
    assert.equal(afterRejectIds.has("fsd-9003-clinic"), false);

    const second = await runFsdSync({ db: client, csvText: fsdCsv([TITAHI_CLINIC]) });
    assert.equal(second.stats.new, 0);
    const pendingNew = await client.query(
      `SELECT count(*)::int AS n FROM review_queue_items WHERE kind = 'new' AND status = 'pending'`
    );
    assert.equal(pendingNew.rows[0].n, 0);

    const afterSync = await publishCatalog({
      db: client,
      publishedBy: "after-second-sync",
      purge: async () => {},
    });
    const afterSyncIds = snapshotServiceIds(afterSync.envelope);
    assert.equal(afterSyncIds.has("fsd-9003-clinic"), false);
  });
});

test("approving a new SERVICE_ID publishes its draft organization into the snapshot", async (t) => {
  await withSyncDatabase(t, async (client) => {
    await runFsdSync({ db: client, csvText: fsdCsv([TITAHI_CLINIC]) });
    const orgBefore = await client.query(`SELECT status FROM organizations WHERE id = 'fsd-9003-clinic'`);
    assert.equal(orgBefore.rows[0].status, "draft");
    const queue = await client.query(`SELECT id, proposed FROM review_queue_items WHERE kind = 'new'`);
    assert.equal(queue.rows[0].proposed.before == null || Object.keys(queue.rows[0].proposed.before).length === 0, true);
    await approveReviewItem({ db: client, queueItemId: queue.rows[0].id });
    const orgAfter = await client.query(`SELECT status FROM organizations WHERE id = 'fsd-9003-clinic'`);
    assert.equal(orgAfter.rows[0].status, "published");
    const published = await publishCatalog({ db: client, publishedBy: "editor", purge: async () => {} });
    const found = published.envelope.services.some(
      (entry) =>
        entry.id === "fsd-9003-clinic" ||
        (entry.services ?? []).some((line) => line.id === "fsd-9003-clinic" || line.lineId === "fsd-9003-clinic")
    );
    assert.equal(found, true);
  });
});

test("a new SERVICE_ID seeds raw_import so the next week is unchanged, not missing_raw_import", async (t) => {
  await withSyncDatabase(t, async (client) => {
    await runFsdSync({ db: client, csvText: fsdCsv([TITAHI_CLINIC]) });
    const first = await client.query(`SELECT raw_import FROM services WHERE fsd_service_id = '9003-clinic'`);
    assert.ok(first.rows[0].raw_import);
    assert.notEqual(first.rows[0].raw_import, null);

    const second = await runFsdSync({ db: client, csvText: fsdCsv([TITAHI_CLINIC]) });
    const changed = second.items.filter((item) => item.kind === "changed");
    assert.equal(changed.length, 0);
    assert.equal(second.stats.unchanged, 1);
    assert.ok(!changed.some((item) => item.proposed?.missing_raw_import));
    const pending = await client.query(
      `SELECT kind, count(*)::int AS n FROM review_queue_items WHERE status = 'pending' GROUP BY kind`
    );
    assert.equal(pending.rows.length, 1);
    assert.equal(pending.rows[0].kind, "new");
    assert.equal(pending.rows[0].n, 1);
  });
});

test("decideQueueWrite refreshes one pending row and skips a ruled-on geocode code", () => {
  assert.equal(decideQueueWrite({ kind: "changed" }, { pending: { id: "q1" } }), "refresh");
  assert.equal(decideQueueWrite({ kind: "changed" }, { pending: null }), "insert");
  assert.equal(
    decideQueueWrite(
      { kind: "geocode_flag", proposed: { geocode_flag: { code: GEOCODE_QA_REASON.GEOCODE_IN_MARINE_BBOX } } },
      { pending: { id: "q1" } }
    ),
    "refresh"
  );
  assert.equal(
    decideQueueWrite(
      { kind: "geocode_flag", proposed: { geocode_flag: { code: GEOCODE_QA_REASON.GEOCODE_IN_MARINE_BBOX } } },
      { pending: null, ruledGeocodeCodes: new Set([GEOCODE_QA_REASON.GEOCODE_IN_MARINE_BBOX]) }
    ),
    "skip"
  );
  assert.equal(
    decideQueueWrite(
      {
        kind: "geocode_flag",
        proposed: { geocode_flag: { code: GEOCODE_QA_REASON.GEOCODE_OUTSIDE_PORIRUA_BOUNDS } },
      },
      { pending: null, ruledGeocodeCodes: new Set([GEOCODE_QA_REASON.GEOCODE_IN_MARINE_BBOX]) }
    ),
    "insert"
  );
});

test("two syncs over unchanged data leave one pending item per entity and kind", async (t) => {
  await withSyncDatabase(t, async (client) => {
    const raw = fingerprintFromCsv(PORIRUA_FOOD);
    await insertFsdService(client, {
      csvRow: PORIRUA_FOOD,
      description: "Last accepted food text",
      rawImport: { ...raw, description: "Last accepted food text" },
    });
    await insertFsdService(client, { csvRow: MARINE_PIN });
    const incoming = { ...PORIRUA_FOOD, SERVICE_DETAIL: "Updated food help from FSD" };
    const csv = fsdCsv([incoming, MARINE_PIN]);

    const first = await runFsdSync({ db: client, csvText: csv });
    assert.equal(first.stats.changed, 1);
    assert.equal(first.stats.geocode_flag, 1);

    const second = await runFsdSync({ db: client, csvText: csv });
    assert.equal(second.stats.changed, 1);
    assert.equal(second.stats.geocode_flag, 1);

    const pending = await client.query(
      `SELECT entity_id, kind, count(*)::int AS n
         FROM review_queue_items
        WHERE status = 'pending'
        GROUP BY entity_id, kind
        ORDER BY entity_id, kind`
    );
    assert.deepEqual(
      pending.rows.map((row) => ({ entity_id: row.entity_id, kind: row.kind, n: row.n })),
      [
        { entity_id: "fsd-9001-line-a", kind: "changed", n: 1 },
        { entity_id: "fsd-9004-marine", kind: "geocode_flag", n: 1 },
      ]
    );
    const total = await client.query(`SELECT count(*)::int AS n FROM review_queue_items`);
    assert.equal(total.rows[0].n, 2);
  });
});

test("a rejected geocode flag of the same code is not raised again", async (t) => {
  await withSyncDatabase(t, async (client) => {
    await insertFsdService(client, { csvRow: MARINE_PIN });
    const first = await runFsdSync({ db: client, csvText: fsdCsv([MARINE_PIN]) });
    assert.equal(first.stats.geocode_flag, 1);
    const queue = await client.query(
      `SELECT * FROM review_queue_items WHERE kind = 'geocode_flag' AND status = 'pending'`
    );
    assert.equal(queue.rowCount, 1);
    assert.equal(queue.rows[0].proposed.geocode_flag.code, GEOCODE_QA_REASON.GEOCODE_IN_MARINE_BBOX);

    await rejectReviewItem({ db: client, queueItemId: queue.rows[0].id });
    const afterReject = await client.query(`SELECT status FROM review_queue_items WHERE id = $1`, [
      queue.rows[0].id,
    ]);
    assert.equal(afterReject.rows[0].status, "rejected");

    const second = await runFsdSync({ db: client, csvText: fsdCsv([MARINE_PIN]) });
    const pending = await client.query(
      `SELECT * FROM review_queue_items WHERE kind = 'geocode_flag' AND status = 'pending'`
    );
    assert.equal(pending.rowCount, 0);
    assert.equal(
      second.queued.filter((row) => row.kind === "geocode_flag").length,
      0
    );
    const allFlags = await client.query(`SELECT status FROM review_queue_items WHERE kind = 'geocode_flag'`);
    assert.equal(allFlags.rowCount, 1);
    assert.equal(allFlags.rows[0].status, "rejected");
  });
});
