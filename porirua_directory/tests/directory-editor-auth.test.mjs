import test from "node:test";
import assert from "node:assert/strict";
import { bootstrapDirectus } from "../scripts/directus/bootstrap.mjs";
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  DIRECTUS_URL,
  EDITOR_EMAIL,
  EDITOR_PASSWORD,
  directusRequest,
  loginDirectus,
  probeDirectus,
} from "./helpers/directus-api.mjs";

const VIEWER_EMAIL = "viewer@example.com";
const VIEWER_PASSWORD = "viewer-local";

let bootstrapped = false;

async function ensureWorkspace(t) {
  if (!(await probeDirectus())) {
    t.skip("Directus is not reachable; run npm run directus:up");
    return false;
  }
  const health = await fetch(`${DIRECTUS_URL}/directory-editor/health`);
  if (!health.ok) {
    t.skip("Directory editor endpoint is not loaded; rebuild Dockerfile.directus");
    return false;
  }
  if (!bootstrapped) {
    await bootstrapDirectus();
    bootstrapped = true;
  }
  return true;
}

async function ensureViewer(adminToken) {
  const roles = await directusRequest(adminToken, "/roles?filter[name][_eq]=Viewer");
  let roleId = roles.data?.data?.[0]?.id;
  if (!roleId) {
    const created = await directusRequest(adminToken, "/roles", {
      method: "POST",
      body: { name: "Viewer", icon: "visibility", description: "Authenticated, not Editor" },
    });
    roleId = created.data?.data?.id;
  }
  const users = await directusRequest(adminToken, `/users?filter[email][_eq]=${VIEWER_EMAIL}`);
  if (!users.data?.data?.[0]) {
    await directusRequest(adminToken, "/users", {
      method: "POST",
      body: {
        email: VIEWER_EMAIL,
        password: VIEWER_PASSWORD,
        role: roleId,
        first_name: "Viewer",
      },
    });
  }
}

test("a non-editor authenticated session gets 403 from a mutating Directory route", async (t) => {
  if (!(await ensureWorkspace(t))) return;
  const admin = await loginDirectus(ADMIN_EMAIL, ADMIN_PASSWORD);
  await ensureViewer(admin);
  const viewer = await loginDirectus(VIEWER_EMAIL, VIEWER_PASSWORD);
  const denied = await directusRequest(viewer, "/directory-editor/listings", {
    method: "POST",
    body: { name: "Should Not Create" },
  });
  assert.equal(denied.status, 403, JSON.stringify(denied.data));

  const editor = await loginDirectus(EDITOR_EMAIL, EDITOR_PASSWORD);
  const allowed = await directusRequest(editor, "/directory-editor/listings/name-matches?name=Test");
  assert.ok(allowed.status < 500, `editor name-matches ${allowed.status}`);
});
