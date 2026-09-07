/**
 * Sidecar used by committed Directus Flows. Keep Flow JSON thin; logic lives here
 * so tests can call the same functions without clicking the Data Studio.
 *
 * Can publish, approve, and rewrite raw_import. Deploy cluster-internal only —
 * ClusterIP, no Ingress. Local compose binds 18790 for tests, not as a public API.
 */

import { createServer } from "node:http";
import { pathToFileURL } from "node:url";
import { getPool } from "../../scripts/lib/db.mjs";
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

const PORT = Number(process.env.OPERATIONS_PORT || 8790);

function send(res, status, body) {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(json);
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
  return {
    ok: true,
    blocked: false,
    preflight,
    version: published.version,
    counts: published.envelope.counts,
  };
}

async function handleRollback(body, db) {
  const version = Number(body.version);
  const result = await rollbackCatalog({
    db,
    version,
    publishedBy: actor(body),
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
      if (req.method !== "POST") {
        send(res, 405, { error: "method not allowed" });
        return;
      }

      const body = await readJson(req);
      if (url.pathname === "/sticky-curation") {
        send(res, 200, await handleSticky(body, executor));
        return;
      }
      if (url.pathname === "/approve") {
        send(res, 200, {
          ok: true,
          ...(await approveReviewItem({ db: executor, queueItemId: body.queueItemId })),
        });
        return;
      }
      if (url.pathname === "/edit-and-approve") {
        send(res, 200, {
          ok: true,
          ...(await editAndApproveReviewItem({
            db: executor,
            queueItemId: body.queueItemId,
            payload: body.payload,
          })),
        });
        return;
      }
      if (url.pathname === "/hide") {
        send(res, 200, {
          ok: true,
          ...(await hideReviewItem({
            db: executor,
            queueItemId: body.queueItemId,
            createdBy: actor(body),
          })),
        });
        return;
      }
      if (url.pathname === "/reject") {
        send(res, 200, {
          ok: true,
          ...(await rejectReviewItem({ db: executor, queueItemId: body.queueItemId })),
        });
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
      send(res, 500, {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };
}

export function startOperationsServer({ db, port = PORT } = {}) {
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
