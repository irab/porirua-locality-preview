import test from "node:test";
import assert from "node:assert/strict";
import {
  approveReviewItem,
  editAndApproveReviewItem,
  hideReviewItem,
  keepCurationReviewItem,
  rejectReviewItem,
  rawImportFromAccepted,
} from "../scripts/approve-review.mjs";
import { diffFsdCatalog } from "../scripts/fsd-sync-diff.mjs";
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

const CANONICAL_EMPTY = {
  serviceName: "",
  url: "",
  categories: [],
  fsd_service_id: null,
  fsd_legacy_id: null,
};

const PARTIAL_BASELINE = {
  name: "Old Name",
  serviceName: "Support",
  description: "Old blurb",
  phone: "04 111 2222",
  url: "https://example.org/keep-me",
  address: "1 Old Street",
  lat: -41.13,
  lng: 174.84,
  categories: ["food", "health"],
  fsd_service_id: "2964",
  fsd_legacy_id: "2964",
};

async function seedReview(client, {
  proposedAfter = PROPOSED_AFTER,
  rawImport = RAW_BEFORE,
  status = "pending_review",
  address = "1 Old Street",
  title = "Support",
  serviceName = "Support",
  fsdServiceId = null,
  kind = "changed",
} = {}) {
  await client.query(
    `INSERT INTO organizations (id, public_id, render_grain, name, cluster_key, status, source_primary)
     VALUES ('org-fsd', 'fsd-2964', 'flat', 'Old Name', 'key-fsd', 'published', 'fsd')`
  );
  await client.query(
    `INSERT INTO services (
       id, organization_id, line_id, title, service_name, address, phone, lat, lng,
       source, status, raw_import, description, fsd_service_id, fsd_legacy_id
     ) VALUES (
       'fsd-2964', 'org-fsd', 'fsd-2964', $3, $4,
       $5, '04 111 2222', -41.13, 174.84,
       'fsd', $2, $1::jsonb, 'Old blurb', $6, $6
     )`,
    [JSON.stringify(rawImport), status, title, serviceName, address, fsdServiceId]
  );
  const run = await client.query(
    `INSERT INTO import_runs (source, status)
     VALUES ('fsd', 'success')
     RETURNING id`
  );
  const queue = await client.query(
    `INSERT INTO review_queue_items (
       import_run_id, entity_type, entity_id, kind, proposed, status
     ) VALUES ($1, 'service', 'fsd-2964', $3, $2::jsonb, 'pending')
     RETURNING id`,
    [run.rows[0].id, JSON.stringify({ before: rawImport, after: proposedAfter }), kind]
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
    const { queueItemId } = await seedReview(client);
    await approveReviewItem({ db: client, queueItemId });

    const service = await readService(client);
    assert.equal(service.status, "published");
    assert.equal(service.address, "9 New Street");
    assert.equal(service.phone, "04 999 0000");
    assert.equal(service.description, "Updated blurb");
    assert.equal(Number(service.lat), -41.14);
    assert.equal(Number(service.lng), 174.85);
    assert.deepEqual(
      service.raw_import,
      rawImportFromAccepted(RAW_BEFORE, PROPOSED_AFTER)
    );
    assert.deepEqual(service.raw_import, {
      ...RAW_BEFORE,
      ...PROPOSED_AFTER,
      ...CANONICAL_EMPTY,
    });

    const queue = await readQueue(client, queueItemId);
    assert.equal(queue.status, "accepted");
  });
});

test("a partial address approve keeps previous url and categories so the next sync is unchanged", async (t) => {
  await withDirectusDatabase(t, async (client) => {
    const { queueItemId } = await seedReview(client, {
      rawImport: PARTIAL_BASELINE,
      proposedAfter: { address: "9 New Street" },
      fsdServiceId: "2964",
    });
    await approveReviewItem({ db: client, queueItemId });

    const service = await readService(client);
    assert.equal(service.address, "9 New Street");
    assert.equal(service.raw_import.address, "9 New Street");
    assert.equal(service.raw_import.url, "https://example.org/keep-me");
    assert.deepEqual(service.raw_import.categories, ["food", "health"]);
    assert.equal(service.raw_import.serviceName, "Support");
    assert.equal(service.raw_import.fsd_service_id, "2964");

    const incoming = {
      SERVICE_ID: "2964",
      name: PARTIAL_BASELINE.name,
      serviceName: PARTIAL_BASELINE.serviceName,
      description: PARTIAL_BASELINE.description,
      phone: PARTIAL_BASELINE.phone,
      url: PARTIAL_BASELINE.url,
      address: "9 New Street",
      lat: PARTIAL_BASELINE.lat,
      lng: PARTIAL_BASELINE.lng,
      categories: PARTIAL_BASELINE.categories,
    };
    const items = diffFsdCatalog(
      [incoming],
      [{ fsd_service_id: "2964", status: "published", raw_import: service.raw_import }]
    );
    assert.equal(items[0].kind, "unchanged");
  });
});

