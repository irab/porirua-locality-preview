import test from "node:test";
import assert from "node:assert/strict";
import { bootstrapDirectus } from "../scripts/directus/bootstrap.mjs";
import { withDirectusDatabase } from "./helpers/directus-postgres.mjs";
import {
  EDITOR_EMAIL,
  EDITOR_PASSWORD,
  OPERATIONS_URL,
  directusRequest,
  loginDirectus,
  probeDirectus,
  probeOperations,
} from "./helpers/directus-api.mjs";

let bootstrapped = false;

async function ensureWorkspace(t) {
  if (!(await probeDirectus()) || !(await probeOperations())) {
    t.skip(
      "Directus or operations is not reachable; run npm run directus:up"
    );
    return false;
  }
  if (!bootstrapped) {
    await bootstrapDirectus();
    bootstrapped = true;
  }
  return true;
}

async function seedFsd(client) {
  await client.query(
    `INSERT INTO organizations (id, public_id, render_grain, name, cluster_key, status, source_primary)
     VALUES ('org-flow', 'fsd-2964', 'flat', 'Flow Org', 'key-flow', 'published', 'fsd')
     ON CONFLICT (id) DO UPDATE SET public_id = 'fsd-2964', name = 'Flow Org'`
  );
  await client.query(
    `INSERT INTO services (
       id, organization_id, line_id, title, address, source, status, raw_import
     ) VALUES (
       'fsd-2964', 'org-flow', 'fsd-2964', 'Support', '1 Old Street', 'fsd', 'published', $1::jsonb
     )
     ON CONFLICT (id) DO UPDATE SET address = '1 Old Street', raw_import = EXCLUDED.raw_import, status = 'published'`,
    [JSON.stringify({ address: "1 Old Street" })]
  );
}

test("editor save through Directus lands as a correctly shaped overrides row", async (t) => {
  if (!(await ensureWorkspace(t))) return;
  await withDirectusDatabase(t, async (client) => {
    await seedFsd(client);
    const editor = await loginDirectus(EDITOR_EMAIL, EDITOR_PASSWORD);
    const patched = await directusRequest(editor, "/items/services/fsd-2964", {
      method: "PATCH",
      body: { address: "9 New Street" },
    });
    assert.equal(patched.status, 200);

    const started = Date.now();
    let rows = [];
    while (Date.now() - started < 8000) {
      const result = await client.query(
        `SELECT target_type, target_id, action, patch, status FROM overrides WHERE target_id = 'fsd-2964'`
      );
      rows = result.rows;
      if (rows.length > 0) break;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    assert.equal(rows.length, 1, "sticky Flow did not write an overrides row");
    assert.equal(rows[0].target_type, "service");
    assert.equal(rows[0].target_id, "fsd-2964");
    assert.equal(rows[0].action, "patch");
    assert.equal(rows[0].status, "open");
    assert.equal(rows[0].patch.address, "9 New Street");
  });
});

test("Approve through operations refreshes raw_import on the accepted service", async (t) => {
  if (!(await ensureWorkspace(t))) return;
  await withDirectusDatabase(t, async (client) => {
    await seedFsd(client);
    await client.query(`UPDATE services SET status = 'pending_review' WHERE id = 'fsd-2964'`);
    const run = await client.query(
      `INSERT INTO import_runs (source, status) VALUES ('fsd', 'success') RETURNING id`
    );
    const queue = await client.query(
      `INSERT INTO review_queue_items (import_run_id, entity_type, entity_id, kind, proposed, status)
       VALUES ($1, 'service', 'fsd-2964', 'changed', $2::jsonb, 'pending')
       RETURNING id`,
      [run.rows[0].id, JSON.stringify({ after: { address: "Approved Street", phone: "04 000 1111" } })]
    );

    const response = await fetch(`${OPERATIONS_URL}/approve`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ queueItemId: queue.rows[0].id }),
    });
    assert.equal(response.status, 200, await response.text());
    const service = await client.query(`SELECT status, address, raw_import FROM services WHERE id = 'fsd-2964'`);
    assert.equal(service.rows[0].status, "published");
    assert.equal(service.rows[0].address, "Approved Street");
    assert.equal(service.rows[0].raw_import.address, "Approved Street");
    assert.equal(service.rows[0].raw_import.phone, "04 000 1111");
  });
});
