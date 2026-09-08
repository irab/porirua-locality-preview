/**
 * Bootstrap the catalog tables from committed services.json + overrides.json.
 */

import fs from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { OVERRIDES_JSON, SERVICES_JSON } from "./config.mjs";
import { catalogToRows } from "./catalog-rows.mjs";
import { prepareBootstrapRows } from "./lib/catalog-bootstrap.mjs";
import { applySchema, closePool, getPool, withTransaction } from "./lib/db.mjs";

/** Stable id so a second bootstrap does not add another import_runs row. */
export const BOOTSTRAP_IMPORT_RUN_ID = "00000000-0000-4000-8000-000000000001";

export function overrideRowId(row) {
  return `${row.target_type}:${row.target_id}:${row.action}`;
}

function asJson(value) {
  return value == null ? null : JSON.stringify(value);
}

async function upsertOrganization(db, org) {
  await db.query(
    `INSERT INTO organizations (
       id, public_id, render_grain, name, description, phone, url, email,
       address, lat, lng, org_type, community_filters, community_meta,
       source_primary, status, duplicate_of, merged_into, merge_reason,
       cluster_key, sort_key, published_at, updated_at
     ) VALUES (
       $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14::jsonb,$15,$16,$17,$18,$19,$20,$21,
       CASE WHEN $16 = 'published' THEN now() ELSE NULL END,
       now()
     )
     ON CONFLICT (id) DO UPDATE SET
       public_id = EXCLUDED.public_id,
       render_grain = EXCLUDED.render_grain,
       name = EXCLUDED.name,
       description = EXCLUDED.description,
       phone = EXCLUDED.phone,
       url = EXCLUDED.url,
       email = EXCLUDED.email,
       address = EXCLUDED.address,
       lat = EXCLUDED.lat,
       lng = EXCLUDED.lng,
       org_type = EXCLUDED.org_type,
       community_filters = EXCLUDED.community_filters,
       community_meta = EXCLUDED.community_meta,
       source_primary = EXCLUDED.source_primary,
       status = EXCLUDED.status,
       duplicate_of = EXCLUDED.duplicate_of,
       merged_into = EXCLUDED.merged_into,
       merge_reason = EXCLUDED.merge_reason,
       cluster_key = EXCLUDED.cluster_key,
       sort_key = EXCLUDED.sort_key,
       updated_at = now()`,
    [
      org.id,
      org.public_id,
      org.render_grain,
      org.name ?? "",
      org.description ?? "",
      org.phone ?? "",
      org.url ?? "",
      org.email ?? "",
      org.address ?? "",
      org.lat ?? null,
      org.lng ?? null,
      org.org_type ?? "",
      asJson(org.community_filters ?? []),
      asJson(org.community_meta),
      org.source_primary ?? "",
      org.status ?? "published",
      org.duplicate_of ?? null,
      org.merged_into ?? null,
      org.merge_reason ?? null,
      org.cluster_key,
      org.sort_key ?? 0,
    ]
  );
}

async function upsertService(db, service) {
  await db.query(
    `INSERT INTO services (
       id, organization_id, line_id, title, service_name, description,
       phone, url, address, lat, lng, categories, badges, source,
       fsd_service_id, fsd_legacy_id, status, duplicate_of, raw_import, sort_key,
       updated_at
     ) VALUES (
       $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13::jsonb,$14,$15,$16,$17,$18,$19::jsonb,$20, now()
     )
     ON CONFLICT (id) DO UPDATE SET
       organization_id = EXCLUDED.organization_id,
       line_id = EXCLUDED.line_id,
       title = EXCLUDED.title,
       service_name = EXCLUDED.service_name,
       description = EXCLUDED.description,
       phone = EXCLUDED.phone,
       url = EXCLUDED.url,
       address = EXCLUDED.address,
       lat = EXCLUDED.lat,
       lng = EXCLUDED.lng,
       categories = EXCLUDED.categories,
       badges = EXCLUDED.badges,
       source = EXCLUDED.source,
       fsd_service_id = EXCLUDED.fsd_service_id,
       fsd_legacy_id = EXCLUDED.fsd_legacy_id,
       status = EXCLUDED.status,
       duplicate_of = EXCLUDED.duplicate_of,
       raw_import = EXCLUDED.raw_import,
       sort_key = EXCLUDED.sort_key,
       updated_at = now()`,
    [
      service.id,
      service.organization_id,
      service.line_id,
      service.title ?? "",
      service.service_name ?? "",
      service.description ?? "",
      service.phone ?? "",
      service.url ?? "",
      service.address ?? "",
      service.lat ?? null,
      service.lng ?? null,
      asJson(service.categories ?? []),
      asJson(service.badges ?? []),
      service.source ?? "",
      service.fsd_service_id ?? null,
      service.fsd_legacy_id ?? null,
      service.status ?? "published",
      service.duplicate_of ?? null,
      asJson(service.raw_import),
      service.sort_key ?? 0,
    ]
  );
}

