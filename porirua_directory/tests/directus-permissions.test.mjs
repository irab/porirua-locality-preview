import test from "node:test";
import assert from "node:assert/strict";
import { bootstrapDirectus } from "../scripts/directus/bootstrap.mjs";
import { EDITOR_FORBIDDEN_FIELDS } from "../scripts/directus/bootstrap.mjs";
import { withDirectusDatabase } from "./helpers/directus-postgres.mjs";
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  EDITOR_EMAIL,
  EDITOR_PASSWORD,
  directusRequest,
  loginDirectus,
  probeDirectus,
  skipUnless,
} from "./helpers/directus-api.mjs";

let bootstrapped = false;

async function ensureWorkspace(t) {
  if (!(await probeDirectus())) {
    t.skip("Directus is not reachable; run docker compose -p porirua-directus-ojw13bd2 -f docker-compose.directus.yml up -d --wait");
    return false;
  }
  if (!bootstrapped) {
    await bootstrapDirectus();
    bootstrapped = true;
  }
  return true;
}

async function seedOrg(client) {
  await client.query(
    `INSERT INTO organizations (id, public_id, render_grain, name, cluster_key, status, source_primary)
     VALUES ('org-perm', 'org-perm', 'flat', 'Permission Org', 'key-perm', 'published', 'fsd')
     ON CONFLICT (id) DO UPDATE SET public_id = 'org-perm', render_grain = 'flat', name = 'Permission Org'`
  );
  await client.query(
    `INSERT INTO services (id, organization_id, line_id, title, source, status)
     VALUES ('svc-perm', 'org-perm', 'svc-perm', 'Line', 'fsd', 'published')
     ON CONFLICT (id) DO UPDATE SET title = 'Line'`
  );
}

test("Editor update permission fields omit public_id and render_grain", async (t) => {
  if (!(await ensureWorkspace(t))) return;
  assert.deepEqual(EDITOR_FORBIDDEN_FIELDS, ["public_id", "render_grain"]);
  const admin = await loginDirectus(ADMIN_EMAIL, ADMIN_PASSWORD);
  const policies = await directusRequest(admin, "/policies?filter[name][_eq]=Editor");
  const policyId = policies.data.data[0].id;
  const permissions = await directusRequest(
    admin,
    `/permissions?filter[policy][_eq]=${policyId}&filter[collection][_eq]=organizations&filter[action][_eq]=update`
  );
  const fields = permissions.data.data[0]?.fields ?? [];
  assert.equal(fields.includes("public_id"), false);
  assert.equal(fields.includes("render_grain"), false);
  assert.equal(fields.includes("service_lines"), false);
  assert.equal(fields.includes("name"), true);
  assert.equal(fields.includes("status"), true);
});

test("Editor cannot change public_id or render_grain through the Directus API", async (t) => {
  if (!(await ensureWorkspace(t))) return;
  await withDirectusDatabase(t, async (client) => {
    await seedOrg(client);
    const editor = await loginDirectus(EDITOR_EMAIL, EDITOR_PASSWORD);

    const publicId = await directusRequest(editor, "/items/organizations/org-perm", {
      method: "PATCH",
      body: { public_id: "org-hijacked" },
    });
    assert.ok(publicId.status === 403 || publicId.status === 400, `public_id status ${publicId.status}`);

    const grain = await directusRequest(editor, "/items/organizations/org-perm", {
      method: "PATCH",
      body: { render_grain: "organization" },
    });
    assert.ok(grain.status === 403 || grain.status === 400, `render_grain status ${grain.status}`);

    const stored = await client.query(
      `SELECT public_id, render_grain, name FROM organizations WHERE id = 'org-perm'`
    );
    assert.equal(stored.rows[0].public_id, "org-perm");
    assert.equal(stored.rows[0].render_grain, "flat");

    const name = await directusRequest(editor, "/items/organizations/org-perm", {
      method: "PATCH",
      body: { name: "Editor renamed" },
    });
    assert.equal(name.status, 200);
    const renamed = await client.query(`SELECT name FROM organizations WHERE id = 'org-perm'`);
    assert.equal(renamed.rows[0].name, "Editor renamed");
  });
});

test("Admin can change render_grain through the Directus API", async (t) => {
  if (!(await ensureWorkspace(t))) return;
  await withDirectusDatabase(t, async (client) => {
    await seedOrg(client);
    const admin = await loginDirectus(ADMIN_EMAIL, ADMIN_PASSWORD);
    const grain = await directusRequest(admin, "/items/organizations/org-perm", {
      method: "PATCH",
      body: { render_grain: "organization" },
    });
    assert.equal(grain.status, 200);
    const stored = await client.query(`SELECT render_grain FROM organizations WHERE id = 'org-perm'`);
    assert.equal(stored.rows[0].render_grain, "organization");
  });
});
