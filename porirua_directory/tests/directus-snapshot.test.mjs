import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { editorPermissions } from "../scripts/directus/bootstrap.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const snapshotPath = path.join(root, "directus/snapshot.yaml");
const flowsDir = path.join(root, "directus/flows");

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
  assert.match(text, /field: service_lines/);
  assert.match(text, /one_field: service_lines/);
  assert.match(text, /collection: directus_flows/);
});

test("Editor policy reads directus_flows so Data Studio can list manual flows", () => {
  const rows = editorPermissions("policy");
  assert.ok(rows.some((row) => row.collection === "directus_flows" && row.action === "read"));
});

test("Publish is a collection action; rollback and review actions are on list and item", async () => {
  const publish = JSON.parse(await fs.readFile(path.join(flowsDir, "publish-directory.json"), "utf8"));
  assert.equal(publish.options.location, "collection");
  const rollback = JSON.parse(await fs.readFile(path.join(flowsDir, "rollback-catalog.json"), "utf8"));
  assert.equal(rollback.options.location, "both");
  for (const name of ["approve-review.json", "edit-and-approve.json", "hide-review.json", "reject-review.json"]) {
    const flow = JSON.parse(await fs.readFile(path.join(flowsDir, name), "utf8"));
    assert.equal(flow.options.location, "both", name);
  }
});
