/**
 * Public catalog read service. Serves catalog_snapshots.envelope as-is.
 */

import { createServer } from "node:http";
import { pathToFileURL } from "node:url";

export function createCatalogServer({ repository } = {}) {
  if (!repository) {
    throw new Error("createCatalogServer requires a snapshot repository");
  }

  return createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    if (req.method === "GET" && url.pathname === "/api/catalog") {
      const current = await repository.getCurrent();
      const body = JSON.stringify(current.envelope);
      res.writeHead(200, {
        "content-type": "application/json; charset=utf-8",
      });
      res.end(body);
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
