import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bootstrapFromJson } from "../scripts/db-import-from-json.mjs";
import { withTestDatabase } from "./helpers/postgres.mjs";

const dataDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../data");

async function loadCommitted() {
  return {
    envelope: JSON.parse(await fs.readFile(path.join(dataDir, "services.json"), "utf8")),
    overrides: JSON.parse(await fs.readFile(path.join(dataDir, "overrides.json"), "utf8")),
  };
}

async function catalogCounts(client) {
  const organizations = await client.query("SELECT id FROM organizations ORDER BY id");
  const services = await client.query("SELECT id FROM services ORDER BY id");
  const overrides = await client.query("SELECT id FROM overrides ORDER BY id");
  const importRuns = await client.query("SELECT id FROM import_runs ORDER BY id");
  return {
    organizationCount: organizations.rowCount,
    serviceCount: services.rowCount,
    overrideCount: overrides.rowCount,
    importRunCount: importRuns.rowCount,
    organizationIds: organizations.rows.map((row) => row.id),
    serviceIds: services.rows.map((row) => row.id),
  };
}

test("bootstrap is idempotent: a second run changes no row counts and no ids", async (t) => {
  await withTestDatabase(t, async (client) => {
    const { envelope, overrides } = await loadCommitted();
    await bootstrapFromJson({ envelope, overrides, db: client });
    const first = await catalogCounts(client);
    await bootstrapFromJson({ envelope, overrides, db: client });
    const second = await catalogCounts(client);
    assert.deepEqual(second, first);
    assert.equal(first.importRunCount, 1);
  });
});

test("raw_import is seeded for every FSD-sourced line", async (t) => {
  await withTestDatabase(t, async (client) => {
    const { envelope, overrides } = await loadCommitted();
    await bootstrapFromJson({ envelope, overrides, db: client });
    const missing = await client.query(
      `SELECT id FROM services WHERE source = 'fsd' AND raw_import IS NULL`
    );
    const fsd = await client.query(
      `SELECT count(*)::int AS n FROM services WHERE source = 'fsd'`
    );
    assert.equal(missing.rowCount, 0);
    assert.equal(fsd.rows[0].n, 162);
    const patch = await client.query(
      `SELECT target_id, action, patch FROM overrides WHERE target_id = 'fsd-2964'`
    );
    assert.equal(patch.rowCount, 1);
    assert.equal(patch.rows[0].action, "patch");
    assert.equal(patch.rows[0].patch.address, "22 Ngāti Toa Street, Takapūwāhia, Porirua");
  });
});
