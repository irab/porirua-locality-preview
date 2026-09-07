/**
 * Sidecar used by committed Directus Flows. Keep Flow JSON thin; logic lives here
 * so tests can call the same functions without clicking the Data Studio.
 *
 * Can publish, approve, and rewrite raw_import. Deploy cluster-internal only —
 * ClusterIP, no Ingress. Local compose binds 18790 for tests, not as a public API.
 */

import { createServer } from "node:http";
import { pathToFileURL } from "node:url";
import { applySchema, getPool } from "../../scripts/lib/db.mjs";
import { upsertStickyOverride } from "../../scripts/directus/sticky-curation.mjs";
import {
  approveReviewItem,
  editAndApproveReviewItem,
  hideReviewItem,
  rejectReviewItem,
} from "../../scripts/approve-review.mjs";
import { recordPublicIdAlias } from "../../scripts/directus/public-id-alias.mjs";
import { catalogCountPreflight } from "../../scripts/directus/publish-preflight.mjs";
import {
  getCurrentSnapshot,
  loadPublishedRows,
  loadSourceCounts,
  publishCatalog,
  rollbackCatalog,
} from "../../scripts/publish-catalog.mjs";
import { buildCatalogEnvelope } from "../../scripts/catalog-envelope.mjs";
import {
  archiveListing,
  createListing,
  getListing,
  listListings,
  listQueueItems,
  ListingError,
  nameMatches,
  publishStatus,
  restoreListing,
  updateListing,
} from "../../scripts/listings.mjs";
import {
  deferQueueItem,
  keepAsCommunityReviewItem,
  undoReviewDecision,
  wrapReviewUndo,
} from "../../scripts/review-actions.mjs";
import { keepCurationReviewItem } from "../../scripts/approve-review.mjs";

const PORT = Number(process.env.OPERATIONS_PORT || 8790);

export class HttpError extends Error {
  constructor(statusCode, message, extra = {}) {
    super(message);
    this.name = "HttpError";
    this.statusCode = statusCode;
    this.extra = extra;
  }
}

function send(res, status, body) {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(json);
}

function errorStatus(error) {
  if (
    error &&
    Number.isInteger(error.statusCode) &&
    error.statusCode >= 400 &&
    error.statusCode < 600
  ) {
    return error.statusCode;
  }
  return 500;
}

/** Directus `{{$trigger}}` may be the wrapper or the inner body. */
export function unwrapTrigger(body) {
  if (!body || typeof body !== "object") return {};
  const inner = body.body;
  if (
    inner &&
    typeof inner === "object" &&
    !Array.isArray(inner) &&
    (Array.isArray(inner.keys) ||
      inner.queueItemId != null ||
      inner.queueItemIds != null ||
      inner.payload != null ||
      inner.version != null ||
      inner.collection)
  ) {
    return {
      ...inner,
      createdBy: body.createdBy ?? inner.createdBy,
      accountability: body.accountability ?? inner.accountability,
      user: body.user ?? inner.user,
    };
  }
  return body;
}

function asKeyList(value) {
  if (Array.isArray(value)) {
    return value.map((key) => String(key)).filter((key) => key && key !== "undefined");
  }
  if (typeof value === "string" && value.trim()) {
    const trimmed = value.trim();
    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return asKeyList(parsed);
      } catch {
        /* treat as a single key */
      }
    }
    return [trimmed];
  }
  if (value != null && value !== "") return [String(value)];
  return [];
}

export function selectionKeys(body, { includeVersion = false } = {}) {
  const trigger = unwrapTrigger(body);
  const fromKeys = asKeyList(trigger.keys);
  if (fromKeys.length > 0) return fromKeys;
  const fromIds = asKeyList(trigger.queueItemIds);
  if (fromIds.length > 0) return fromIds;
  if (trigger.queueItemId != null && trigger.queueItemId !== "") {
    return [String(trigger.queueItemId)];
  }
  if (includeVersion && trigger.version != null && trigger.version !== "") {
    return [String(trigger.version)];
  }
  return [];
}

export function requireSingleSelection(body, endpoint, options = {}) {
  const keys = selectionKeys(body, options);
  if (keys.length > 1) {
    throw new HttpError(400, `${endpoint} accepts exactly one selection, got ${keys.length}`, {
      keys,
    });
  }
  return keys[0] ?? null;
}

