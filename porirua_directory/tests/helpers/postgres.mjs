/**
 * Disposable Postgres harness for db-*.test.mjs.
 * Skips cleanly when the test database is unreachable so `npm test` still passes
 * without Docker. Start it with:
 *   docker compose -f docker-compose.test.yml up -d --wait
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Client } = pg;

export const DEFAULT_TEST_DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgres://porirua:porirua@127.0.0.1:54329/porirua_test";

const SCHEMA_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../scripts/db-schema.sql"
);

const CATALOG_TABLES = [
  "review_queue_items",
  "import_runs",
  "overrides",
  "catalog_snapshots",
  "public_id_aliases",
  "services",
  "organizations",
];

export async function probeTestDatabase(url = DEFAULT_TEST_DATABASE_URL) {
  const client = new Client({
    connectionString: url,
    connectionTimeoutMillis: 1500,
  });
  try {
    await client.connect();
    await client.query("SELECT 1");
    return true;
  } catch {
    return false;
  } finally {
    try {
      await client.end();
    } catch {
      /* already closed or never opened */
    }
  }
}

export async function readSchemaSql() {
  return fs.readFile(SCHEMA_PATH, "utf8");
}

export async function applySchema(client) {
  const sql = await readSchemaSql();
  await client.query(sql);
}

export async function dropCatalogTables(client) {
  await client.query(`DROP TABLE IF EXISTS ${CATALOG_TABLES.join(", ")} CASCADE`);
}

export async function resetTestDatabase(client) {
  await applySchema(client);
  await client.query(
    `TRUNCATE TABLE
       review_queue_items,
       import_runs,
       overrides,
       catalog_snapshots,
       public_id_aliases,
       services,
       organizations
     RESTART IDENTITY CASCADE`
  );
}

export async function connectTestDatabase(url = DEFAULT_TEST_DATABASE_URL) {
  const client = new Client({
    connectionString: url,
    connectionTimeoutMillis: 1500,
  });
  await client.connect();
  return client;
}

const ADVISORY_LOCK_KEY = 872014;

export async function exclusiveTestDatabase(fn) {
  const lockClient = await connectTestDatabase();
  try {
    await lockClient.query("SELECT pg_advisory_lock($1)", [ADVISORY_LOCK_KEY]);
    return await fn();
  } finally {
    try {
      await lockClient.query("SELECT pg_advisory_unlock($1)", [ADVISORY_LOCK_KEY]);
    } catch {
      /* disconnect releases the lock */
    }
    await lockClient.end();
  }
}

/**
 * @param {import("node:test").TestContext} t
 * @param {(client: import("pg").Client) => Promise<void>} fn
 */
export async function withTestDatabase(t, fn) {
  try {
    return await exclusiveTestDatabase(async () => {
      const client = await connectTestDatabase();
      try {
        await resetTestDatabase(client);
        await fn(client);
      } finally {
        await client.end();
      }
    });
  } catch (error) {
    if (
      error.code === "ECONNREFUSED" ||
      error.code === "ETIMEDOUT" ||
      error.code === "ENOTFOUND" ||
      /connect ECONNREFUSED|timeout|not reachable/i.test(String(error.message))
    ) {
      t.skip(
        "test database is not reachable; run docker compose -f docker-compose.test.yml up -d --wait"
      );
      return;
    }
    throw error;
  }
}

export async function tableNames(client) {
  const result = await client.query(
    `SELECT table_name
       FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
      ORDER BY table_name`
  );
  return result.rows.map((row) => row.table_name);
}

export async function columnNames(client, table) {
  const result = await client.query(
    `SELECT column_name
       FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position`,
    [table]
  );
  return result.rows.map((row) => row.column_name);
}
