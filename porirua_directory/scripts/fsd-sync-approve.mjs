/**
 * Editor approval for weekly FSD review-queue items.
 * Must refresh raw_import or the next sync re-queues the same change.
 */

import { withTransaction } from "./lib/db.mjs";

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
    const incomingKey = column;
    if (locked.has(incomingKey)) continue;
    if (!Object.hasOwn(accepted, incomingKey)) continue;
    values.push(column === "categories" ? JSON.stringify(accepted[incomingKey] ?? []) : accepted[incomingKey]);
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

export async function approveFsdReviewItem({ db, queueItemId, payload } = {}) {
  if (!db) throw new Error("approveFsdReviewItem requires db");
  if (!queueItemId) throw new Error("approveFsdReviewItem requires queueItemId");
  return withTransaction(async (tx) => {
    const item = await loadQueueItem(tx, queueItemId);
    if (item.entity_type !== "service") {
      throw new Error(`approve does not yet handle entity_type=${item.entity_type}`);
    }
    const accepted = { ...proposedAfter(item), ...(payload ?? {}) };
    const lockedFields = item.proposed?.locked_fields ?? [];
    await applyAcceptedService(tx, item.entity_id, accepted, lockedFields);
    await tx.query(
      `UPDATE review_queue_items SET status = 'accepted', updated_at = now() WHERE id = $1`,
      [queueItemId]
    );
    return { queueItemId, entityId: item.entity_id, accepted };
  }, db);
}
