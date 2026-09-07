/**
 * Review-queue decisions. Approve must refresh raw_import or the weekly
 * sync will silently re-queue the same change.
 */

import { randomUUID } from "node:crypto";
import { withTransaction } from "../lib/db.mjs";

const SERVICE_FIELDS = [
  "address",
  "phone",
  "lat",
  "lng",
  "description",
  "title",
  "service_name",
  "url",
];

async function loadQueueItem(db, queueItemId) {
  const result = await db.query(`SELECT * FROM review_queue_items WHERE id = $1`, [queueItemId]);
  if (result.rowCount === 0) throw new Error(`review queue item ${queueItemId} not found`);
  return result.rows[0];
}

function acceptedRecord(item, payload) {
  const proposed = item.proposed && typeof item.proposed === "object" ? item.proposed : {};
  const after = proposed.after && typeof proposed.after === "object" ? proposed.after : {};
  return { ...after, ...(payload ?? {}) };
}

async function applyServiceRecord(tx, entityId, accepted) {
  const service = await tx.query(`SELECT * FROM services WHERE id = $1`, [entityId]);
  if (service.rowCount === 0) throw new Error(`service ${entityId} not found`);
  const current = service.rows[0];
  const rawImport = {
    ...(current.raw_import && typeof current.raw_import === "object" ? current.raw_import : {}),
    ...accepted,
  };
  if (!rawImport || Object.keys(rawImport).length === 0) {
    throw new Error("approve requires a raw_import refresh of the accepted record");
  }

  const sets = ["status = 'published'", "raw_import = $2::jsonb", "updated_at = now()"];
  const values = [entityId, JSON.stringify(rawImport)];
  for (const field of SERVICE_FIELDS) {
    if (!Object.hasOwn(accepted, field)) continue;
    values.push(accepted[field]);
    sets.push(`${field} = $${values.length}`);
  }
  await tx.query(`UPDATE services SET ${sets.join(", ")} WHERE id = $1`, values);

  if (Object.hasOwn(accepted, "name") && current.organization_id) {
    await tx.query(`UPDATE organizations SET name = $2, updated_at = now() WHERE id = $1`, [
      current.organization_id,
      accepted.name,
    ]);
  }

  const written = await tx.query(`SELECT raw_import, status FROM services WHERE id = $1`, [entityId]);
  if (!written.rows[0]?.raw_import) {
    throw new Error("approve failed: raw_import was not refreshed");
  }
  return written.rows[0];
}

async function markQueue(tx, queueItemId, status) {
  await tx.query(
    `UPDATE review_queue_items SET status = $2, updated_at = now() WHERE id = $1`,
    [queueItemId, status]
  );
}

export async function approveReviewItem({ db, queueItemId, payload } = {}) {
  if (!db) throw new Error("approveReviewItem requires db");
  if (!queueItemId) throw new Error("approveReviewItem requires queueItemId");
  return withTransaction(async (tx) => {
    const item = await loadQueueItem(tx, queueItemId);
    const accepted = acceptedRecord(item, payload);
    if (item.entity_type !== "service") {
      throw new Error(`approve does not yet handle entity_type=${item.entity_type}`);
    }
    await applyServiceRecord(tx, item.entity_id, accepted);
    await markQueue(tx, queueItemId, "accepted");
    return { queueItemId, entityId: item.entity_id, accepted };
  }, db);
}

export async function editAndApproveReviewItem(options) {
  return approveReviewItem(options);
}

export async function hideReviewItem({ db, queueItemId, createdBy } = {}) {
  if (!db) throw new Error("hideReviewItem requires db");
  return withTransaction(async (tx) => {
    const item = await loadQueueItem(tx, queueItemId);
    await tx.query(
      `UPDATE services SET status = 'hidden', updated_at = now() WHERE id = $1`,
      [item.entity_id]
    );
    await tx.query(
      `INSERT INTO overrides (id, target_type, target_id, action, patch, status, created_by)
       VALUES ($1, $2, $3, 'hide', NULL, 'open', $4)
       ON CONFLICT (target_type, target_id, action)
       DO UPDATE SET status = 'open'`,
      [`hide:${item.entity_type}:${item.entity_id}`, item.entity_type, item.entity_id, createdBy ?? null]
    );
    await markQueue(tx, queueItemId, "accepted");
    return { queueItemId, entityId: item.entity_id };
  }, db);
}

export async function rejectReviewItem({ db, queueItemId } = {}) {
  if (!db) throw new Error("rejectReviewItem requires db");
  return withTransaction(async (tx) => {
    const item = await loadQueueItem(tx, queueItemId);
    const service = await tx.query(`SELECT * FROM services WHERE id = $1`, [item.entity_id]);
    if (service.rowCount === 0) throw new Error(`service ${item.entity_id} not found`);
    const raw = service.rows[0].raw_import && typeof service.rows[0].raw_import === "object"
      ? service.rows[0].raw_import
      : {};
    const sets = ["status = 'published'", "updated_at = now()"];
    const values = [item.entity_id];
    for (const field of SERVICE_FIELDS) {
      if (!Object.hasOwn(raw, field)) continue;
      values.push(raw[field]);
      sets.push(`${field} = $${values.length}`);
    }
    await tx.query(`UPDATE services SET ${sets.join(", ")} WHERE id = $1`, values);
    if (Object.hasOwn(raw, "name") && service.rows[0].organization_id) {
      await tx.query(`UPDATE organizations SET name = $2, updated_at = now() WHERE id = $1`, [
        service.rows[0].organization_id,
        raw.name,
      ]);
    }
    await markQueue(tx, queueItemId, "rejected");
    return { queueItemId, entityId: item.entity_id };
  }, db);
}

export function newOverrideId(prefix) {
  return `${prefix}:${randomUUID()}`;
}
