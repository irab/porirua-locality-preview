import test from "node:test";
import assert from "node:assert/strict";
import {
  archiveListing,
  createListing,
  getListing,
  listListings,
  listQueueItems,
  ListingError,
  nameMatches,
  queueItemCount,
  restoreListing,
  updateListing,
} from "../scripts/listings.mjs";
import { approveReviewItem } from "../scripts/approve-review.mjs";
import { withDirectusDatabase } from "./helpers/directus-postgres.mjs";

async function createPublishedOrg(client, { id, name, grain = "flat" } = {}) {
  await client.query(
    `INSERT INTO organizations (id, public_id, render_grain, name, cluster_key, status, source_primary)
     VALUES ($1, $1, $3, $2, $4, 'published', 'community')`,
    [id, name, grain, `key-${id}`]
  );
  await client.query(
    `INSERT INTO services (id, organization_id, line_id, title, source, status)
     VALUES ($1, $1, $1, $2, 'community', 'published')`,
    [id, name]
  );
}

test("createListing inserts a published community org and does not write a queue row", async (t) => {
  await withDirectusDatabase(t, async (client) => {
    const before = await queueItemCount(client);
    const created = await createListing({
      db: client,
      payload: {
        name: "Cannons Creek Hub",
        address: "1 Bedford Court",
        phone: "04 111 0000",
        communityFilters: ["community_groups"],
        categories: ["food"],
      },
    });
    assert.equal(created.organizationId, "community-cannons-creek-hub");
    assert.equal(created.serviceId, "community-cannons-creek-hub");
    const org = await client.query(`SELECT * FROM organizations WHERE id = $1`, [
      created.organizationId,
    ]);
    const service = await client.query(`SELECT * FROM services WHERE id = $1`, [created.serviceId]);
    assert.equal(org.rows[0].status, "published");
    assert.equal(org.rows[0].source_primary, "community");
    assert.equal(org.rows[0].render_grain, "flat");
    assert.equal(service.rows[0].status, "published");
    assert.equal(service.rows[0].source, "community");
    assert.equal(await queueItemCount(client), before);
  });
});

test("createListing returns 409 with matches unless confirmCreateAnyway", async (t) => {
  await withDirectusDatabase(t, async (client) => {
    await createPublishedOrg(client, {
      id: "community-porirua-whanau-centre",
      name: "Porirua Whānau Centre",
    });
    await assert.rejects(
      () =>
        createListing({
          db: client,
          payload: { name: "Porirua Whanau Centre" },
        }),
      (error) =>
        error instanceof ListingError &&
        error.statusCode === 409 &&
        error.extra.matches.some((row) => row.id === "community-porirua-whanau-centre")
    );
    const created = await createListing({
      db: client,
      payload: { name: "Porirua Whanau Centre", confirmCreateAnyway: true },
    });
    assert.ok(created.organizationId.startsWith("community-porirua-whanau-centre"));
    assert.notEqual(created.organizationId, "community-porirua-whanau-centre");
    assert.equal(await queueItemCount(client), 0);
  });
});

test("nameMatches includes hidden organisations", async (t) => {
  await withDirectusDatabase(t, async (client) => {
    await createPublishedOrg(client, { id: "community-hidden-hub", name: "Hidden Hub" });
    await client.query(`UPDATE organizations SET status = 'hidden' WHERE id = 'community-hidden-hub'`);
    const { matches } = await nameMatches({ db: client, name: "Hidden Hub" });
    assert.equal(matches.length, 1);
    assert.equal(matches[0].status, "hidden");
  });
});

test("a second public line on a flat org upgrades render_grain", async (t) => {
  await withDirectusDatabase(t, async (client) => {
    await createPublishedOrg(client, { id: "org-existing", name: "Existing Org" });
    await createListing({
      db: client,
      payload: {
        kind: "serviceLine",
        organizationId: "org-existing",
        title: "Budgeting",
        categories: ["money"],
      },
    });
    const org = await client.query(`SELECT render_grain, public_id, cluster_key FROM organizations WHERE id = 'org-existing'`);
    assert.equal(org.rows[0].render_grain, "organization");
    assert.equal(org.rows[0].public_id, "org-existing");
    assert.equal(org.rows[0].cluster_key, "key-org-existing");
    const lines = await client.query(`SELECT source, status FROM services WHERE organization_id = 'org-existing'`);
    assert.equal(lines.rows.length, 2);
    assert.ok(lines.rows.every((row) => row.source === "community"));
    assert.ok(lines.rows.every((row) => row.status === "published"));
  });
});

