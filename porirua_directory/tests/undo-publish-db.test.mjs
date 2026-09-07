import test from "node:test";
import assert from "node:assert/strict";
import { CATALOG_PUBLIC_URL } from "../scripts/lib/edge-cache.mjs";
import { publishStatus, updateListing } from "../scripts/listings.mjs";
import { getCurrentSnapshot, publishCatalog } from "../scripts/publish-catalog.mjs";
import { undoPublish } from "../scripts/undo-publish.mjs";
import { UNDO_PUBLISH_STALE } from "../editor-core/undo-publish.mjs";
import { withDirectusDatabase } from "./helpers/directus-postgres.mjs";

async function seedListing(client, name = "First Name") {
  await client.query(
    `INSERT INTO organizations (id, public_id, render_grain, name, cluster_key, status, source_primary)
     VALUES ('org-1', 'org-1', 'flat', $1, 'key-1', 'published', 'community')`,
    [name]
  );
  await client.query(
    `INSERT INTO services (id, organization_id, line_id, title, source, status)
     VALUES ('org-1', 'org-1', 'org-1', $1, 'community', 'published')`,
    [name]
  );
}

function listingName(envelope) {
  return envelope.services[0]?.name;
}

test("first publish has no Undo publish because there is no previous snapshot", async (t) => {
  await withDirectusDatabase(t, async (client) => {
    await seedListing(client);
    await publishCatalog({ db: client, publishedBy: "moana", purge: async () => {} });
    const status = await publishStatus({ db: client });
    assert.equal(status.canUndoPublish, false);
    assert.equal(status.previousVersion, null);
    await assert.rejects(
      () => undoPublish({ db: client, expectedVersion: status.currentVersion, undoneBy: "moana", purge: async () => {} }),
      /nothing to undo/i
    );
  });
});

test("two publishes and a stale expected version refuse instead of rolling back the later publish", async (t) => {
  await withDirectusDatabase(t, async (client) => {
    await seedListing(client, "Moana version");
    const first = await publishCatalog({ db: client, publishedBy: "moana", purge: async () => {} });
    await client.query(`UPDATE organizations SET name = 'Kahu version' WHERE id = 'org-1'`);
    const second = await publishCatalog({ db: client, publishedBy: "kahu", purge: async () => {} });
    assert.notEqual(second.version, first.version);

    await assert.rejects(
      () =>
        undoPublish({
          db: client,
          expectedVersion: first.version,
          undoneBy: "moana",
          purge: async () => {},
        }),
      (error) => error.statusCode === 409 && error.message === UNDO_PUBLISH_STALE
    );

    const current = await getCurrentSnapshot(client);
    assert.equal(Number(current.version), second.version);
    assert.equal(listingName(current.envelope), "Kahu version");
  });
});

test("undo publish restores the previous public snapshot and leaves live rows alone", async (t) => {
  await withDirectusDatabase(t, async (client) => {
    await seedListing(client, "On the site");
    await publishCatalog({ db: client, publishedBy: "moana", purge: async () => {} });
    await client.query(`UPDATE organizations SET name = 'Waiting name' WHERE id = 'org-1'`);
    const published = await publishCatalog({ db: client, publishedBy: "moana", purge: async () => {} });

    await updateListing({
      db: client,
      organizationId: "org-1",
      payload: { name: "Edited after publish" },
    });

    const purged = [];
    const undone = await undoPublish({
      db: client,
      expectedVersion: published.version,
      undoneBy: "moana",
      purge: async (urls) => {
        purged.push(urls);
      },
    });

    const current = await getCurrentSnapshot(client);
    assert.equal(Number(current.version), undone.version);
    assert.equal(listingName(current.envelope), "On the site");
    assert.deepEqual(purged, [[CATALOG_PUBLIC_URL]]);

    const live = await client.query(`SELECT name FROM organizations WHERE id = 'org-1'`);
    assert.equal(live.rows[0].name, "Edited after publish");

    const status = await publishStatus({ db: client });
    assert.equal(status.canUndoPublish, false);
    assert.equal(status.unpublished, true);
    assert.ok(status.unpublishedCount >= 1);
  });
});

test("undo publish records who published and who undid alongside the snapshot version", async (t) => {
  await withDirectusDatabase(t, async (client) => {
    await seedListing(client, "First");
    const first = await publishCatalog({ db: client, publishedBy: "moana", purge: async () => {} });
    await client.query(`UPDATE organizations SET name = 'Second' WHERE id = 'org-1'`);
    const second = await publishCatalog({ db: client, publishedBy: "moana", purge: async () => {} });
    await undoPublish({
      db: client,
      expectedVersion: second.version,
      undoneBy: "moana",
      purge: async () => {},
    });

    const events = await client.query(
      `SELECT action, snapshot_version, previous_version, actor
         FROM catalog_publish_events
        ORDER BY created_at ASC, action ASC`
    );
    assert.equal(events.rows.length, 3);
    assert.equal(events.rows[0].action, "publish");
    assert.equal(Number(events.rows[0].snapshot_version), first.version);
    assert.equal(events.rows[0].actor, "moana");
    assert.equal(events.rows[1].action, "publish");
    assert.equal(Number(events.rows[1].snapshot_version), second.version);
    assert.equal(Number(events.rows[1].previous_version), first.version);
    assert.equal(events.rows[2].action, "undo-publish");
    assert.equal(Number(events.rows[2].snapshot_version), second.version);
    assert.equal(events.rows[2].actor, "moana");
    assert.ok(events.rows.every((row) => row.actor && Number.isFinite(Number(row.snapshot_version))));
  });
});
