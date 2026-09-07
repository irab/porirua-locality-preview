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
import { closeCommunityOwned, markCommunityOwnedRuledOn } from "./review-actions.mjs";
import { FSD_FINGERPRINT_FIELDS } from "./fsd-sync-collapse.mjs";

/**
 * Last-accepted baseline the weekly differ compares against.
 * Merge payload keys onto the previous raw_import, then fill missing
 * fingerprint keys. An absent key must never overwrite a known value.
 */
const RAW_IMPORT_DEFAULTS = {
  name: "",
  serviceName: "",
  description: "",
  phone: "",
  url: "",
  address: "",
  lat: null,
  lng: null,
  categories: [],
  fsd_service_id: null,
  fsd_legacy_id: null,
};

const RAW_IMPORT_ALIASES = {
  name: ["name"],
  serviceName: ["serviceName", "service_name", "title"],
  description: ["description"],
  phone: ["phone"],
  url: ["url"],
  address: ["address"],
  lat: ["lat"],
  lng: ["lng"],
  categories: ["categories"],
  fsd_service_id: ["fsd_service_id", "SERVICE_ID"],
  fsd_legacy_id: ["fsd_legacy_id", "FSD_ID"],
};

const LIVE_COLUMNS = [
  { column: "description", aliases: ["description"], lockedAs: ["description"] },
  { column: "phone", aliases: ["phone"], lockedAs: ["phone"] },
  { column: "url", aliases: ["url"], lockedAs: ["url"] },
  { column: "address", aliases: ["address"], lockedAs: ["address"] },
  { column: "lat", aliases: ["lat"], lockedAs: ["lat"] },
  { column: "lng", aliases: ["lng"], lockedAs: ["lng"] },
  { column: "categories", aliases: ["categories"], lockedAs: ["categories"], jsonb: true },
  { column: "service_name", aliases: ["service_name", "serviceName"], lockedAs: ["service_name", "serviceName"] },
  {
    column: "title",
    aliases: ["title", "service_name", "serviceName"],
    lockedAs: ["title", "service_name", "serviceName"],
  },
];

function proposedAfter(item) {
  const proposed = item.proposed && typeof item.proposed === "object" ? item.proposed : {};
  const after = proposed.after && typeof proposed.after === "object" ? proposed.after : {};
  return after;
}

function firstPresent(object, keys) {
  if (!object || typeof object !== "object" || Array.isArray(object)) {
    return { present: false };
  }
  for (const key of keys) {
    if (Object.hasOwn(object, key)) return { present: true, value: object[key] };
  }
  return { present: false };
}

function overlayFromAccepted(accepted) {
  const overlay = {};
  for (const [canonical, aliases] of Object.entries(RAW_IMPORT_ALIASES)) {
    const found = firstPresent(accepted, aliases);
    if (found.present) overlay[canonical] = found.value;
  }
  return overlay;
}

export function rawImportFromAccepted(currentRaw, accepted) {
  const previous =
    currentRaw && typeof currentRaw === "object" && !Array.isArray(currentRaw) ? currentRaw : {};
  const merged = { ...previous, ...overlayFromAccepted(accepted) };
  const result = { ...merged };
  for (const key of [...FSD_FINGERPRINT_FIELDS, "fsd_service_id", "fsd_legacy_id"]) {
    if (!Object.hasOwn(result, key) || result[key] === undefined) {
      result[key] = RAW_IMPORT_DEFAULTS[key];
    }
  }
  return result;
}

function isLocked(locked, names) {
  return names.some((name) => locked.has(name));
}