test("updateListing changes live fields and does not write a queue row", async (t) => {
  await withDirectusDatabase(t, async (client) => {
    const created = await createListing({
      db: client,
      payload: { name: "Update Me", phone: "04 111 0000" },
    });
    await updateListing({
      db: client,
      organizationId: created.organizationId,
      serviceId: created.serviceId,
      payload: { phone: "04 222 0000", address: "2 New Street" },
    });
    const org = await client.query(`SELECT phone, address FROM organizations WHERE id = $1`, [
      created.organizationId,
    ]);
    assert.equal(org.rows[0].phone, "04 222 0000");
    assert.equal(org.rows[0].address, "2 New Street");
    assert.equal(await queueItemCount(client), 0);
  });
});

test("archive hides the service and writes a hide override; restore reverses it", async (t) => {
  await withDirectusDatabase(t, async (client) => {
    await createPublishedOrg(client, { id: "community-archive-me", name: "Archive Me" });
    const archived = await archiveListing({
      db: client,
      serviceId: "community-archive-me",
      createdBy: "editor-1",
    });
    assert.equal(archived.onlyPublicLine, true);
    assert.equal(archived.organizationArchived, false);
    const service = await client.query(`SELECT status FROM services WHERE id = 'community-archive-me'`);
    const org = await client.query(`SELECT status FROM organizations WHERE id = 'community-archive-me'`);
    assert.equal(service.rows[0].status, "hidden");
    assert.equal(org.rows[0].status, "published");
    const hide = await client.query(`SELECT action, status FROM overrides WHERE target_id = 'community-archive-me'`);
    assert.equal(hide.rows[0].action, "hide");
    assert.equal(hide.rows[0].status, "open");

    await restoreListing({ db: client, serviceId: "community-archive-me" });
    const restored = await client.query(`SELECT status FROM services WHERE id = 'community-archive-me'`);
    assert.equal(restored.rows[0].status, "published");
  });
});

test("listListings uses On the site / Not on the site, not raw status enums", async (t) => {
  await withDirectusDatabase(t, async (client) => {
    await createPublishedOrg(client, { id: "community-status-words", name: "Status Words" });
    const { listings } = await listListings({ db: client });
    const row = listings.find((item) => item.id === "community-status-words");
    assert.equal(row.status, "published");
    assert.equal(row.statusLabel, "On the site");
  });
});

test("listQueueItems fills a before/after diff when weekly sync omitted before", async (t) => {
  await withDirectusDatabase(t, async (client) => {
    await createPublishedOrg(client, { id: "community-diff-me", name: "Diff Me" });
    await client.query(
      `UPDATE services SET phone = '04 237 7749', address = '1 Old Street' WHERE id = 'community-diff-me'`
    );
    const run = await client.query(
      `INSERT INTO import_runs (source, status) VALUES ('fsd', 'success') RETURNING id`
    );
    await client.query(
      `INSERT INTO review_queue_items (
         import_run_id, entity_type, entity_id, kind, proposed, status
       ) VALUES ($1, 'service', 'community-diff-me', 'changed', $2::jsonb, 'pending')`,
      [
        run.rows[0].id,
        JSON.stringify({ after: { phone: "04 237 9608", address: "9 New Street", name: "Diff Me" } }),
      ]
    );
    const { items } = await listQueueItems({ db: client });
    const item = items.find((row) => row.entityId === "community-diff-me");
    assert.equal(item.kindLabel, "Details changed");
    assert.equal(item.rejectActionLabel, "Don't use this change");
    assert.ok(item.diffRows.some((row) => row.line === "Phone: 04 237 7749 → 04 237 9608"));
    assert.ok(item.diffRows.some((row) => row.line === "Address: 1 Old Street → 9 New Street"));
    assert.equal(item.diffRows.some((row) => /lat|lng|-41/.test(row.line)), false);
  });
});

