import test from "node:test";
import assert from "node:assert/strict";
import { DATABASE_URL, TEST_DATABASE_URL } from "../scripts/config.mjs";
import { applySchema, closePool, getPool, query, withTransaction } from "../scripts/lib/db.mjs";
import { exclusiveTestDatabase, probeTestDatabase } from "./helpers/postgres.mjs";

test("pooled client reads DATABASE_URL via config.mjs", async (t) => {
  if (!(await probeTestDatabase())) {
    t.skip(
      "test database is not reachable; run docker compose -f docker-compose.test.yml up -d --wait"
    );
    return;
  }

  await exclusiveTestDatabase(async () => {
  const previous = process.env.DATABASE_URL;
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  assert.equal(TEST_DATABASE_URL.startsWith("postgres://"), true);
  assert.equal(typeof DATABASE_URL, "string");

  try {
    const pool = getPool(TEST_DATABASE_URL);
    await applySchema(pool);
    await pool.query(
      `TRUNCATE TABLE
         review_queue_items, import_runs, overrides, catalog_snapshots,
         public_id_aliases, services, organizations
       RESTART IDENTITY CASCADE`
    );
    const result = await query("SELECT current_database() AS name");
    assert.equal(result.rows[0].name, "porirua_test");

    await withTransaction(async (client) => {
      await client.query(
        `INSERT INTO organizations (id, public_id, render_grain, cluster_key)
         VALUES ('org-tx', 'org-tx', 'flat', 'k')`
      );
    });
    const saved = await query("SELECT count(*)::int AS n FROM organizations");
    assert.equal(saved.rows[0].n, 1);

    await assert.rejects(async () => {
      await withTransaction(async (client) => {
        await client.query(
          `INSERT INTO organizations (id, public_id, render_grain, cluster_key)
           VALUES ('org-fail', 'org-fail', 'flat', 'k')`
        );
        throw new Error("force rollback");
      });
    }, /force rollback/);
    const afterRollback = await query("SELECT count(*)::int AS n FROM organizations");
    assert.equal(afterRollback.rows[0].n, 1);
  } finally {
    await closePool();
    if (previous == null) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previous;
  }
  });
});
