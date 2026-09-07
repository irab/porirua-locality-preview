import test from "node:test";
import assert from "node:assert/strict";
import {
  approveReviewItem,
  editAndApproveReviewItem,
  hideReviewItem,
  rejectReviewItem,
} from "../scripts/approve-review.mjs";
import { withDirectusDatabase } from "./helpers/directus-postgres.mjs";

const RAW_BEFORE = {
  name: "Old Name",
  address: "1 Old Street",
  phone: "04 111 2222",
  lat: -41.13,
  lng: 174.84,
};

const PROPOSED_AFTER = {
  name: "Accepted Name",
  address: "9 New Street",
  phone: "04 999 0000",
  lat: -41.14,
  lng: 174.85,
  description: "Updated blurb",
};

async function seedPendingReview(client, proposedAfter = PROPOSED_AFTER) {
  await client.query(
    `INSERT INTO organizations (id, public_id, render_grain, name, cluster_key, status, source_primary)
     VALUES ('org-fsd', 'fsd-2964', 'flat', 'Old Name', 'key-fsd', 'published', 'fsd')`
  );
  await client.query(
    `INSERT INTO services (
       id, organization_id, line_id, title, service_name, address, phone, lat, lng,
       source, status, raw_import, description
     ) VALUES (
       'fsd-2964', 'org-fsd', 'fsd-2964', 'Support', 'Support',
       '1 Old Street', '04 111 2222', -41.13, 174.84,
       'fsd', 'pending_review', $1::jsonb, 'Old blurb'
     )`,
    [JSON.stringify(RAW_BEFORE)]
  );
  const run = await client.query(
    `INSERT INTO import_runs (source, status)
     VALUES ('fsd', 'success')
     RETURNING id`
  );
  const queue = await client.query(
    `INSERT INTO review_queue_items (
       import_run_id, entity_type, entity_id, kind, proposed, status
     ) VALUES ($1, 'service', 'fsd-2964', 'changed', $2::jsonb, 'pending')
     RETURNING id`,
    [run.rows[0].id, JSON.stringify({ before: RAW_BEFORE, after: proposedAfter })]
  );
  return { queueItemId: queue.rows[0].id };
}

async function readService(client, id = "fsd-2964") {
  const result = await client.query(`SELECT * FROM services WHERE id = $1`, [id]);
  return result.rows[0];
}

async function readQueue(client, id) {
  const result = await client.query(`SELECT * FROM review_queue_items WHERE id = $1`, [id]);
  return result.rows[0];
}

test("approve applies proposed.after, publishes, and refreshes raw_import so weekly sync will not re-queue", async (t) => {
  await withDirectusDatabase(t, async (client) => {
    const { queueItemId } = await seedPendingReview(client);
    await approveReviewItem({ db: client, queueItemId });

    const service = await readService(client);
    assert.equal(service.status, "published");
    assert.equal(service.address, "9 New Street");
    assert.equal(service.phone, "04 999 0000");
    assert.equal(service.description, "Updated blurb");
    assert.equal(Number(service.lat), -41.14);
    assert.equal(Number(service.lng), 174.85);
    assert.deepEqual(service.raw_import, {
      ...RAW_BEFORE,
      ...PROPOSED_AFTER,
    });

    const queue = await readQueue(client, queueItemId);
    assert.equal(queue.status, "accepted");
  });
});

test("edit-and-approve applies the editor payload then refreshes raw_import", async (t) => {
  await withDirectusDatabase(t, async (client) => {
    const { queueItemId } = await seedPendingReview(client);
    const edited = { ...PROPOSED_AFTER, address: "Editor-corrected Street" };
    await editAndApproveReviewItem({ db: client, queueItemId, payload: edited });

    const service = await readService(client);
    assert.equal(service.status, "published");
    assert.equal(service.address, "Editor-corrected Street");
    assert.equal(service.raw_import.address, "Editor-corrected Street");
    assert.equal((await readQueue(client, queueItemId)).status, "accepted");
  });
});

test("hide writes a hide override, hides the service, and accepts the queue item", async (t) => {
  await withDirectusDatabase(t, async (client) => {
    const { queueItemId } = await seedPendingReview(client);
    await hideReviewItem({ db: client, queueItemId, createdBy: "editor-1" });

    const service = await readService(client);
    assert.equal(service.status, "hidden");
    const override = await client.query(
      `SELECT target_type, target_id, action, status, created_by FROM overrides`
    );
    assert.equal(override.rows.length, 1);
    assert.equal(override.rows[0].target_type, "service");
    assert.equal(override.rows[0].target_id, "fsd-2964");
    assert.equal(override.rows[0].action, "hide");
    assert.equal(override.rows[0].status, "open");
    assert.equal((await readQueue(client, queueItemId)).status, "accepted");
  });
});

test("reject leaves the stored record on raw_import and marks the queue item rejected", async (t) => {
  await withDirectusDatabase(t, async (client) => {
    const { queueItemId } = await seedPendingReview(client);
    await rejectReviewItem({ db: client, queueItemId });

    const service = await readService(client);
    assert.equal(service.status, "published");
    assert.equal(service.address, "1 Old Street");
    assert.deepEqual(service.raw_import, RAW_BEFORE);
    assert.equal((await readQueue(client, queueItemId)).status, "rejected");
  });
});
