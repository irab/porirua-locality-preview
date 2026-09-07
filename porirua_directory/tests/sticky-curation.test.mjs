import test from "node:test";
import assert from "node:assert/strict";
import { upsertStickyOverride } from "../scripts/directus/sticky-curation.mjs";
import { withDirectusDatabase } from "./helpers/directus-postgres.mjs";

async function seedFsdService(client) {
  await client.query(
    `INSERT INTO organizations (id, public_id, render_grain, name, cluster_key, status, source_primary)
     VALUES ('org-fsd', 'fsd-2964', 'flat', 'Whānau Centre', 'key-fsd', 'published', 'fsd')`
  );
  await client.query(
    `INSERT INTO services (
       id, organization_id, line_id, title, service_name, address, lat, lng, source, status, raw_import
     ) VALUES (
       'fsd-2964', 'org-fsd', 'fsd-2964', 'Support', 'Support',
       '1 Walton Leigh Avenue', -41.13, 174.84, 'fsd', 'published', $1::jsonb
     )`,
    [
      JSON.stringify({
        address: "1 Walton Leigh Avenue",
        lat: -41.13,
        lng: 174.84,
        phone: "04 111 2222",
      }),
    ]
  );
}

async function readOverrides(client) {
  const result = await client.query(
    `SELECT id, target_type, target_id, action, patch, reason, status, created_by
       FROM overrides
      ORDER BY target_type, target_id, action`
  );
  return result.rows;
}

test("saving curated fields on an FSD service upserts one patch override that Postgres stores", async (t) => {
  await withDirectusDatabase(t, async (client) => {
    await seedFsdService(client);
    await upsertStickyOverride({
      db: client,
      collection: "services",
      key: "fsd-2964",
      payload: { address: "2 Walton Leigh Avenue", lat: -41.14 },
      createdBy: "editor-1",
    });

    const rows = await readOverrides(client);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].target_type, "service");
    assert.equal(rows[0].target_id, "fsd-2964");
    assert.equal(rows[0].action, "patch");
    assert.equal(rows[0].status, "open");
    assert.equal(rows[0].created_by, "editor-1");
    assert.equal(typeof rows[0].id, "string");
    assert.ok(rows[0].id.length > 0);
    assert.deepEqual(rows[0].patch, {
      address: "2 Walton Leigh Avenue",
      lat: -41.14,
    });
  });
});

test("a second save merges keys into the same override row and does not insert another", async (t) => {
  await withDirectusDatabase(t, async (client) => {
    await seedFsdService(client);
    await upsertStickyOverride({
      db: client,
      collection: "services",
      key: "fsd-2964",
      payload: { address: "2 Walton Leigh Avenue" },
      createdBy: "editor-1",
    });
    await upsertStickyOverride({
      db: client,
      collection: "services",
      key: "fsd-2964",
      payload: { lng: 174.85 },
      createdBy: "editor-2",
    });

    const rows = await readOverrides(client);
    assert.equal(rows.length, 1);
    assert.deepEqual(rows[0].patch, {
      address: "2 Walton Leigh Avenue",
      lng: 174.85,
    });
    assert.equal(rows[0].created_by, "editor-1");
  });
});

test("community-sourced saves do not write overrides", async (t) => {
  await withDirectusDatabase(t, async (client) => {
    await client.query(
      `INSERT INTO organizations (id, public_id, render_grain, name, cluster_key, status, source_primary)
       VALUES ('org-com', 'community-1', 'organization', 'Marae', 'key-com', 'published', 'community')`
    );
    await client.query(
      `INSERT INTO services (id, organization_id, line_id, title, source, status)
       VALUES ('community-1', 'org-com', 'community-1', 'Hui', 'community', 'published')`
    );
    await upsertStickyOverride({
      db: client,
      collection: "services",
      key: "community-1",
      payload: { address: "New address" },
      createdBy: "editor-1",
    });
    assert.deepEqual(await readOverrides(client), []);
  });
});

test("fields that still match raw_import are not written into the patch", async (t) => {
  await withDirectusDatabase(t, async (client) => {
    await seedFsdService(client);
    await upsertStickyOverride({
      db: client,
      collection: "services",
      key: "fsd-2964",
      payload: { address: "1 Walton Leigh Avenue", phone: "04 999 0000" },
      createdBy: "editor-1",
    });
    const rows = await readOverrides(client);
    assert.equal(rows.length, 1);
    assert.deepEqual(rows[0].patch, { phone: "04 999 0000" });
  });
});
