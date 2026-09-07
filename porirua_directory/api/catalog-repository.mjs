/**
 * Read-only access to catalog_snapshots through the pooled db client.
 * Does not rebuild envelopes or touch organizations/services rows.
 */

import { getPool } from "../scripts/lib/db.mjs";

const SNAPSHOT_COLUMNS =
  "version, envelope, counts, generated_at, published_by, is_current";

function mapSnapshot(row) {
  if (!row) return null;
  return {
    version: Number(row.version),
    envelope: row.envelope,
    counts: row.counts,
    generatedAt: row.generated_at,
    publishedBy: row.published_by,
    isCurrent: row.is_current,
  };
}

export function createCatalogRepository(db = null) {
  const executor = () => db ?? getPool();

  return {
    async getCurrent() {
      const result = await executor().query(
        `SELECT ${SNAPSHOT_COLUMNS}
           FROM catalog_snapshots
          WHERE is_current
          LIMIT 1`
      );
      return mapSnapshot(result.rows[0]);
    },

    async getByVersion(version) {
      const result = await executor().query(
        `SELECT ${SNAPSHOT_COLUMNS}
           FROM catalog_snapshots
          WHERE version = $1`,
        [version]
      );
      return mapSnapshot(result.rows[0]);
    },

    async ping() {
      await executor().query("SELECT 1");
    },
  };
}
