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
      "Directus is not reachable; run docker compose -p porirua-directus-ojw13bd2 -f docker-compose.directus.yml up -d --wait"
    );
    return false;
  }
  if (!bootstrapped) {
    await bootstrapDirectus();
    bootstrapped = true;
  }
  return true;
}

test("Editor inbox is review_queue_items; pending_review is not a Data Studio collection", async (t) => {
  if (!(await ensureWorkspace(t))) return;
  const editor = await loginDirectus(EDITOR_EMAIL, EDITOR_PASSWORD);
  const admin = await loginDirectus(ADMIN_EMAIL, ADMIN_PASSWORD);

  const queue = await directusRequest(editor, "/items/review_queue_items?limit=1");
  assert.equal(queue.status, 200, JSON.stringify(queue.data));

  const ghost = await directusRequest(editor, "/items/pending_review?limit=1");
  assert.ok(ghost.status === 403 || ghost.status === 404, `pending_review status ${ghost.status}`);

  const collections = await directusRequest(admin, "/collections?limit=80");
  const names = (collections.data?.data ?? []).map((row) => row.collection);
  assert.equal(names.includes("review_queue_items"), true);
  const pending = (collections.data?.data ?? []).find((row) => row.collection === "pending_review");
  assert.ok(!pending || pending.meta?.hidden === true, "pending_review must not sit in the sidebar");

  const queueCollection = (collections.data?.data ?? []).find(
    (row) => row.collection === "review_queue_items"
  );
  assert.equal(queueCollection?.meta?.hidden, false);

  const fields = await directusRequest(admin, "/fields/review_queue_items");
  const fieldNames = (fields.data?.data ?? []).map((row) => row.field);
  assert.ok(fieldNames.includes("change_summary"), "change_summary field metadata missing");
  assert.ok(fieldNames.includes("kind"));

  const presets = await directusRequest(
    admin,
    "/presets?filter[bookmark][_eq]=Review queue&limit=5"
  );
  const reviewPreset = (presets.data?.data ?? []).find(
    (row) => row.collection === "review_queue_items"
  );
  assert.ok(reviewPreset, "Review queue preset must target review_queue_items");
  assert.equal(reviewPreset.filter?.status?._eq, "pending");
});