test("listQueueItems shows the live listing and keeps the queued before snapshot", async (t) => {
  await withDirectusDatabase(t, async (client) => {
    await createPublishedOrg(client, { id: "community-queued-before", name: "Queued Before" });
    await client.query(
      `UPDATE services SET phone = '04 237 7749', address = '1 Live Street' WHERE id = 'community-queued-before'`
    );
    const run = await client.query(
      `INSERT INTO import_runs (source, status) VALUES ('fsd', 'success') RETURNING id`
    );
    await client.query(
      `INSERT INTO review_queue_items (
         import_run_id, entity_type, entity_id, kind, proposed, status
       ) VALUES ($1, 'service', 'community-queued-before', 'changed', $2::jsonb, 'pending')`,
      [
        run.rows[0].id,
        JSON.stringify({
          before: { phone: "04 111 0000", address: "9 Queued Street", name: "Queued Before" },
          after: { phone: "04 237 9608", address: "9 New Street", name: "Queued Before" },
        }),
      ]
    );
    const { items } = await listQueueItems({ db: client });
    const item = items.find((row) => row.entityId === "community-queued-before");
    assert.equal(item.before.phone, "04 237 7749");
    assert.equal(item.before.address, "1 Live Street");
    assert.equal(item.queuedBefore.phone, "04 111 0000");
    assert.equal(item.queuedBefore.address, "9 Queued Street");
  });
});

test("listQueueItems does not invent deletions for a pin-check", async (t) => {
  await withDirectusDatabase(t, async (client) => {
    await createPublishedOrg(client, { id: "community-pin-only", name: "Pin Only" });
    await client.query(
      `UPDATE services SET phone = '04 237 7749', address = '1 Old Street', title = 'Pin Only Upper Hutt' WHERE id = 'community-pin-only'`
    );
    const run = await client.query(
      `INSERT INTO import_runs (source, status) VALUES ('fsd', 'success') RETURNING id`
    );
    await client.query(
      `INSERT INTO review_queue_items (
         import_run_id, entity_type, entity_id, kind, proposed, status
       ) VALUES ($1, 'service', 'community-pin-only', 'geocode_flag', $2::jsonb, 'pending')`,
      [run.rows[0].id, JSON.stringify({ geocode_flag: "sea" })]
    );
    const { items } = await listQueueItems({ db: client });
    const item = items.find((row) => row.entityId === "community-pin-only");
    assert.equal(item.kindLabel, "Check the map pin");
    assert.deepEqual(item.diffRows, []);
  });
});

test("listQueueItems skips Service name when the proposal has no name key", async (t) => {
  await withDirectusDatabase(t, async (client) => {
    await createPublishedOrg(client, { id: "community-name-gap", name: "Name Gap" });
    await client.query(
      `UPDATE services SET title = 'Supported Employment Service', categories = '["support"]'::jsonb WHERE id = 'community-name-gap'`
    );
    const run = await client.query(
      `INSERT INTO import_runs (source, status) VALUES ('fsd', 'success') RETURNING id`
    );
    await client.query(
      `INSERT INTO review_queue_items (
         import_run_id, entity_type, entity_id, kind, proposed, status
       ) VALUES ($1, 'service', 'community-name-gap', 'changed', $2::jsonb, 'pending')`,
      [
        run.rows[0].id,
        JSON.stringify({ after: { name: "Name Gap", categories: ["food"] } }),
      ]
    );
    const { items } = await listQueueItems({ db: client });
    const item = items.find((row) => row.entityId === "community-name-gap");
    assert.equal(item.name, "Name Gap");
    assert.equal(item.lineLabel, "Supported Employment Service");
    assert.equal(
      item.diffRows.some((row) => /Supported Employment|→ —/.test(row.line)),
      false
    );
    assert.ok(item.diffRows.some((row) => row.line.startsWith("Help types:")));
  });
});

