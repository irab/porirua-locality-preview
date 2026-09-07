import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import {
  createOperationsHandler,
  requireSingleSelection,
  selectionKeys,
  unwrapTrigger,
} from "../directus/operations/server.mjs";
import { withTestDatabase } from "./helpers/postgres.mjs";

function listen(handler) {
  return new Promise((resolve) => {
    const server = createServer(handler);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({
        url: `http://127.0.0.1:${port}`,
        close: () => new Promise((done, fail) => server.close((error) => (error ? fail(error) : done()))),
      });
    });
  });
}

async function post(url, pathname, body) {
  const response = await fetch(`${url}${pathname}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: response.status, json: await response.json() };
}

test("selectionKeys reads the Directus keys array, not only the first item", () => {
  assert.deepEqual(selectionKeys({ keys: ["a", "b"] }), ["a", "b"]);
  assert.deepEqual(selectionKeys({ body: { keys: ["a", "b"], collection: "pending_review" } }), [
    "a",
    "b",
  ]);
  assert.deepEqual(selectionKeys({ queueItemId: "solo" }), ["solo"]);
  assert.deepEqual(unwrapTrigger({ body: { keys: ["x"], collection: "pending_review" } }).keys, [
    "x",
  ]);
});

test("single-target helpers refuse extra keys instead of truncating", () => {
  assert.throws(
    () => requireSingleSelection({ keys: ["1", "2"] }, "edit-and-approve"),
    (error) => error.statusCode === 400 && /exactly one selection, got 2/.test(error.message)
  );
  assert.equal(requireSingleSelection({ keys: ["only"] }, "edit-and-approve"), "only");
});

test("edit-and-approve and rollback 400 when the trigger carries more than one key", async () => {
  const db = {
    query() {
      throw new Error("db should not be called when extra keys are rejected");
    },
  };
  const { url, close } = await listen(createOperationsHandler({ db }));
  try {
    const edit = await post(url, "/edit-and-approve", {
      keys: ["one", "two"],
      payload: { name: "Nope" },
    });
    assert.equal(edit.status, 400);
    assert.match(edit.json.error, /exactly one selection, got 2/);
    assert.deepEqual(edit.json.keys, ["one", "two"]);

    const rollback = await post(url, "/rollback", { keys: [3, 4] });
    assert.equal(rollback.status, 400);
    assert.match(rollback.json.error, /exactly one selection, got 2/);
  } finally {
    await close();
  }
});

async function seedPending(client, { id, address }) {
  await client.query(
    `INSERT INTO organizations (id, public_id, render_grain, name, cluster_key, status, source_primary)
     VALUES ($1, $2, 'flat', $3, $4, 'published', 'fsd')`,
    [`org-${id}`, id, `Org ${id}`, `key-${id}`]
  );
  await client.query(
    `INSERT INTO services (
       id, organization_id, line_id, title, service_name, address, phone, lat, lng,
       source, status, raw_import, description
     ) VALUES (
       $1, $2, $1, 'Support', 'Support',
       $3, '04 111 2222', -41.13, 174.84,
       'fsd', 'pending_review', $4::jsonb, 'Old blurb'
     )`,
    [id, `org-${id}`, address, JSON.stringify({ address, name: `Org ${id}` })]
  );
  const run = await client.query(
    `INSERT INTO import_runs (source, status) VALUES ('fsd', 'success') RETURNING id`
  );
  const queue = await client.query(
    `INSERT INTO review_queue_items (
       import_run_id, entity_type, entity_id, kind, proposed, status
     ) VALUES ($1, 'service', $2, 'changed', $3::jsonb, 'pending')
     RETURNING id`,
    [
      run.rows[0].id,
      id,
      JSON.stringify({ after: { address: `${address} approved`, phone: "04 000 1111" } }),
    ]
  );
  return queue.rows[0].id;
}

test("bulk approve processes every selected key and leaves queue rows accepted", async (t) => {
  await withTestDatabase(t, async (client) => {
    const first = await seedPending(client, { id: "fsd-bulk-1", address: "1 Bulk Street" });
    const second = await seedPending(client, { id: "fsd-bulk-2", address: "2 Bulk Street" });
    const { url, close } = await listen(createOperationsHandler({ db: client }));
    try {
      const response = await post(url, "/approve", {
        collection: "pending_review",
        keys: [first, second],
      });
      assert.equal(response.status, 200, JSON.stringify(response.json));
      assert.equal(response.json.ok, true);
      assert.equal(response.json.succeededCount, 2);
      assert.equal(response.json.failedCount, 0);
      const rows = await client.query(
        `SELECT id, status FROM review_queue_items WHERE id = ANY($1::uuid[]) ORDER BY id`,
        [[first, second]]
      );
      assert.deepEqual(
        rows.rows.map((row) => row.status),
        ["accepted", "accepted"]
      );
    } finally {
      await close();
    }
  });
});

test("bulk approve continues after a later failure and does not roll back earlier successes", async (t) => {
  await withTestDatabase(t, async (client) => {
    const first = await seedPending(client, { id: "fsd-bulk-ok", address: "9 Ok Street" });
    const missing = "00000000-0000-4000-8000-000000000001";
    const { url, close } = await listen(createOperationsHandler({ db: client }));
    try {
      const response = await post(url, "/approve", { keys: [first, missing] });
      assert.equal(response.status, 409, JSON.stringify(response.json));
      assert.equal(response.json.ok, false);
      assert.equal(response.json.succeededCount, 1);
      assert.equal(response.json.failedCount, 1);
      assert.equal(response.json.succeeded[0].queueItemId, String(first));
      assert.equal(response.json.failed[0].queueItemId, String(missing));
      const accepted = await client.query(`SELECT status FROM review_queue_items WHERE id = $1`, [
        first,
      ]);
      assert.equal(accepted.rows[0].status, "accepted");
    } finally {
      await close();
    }
  });
});
