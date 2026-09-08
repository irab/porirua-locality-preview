import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { isEditorOrAdmin } from "../editor-core/authorize.mjs";
import {
  DIRECTORY_EDITOR_PROXIED_ROUTES,
  handleDirectoryEditorRequest,
  identityFromPayloadUser,
  matchDirectoryEditorRoute,
} from "../editor-core/operations-proxy.mjs";

const EDITOR = { userId: "user-editor", admin: false, roleName: "Editor" };
const VIEWER = { userId: "user-viewer", admin: false, roleName: "Viewer" };
const REVIEWER = { userId: "user-reviewer", admin: false, roleName: "Reviewer" };

const EXPECTED_ROUTES = [
  ["GET", "/listings/name-matches"],
  ["GET", "/listings"],
  ["GET", "/listings/:id"],
  ["GET", "/queue"],
  ["GET", "/publish-status"],
  ["GET", "/geocode"],
  ["POST", "/listings"],
  ["POST", "/listings/update"],
  ["POST", "/listings/archive"],
  ["POST", "/listings/restore"],
  ["POST", "/approve"],
  ["POST", "/keep-curation"],
  ["POST", "/hide"],
  ["POST", "/reject"],
  ["POST", "/edit-and-approve"],
  ["POST", "/defer"],
  ["POST", "/keep-community"],
  ["POST", "/review-undo"],
  ["POST", "/publish"],
  ["POST", "/undo-publish"],
];

function startMockOperations() {
  const received = [];
  const server = createServer((req, res) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      let body = null;
      if (raw) {
        try {
          body = JSON.parse(raw);
        } catch {
          body = raw;
        }
      }
      received.push({ method: req.method, url: req.url, body });
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, path: req.url }));
    });
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({
        url: `http://127.0.0.1:${port}`,
        received,
        close: () => new Promise((done) => server.close(done)),
      });
    });
  });
}

test("the Payload proxy covers every Directory sidecar route the Directus gate exposes", () => {
  assert.deepEqual(
    DIRECTORY_EDITOR_PROXIED_ROUTES.map((route) => [route.method, route.path]),
    EXPECTED_ROUTES
  );
  assert.equal(DIRECTORY_EDITOR_PROXIED_ROUTES.length, 20);
  assert.ok(matchDirectoryEditorRoute("GET", "/listings/name-matches"));
  assert.ok(matchDirectoryEditorRoute("GET", "/listings/org-ora-toa"));
  assert.equal(matchDirectoryEditorRoute("GET", "/listings/org-ora-toa").sidecarPath, "/listings/org-ora-toa");
  assert.equal(matchDirectoryEditorRoute("POST", "/listings/update")?.path, "/listings/update");
  assert.equal(matchDirectoryEditorRoute("GET", "/health"), null);
});

test("unauthenticated Directory reads are 401; health stays open", async () => {
  const result = await handleDirectoryEditorRequest({
    method: "GET",
    path: "/listings",
    identity: null,
    operationsUrl: "http://127.0.0.1:9",
  });
  assert.equal(result.status, 401);
  assert.match(result.body.error, /authentication required/i);

  const health = await handleDirectoryEditorRequest({
    method: "GET",
    path: "/health",
    identity: null,
    operationsUrl: "http://127.0.0.1:9",
  });
  assert.equal(health.status, 200);
  assert.deepEqual(health.body, { ok: true });
});

test("a Viewer session gets 403 from reads and mutations", async () => {
  const read = await handleDirectoryEditorRequest({
    method: "GET",
    path: "/queue",
    identity: VIEWER,
    operationsUrl: "http://127.0.0.1:9",
  });
  assert.equal(read.status, 403);

  const write = await handleDirectoryEditorRequest({
    method: "POST",
    path: "/listings",
    identity: VIEWER,
    body: { name: "Should Not Create" },
    operationsUrl: "http://127.0.0.1:9",
  });
  assert.equal(write.status, 403);
  assert.equal(isEditorOrAdmin(VIEWER), false);
});

