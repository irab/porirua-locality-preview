import test from "node:test";
import assert from "node:assert/strict";
import { bootstrapDirectus, EDITOR_LANDING_PAGE } from "../scripts/directus/bootstrap.mjs";
import {
  DIRECTUS_URL,
  EDITOR_EMAIL,
  EDITOR_PASSWORD,
  directusRequest,
  loginDirectus,
  probeDirectus,
} from "./helpers/directus-api.mjs";

let bootstrapped = false;

async function ensureWorkspace(t) {
  if (!(await probeDirectus())) {
    t.skip("Directus is not reachable; run npm run directus:up");
    return false;
  }
  if (!bootstrapped) {
    await bootstrapDirectus();
    bootstrapped = true;
  }
  return true;
}

async function loginEditorSession() {
  const response = await fetch(`${DIRECTUS_URL}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: EDITOR_EMAIL,
      password: EDITOR_PASSWORD,
      mode: "session",
    }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(`session login failed: ${JSON.stringify(data)}`);
  }
  const setCookie = response.headers.getSetCookie?.() ?? [];
  const cookieHeader = setCookie.map((entry) => entry.split(";")[0]).join("; ");
  assert.ok(cookieHeader, "session login must set a cookie");
  return cookieHeader;
}

async function cookieRequest(cookieHeader, path, { method = "GET", body } = {}) {
  const response = await fetch(`${DIRECTUS_URL}${path}`, {
    method,
    headers: {
      cookie: cookieHeader,
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  return { status: response.status, data };
}

test("a leftover Editor session cookie still loads the Directory module after bootstrap", async (t) => {
  if (!(await ensureWorkspace(t))) return;
  const cookie = await loginEditorSession();
  const before = await cookieRequest(cookie, "/extensions/sources/index.js");
  assert.equal(before.status, 200, `module script before bootstrap: ${before.status}`);

  await bootstrapDirectus();

  const after = await cookieRequest(cookie, "/extensions/sources/index.js");
  assert.equal(after.status, 200, `module script after bootstrap: ${after.status}`);
  assert.match(String(after.data), /directory/, "bundle must still register the Directory module");

  const me = await cookieRequest(cookie, "/users/me?fields=last_page");
  assert.equal(me.status, 200, `users/me after bootstrap: ${me.status}`);
  assert.equal(me.data?.data?.last_page, EDITOR_LANDING_PAGE);
});

test("track/page cannot park an Editor on a hidden Content route", async (t) => {
  if (!(await ensureWorkspace(t))) return;
  const editor = await loginDirectus(EDITOR_EMAIL, EDITOR_PASSWORD);
  const tracked = await directusRequest(editor, "/users/me/track/page", {
    method: "PATCH",
    body: { last_page: "/content" },
  });
  assert.ok(tracked.status === 200 || tracked.status === 204, `track/page status ${tracked.status}`);
  const me = await directusRequest(editor, "/users/me?fields=last_page");
  assert.equal(me.status, 200);
  assert.equal(me.data?.data?.last_page, EDITOR_LANDING_PAGE);
});
