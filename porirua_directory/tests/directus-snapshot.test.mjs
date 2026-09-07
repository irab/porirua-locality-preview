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
  assert.match(text, /collection: review_queue_items/);
  assert.match(text, /collection: catalog_snapshots/);
  assert.match(text, /name: Editor/);
  assert.match(text, /bookmark: Review queue/);
  assert.match(text, /change_summary/);
  assert.doesNotMatch(text, /bookmark: Review queue\n    collection: pending_review/);
  assert.doesNotMatch(text, /collection: pending_review\n    action: read/);
  assert.match(text, /field: public_id/);
  assert.match(text, /field: render_grain/);
  assert.match(text, /field: status/);
  assert.match(text, /field: service_lines/);
  assert.match(text, /one_field: service_lines/);
  assert.match(text, /collection: directus_flows/);
});

test("Editor policy does not read Flows or the raw review queue — the Directory module is the inbox", () => {
  const rows = editorPermissions("policy");
  assert.equal(rows.some((row) => row.collection === "directus_flows"), false);
  assert.equal(rows.some((row) => row.collection === "review_queue_items"), false);
  assert.equal(rows.some((row) => row.collection === "catalog_snapshots"), false);
  assert.equal(rows.some((row) => row.collection === "pending_review"), false);
  assert.ok(rows.some((row) => row.collection === "organizations" && row.action === "update"));
  assert.equal(rows.some((row) => row.collection === "organizations" && row.action === "create"), false);
});

test("review Flows target the reachable review_queue_items collection only", async () => {
  for (const name of ["approve-review.json", "edit-and-approve.json", "hide-review.json", "reject-review.json"]) {
    const flow = JSON.parse(await fs.readFile(path.join(flowsDir, name), "utf8"));
    assert.deepEqual(flow.options.collections, ["review_queue_items"], name);
  }
});

test("Publish is collection; rollback and edit-and-approve are item; bulk review is both", async () => {
  const publish = JSON.parse(await fs.readFile(path.join(flowsDir, "publish-directory.json"), "utf8"));
  assert.equal(publish.options.location, "collection");
  assert.equal(publish.options.requireSelection, false);
  const rollback = JSON.parse(await fs.readFile(path.join(flowsDir, "rollback-catalog.json"), "utf8"));
  assert.equal(rollback.options.location, "item");
  assert.equal(rollback.operations[0].options.body, "{{$trigger}}");
  const edit = JSON.parse(await fs.readFile(path.join(flowsDir, "edit-and-approve.json"), "utf8"));
  assert.equal(edit.options.location, "item");
  assert.equal(edit.operations[0].options.body, "{{$trigger}}");
  for (const name of ["approve-review.json", "hide-review.json", "reject-review.json"]) {
    const flow = JSON.parse(await fs.readFile(path.join(flowsDir, name), "utf8"));
    assert.equal(flow.options.location, "both", name);
    assert.equal(flow.operations[0].options.body, "{{$trigger}}", name);
  }
});