test("Editor, Admin, and Reviewer may call every proxied route", async () => {
  const ops = await startMockOperations();
  try {
    for (const [method, path] of EXPECTED_ROUTES) {
      const resolved = path === "/listings/:id" ? "/listings/org-demo" : path;
      const editor = await handleDirectoryEditorRequest({
        method,
        path: resolved,
        search: method === "GET" && path === "/listings/name-matches" ? "?name=Test" : "",
        identity: EDITOR,
        body: method === "POST" ? { name: "Test" } : undefined,
        operationsUrl: ops.url,
        catalogPublisher: "payload",
      });
      assert.equal(editor.status, 200, `${method} ${resolved} editor ${editor.status}`);
    }
    const reviewer = await handleDirectoryEditorRequest({
      method: "GET",
      path: "/publish-status",
      identity: REVIEWER,
      operationsUrl: ops.url,
      catalogPublisher: "payload",
    });
    assert.equal(reviewer.status, 200);
    assert.equal(isEditorOrAdmin(REVIEWER), true);
    assert.equal(isEditorOrAdmin({ admin: true, roleName: "Anything" }), true);
  } finally {
    await ops.close();
  }
});

test("client-supplied createdBy and user are replaced with the authenticated actor", async () => {
  const ops = await startMockOperations();
  try {
    const result = await handleDirectoryEditorRequest({
      method: "POST",
      path: "/publish",
      identity: EDITOR,
      body: { createdBy: "attacker", user: "attacker", confirmLargeDelta: true },
      operationsUrl: ops.url,
      catalogPublisher: "payload",
    });
    assert.equal(result.status, 200);
    assert.equal(ops.received.length, 1);
    assert.equal(ops.received[0].body.createdBy, "user-editor");
    assert.equal(ops.received[0].body.user, "user-editor");
    assert.equal(ops.received[0].body.confirmLargeDelta, true);
  } finally {
    await ops.close();
  }
});

test("Payload refuses publish and undo-publish while Directus is the catalog publisher", async () => {
  const ops = await startMockOperations();
  try {
    const publish = await handleDirectoryEditorRequest({
      method: "POST",
      path: "/publish",
      identity: EDITOR,
      body: { confirmLargeDelta: true },
      operationsUrl: ops.url,
      catalogPublisher: "directus",
    });
    assert.equal(publish.status, 403);
    assert.match(publish.body.error, /admin-directory-dev\.bsky\.nz/);

    const undo = await handleDirectoryEditorRequest({
      method: "POST",
      path: "/undo-publish",
      identity: EDITOR,
      body: { expectedVersion: 4 },
      operationsUrl: ops.url,
      catalogPublisher: "directus",
    });
    assert.equal(undo.status, 403);
    assert.equal(ops.received.length, 0);
  } finally {
    await ops.close();
  }
});

test("publish-status stays readable on Payload and names whether this host can publish", async () => {
  const ops = await startMockOperations();
  try {
    const status = await handleDirectoryEditorRequest({
      method: "GET",
      path: "/publish-status",
      identity: EDITOR,
      operationsUrl: ops.url,
      catalogPublisher: "directus",
    });
    assert.equal(status.status, 200);
    assert.equal(status.body.thisHostCanPublish, false);
    assert.equal(status.body.catalogPublisher, "directus");
    assert.equal(ops.received.length, 1);
  } finally {
    await ops.close();
  }
});

test("Payload users map onto the shared isEditorOrAdmin predicate", () => {
  assert.deepEqual(identityFromPayloadUser(null), null);
  assert.equal(isEditorOrAdmin(identityFromPayloadUser({ id: "1", role: "viewer" })), false);
  assert.equal(isEditorOrAdmin(identityFromPayloadUser({ id: "2", role: "editor" })), true);
  assert.equal(isEditorOrAdmin(identityFromPayloadUser({ id: "3", role: "reviewer" })), true);
  assert.equal(isEditorOrAdmin(identityFromPayloadUser({ id: "4", role: "admin" })), true);
  assert.equal(identityFromPayloadUser({ id: "2", role: "editor" }).userId, "2");
});
