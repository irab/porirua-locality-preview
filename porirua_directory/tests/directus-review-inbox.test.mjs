import test from "node:test";
import assert from "node:assert/strict";
import { bootstrapDirectus } from "../scripts/directus/bootstrap.mjs";
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  EDITOR_EMAIL,
  EDITOR_PASSWORD,
  directusRequest,
  loginDirectus,
  probeDirectus,
} from "./helpers/directus-api.mjs";

let bootstrapped = false;

async function ensureWorkspace(t) {
  if (!(await probeDirectus())) {
    t.skip(
      "Directus is not reachable; run npm run directus:up"
    );
    return false;
  }
  if (!bootstrapped) {
    await bootstrapDirectus();
    bootstrapped = true;
  }
  return true;
}

test("Editor uses the Directory module; raw queue and snapshot collections stay hidden", async (t) => {
  if (!(await ensureWorkspace(t))) return;
  const editor = await loginDirectus(EDITOR_EMAIL, EDITOR_PASSWORD);
  const admin = await loginDirectus(ADMIN_EMAIL, ADMIN_PASSWORD);

  const queue = await directusRequest(editor, "/items/review_queue_items?limit=1");
  assert.ok(queue.status === 403 || queue.status === 404, `review_queue_items status ${queue.status}`);

  const ghost = await directusRequest(editor, "/items/pending_review?limit=1");
  assert.ok(ghost.status === 403 || ghost.status === 404, `pending_review status ${ghost.status}`);

  const collections = await directusRequest(admin, "/collections?limit=80");
  const names = (collections.data?.data ?? []).map((row) => row.collection);
  assert.equal(names.includes("review_queue_items"), true);
  const pending = (collections.data?.data ?? []).find((row) => row.collection === "pending_review");
  assert.ok(!pending || pending.meta?.hidden === true, "pending_review must not sit in the sidebar");

  for (const collection of ["organizations", "services", "review_queue_items", "catalog_snapshots"]) {
    const row = (collections.data?.data ?? []).find((item) => item.collection === collection);
    assert.equal(row?.meta?.hidden, true, `${collection} must be hidden from the sidebar`);
  }

  const fields = await directusRequest(admin, "/fields/review_queue_items");
  const fieldNames = (fields.data?.data ?? []).map((row) => row.field);
  assert.ok(fieldNames.includes("change_summary"), "change_summary field metadata missing");
  assert.ok(fieldNames.includes("kind"));

  const me = await directusRequest(editor, "/users/me?fields=last_page");
  assert.equal(me.status, 200, `users/me status ${me.status}`);
  assert.equal(me.data?.data?.last_page, "/directory");
});