test("listQueueItems returns recently finished work from closed rows, not a session counter", async (t) => {
  await withDirectusDatabase(t, async (client) => {
    await createPublishedOrg(client, { id: "community-finished", name: "Finished Org" });
    await client.query(
      `UPDATE services SET address = '1 Old Street' WHERE id = 'community-finished'`
    );
    const run = await client.query(
      `INSERT INTO import_runs (source, status) VALUES ('fsd', 'success') RETURNING id`
    );
    const queued = await client.query(
      `INSERT INTO review_queue_items (
         import_run_id, entity_type, entity_id, kind, proposed, status
       ) VALUES ($1, 'service', 'community-finished', 'changed', $2::jsonb, 'pending')
       RETURNING id`,
      [
        run.rows[0].id,
        JSON.stringify({
          before: { address: "1 Old Street", name: "Finished Org" },
          after: { address: "9 New Street", name: "Finished Org" },
        }),
      ]
    );
    const before = await listQueueItems({ db: client });
    assert.equal(before.recent.some((row) => row.organizationId === "community-finished"), false);
    await approveReviewItem({ db: client, queueItemId: queued.rows[0].id });
    const after = await listQueueItems({ db: client });
    const row = after.recent.find((item) => item.organizationId === "community-finished");
    assert.ok(row);
    assert.equal(row.name, "Finished Org");
    assert.equal(row.lineLabel, "");
    assert.equal(row.decisionLabel, "Accepted this change");
    assert.equal(row.listingLabel, "Open listing");
    const stored = await client.query(`SELECT proposed, status FROM review_queue_items WHERE id = $1`, [
      queued.rows[0].id,
    ]);
    assert.equal(stored.rows[0].status, "accepted");
    assert.equal(stored.rows[0].proposed.editor_decision.action, "approve");
  });
});

test("listQueueItems keeps two service lines under one organisation distinct", async (t) => {
  await withDirectusDatabase(t, async (client) => {
    await createPublishedOrg(client, {
      id: "org-tenancy-services",
      name: "Tenancy Services",
      grain: "organization",
    });
    await client.query(`DELETE FROM services WHERE organization_id = 'org-tenancy-services'`);
    await client.query(
      `INSERT INTO services (id, organization_id, line_id, title, source, status)
       VALUES
         ('fsd-35898', 'org-tenancy-services', 'fsd-35898', 'Dispute resolution service for tenants and landlords', 'fsd', 'published'),
         ('fsd-3964', 'org-tenancy-services', 'fsd-3964', 'Information, advice and templates on tenancy', 'fsd', 'published')`
    );
    const run = await client.query(
      `INSERT INTO import_runs (source, status) VALUES ('fsd', 'success') RETURNING id`
    );
    await client.query(
      `INSERT INTO review_queue_items (
         import_run_id, entity_type, entity_id, kind, proposed, status
       ) VALUES
         ($1, 'service', 'fsd-35898', 'changed', $2::jsonb, 'pending'),
         ($1, 'service', 'fsd-3964', 'changed', $3::jsonb, 'pending')`,
      [
        run.rows[0].id,
        JSON.stringify({
          before: { categories: ["housing", "money"], name: "Tenancy Services" },
          after: { categories: ["housing", "money", "legal"], name: "Tenancy Services" },
        }),
        JSON.stringify({
          before: { categories: ["housing", "money", "support"], name: "Tenancy Services" },
          after: { categories: ["housing", "money", "support", "legal"], name: "Tenancy Services" },
        }),
      ]
    );
    const { items } = await listQueueItems({ db: client });
    const dispute = items.find((row) => row.entityId === "fsd-35898");
    const advice = items.find((row) => row.entityId === "fsd-3964");
    assert.equal(dispute.name, "Tenancy Services");
    assert.equal(advice.name, "Tenancy Services");
    assert.equal(dispute.lineLabel, "Dispute resolution service for tenants and landlords");
    assert.equal(advice.lineLabel, "Information, advice and templates on tenancy");
    assert.notEqual(dispute.lineLabel, advice.lineLabel);
  });
});

test("getListing marks curated fields You set this earlier on a plain edit", async (t) => {
  await withDirectusDatabase(t, async (client) => {
    await createPublishedOrg(client, { id: "community-locked-edit", name: "Locked Edit" });
    await client.query(
      `UPDATE services SET address = '22 Ngati Toa Street', lat = -41.12, lng = 174.83 WHERE id = 'community-locked-edit'`
    );
    await client.query(
      `INSERT INTO overrides (id, target_type, target_id, action, patch, status)
       VALUES ('service:community-locked-edit:patch', 'service', 'community-locked-edit', 'patch', $1::jsonb, 'open')`,
      [JSON.stringify({ address: "22 Ngati Toa Street", lat: -41.12, lng: 174.83 })]
    );
    const listing = await getListing({ db: client, organizationId: "community-locked-edit" });
    assert.deepEqual(
      listing.services[0].youSetThis.map((row) => row.label).sort(),
      ["Address", "Map pin"]
    );
  });
});
