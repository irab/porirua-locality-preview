import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const snapshotPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../directus/snapshot.yaml"
);

test("committed snapshot.yaml includes collections, Editor RBAC, and the Review queue preset", async () => {
  const text = await fs.readFile(snapshotPath, "utf8");
  assert.match(text, /^version: 1/m);
  assert.match(text, /collection: organizations/);
  assert.match(text, /collection: services/);
  assert.match(text, /collection: pending_review/);
  assert.match(text, /collection: catalog_snapshots/);
  assert.match(text, /name: Editor/);
  assert.match(text, /bookmark: Review queue/);
  assert.match(text, /field: public_id/);
  assert.match(text, /field: render_grain/);
  assert.match(text, /field: status/);
});