test("a sparse baseline plus an omitted categories key fills [] from RAW_IMPORT_DEFAULTS", () => {
  const sparseBaseline = {
    name: "Old Name",
    serviceName: "Support",
    description: "Old blurb",
    phone: "04 111 2222",
    url: "https://example.org/keep-me",
    address: "1 Old Street",
    lat: -41.13,
    lng: 174.84,
  };
  const accepted = { address: "9 New Street" };
  assert.equal(Object.hasOwn(sparseBaseline, "categories"), false);
  assert.equal(Object.hasOwn(accepted, "categories"), false);

  const written = rawImportFromAccepted(sparseBaseline, accepted);
  assert.deepEqual(written, {
    ...sparseBaseline,
    address: "9 New Street",
    categories: [],
    fsd_service_id: null,
    fsd_legacy_id: null,
  });
});

test("edit-and-approve applies the editor payload then refreshes raw_import", async (t) => {
  await withDirectusDatabase(t, async (client) => {
    const { queueItemId } = await seedReview(client);
    const edited = { ...PROPOSED_AFTER, address: "Editor-corrected Street" };
    await editAndApproveReviewItem({ db: client, queueItemId, payload: edited });

    const service = await readService(client);
    assert.equal(service.status, "published");
    assert.equal(service.address, "Editor-corrected Street");
    assert.equal(service.raw_import.address, "Editor-corrected Street");
    assert.equal((await readQueue(client, queueItemId)).status, "accepted");
  });
});

test("edit-and-approve with database-style keys updates live columns and raw_import", async (t) => {
  await withDirectusDatabase(t, async (client) => {
    const { queueItemId } = await seedReview(client, { proposedAfter: {} });
    await editAndApproveReviewItem({
      db: client,
      queueItemId,
      payload: {
        service_name: "Clinic line",
        title: "Clinic line title",
        address: "12 Database Street",
      },
    });

    const service = await readService(client);
    assert.equal(service.service_name, "Clinic line");
    assert.equal(service.title, "Clinic line title");
    assert.equal(service.address, "12 Database Street");
    assert.equal(service.raw_import.serviceName, "Clinic line");
    assert.equal(service.raw_import.address, "12 Database Street");
    assert.equal((await readQueue(client, queueItemId)).status, "accepted");
  });
});

test("accepting a removed item archives the service and does not republish proposed.after", async (t) => {
  await withDirectusDatabase(t, async (client) => {
    const { queueItemId } = await seedReview(client, {
      kind: "removed",
      proposedAfter: { auto_hide: false },
      status: "published",
    });
    const before = await readService(client);
    await approveReviewItem({ db: client, queueItemId, createdBy: "editor-1" });

    const service = await readService(client);
    assert.equal(service.status, "hidden");
    assert.equal(service.address, before.address);
    assert.equal(service.phone, before.phone);
    assert.notEqual(service.status, "published");

    const override = await client.query(
      `SELECT target_type, target_id, action, status FROM overrides WHERE action = 'hide'`
    );
    assert.equal(override.rows.length, 1);
    assert.equal(override.rows[0].target_type, "service");
    assert.equal(override.rows[0].target_id, "fsd-2964");
    assert.equal(override.rows[0].status, "open");
    assert.equal((await readQueue(client, queueItemId)).status, "accepted");
  });
});

test("hide writes a hide override, hides the service, and accepts the queue item", async (t) => {
  await withDirectusDatabase(t, async (client) => {
    const { queueItemId } = await seedReview(client);
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

test("keep-curation refreshes raw_import and leaves the live curated columns alone", async (t) => {
  await withDirectusDatabase(t, async (client) => {
    const { queueItemId } = await seedReview(client, {
      proposedAfter: { address: "9 New Street" },
    });
    await keepCurationReviewItem({ db: client, queueItemId });
    const service = await readService(client);
    assert.equal(service.address, "1 Old Street");
    assert.equal(service.raw_import.address, "9 New Street");
    assert.equal((await readQueue(client, queueItemId)).status, "accepted");
  });
});

test("reject leaves the stored record on raw_import and marks the queue item rejected", async (t) => {
  await withDirectusDatabase(t, async (client) => {
    const { queueItemId } = await seedReview(client);
    await rejectReviewItem({ db: client, queueItemId });

    const service = await readService(client);
    assert.equal(service.status, "published");
    assert.equal(service.address, "1 Old Street");
    assert.deepEqual(service.raw_import, RAW_BEFORE);
    assert.equal((await readQueue(client, queueItemId)).status, "rejected");
  });
});

test("rejecting a proposal against a hidden record leaves it hidden", async (t) => {
  await withDirectusDatabase(t, async (client) => {
    const { queueItemId } = await seedReview(client, {
      status: "hidden",
      address: "9 Proposed Street",
      rawImport: RAW_BEFORE,
      proposedAfter: { address: "9 Proposed Street" },
    });
    await rejectReviewItem({ db: client, queueItemId });

    const service = await readService(client);
    assert.equal(service.status, "hidden");
    assert.equal(service.address, "1 Old Street");
    assert.deepEqual(service.raw_import, RAW_BEFORE);
    assert.equal((await readQueue(client, queueItemId)).status, "rejected");
  });
});
