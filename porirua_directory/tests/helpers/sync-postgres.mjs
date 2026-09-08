/**
 * Isolated Postgres for weekly FSD sync tests.
 * Host port 54339 / compose project weekly-fsd-sync-l2yyxlzr — not 54329.
 */

import {
  connectTestDatabase,
  probeTestDatabase,
  resetTestDatabase,
} from "./postgres.mjs";

export const SYNC_TEST_DATABASE_URL =
  process.env.FSD_SYNC_DATABASE_URL ||
  "postgres://porirua:porirua@127.0.0.1:54339/porirua_sync";

const ADVISORY_LOCK_KEY = 872039;

export async function probeSyncDatabase(url = SYNC_TEST_DATABASE_URL) {
  return probeTestDatabase(url);
}

export async function exclusiveSyncDatabase(fn, url = SYNC_TEST_DATABASE_URL) {
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
export async function withSyncDatabase(t, fn) {
  try {
    return await exclusiveSyncDatabase(async () => {
      const client = await connectTestDatabase(SYNC_TEST_DATABASE_URL);
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
        "sync test database is not reachable; run docker compose -p weekly-fsd-sync-l2yyxlzr -f docker-compose.sync-test.yml up -d --wait"
      );
      return;
    }
    throw error;
  }
}