export async function runBulkQueue({ action, keys, each }) {
  if (keys.length === 0) {
    throw new HttpError(400, `${action} requires at least one queue item`);
  }
  const succeeded = [];
  const failed = [];
  for (const queueItemId of keys) {
    try {
      const result = await each(queueItemId);
      succeeded.push({ queueItemId, ...result });
    } catch (error) {
      failed.push({
        queueItemId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  const total = succeeded.length + failed.length;
  return {
    status: failed.length === 0 ? 200 : 409,
    body: {
      ok: failed.length === 0,
      action,
      succeededCount: succeeded.length,
      failedCount: failed.length,
      succeeded,
      failed,
      message:
        failed.length === 0
          ? `${action} ${succeeded.length} item${succeeded.length === 1 ? "" : "s"}`
          : `${action} ${succeeded.length} of ${total}. ${failed.length} failed.`,
    },
  };
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

function actor(body) {
  return body.createdBy || body.accountability?.user || body.user || "directus-flow";
}

const PORIRUA_VIEWBOX = "174.70,-41.22,175.05,-41.04";

export async function geocodeAddress(query) {
  const q = String(query ?? "").trim();
  if (!q) throw new HttpError(400, "address is required");
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", q);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "5");
  url.searchParams.set("viewbox", PORIRUA_VIEWBOX);
  url.searchParams.set("bounded", "0");
  url.searchParams.set("countrycodes", "nz");
  const response = await fetch(url, {
    headers: { "user-agent": "porirua-directory-editor/1.0 (directory.bsky.nz)" },
  });
  if (!response.ok) throw new HttpError(502, "Address lookup is unavailable");
  const results = await response.json();
  return {
    results: (Array.isArray(results) ? results : []).map((row) => ({
      label: row.display_name,
      lat: Number(row.lat),
      lng: Number(row.lon),
    })),
  };
}

async function handleSticky(body, db) {
  const keys = body.keys ?? (body.key ? [body.key] : []);
  const collection = body.collection;
  const payload = body.payload ?? {};
  const results = [];
  for (const key of keys) {
    results.push(
      await upsertStickyOverride({
        db,
        collection,
        key,
        payload,
        createdBy: actor(body),
      })
    );
  }
  return { ok: true, results };
}

async function handlePublish(body, db) {
  const current = await getCurrentSnapshot(db);
  const rows = await loadPublishedRows(db);
  const counts = await loadSourceCounts(db);
  const nextEnvelope = buildCatalogEnvelope({ ...rows, counts });
  const preflight = catalogCountPreflight(current?.counts ?? current?.envelope?.counts, nextEnvelope.counts);
  if (preflight.warning && body.confirmLargeDelta !== true) {
    return { ok: false, blocked: true, preflight };
  }
  const published = await publishCatalog({
    db,
    publishedBy: actor(body),
    purge: typeof body.purge === "function" ? body.purge : undefined,
  });
  await db.query(`DELETE FROM editor_undo`);
  return {
    ok: true,
    blocked: false,
    preflight,
    version: published.version,
    counts: published.envelope.counts,
  };
}

async function handleRollback(body, db) {
  const trigger = unwrapTrigger(body);
  const selected = requireSingleSelection(trigger, "rollback", { includeVersion: true });
  const version = Number(selected ?? trigger.version);
  if (!Number.isFinite(version)) {
    throw new HttpError(400, "rollback requires exactly one snapshot version");
  }
  const result = await rollbackCatalog({
    db,
    version,
    publishedBy: actor(trigger),
    purge: typeof body.purge === "function" ? body.purge : undefined,
  });
  return { ok: true, version: result.version, counts: result.envelope.counts };
}

export function createOperationsHandler({ db } = {}) {
  return async function handler(req, res) {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    try {
      if (req.method === "GET" && url.pathname === "/health") {
        send(res, 200, { ok: true });
        return;
      }

      const executor = db ?? getPool();
      if (req.method === "GET" && url.pathname === "/listings/name-matches") {
        send(
          res,
          200,
          await nameMatches({
            db: executor,
            name: url.searchParams.get("name"),
            organizationId: url.searchParams.get("organizationId"),
          })
        );
        return;
      }
      if (req.method === "GET" && url.pathname === "/listings") {
        send(res, 200, await listListings({ db: executor }));
        return;
      }
      if (req.method === "GET" && url.pathname === "/queue") {
        send(res, 200, await listQueueItems({ db: executor }));
        return;
      }
      if (req.method === "GET" && url.pathname === "/publish-status") {
        send(res, 200, await publishStatus({ db: executor }));
        return;
      }
      if (req.method === "GET" && url.pathname.startsWith("/listings/") && url.pathname !== "/listings/name-matches") {
        const organizationId = decodeURIComponent(url.pathname.slice("/listings/".length));
        send(res, 200, await getListing({ db: executor, organizationId }));
        return;
      }
      if (req.method === "GET" && url.pathname === "/geocode") {
        send(res, 200, await geocodeAddress(url.searchParams.get("q")));
        return;
      }
      if (req.method !== "POST") {
        send(res, 405, { error: "method not allowed" });
        return;
      }

      const body = await readJson(req);
      const trigger = unwrapTrigger(body);
      if (url.pathname === "/listings") {
        send(res, 200, await createListing({ db: executor, payload: trigger }));
        return;
      }
      if (url.pathname === "/listings/archive") {
        send(
          res,
          200,
          await archiveListing({
            db: executor,
            serviceId: trigger.serviceId,
            alsoArchiveOrganization: trigger.alsoArchiveOrganization === true,
            createdBy: actor(trigger),
          })
        );
        return;
      }
      if (url.pathname === "/listings/restore") {
        send(res, 200, await restoreListing({ db: executor, serviceId: trigger.serviceId }));
        return;
      }
      if (url.pathname === "/listings/update") {
        send(
          res,
          200,
          await updateListing({
            db: executor,
            organizationId: trigger.organizationId,
            serviceId: trigger.serviceId,
            payload: trigger.payload ?? trigger,
            createdBy: actor(trigger),
          })
        );
        return;
      }
      if (url.pathname === "/keep-curation") {
        const queueItemId = requireSingleSelection(trigger, "keep-curation");
        if (!queueItemId) throw new HttpError(400, "keep-curation requires exactly one queue item");
        send(res, 200, {
          ok: true,
          ...(await wrapReviewUndo(executor, queueItemId, "keep", () =>
            keepCurationReviewItem({ db: executor, queueItemId })
          )),
        });
        return;
      }
      if (url.pathname === "/defer") {
        const queueItemId = requireSingleSelection(trigger, "defer");
        if (!queueItemId) throw new HttpError(400, "defer requires exactly one queue item");
        send(res, 200, await deferQueueItem({ db: executor, queueItemId }));
        return;
      }
      if (url.pathname === "/keep-community") {
        const queueItemId = requireSingleSelection(trigger, "keep-community");
        if (!queueItemId) throw new HttpError(400, "keep-community requires exactly one queue item");
        send(res, 200, {
          ok: true,
          ...(await keepAsCommunityReviewItem({
            db: executor,
            queueItemId,
            createdBy: actor(trigger),
          })),
        });
        return;
      }
      if (url.pathname === "/review-undo") {
        if (!trigger.undoId) throw new HttpError(400, "review-undo requires undoId");
        send(res, 200, await undoReviewDecision({ db: executor, undoId: trigger.undoId }));
        return;
      }
      if (url.pathname === "/sticky-curation") {
        send(res, 200, await handleSticky(body, executor));
        return;
      }
      if (url.pathname === "/approve") {
        const outcome = await runBulkQueue({
          action: "approve",
          keys: selectionKeys(trigger),
          each: (queueItemId) =>
            wrapReviewUndo(executor, queueItemId, "approve", () =>
              approveReviewItem({
                db: executor,
                queueItemId,
                createdBy: actor(trigger),
              })
            ),
        });
        send(res, outcome.status, outcome.body);
        return;
      }
      if (url.pathname === "/edit-and-approve") {
        const queueItemId = requireSingleSelection(trigger, "edit-and-approve");
        if (!queueItemId) {
          throw new HttpError(400, "edit-and-approve requires exactly one queue item");
        }
        send(res, 200, {
          ok: true,
          ...(await wrapReviewUndo(executor, queueItemId, "edit-and-approve", () =>
            editAndApproveReviewItem({
              db: executor,
              queueItemId,
              payload: trigger.payload,
            })
          )),
        });
        return;
      }
      if (url.pathname === "/hide") {
        const outcome = await runBulkQueue({
          action: "hide",
          keys: selectionKeys(trigger),
          each: (queueItemId) =>
            wrapReviewUndo(executor, queueItemId, "hide", () =>
              hideReviewItem({
                db: executor,
                queueItemId,
                createdBy: actor(trigger),
              })
            ),
        });
        send(res, outcome.status, outcome.body);
        return;
      }
      if (url.pathname === "/reject") {
        const outcome = await runBulkQueue({
          action: "reject",
          keys: selectionKeys(trigger),
          each: (queueItemId) =>
            wrapReviewUndo(executor, queueItemId, "reject", () =>
              rejectReviewItem({ db: executor, queueItemId })
            ),
        });
        send(res, outcome.status, outcome.body);
        return;
      }
      if (url.pathname === "/publish") {
        const result = await handlePublish(body, executor);
        send(res, result.blocked ? 409 : 200, result);
        return;
      }
      if (url.pathname === "/rollback") {
        send(res, 200, await handleRollback(body, executor));
        return;
      }
      if (url.pathname === "/public-id-alias") {
        let oldPublicId = body.oldPublicId;
        if (!oldPublicId && body.key) {
          const current = await executor.query(
            `SELECT public_id FROM organizations WHERE id = $1`,
            [body.key]
          );
          oldPublicId = current.rows[0]?.public_id;
        }
        send(res, 200, {
          ok: true,
          alias: await recordPublicIdAlias({
            db: executor,
            oldPublicId,
            newPublicId: body.newPublicId,
            entityType: body.entityType,
          }),
        });
        return;
      }
      send(res, 404, { error: "not found" });
    } catch (error) {
      send(res, errorStatus(error), {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
        ...(error instanceof HttpError || error instanceof ListingError ? error.extra : {}),
      });
    }
  };
}

export async function startOperationsServer({ db, port = PORT } = {}) {
  await applySchema(db ?? getPool());
  const server = createServer(createOperationsHandler({ db }));
  return new Promise((resolve) => {
    server.listen(port, "0.0.0.0", () => resolve(server));
  });
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  startOperationsServer().then((server) => {
    const address = server.address();
    console.log(`directus operations listening on ${address.port}`);
  });
}
