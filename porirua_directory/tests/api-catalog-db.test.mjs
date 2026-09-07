import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createCatalogRepository } from "../api/catalog-repository.mjs";
import { bootstrapFromJson } from "../scripts/db-import-from-json.mjs";
import { publishCatalog } from "../scripts/publish-catalog.mjs";
import { withCatalogApi } from "./helpers/catalog-api.mjs";
import { withTestDatabase } from "./helpers/postgres.mjs";

const dataDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../data");

function catalogIds(envelope) {
  const ids = new Set();
  for (const entry of envelope.services ?? []) {
    if (entry.id) ids.add(entry.id);
    for (const line of entry.services ?? []) {
      if (line.id) ids.add(line.id);
    }
  }
  return ids;
}

async function loadCommitted() {
  return {
    envelope: JSON.parse(await fs.readFile(path.join(dataDir, "services.json"), "utf8")),
    overrides: JSON.parse(await fs.readFile(path.join(dataDir, "overrides.json"), "utf8")),
  };
}

test("publish then GET /api/catalog never serves draft, hidden, pending_review, or merged ids", async (t) => {
  await withTestDatabase(t, async (client) => {
    const { envelope, overrides } = await loadCommitted();
    await bootstrapFromJson({ envelope, overrides, db: client });

    await client.query(
      `INSERT INTO organizations (id, public_id, render_grain, name, cluster_key, status, sort_key)
       VALUES
         ('org-draft', 'org-draft', 'flat', 'Draft Only', 'draft-key', 'draft', 9000),
         ('org-hidden', 'org-hidden', 'flat', 'Hidden Only', 'hidden-key', 'hidden', 9001),
         ('org-merged', 'org-merged', 'flat', 'Merged Away', 'merged-key', 'published', 9002)`
    );
    await client.query(
      `UPDATE organizations SET merged_into = 'org-draft' WHERE id = 'org-merged'`
    );
    await client.query(
      `INSERT INTO services (id, organization_id, line_id, title, source, status)
       VALUES
         ('svc-draft', 'org-draft', 'svc-draft', 'Draft line', 'fsd', 'published'),
         ('svc-hidden', 'org-hidden', 'svc-hidden', 'Hidden line', 'fsd', 'published'),
         ('svc-merged', 'org-merged', 'svc-merged', 'Merged line', 'fsd', 'published'),
         ('svc-pending', 'fsd-2964', 'svc-pending', 'Pending line', 'fsd', 'pending_review')`
    );

    const first = await publishCatalog({ db: client, publishedBy: "api-test" });
    await client.query(
      `UPDATE organizations SET name = 'Renamed For Api Version Pin' WHERE public_id = 'fsd-2964'`
    );
    const second = await publishCatalog({ db: client, publishedBy: "api-test-2" });
    const repository = createCatalogRepository(client);

    await withCatalogApi(t, { repository }, async ({ get }) => {
      const response = await get("/api/catalog");
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("etag"), `"${second.version}"`);
      const body = await response.json();
      const ids = catalogIds(body);
      for (const id of ["org-draft", "org-hidden", "org-merged", "svc-draft", "svc-hidden", "svc-merged", "svc-pending"]) {
        assert.equal(ids.has(id), false, `unpublished id leaked: ${id}`);
      }
      assert.equal("generatedAt" in body, true);
      assert.equal(Array.isArray(body.services), true);
      assert.equal(
        body.services.some((entry) => entry.name === "Renamed For Api Version Pin"),
        true
      );

      const pinned = await get(`/api/catalog?version=${first.version}`);
      assert.equal(pinned.status, 200);
      assert.equal(pinned.headers.get("etag"), `"${first.version}"`);
      const older = await pinned.json();
      assert.equal(
        older.services.some((entry) => entry.name === "Renamed For Api Version Pin"),
        false
      );
    });
  });
});
