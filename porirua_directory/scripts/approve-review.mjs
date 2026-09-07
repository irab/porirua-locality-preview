/**
 * Shared review-queue decisions for the weekly FSD runner and Directus.
 * Approve must refresh raw_import or the next sync silently re-queues the change.
 *
 * Canonical export: approveReviewItem
 * Import: `porirua_directory/scripts/approve-review.mjs`
 */

import path from "node:path";
import { pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";
import { closePool, getPool, withTransaction } from "./lib/db.mjs";

const SERVICE_COLUMNS = [
  "description",
  "phone",
  "url",
  "address",
  "lat",
  "lng",
  "categories",
];

function proposedAfter(item) {
  const proposed = item.proposed && typeof item.proposed === "object" ? item.proposed : {};
  const after = proposed.after && typeof proposed.after === "object" ? proposed.after : {};
  return after;
}

function rawImportFromAccepted(currentRaw, accepted) {
  const previous = currentRaw && typeof currentRaw === "object" ? currentRaw : {};
  return {
    ...previous,
    name: accepted.name ?? previous.name ?? "",
    serviceName: accepted.serviceName ?? previous.serviceName ?? "",
    description: accepted.description ?? previous.description ?? "",
    phone: accepted.phone ?? previous.phone ?? "",
    url: accepted.url ?? previous.url ?? "",
    address: accepted.address ?? previous.address ?? "",
    lat: accepted.lat ?? previous.lat ?? null,
    lng: accepted.lng ?? previous.lng ?? null,
    categories: accepted.categories ?? previous.categories ?? [],
    fsd_service_id: accepted.fsd_service_id ?? accepted.SERVICE_ID ?? previous.fsd_service_id ?? null,
    fsd_legacy_id: accepted.fsd_legacy_id ?? accepted.FSD_ID ?? previous.fsd_legacy_id ?? null,
  };
}

async function loadQueueItem(db, queueItemId) {
  const result = await db.query(`SELECT * FROM review_queue_items WHERE id = $1`, [queueItemId]);
  if (result.rowCount === 0) throw new Error(`review queue item ${queueItemId} not found`);
  return result.rows[0];
}

async function applyAcceptedService(tx, entityId, accepted, lockedFields) {
  const locked = new Set(lockedFields ?? []);
  const service = await tx.query(`SELECT * FROM services WHERE id = $1`, [entityId]);
  if (service.rowCount === 0) throw new Error(`service ${entityId} not found`);
  const current = service.rows[0];
  const rawImport = rawImportFromAccepted(current.raw_import, accepted);
  if (!rawImport || Object.keys(rawImport).length === 0) {
    throw new Error("approve requires a raw_import refresh of the accepted record");
  }

  const sets = ["status = 'published'", "raw_import = $2::jsonb", "updated_at = now()"];
  const values = [entityId, JSON.stringify(rawImport)];

  if (!locked.has("serviceName") && Object.hasOwn(accepted, "serviceName")) {
    values.push(accepted.serviceName ?? "");
    sets.push(`service_name = $${values.length}`);
    values.push(accepted.serviceName ?? accepted.name ?? "");
    sets.push(`title = $${values.length}`);
  }
  for (const column of SERVICE_COLUMNS) {
    if (locked.has(column)) continue;
    if (!Object.hasOwn(accepted, column)) continue;
    values.push(column === "categories" ? JSON.stringify(accepted[column] ?? []) : accepted[column]);
    sets.push(
      column === "categories" ? `${column} = $${values.length}::jsonb` : `${column} = $${values.length}`
    );
  }

  await tx.query(`UPDATE services SET ${sets.join(", ")} WHERE id = $1`, values);

  if (current.organization_id) {
    const orgSets = ["updated_at = now()"];
    const orgValues = [current.organization_id];
    if (!locked.has("name") && Object.hasOwn(accepted, "name")) {
      orgValues.push(accepted.name);
      orgSets.push(`name = $${orgValues.length}`);
    }
    orgSets.push(`status = CASE WHEN status = 'draft' THEN 'published' ELSE status END`);
    orgSets.push(`published_at = CASE WHEN status = 'draft' THEN now() ELSE published_at END`);
    await tx.query(`UPDATE organizations SET ${orgSets.join(", ")} WHERE id = $1`, orgValues);
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

/**
 * Apply proposed.after, publish the service, promote a draft organisation,
 * refresh raw_import, and mark the queue item accepted.
 */
export async function approveReviewItem({ db, queueItemId, payload } = {}) {
  if (!db) throw new Error("approveReviewItem requires db");
  if (!queueItemId) throw new Error("approveReviewItem requires queueItemId");
  return withTransaction(async (tx) => {
    const item = await loadQueueItem(tx, queueItemId);
    if (item.entity_type !== "service") {
      throw new Error(`approve does not yet handle entity_type=${item.entity_type}`);
    }
    const accepted = { ...proposedAfter(item), ...(payload ?? {}) };
    const lockedFields = item.proposed?.locked_fields ?? [];
    await applyAcceptedService(tx, item.entity_id, accepted, lockedFields);
    await markQueue(tx, queueItemId, "accepted");
    return { queueItemId, entityId: item.entity_id, accepted };
  }, db);
}

export async function editAndApproveReviewItem(options) {
  return approveReviewItem(options);
}

/** @deprecated Use approveReviewItem — same function, kept for earlier runner tests. */
export const approveFsdReviewItem = approveReviewItem;

export async function hideReviewItem({ db, queueItemId, createdBy } = {}) {
  if (!db) throw new Error("hideReviewItem requires db");
  if (!queueItemId) throw new Error("hideReviewItem requires queueItemId");
  return withTransaction(async (tx) => {
    const item = await loadQueueItem(tx, queueItemId);
    await tx.query(`UPDATE services SET status = 'hidden', updated_at = now() WHERE id = $1`, [
      item.entity_id,
    ]);
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
  if (!queueItemId) throw new Error("rejectReviewItem requires queueItemId");
  return withTransaction(async (tx) => {
    const item = await loadQueueItem(tx, queueItemId);
    const service = await tx.query(`SELECT * FROM services WHERE id = $1`, [item.entity_id]);
    if (service.rowCount === 0) throw new Error(`service ${item.entity_id} not found`);
    const current = service.rows[0];
    const raw = current.raw_import && typeof current.raw_import === "object" ? current.raw_import : {};
    const sets = ["updated_at = now()"];
    const values = [item.entity_id];
    if (current.status === "pending_review") {
      sets.push(`status = 'published'`);
      for (const column of SERVICE_COLUMNS) {
        if (!Object.hasOwn(raw, column)) continue;
        values.push(column === "categories" ? JSON.stringify(raw[column] ?? []) : raw[column]);
        sets.push(
          column === "categories" ? `${column} = $${values.length}::jsonb` : `${column} = $${values.length}`
        );
      }
      if (Object.hasOwn(raw, "serviceName")) {
        values.push(raw.serviceName ?? "");
        sets.push(`service_name = $${values.length}`);
      }
    }
    await tx.query(`UPDATE services SET ${sets.join(", ")} WHERE id = $1`, values);
    if (Object.hasOwn(raw, "name") && current.organization_id && current.status === "pending_review") {
      await tx.query(`UPDATE organizations SET name = $2, updated_at = now() WHERE id = $1`, [
        current.organization_id,
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

async function main() {
  const args = process.argv.slice(2);
  const approveIdx = args.indexOf("--approve");
  const rejectIdx = args.indexOf("--reject");
  const queueItemId = approveIdx !== -1 ? args[approveIdx + 1] : args[rejectIdx + 1];
  if (!queueItemId || (approveIdx === -1 && rejectIdx === -1)) {
    console.error("Usage: node scripts/approve-review.mjs --approve <queueItemId> | --reject <queueItemId>");
    process.exitCode = 1;
    return;
  }
  const pool = getPool();
  try {
    const result =
      approveIdx !== -1
        ? await approveReviewItem({ db: pool, queueItemId })
        : await rejectReviewItem({ db: pool, queueItemId });
    console.log(JSON.stringify(result));
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
