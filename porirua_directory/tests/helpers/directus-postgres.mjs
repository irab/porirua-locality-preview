/**
 * Postgres harness for Directus-workspace tests.
 * Uses host port 54341 / compose project porirua-directus so we never
 * share docker-compose.test.yml (54329) with the catalog API task.
 */

import {
  columnNames,
  connectTestDatabase,
  probeTestDatabase,
  resetTestDatabase,
  tableNames,
} from "./postgres.mjs";

export const DIRECTUS_DATABASE_URL =
  process.env.DIRECTUS_DATABASE_URL ||
  "postgres://porirua:porirua@127.0.0.1:54341/porirua_directus";

const ADVISORY_LOCK_KEY = 872041;

export { columnNames, tableNames };

export async function probeDirectusDatabase(url = DIRECTUS_DATABASE_URL) {
  return probeTestDatabase(url);
}

export async function connectDirectusDatabase(url = DIRECTUS_DATABASE_URL) {
  return connectTestDatabase(url);
}

export async function exclusiveDirectusDatabase(fn, url = DIRECTUS_DATABASE_URL) {
  const lockClient = await connectTestDatabase(url);
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
export async function withDirectusDatabase(t, fn) {
  try {
    return await exclusiveDirectusDatabase(async () => {
      const client = await connectTestDatabase(DIRECTUS_DATABASE_URL);
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
        "Directus test database is not reachable; run npm run directus:up"
      );
      return;
    }
    throw error;
  }
}
