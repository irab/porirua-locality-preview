import test from "node:test";
import assert from "node:assert/strict";
import { columnNames, tableNames, withTestDatabase } from "./helpers/postgres.mjs";

const REQUIRED_TABLES = [
  "catalog_publish_events",
  "catalog_snapshots",
  "editor_undo",
  "import_runs",
  "organizations",
  "overrides",
  "public_id_aliases",
  "review_queue_items",
  "services",
];

const ORGANIZATION_COLUMNS = [
  "id",
  "public_id",
  "render_grain",
  "name",
  "description",
  "phone",
  "url",
  "email",
  "address",
  "lat",
  "lng",
  "org_type",
  "community_filters",
  "community_meta",
  "source_primary",
  "status",
  "duplicate_of",
  "merged_into",
  "merge_reason",
  "cluster_key",
  "sort_key",
  "created_at",
  "updated_at",
  "published_at",
];

const SERVICE_COLUMNS = [
  "id",
  "organization_id",
  "line_id",
  "title",
  "service_name",
  "description",
  "phone",
  "url",
  "address",
  "lat",
  "lng",
  "categories",
  "badges",
  "source",
  "fsd_service_id",
  "fsd_legacy_id",
  "status",
  "duplicate_of",
  "raw_import",
  "sort_key",
  "created_at",
  "updated_at",
];

const IMPORT_RUN_COLUMNS = [
  "id",
  "source",
  "status",
  "fsd_csv_url",
  "started_at",
  "finished_at",
  "error_message",
  "stats",
  "notes",
];

const REVIEW_QUEUE_COLUMNS = [
  "id",
  "import_run_id",
  "entity_type",
  "entity_id",
  "kind",
  "proposed",
  "status",
  "created_at",
  "updated_at",
  "change_summary",
];

test("schema creates the catalog tables with sync-ready columns", async (t) => {
  await withTestDatabase(t, async (client) => {
    const tables = await tableNames(client);
    for (const table of REQUIRED_TABLES) {
      assert.ok(tables.includes(table), `missing table ${table}`);
    }

    assert.deepEqual(await columnNames(client, "organizations"), ORGANIZATION_COLUMNS);
    assert.deepEqual(await columnNames(client, "services"), SERVICE_COLUMNS);
    assert.deepEqual(await columnNames(client, "import_runs"), IMPORT_RUN_COLUMNS);
    assert.deepEqual(await columnNames(client, "review_queue_items"), REVIEW_QUEUE_COLUMNS);

    const uniquePublicId = await client.query(
      `SELECT 1
         FROM pg_constraint
        WHERE conrelid = 'organizations'::regclass
          AND contype = 'u'
          AND pg_get_constraintdef(oid) ILIKE '%public_id%'`
    );
    assert.equal(uniquePublicId.rowCount, 1);

    const oneCurrent = await client.query(
      `SELECT indexdef FROM pg_indexes
        WHERE tablename = 'catalog_snapshots' AND indexdef ILIKE '%is_current%'`
    );
    assert.ok(
      oneCurrent.rows.some((row) => /WHERE/i.test(row.indexdef)),
      "catalog_snapshots needs a partial unique index on is_current"
    );
  });
});

test("public_id uniqueness and organization_id are enforced", async (t) => {
  await withTestDatabase(t, async (client) => {
    await client.query(
      `INSERT INTO organizations (id, public_id, render_grain, cluster_key)
       VALUES ('org-a', 'org-a', 'flat', 'k')`
    );
    await assert.rejects(
      () =>
        client.query(
          `INSERT INTO organizations (id, public_id, render_grain, cluster_key)
           VALUES ('org-b', 'org-a', 'flat', 'k')`
        ),
      /organizations_public_id/
    );
    await assert.rejects(
      () =>
        client.query(
          `INSERT INTO services (id, organization_id, line_id)
           VALUES ('s1', 'missing-org', 'line-1')`
        ),
      /organization_id/
    );
  });
});

test("change_summary names the listing fields that actually moved", async (t) => {
  await withTestDatabase(t, async (client) => {
    const run = await client.query(
      `INSERT INTO import_runs (source, status) VALUES ('fsd', 'success') RETURNING id`
    );
    const changed = await client.query(
      `INSERT INTO review_queue_items (
         import_run_id, entity_type, entity_id, kind, proposed, status
       ) VALUES (
         $1, 'service', 'fsd-1', 'changed', $2::jsonb, 'pending'
       ) RETURNING change_summary`,
      [
        run.rows[0].id,
        JSON.stringify({
          before: { address: "1 Old Street", phone: "04 111", name: "Same" },
          after: { address: "9 New Street", phone: "04 999", name: "Same", SERVICE_ID: "1" },
        }),
      ]
    );
    assert.equal(changed.rows[0].change_summary, "Changing address, phone");

    const flag = await client.query(
      `INSERT INTO review_queue_items (
         import_run_id, entity_type, entity_id, kind, proposed, status
       ) VALUES (
         $1, 'service', 'fsd-2', 'geocode_flag', $2::jsonb, 'pending'
       ) RETURNING change_summary`,
      [
        run.rows[0].id,
        JSON.stringify({
          geocode_flag: { code: "GEOCODE_OUTSIDE_PORIRUA_BOUNDS", detail: "Coordinates outside the box" },
        }),
      ]
    );
    assert.equal(flag.rows[0].change_summary, "Coordinates outside the box");
  });
});
