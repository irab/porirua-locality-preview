/**
 * Materialise a published catalog snapshot and flip is_current atomically.
 */

import { pathToFileURL } from "node:url";
import { buildCatalogEnvelope } from "./catalog-envelope.mjs";
import {
  applySchema,
  closePool,
  getPool,
  mapOrganizationRow,
  mapServiceRow,
  withTransaction,
} from "./lib/db.mjs";

export function isSnapshotOrganization(organization) {
  return (
    organization.status === "published" &&
    !organization.merged_into &&
    !organization.duplicate_of
  );
}

export function isSnapshotService(service) {
  return service.status === "published" && !service.duplicate_of;
}

export function rowsForSnapshot(organizations = [], services = []) {
  const publishedOrgs = organizations.filter(isSnapshotOrganization);
  const publishedIds = new Set(publishedOrgs.map((org) => org.id));
  const publishedServices = services.filter(
    (service) => isSnapshotService(service) && publishedIds.has(service.organization_id)
  );
  const orgsWithLines = publishedOrgs.filter((org) =>
    publishedServices.some((service) => service.organization_id === org.id)
  );
  return { organizations: orgsWithLines, services: publishedServices };
}

export async function loadPublishedRows(db) {
  const orgs = await db.query(
    `SELECT * FROM organizations
      WHERE status = 'published'
        AND merged_into IS NULL
        AND duplicate_of IS NULL
      ORDER BY sort_key, id`
  );
  const services = await db.query(
    `SELECT * FROM services
      WHERE status = 'published'
        AND duplicate_of IS NULL
      ORDER BY sort_key, id`
  );
  return rowsForSnapshot(orgs.rows.map(mapOrganizationRow), services.rows.map(mapServiceRow));
}

export async function loadSourceCounts(db) {
  const result = await db.query(
    `SELECT stats
       FROM import_runs
      WHERE stats ? 'community'
      ORDER BY started_at DESC
      LIMIT 1`
  );
  const stats = result.rows[0]?.stats ?? {};
  return {
    community: stats.community,
    fsd: stats.fsd,
    duplicatesHidden: stats.duplicatesHidden,
  };
}

export async function getCurrentSnapshot(db) {
  const result = await db.query(
    `SELECT version, envelope, counts, generated_at, published_by, is_current
       FROM catalog_snapshots
      WHERE is_current
      LIMIT 1`
  );
  return result.rows[0] ?? null;
}

async function insertCurrentSnapshot(tx, envelope, publishedBy) {
  await tx.query(`UPDATE catalog_snapshots SET is_current = false WHERE is_current`);
  const inserted = await tx.query(
    `INSERT INTO catalog_snapshots (envelope, counts, generated_at, published_by, is_current)
     VALUES ($1::jsonb, $2::jsonb, $3, $4, true)
     RETURNING version`,
    [JSON.stringify(envelope), JSON.stringify(envelope.counts), envelope.generatedAt, publishedBy ?? null]
  );
  return Number(inserted.rows[0].version);
}

export async function publishCatalog({ db, publishedBy } = {}) {
  const executor = db ?? getPool();
  const rows = await loadPublishedRows(executor);
  const counts = await loadSourceCounts(executor);
  const envelope = buildCatalogEnvelope({ ...rows, counts });
  const version = await withTransaction(
    (tx) => insertCurrentSnapshot(tx, envelope, publishedBy),
    db
  );
  return { version, envelope };
}

export async function rollbackCatalog({ db, version, publishedBy } = {}) {
  if (version == null) throw new Error("rollback requires a snapshot version");
  return withTransaction(async (tx) => {
    const found = await tx.query(
      `SELECT version, envelope FROM catalog_snapshots WHERE version = $1`,
      [version]
    );
    if (found.rowCount === 0) {
      throw new Error(`catalog snapshot version ${version} not found`);
    }
    await tx.query(`UPDATE catalog_snapshots SET is_current = false WHERE is_current`);
    await tx.query(
      `UPDATE catalog_snapshots
          SET is_current = true, published_by = COALESCE($2, published_by)
        WHERE version = $1`,
      [version, publishedBy ?? null]
    );
    return {
      version: Number(found.rows[0].version),
      envelope: found.rows[0].envelope,
    };
  }, db);
}

async function ensureSchema(db) {
  const result = await db.query(`SELECT to_regclass('public.organizations') AS name`);
  if (!result.rows[0]?.name) await applySchema(db);
}

async function main() {
  const args = process.argv.slice(2);
  const rollbackIdx = args.indexOf("--rollback");
  const pool = getPool();
  try {
    await ensureSchema(pool);
    if (rollbackIdx !== -1) {
      const version = Number(args[rollbackIdx + 1]);
      const result = await rollbackCatalog({ db: pool, version });
      console.log(JSON.stringify({ action: "rollback", version: result.version, counts: result.envelope.counts }));
      return;
    }
    const result = await publishCatalog({ db: pool, publishedBy: process.env.USER || "cli" });
    console.log(JSON.stringify({ action: "publish", version: result.version, counts: result.envelope.counts }));
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