async function upsertOverride(db, row) {
  const id = overrideRowId(row);
  await db.query(
    `INSERT INTO overrides (id, target_type, target_id, action, patch, reason, status)
     VALUES ($1,$2,$3,$4,$5::jsonb,$6,'open')
     ON CONFLICT (id) DO UPDATE SET
       patch = EXCLUDED.patch,
       reason = EXCLUDED.reason,
       status = EXCLUDED.status`,
    [
      id,
      row.target_type,
      row.target_id,
      row.action,
      asJson(row.patch),
      row.reason ?? null,
    ]
  );
}

async function upsertBootstrapRun(db, counts) {
  await db.query(
    `INSERT INTO import_runs (id, source, status, finished_at, stats, notes)
     VALUES ($1, 'json-bootstrap', 'success', now(), $2::jsonb, $3)
     ON CONFLICT (id) DO UPDATE SET
       status = 'success',
       finished_at = now(),
       stats = EXCLUDED.stats,
       notes = EXCLUDED.notes`,
    [
      BOOTSTRAP_IMPORT_RUN_ID,
      asJson(counts),
      // community/fsd/duplicatesHidden must come from import_runs stats once
      // the weekly sync task lands, rather than staying frozen on this bootstrap row.
      "Source-size counts copied from the committed envelope; replace from weekly sync import_runs.stats once that job lands.",
    ]
  );
}

export async function persistCatalogRows(db, { organizations, services, overrides, counts }) {
  for (const organization of organizations) {
    await upsertOrganization(db, organization);
  }
  for (const service of services) {
    await upsertService(db, service);
  }
  for (const row of overrides ?? []) {
    await upsertOverride(db, row);
  }
  if (counts) await upsertBootstrapRun(db, counts);
}

export function rowsFromEnvelope(envelope, overrides = {}) {
  const mapped = catalogToRows(envelope, overrides);
  const prepared = prepareBootstrapRows(mapped.organizations, mapped.services);
  return {
    organizations: prepared.organizations,
    services: prepared.services,
    overrides: mapped.overrides,
    counts: mapped.counts,
  };
}

export async function bootstrapFromJson({ envelope, overrides = {}, db } = {}) {
  const rows = rowsFromEnvelope(envelope, overrides);
  await withTransaction(async (tx) => {
    await persistCatalogRows(tx, rows);
  }, db);
  return rows;
}

export async function loadCommittedCatalog() {
  const envelope = JSON.parse(await fs.readFile(SERVICES_JSON, "utf8"));
  const overrides = JSON.parse(await fs.readFile(OVERRIDES_JSON, "utf8"));
  return { envelope, overrides };
}

export async function bootstrapFromCommittedFiles(db) {
  const { envelope, overrides } = await loadCommittedCatalog();
  return bootstrapFromJson({ envelope, overrides, db });
}

async function ensureSchema(db) {
  const result = await db.query(`SELECT to_regclass('public.organizations') AS name`);
  if (!result.rows[0]?.name) await applySchema(db);
}

async function main() {
  const pool = getPool();
  try {
    await ensureSchema(pool);
    const rows = await bootstrapFromCommittedFiles(pool);
    console.log(
      JSON.stringify({
        organizations: rows.organizations.length,
        services: rows.services.length,
        overrides: rows.overrides.length,
        counts: rows.counts,
      })
    );
  } finally {
    await closePool();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
