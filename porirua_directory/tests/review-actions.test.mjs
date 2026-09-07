import test from "node:test";
import assert from "node:assert/strict";
import { hideReviewItem } from "../scripts/approve-review.mjs";
import { listQueueItems } from "../scripts/listings.mjs";
import {
  deferQueueItem,
  keepAsCommunityReviewItem,
  undoReviewDecision,
} from "../scripts/review-actions.mjs";
import { withDirectusDatabase } from "./helpers/directus-postgres.mjs";

async function seedQueue(client, { id = "community-review-act", kind = "removed", proposed = {} } = {}) {
  await client.query(
    `INSERT INTO organizations (id, public_id, render_grain, name, cluster_key, status, source_primary)
     VALUES ($1, $1, 'flat', 'Review Act', $2, 'published', 'fsd')`,
    [id, `key-${id}`]
  );
  await client.query(
    `INSERT INTO services (id, organization_id, line_id, title, source, status, fsd_service_id, phone)
     VALUES ($1, $1, $1, 'Review Act', 'fsd', 'published', 'sid-act', '04 237 7749')`,
    [id]
  );
  const run = await client.query(
    `INSERT INTO import_runs (source, status) VALUES ('fsd', 'success') RETURNING id`
  );
  const queue = await client.query(
    `INSERT INTO review_queue_items (
       import_run_id, entity_type, entity_id, kind, proposed, status
     ) VALUES ($1, 'service', $2, $3, $4::jsonb, 'pending')
     RETURNING *`,
    [run.rows[0].id, id, kind, JSON.stringify({ auto_hide: false, ...proposed })]
  );
  return queue.rows[0];
}

test("Needs confirmation stays pending and lists under the deferred group", async (t) => {
  await withDirectusDatabase(t, async (client) => {
    const item = await seedQueue(client, { id: "community-defer-me", kind: "changed", proposed: { after: { phone: "04 9" } } });
    const result = await deferQueueItem({ db: client, queueItemId: item.id });
    assert.equal(result.deferred, true);
    const stored = await client.query(`SELECT proposed, status FROM review_queue_items WHERE id = $1`, [item.id]);
    assert.equal(stored.rows[0].status, "pending");
    assert.ok(stored.rows[0].proposed.deferred_at);
    const { items } = await listQueueItems({ db: client });
    const dto = items.find((row) => row.entityId === "community-defer-me");
    assert.equal(dto.deferred, true);
    assert.equal(dto.deferActionLabel, "Needs confirmation");
  });
});

test("keep as community writes community_owned and leaves the listing on the site", async (t) => {
  await withDirectusDatabase(t, async (client) => {
    const item = await seedQueue(client, { id: "community-keep-ours" });
    await keepAsCommunityReviewItem({ db: client, queueItemId: item.id, createdBy: "moana" });
    const service = await client.query(`SELECT status FROM services WHERE id = 'community-keep-ours'`);
    assert.equal(service.rows[0].status, "published");
    const override = await client.query(
      `SELECT action, status, patch FROM overrides WHERE target_id = 'community-keep-ours' AND action = 'community_owned'`
    );
    assert.equal(override.rowCount, 1);
    assert.equal(override.rows[0].status, "open");
    assert.equal(override.rows[0].patch.awaiting_return, true);
    const queue = await client.query(`SELECT status FROM review_queue_items WHERE id = $1`, [item.id]);
    assert.equal(queue.rows[0].status, "accepted");
  });
});

test("review undo restores a take-off and the hide override", async (t) => {
  await withDirectusDatabase(t, async (client) => {
    const item = await seedQueue(client, { id: "community-undo-me" });
    const { wrapReviewUndo } = await import("../scripts/review-actions.mjs");
    const hidden = await wrapReviewUndo(client, item.id, "hide", () =>
      hideReviewItem({ db: client, queueItemId: item.id, createdBy: "moana" })
    );
    const after = await client.query(`SELECT status FROM services WHERE id = 'community-undo-me'`);
    assert.equal(after.rows[0].status, "hidden");
    await undoReviewDecision({ db: client, undoId: hidden.undoId });
    const restored = await client.query(`SELECT status FROM services WHERE id = 'community-undo-me'`);
    assert.equal(restored.rows[0].status, "published");
    const queue = await client.query(`SELECT status FROM review_queue_items WHERE id = $1`, [item.id]);
    assert.equal(queue.rows[0].status, "pending");
    const hide = await client.query(
      `SELECT status FROM overrides WHERE target_id = 'community-undo-me' AND action = 'hide'`
    );
    assert.equal(hide.rowCount === 0 || hide.rows[0].status !== "open", true);
  });
});
