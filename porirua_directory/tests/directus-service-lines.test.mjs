import test from "node:test";
import assert from "node:assert/strict";
import { bootstrapDirectus } from "../scripts/directus/bootstrap.mjs";
import { withDirectusDatabase } from "./helpers/directus-postgres.mjs";
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  EDITOR_EMAIL,
  EDITOR_PASSWORD,
  directusRequest,
  loginDirectus,
  probeDirectus,
} from "./helpers/directus-api.mjs";

let bootstrapped = false;

async function ensureWorkspace(t) {
  if (!(await probeDirectus())) {
    t.skip(
      "Directus is not reachable; run npm run directus:up"
    );
    return false;
  }
  if (!bootstrapped) {
    await bootstrapDirectus();
    bootstrapped = true;
  }
  return true;
}

async function seedTeWaka(client) {
  await client.query(
    `INSERT INTO organizations (id, public_id, render_grain, name, cluster_key, status, source_primary)
     VALUES ('org-te-waka-whaiora-trust', 'org-te-waka-whaiora-trust', 'organization',
             'Te Waka Whaiora Trust', 'key-te-waka', 'published', 'fsd')
     ON CONFLICT (id) DO UPDATE SET name = 'Te Waka Whaiora Trust', render_grain = 'organization'`
  );
  await client.query(
    `INSERT INTO services (id, organization_id, line_id, title, source, status)
     VALUES
       ('line-a', 'org-te-waka-whaiora-trust', 'line-a', 'Truancy', 'fsd', 'published'),
       ('line-b', 'org-te-waka-whaiora-trust', 'line-b', 'Counselling', 'fsd', 'published'),
       ('line-c', 'org-te-waka-whaiora-trust', 'line-c', 'Advocacy', 'fsd', 'published'),
       ('line-d', 'org-te-waka-whaiora-trust', 'line-d', 'Whānau support', 'fsd', 'published')
     ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, organization_id = EXCLUDED.organization_id`
  );
}

test("reading an organization through Directus returns its related service lines", async (t) => {
  if (!(await ensureWorkspace(t))) return;
  await withDirectusDatabase(t, async (client) => {
    await seedTeWaka(client);
    const editor = await loginDirectus(EDITOR_EMAIL, EDITOR_PASSWORD);
    const read = await directusRequest(
      editor,
      "/items/organizations/org-te-waka-whaiora-trust?fields=*,service_lines.id,service_lines.title"
    );
    assert.equal(read.status, 200, JSON.stringify(read.data));
    const lines = read.data.data.service_lines;
    assert.ok(Array.isArray(lines), "service_lines should be an array on the organization");
    assert.equal(lines.length, 4);
    assert.deepEqual(
      lines.map((line) => line.title).sort(),
      ["Advocacy", "Counselling", "Truancy", "Whānau support"]
    );
  });
});

test("PATCH /items/organizations still succeeds when the service_lines alias is registered", async (t) => {
  if (!(await ensureWorkspace(t))) return;
  await withDirectusDatabase(t, async (client) => {
    await seedTeWaka(client);
    const editor = await loginDirectus(EDITOR_EMAIL, EDITOR_PASSWORD);
    const patched = await directusRequest(editor, "/items/organizations/org-te-waka-whaiora-trust", {
      method: "PATCH",
      body: { name: "Te Waka Whaiora Trust (curated)" },
    });
    assert.equal(patched.status, 200, JSON.stringify(patched.data));
    assert.equal(patched.data.data.name, "Te Waka Whaiora Trust (curated)");
    const stored = await client.query(
      `SELECT name FROM organizations WHERE id = 'org-te-waka-whaiora-trust'`
    );
    assert.equal(stored.rows[0].name, "Te Waka Whaiora Trust (curated)");
    const lines = await client.query(
      `SELECT count(*)::int AS n FROM services WHERE organization_id = 'org-te-waka-whaiora-trust'`
    );
    assert.equal(lines.rows[0].n, 4, "PATCH of ordinary fields must not re-parent lines");
  });
});

test("Editor cannot re-parent service lines through the organization O2M", async (t) => {
  if (!(await ensureWorkspace(t))) return;
  await withDirectusDatabase(t, async (client) => {
    await seedTeWaka(client);
    const editor = await loginDirectus(EDITOR_EMAIL, EDITOR_PASSWORD);
    const reparent = await directusRequest(editor, "/items/organizations/org-te-waka-whaiora-trust", {
      method: "PATCH",
      body: { service_lines: ["line-a"] },
    });
    assert.ok(reparent.status === 403 || reparent.status === 400, `status ${reparent.status}`);
    const count = await client.query(
      `SELECT count(*)::int AS n FROM services WHERE organization_id = 'org-te-waka-whaiora-trust'`
    );
    assert.equal(count.rows[0].n, 4);
  });
});

test("Admin can still PATCH an organization with the alias present", async (t) => {
  if (!(await ensureWorkspace(t))) return;
  await withDirectusDatabase(t, async (client) => {
    await seedTeWaka(client);
    const admin = await loginDirectus(ADMIN_EMAIL, ADMIN_PASSWORD);
    const patched = await directusRequest(admin, "/items/organizations/org-te-waka-whaiora-trust", {
      method: "PATCH",
      body: { description: "Admin note" },
    });
    assert.equal(patched.status, 200, JSON.stringify(patched.data));
  });
});
