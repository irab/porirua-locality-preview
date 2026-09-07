import { randomUUID } from "node:crypto";
import { withTransaction } from "./lib/db.mjs";
import { proposalFingerprint } from "../editor-core/proposal-fingerprint.mjs";

async function loadQueueItem(db, queueItemId) {
  const result = await db.query(`SELECT * FROM review_queue_items WHERE id = $1`, [queueItemId]);
  if (result.rowCount === 0) throw new Error(`review queue item ${queueItemId} not found`);
  return result.rows[0];
}

async function loadUndoSnapshot(db, queueItemId) {
  const queueItem = await loadQueueItem(db, queueItemId);
  const service = await db.query(`SELECT * FROM services WHERE id = $1`, [queueItem.entity_id]);
  const organizationId = service.rows[0]?.organization_id;
  const organization = organizationId
    ? await db.query(`SELECT * FROM organizations WHERE id = $1`, [organizationId])
    : { rows: [] };
  const overrides = await db.query(
    `SELECT * FROM overrides WHERE target_id = ANY($1::text[])`,
    [[queueItem.entity_id, organizationId].filter(Boolean)]
  );
  return {
    queueItem,
    service: service.rows[0] ?? null,
    organization: organization.rows[0] ?? null,
    overrides: overrides.rows,
  };
}

export async function recordReviewUndo(db, snapshot, action) {
  const id = randomUUID();
  await db.query(`DELETE FROM editor_undo`);
  await db.query(`INSERT INTO editor_undo (id, action, snapshot) VALUES ($1, $2, $3::jsonb)`, [
    id,
    action,
    JSON.stringify(snapshot),
  ]);
  return id;
}

const GENERATED_COLUMNS = new Set(["change_summary"]);

async function restoreRow(tx, table, row) {
  if (!row) return;
  const columns = Object.keys(row).filter((column) => !GENERATED_COLUMNS.has(column));
  const values = columns.map((column) => row[column]);
  const placeholders = columns.map((_, index) => `$${index + 1}`);
  const updates = columns
    .filter((column) => column !== "id")
    .map((column, index) => `${column} = $${index + 2}`);
  await tx.query(
    `INSERT INTO ${table} (${columns.join(", ")})
     VALUES (${placeholders.join(", ")})
     ON CONFLICT (id) DO UPDATE SET ${updates.join(", ")}`,
    values
  );
}

export async function undoReviewDecision({ db, undoId } = {}) {
  if (!db) throw new Error("undoReviewDecision requires db");
  if (!undoId) throw new Error("undoReviewDecision requires undoId");
  return withTransaction(async (tx) => {
    const found = await tx.query(`SELECT * FROM editor_undo WHERE id = $1`, [undoId]);
    if (found.rowCount === 0) throw new Error("Nothing to undo");
    const snapshot = found.rows[0].snapshot;
    const queueItem = snapshot.queueItem;
    const targets = [snapshot.service?.id, snapshot.organization?.id].filter(Boolean);
    if (targets.length) {
      await tx.query(`DELETE FROM overrides WHERE target_id = ANY($1::text[])`, [targets]);
    }
    await restoreRow(tx, "organizations", snapshot.organization);
    await restoreRow(tx, "services", snapshot.service);
    for (const override of snapshot.overrides ?? []) {
      await restoreRow(tx, "overrides", override);
    }
    await restoreRow(tx, "review_queue_items", queueItem);
    await tx.query(`DELETE FROM editor_undo WHERE id = $1`, [undoId]);
    return { ok: true, queueItemId: queueItem.id };
  }, db);
}

export async function deferQueueItem({ db, queueItemId } = {}) {
  if (!db) throw new Error("deferQueueItem requires db");
  if (!queueItemId) throw new Error("deferQueueItem requires queueItemId");
  return withTransaction(async (tx) => {
    const snapshot = await loadUndoSnapshot(tx, queueItemId);
    const item = snapshot.queueItem;
    if (item.status !== "pending") throw new Error("Only a pending item can be marked Needs confirmation");
    const proposed = item.proposed && typeof item.proposed === "object" ? { ...item.proposed } : {};
    proposed.deferred_at = new Date().toISOString();
    proposed.deferred_fingerprint = proposalFingerprint({ kind: item.kind, proposed });
    delete proposed.changed_since_deferred;
    await tx.query(
      `UPDATE review_queue_items SET proposed = $2::jsonb, updated_at = now() WHERE id = $1`,
      [queueItemId, JSON.stringify(proposed)]
    );
    const undoId = await recordReviewUndo(tx, snapshot, "defer");
    return { ok: true, queueItemId, deferred: true, undoId };
  }, db);
}

export async function keepAsCommunityReviewItem({ db, queueItemId, createdBy } = {}) {
  if (!db) throw new Error("keepAsCommunityReviewItem requires db");
  if (!queueItemId) throw new Error("keepAsCommunityReviewItem requires queueItemId");
  return withTransaction(async (tx) => {
    const snapshot = await loadUndoSnapshot(tx, queueItemId);
    const item = snapshot.queueItem;
    if (item.kind !== "removed") {
      throw new Error("Keep as community only applies to a removal");
    }
    await tx.query(
      `INSERT INTO overrides (id, target_type, target_id, action, patch, status, created_by)
       VALUES ($1, 'service', $2, 'community_owned', $3::jsonb, 'open', $4)
       ON CONFLICT (target_type, target_id, action)
       DO UPDATE SET status = 'open', patch = EXCLUDED.patch`,
      [
        `community_owned:service:${item.entity_id}`,
        item.entity_id,
        JSON.stringify({ awaiting_return: true }),
        createdBy ?? null,
      ]
    );
    if (snapshot.service?.status === "pending_review") {
      await tx.query(`UPDATE services SET status = 'published', updated_at = now() WHERE id = $1`, [
        item.entity_id,
      ]);
    }
    await tx.query(
      `UPDATE review_queue_items SET status = 'accepted', updated_at = now() WHERE id = $1`,
      [queueItemId]
    );
    const undoId = await recordReviewUndo(tx, snapshot, "keep-community");
    return { ok: true, queueItemId, entityId: item.entity_id, communityOwned: true, undoId };
  }, db);
}

export async function wrapReviewUndo(db, queueItemId, action, fn) {
  const snapshot = await loadUndoSnapshot(db, queueItemId);
  const result = await fn();
  const undoId = await recordReviewUndo(db, snapshot, action);
  return { ...result, undoId };
}

export async function closeCommunityOwned(db, serviceId) {
  await db.query(
    `UPDATE overrides
        SET status = 'closed'
      WHERE target_type = 'service' AND target_id = $1 AND action = 'community_owned' AND status = 'open'`,
    [serviceId]
  );
}

export async function markCommunityOwnedRuledOn(db, serviceId) {
  await db.query(
    `UPDATE overrides
        SET patch = COALESCE(patch, '{}'::jsonb) || '{"awaiting_return": false}'::jsonb
      WHERE target_type = 'service' AND target_id = $1 AND action = 'community_owned' AND status = 'open'`,
    [serviceId]
  );
}