function liveValuesDiffer(column, live, expected) {
  if (column === "categories") {
    return JSON.stringify(live ?? []) !== JSON.stringify(expected ?? []);
  }
  if (column === "lat" || column === "lng") {
    if (live == null && expected == null) return false;
    return Number(live) !== Number(expected);
  }
  return String(live ?? "") !== String(expected ?? "");
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

  // status means on the public site. A hidden row stays hidden; a new
  // pending_review row becomes published. Do not republish a deliberate hide.
  const sets = ["raw_import = $2::jsonb", "updated_at = now()"];
  if (current.status !== "hidden") {
    sets.push("status = 'published'");
  }
  const values = [entityId, JSON.stringify(rawImport)];

  for (const spec of LIVE_COLUMNS) {
    if (isLocked(locked, spec.lockedAs)) continue;
    const found = firstPresent(accepted, spec.aliases);
    if (!found.present) continue;
    values.push(spec.jsonb ? JSON.stringify(found.value ?? []) : found.value);
    sets.push(
      spec.jsonb ? `${spec.column} = $${values.length}::jsonb` : `${spec.column} = $${values.length}`
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

async function markQueue(tx, queueItemId, status, action) {
  const decision = {
    editor_decision: {
      action: action || (status === "rejected" ? "reject" : "approve"),
      at: new Date().toISOString(),
    },
  };
  await tx.query(
    `UPDATE review_queue_items
        SET status = $2,
            proposed = COALESCE(proposed, '{}'::jsonb) || $3::jsonb,
            updated_at = now()
      WHERE id = $1`,
    [queueItemId, status, JSON.stringify(decision)]
  );
}

/**
 * Apply proposed.after, publish the service, promote a draft organisation,
 * refresh raw_import, and mark the queue item accepted.
 *
 * Known gap: no actor is recorded. review_queue_items has no approved_by
 * column; do not invent one here. Locality will eventually need "who
 * approved this" on the handover.
 */
async function archiveServiceWithHideOverride(tx, { entityType, entityId, createdBy } = {}) {
  await tx.query(`UPDATE services SET status = 'hidden', updated_at = now() WHERE id = $1`, [
    entityId,
  ]);
  await tx.query(
    `INSERT INTO overrides (id, target_type, target_id, action, patch, status, created_by)
     VALUES ($1, $2, $3, 'hide', NULL, 'open', $4)
     ON CONFLICT (target_type, target_id, action)
     DO UPDATE SET status = 'open'`,
    [`hide:${entityType}:${entityId}`, entityType, entityId, createdBy ?? null]
  );
}

export async function approveReviewItem({ db, queueItemId, payload, createdBy } = {}) {
  if (!db) throw new Error("approveReviewItem requires db");
  if (!queueItemId) throw new Error("approveReviewItem requires queueItemId");
  return withTransaction(async (tx) => {
    const item = await loadQueueItem(tx, queueItemId);
    if (item.entity_type !== "service") {
      throw new Error(`approve does not yet handle entity_type=${item.entity_type}`);
    }
    if (item.kind === "removed") {
      await archiveServiceWithHideOverride(tx, {
        entityType: item.entity_type,
        entityId: item.entity_id,
        createdBy,
      });
      await markQueue(tx, queueItemId, "accepted", "hide");
      return { queueItemId, entityId: item.entity_id, archived: true };
    }
    const accepted = { ...proposedAfter(item), ...(payload ?? {}) };
    const lockedFields = item.proposed?.locked_fields ?? [];
    if (item.proposed?.fsd_returned) {
      await closeCommunityOwned(tx, item.entity_id);
    }
    await applyAcceptedService(tx, item.entity_id, accepted, lockedFields);
    await markQueue(tx, queueItemId, "accepted", "approve");
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
    await archiveServiceWithHideOverride(tx, {
      entityType: item.entity_type,
      entityId: item.entity_id,
      createdBy,
    });
    await markQueue(tx, queueItemId, "accepted", "hide");
    return { queueItemId, entityId: item.entity_id };
  }, db);
}

/** Leave live columns and the sticky patch; refresh raw_import so this FSD value is not queued again. */
export async function keepCurationReviewItem({ db, queueItemId } = {}) {
  if (!db) throw new Error("keepCurationReviewItem requires db");
  if (!queueItemId) throw new Error("keepCurationReviewItem requires queueItemId");
  return withTransaction(async (tx) => {
    const item = await loadQueueItem(tx, queueItemId);
    if (item.entity_type !== "service") {
      throw new Error(`keep-curation does not yet handle entity_type=${item.entity_type}`);
    }
    const service = await tx.query(`SELECT * FROM services WHERE id = $1`, [item.entity_id]);
    if (service.rowCount === 0) throw new Error(`service ${item.entity_id} not found`);
    const current = service.rows[0];
    const rawImport = rawImportFromAccepted(current.raw_import, proposedAfter(item));
    await tx.query(
      `UPDATE services SET raw_import = $2::jsonb, updated_at = now() WHERE id = $1`,
      [item.entity_id, JSON.stringify(rawImport)]
    );
    if (item.proposed?.fsd_returned) {
      await markCommunityOwnedRuledOn(tx, item.entity_id);
    }
    await markQueue(tx, queueItemId, "accepted", "keep");
    return { queueItemId, entityId: item.entity_id, kept: true };
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
    if (item.kind === "new") {
      // Don't add this: off the site, and the hide lock is the same
      // suppression removals use so next week's sync cannot resurrect it.
      await archiveServiceWithHideOverride(tx, {
        entityType: item.entity_type,
        entityId: item.entity_id,
      });
      await markQueue(tx, queueItemId, "rejected", "reject");
      return { queueItemId, entityId: item.entity_id, hidden: true };
    }
    const raw = current.raw_import && typeof current.raw_import === "object" ? current.raw_import : {};
    const sets = ["updated_at = now()"];
    const values = [item.entity_id];
    for (const spec of LIVE_COLUMNS) {
      const fromRaw = firstPresent(raw, spec.aliases);
      if (!fromRaw.present) continue;
      if (!liveValuesDiffer(spec.column, current[spec.column], fromRaw.value)) continue;
      values.push(spec.jsonb ? JSON.stringify(fromRaw.value ?? []) : fromRaw.value);
      sets.push(
        spec.jsonb ? `${spec.column} = $${values.length}::jsonb` : `${spec.column} = $${values.length}`
      );
    }
    await tx.query(`UPDATE services SET ${sets.join(", ")} WHERE id = $1`, values);
    if (current.organization_id && Object.hasOwn(raw, "name")) {
      const org = await tx.query(`SELECT name FROM organizations WHERE id = $1`, [
        current.organization_id,
      ]);
      if (liveValuesDiffer("name", org.rows[0]?.name, raw.name)) {
        await tx.query(`UPDATE organizations SET name = $2, updated_at = now() WHERE id = $1`, [
          current.organization_id,
          raw.name,
        ]);
      }
    }
    await markQueue(tx, queueItemId, "rejected", "reject");
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
