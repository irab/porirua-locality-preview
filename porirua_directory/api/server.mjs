/**
 * Public catalog read service. Serves catalog_snapshots.envelope as-is.
 */

import { createServer } from "node:http";
import { pathToFileURL } from "node:url";

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

function sendCatalog(req, res, snapshot) {
  const etag = snapshotEtag(snapshot.version);
  const headers = { etag };
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

export function createCatalogServer({ repository } = {}) {
  if (!repository) {
    throw new Error("createCatalogServer requires a snapshot repository");
  }

  return createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    if (req.method === "GET" && url.pathname === "/api/catalog") {
      const current = await repository.getCurrent();
      sendCatalog(req, res, current);
      return;
    }

    res.writeHead(404, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: "not found" }));
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
