export async function recordCatalogPublishEvent(
  db,
  { action, snapshotVersion, previousVersion, actor } = {}
) {
  if (!db) throw new Error("recordCatalogPublishEvent requires db");
  await db.query(
    `INSERT INTO catalog_publish_events (action, snapshot_version, previous_version, actor)
     VALUES ($1, $2, $3, $4)`,
    [action, snapshotVersion, previousVersion ?? null, actor ?? null]
  );
}

export async function loadLatestPublishEvent(db) {
  if (!db) throw new Error("loadLatestPublishEvent requires db");
  const result = await db.query(
    `SELECT action, snapshot_version, previous_version, actor, created_at
       FROM catalog_publish_events
      ORDER BY created_at DESC, id DESC
      LIMIT 1`
  );
  return result.rows[0] ?? null;
}

export function lastEventForAvailability(row) {
  if (!row) return null;
  return {
    action: row.action,
    snapshotVersion: row.snapshot_version,
    previousVersion: row.previous_version,
    createdAt: row.created_at,
  };
}
