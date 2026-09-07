import test from "node:test";
import assert from "node:assert/strict";
import {
  archiveListing,
  createListing,
  ListingError,
  nameMatches,
  queueItemCount,
  restoreListing,
  updateListing,
} from "../scripts/listings.mjs";
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
