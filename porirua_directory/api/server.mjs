/**
 * Public catalog read service. Serves catalog_snapshots.envelope as-is.
 */

import { createServer } from "node:http";
import { pathToFileURL } from "node:url";
import { createCatalogService } from "./catalog-service.mjs";

export function snapshotEtag(version) {
  return `"${Number(version)}"`;
}

function ifNoneMatchHits(ifNoneMatch, etag) {
  if (!ifNoneMatch) return false;
  const header = ifNoneMatch.trim();
  if (header === "*") return true;
  const want = etag.replaceAll('"', "");
  return header.split(",").some((part) => {
    const token = part.trim().replace(/^W\//, "").replaceAll('"', "");
    return token === want;
  });
}

export const CATALOG_CACHE_CONTROL = "public, max-age=60, s-maxage=86400";

function sendJson(res, status, payload, headers = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    ...headers,
  });
  res.end(body);
}

function parseRequestedVersion(raw) {
  if (raw == null || raw === "") return { ok: true, version: null };
  if (!/^[0-9]+$/.test(raw)) return { ok: false };
  const version = Number(raw);
  if (!Number.isSafeInteger(version) || version < 1) return { ok: false };
  return { ok: true, version };
}

function sendCatalog(req, res, snapshot) {
  const etag = snapshotEtag(snapshot.version);
  const headers = {
    etag,
    "cache-control": CATALOG_CACHE_CONTROL,
  };
  if (ifNoneMatchHits(req.headers["if-none-match"], etag)) {
    res.writeHead(304, headers);
    res.end();
    return;
  }
  const body = JSON.stringify(snapshot.envelope);
  res.writeHead(200, {
    ...headers,
    "content-type": "application/json; charset=utf-8",
  });
  res.end(body);
}

export function createCatalogServer({ repository, service } = {}) {
  const catalog =
    service ??
    (repository
      ? createCatalogService({ repository })
      : null);
  if (!catalog) {
    throw new Error("createCatalogServer requires a snapshot repository");
  }

  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://127.0.0.1");
      if (req.method === "GET" && url.pathname === "/api/health") {
        const health = await catalog.health();
        sendJson(res, health.ok ? 200 : 503, health, {
          "cache-control": "no-store",
        });
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/catalog") {
        const requested = parseRequestedVersion(url.searchParams.get("version"));
        if (!requested.ok) {
          sendJson(res, 400, { error: "invalid version" });
          return;
        }
        const snapshot = await catalog.getCatalog({ version: requested.version });
        if (!snapshot) {
          sendJson(res, requested.version ? 404 : 503, {
            error: requested.version ? "snapshot not found" : "catalog unavailable",
          });
          return;
        }
        sendCatalog(req, res, snapshot);
        return;
      }

      sendJson(res, 404, { error: "not found" });
    } catch {
      if (!res.headersSent) {
        sendJson(res, 503, { error: "catalog unavailable" });
      }
    }
  });
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { createCatalogRepository } = await import("./catalog-repository.mjs");
  const port = Number(process.env.PORT || 3000);
  const server = createCatalogServer({ repository: createCatalogRepository() });
  server.listen(port, "0.0.0.0", () => {
    console.log(`catalog api listening on ${port}`);
  });
}
