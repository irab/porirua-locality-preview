export async function recordPublicIdAlias({
  db,
  oldPublicId,
  newPublicId,
  entityType = "organization",
} = {}) {
  if (!db) throw new Error("recordPublicIdAlias requires db");
  if (!oldPublicId || !newPublicId || oldPublicId === newPublicId) return null;
  const result = await db.query(
    `INSERT INTO public_id_aliases (old_public_id, new_public_id, entity_type)
     VALUES ($1, $2, $3)
     ON CONFLICT (old_public_id)
     DO UPDATE SET new_public_id = EXCLUDED.new_public_id
     RETURNING old_public_id, new_public_id, entity_type`,
    [oldPublicId, newPublicId, entityType]
  );
  return result.rows[0];
}
