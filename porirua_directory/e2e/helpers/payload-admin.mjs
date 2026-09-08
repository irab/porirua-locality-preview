import { createServer } from "node:http";
import { existsSync, readFileSync } from "node:fs";

export const LOCAL_PAYLOAD_ORIGIN = "http://127.0.0.1:18100";
export const DEV_PAYLOAD_ORIGIN = "https://admin-payload-directory-dev.bsky.nz";
export const LOCAL_OPERATIONS_PORT = 18790;

const ALLOWED_HOSTS = new Set([
  "127.0.0.1",
  "localhost",
  "admin-payload-directory-dev.bsky.nz",
]);

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

export const FIXTURE = {
  listing: {
    id: "org-e2e-whanau",
    name: "Porirua Whānau Centre",
    address: "1 Hartham Place, Porirua",
    status: "published",
    statusLabel: "On the site",
  },
  first: {
    id: "q-e2e-first",
    kind: "changed",
    name: "E2E First Org",
    summaryLabel: "Phone changed",
    kindLabel: "Details changed",
    deferred: false,
    showRejectAction: true,
    primaryActionLabel: "Accept",
    deferActionLabel: "Needs confirmation",
    diffRows: [{ field: "phone", line: "Phone: 04 111 0000 → 04 222 0000", label: "Phone" }],
  },
  second: {
    id: "q-e2e-second",
    kind: "changed",
    name: "E2E Second Org",
    summaryLabel: "Address changed",
    kindLabel: "Details changed",
    deferred: false,
    showRejectAction: true,
    primaryActionLabel: "Accept",
    deferActionLabel: "Needs confirmation",
    diffRows: [{ field: "address", line: "Address: 1 Old Street → 2 New Street", label: "Address" }],
  },
  removed: {
    id: "q-e2e-removed",
    kind: "removed",
    name: "E2E Removal Org",
    summaryLabel: "Gone from the government list",
    kindLabel: "Gone from the government list",
    deferred: false,
    primaryActionLabel: "Take it off the site",
    keepAsCommunityLabel: "Keep it as a community listing",
    deferActionLabel: "Needs confirmation",
    showRejectAction: false,
  },
  deferred: {
    id: "q-e2e-parked",
    kind: "changed",
    name: "E2E Parked Org",
    summaryLabel: "Phone changed",
    kindLabel: "Details changed",
    deferred: true,
    showRejectAction: true,
    primaryActionLabel: "Accept",
    deferActionLabel: "Needs confirmation",
    diffRows: [{ field: "phone", line: "Phone: 04 333 0000 → 04 444 0000", label: "Phone" }],
  },
};

function parseSecretsFile(text) {
  const map = {};
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const i = line.indexOf("=");
    map[line.slice(0, i)] = line.slice(i + 1);
  }
  return map;
}

export function isLocalPayloadOrigin(origin) {
  const host = new URL(origin).hostname;
  return host === "127.0.0.1" || host === "localhost";
}

export function assertAllowedPayloadOrigin(origin) {
  const host = new URL(origin).hostname;
  if (!ALLOWED_HOSTS.has(host)) {
    throw new Error(`Payload origin ${host} is not a local or directory-dev admin; refusing to run`);
  }
}

function fileSecrets() {
  const fromFile = process.env.DIRECTORY_DEV_SECRETS;
  if (!fromFile || !existsSync(fromFile)) return {};
  return parseSecretsFile(readFileSync(fromFile, "utf8"));
}

export function payloadAccounts(origin) {
  const local = isLocalPayloadOrigin(origin);
  const fileMap = local ? {} : fileSecrets();
  const pick = (envKey, fileKey, fallback) =>
    process.env[envKey] || (!local && fileMap[fileKey]) || fallback;
  return {
    editor: {
      email: pick("PAYLOAD_EDITOR_EMAIL", "EDITOR_EMAIL", "editor@example.com"),
      password: pick("PAYLOAD_EDITOR_PASSWORD", "EDITOR_PASSWORD", "editor-local"),
    },
    viewer: {
      email: pick("PAYLOAD_VIEWER_EMAIL", "VIEWER_EMAIL", "viewer@example.com"),
      password: pick("PAYLOAD_VIEWER_PASSWORD", "VIEWER_PASSWORD", "viewer-local"),
    },
    admin: {
      email: pick("PAYLOAD_ADMIN_EMAIL", "ADMIN_EMAIL", "admin@example.com"),
      password: pick("PAYLOAD_ADMIN_PASSWORD", "ADMIN_PASSWORD", "admin-local"),
    },
  };
}

export async function probeUrl(url, { timeoutMs = 4000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: { "user-agent": BROWSER_UA, accept: "application/json" },
      signal: controller.signal,
    });
    return { ok: response.ok, status: response.status };
  } catch {
    return { ok: false, status: 0 };
  } finally {
    clearTimeout(timer);
  }
}

export async function probePayloadOrigin() {
  const candidates = [
    process.env.PAYLOAD_ORIGIN,
    LOCAL_PAYLOAD_ORIGIN,
    DEV_PAYLOAD_ORIGIN,
  ].filter(Boolean);
  const seen = new Set();
  for (const origin of candidates) {
    const normalized = String(origin).replace(/\/$/, "");
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    assertAllowedPayloadOrigin(normalized);
    const health = await probeUrl(`${normalized}/api/directory-editor/health`);
    if (health.ok) return normalized;
  }
  return null;
}

export function authHeaders(token) {
  return {
    authorization: `JWT ${token}`,
    "user-agent": BROWSER_UA,
    accept: "application/json",
  };
}

export async function ensureViewerSession(origin, accounts) {
  const existing = await loginPayload(origin, accounts.viewer);
  if (existing.token) return existing;
  const admin = await loginPayload(origin, accounts.admin);
  if (!admin.token) return { ...existing, error: "viewer missing and admin login failed" };
  const created = await fetch(`${origin}/api/users`, {
    method: "POST",
    headers: {
      ...authHeaders(admin.token),
      "content-type": "application/json",
    },
    body: JSON.stringify({
      email: accounts.viewer.email,
      password: accounts.viewer.password,
      role: "viewer",
    }),
  });
  if (!created.ok) {
    return { status: created.status, token: null, user: null, error: "could not create viewer" };
  }
  return loginPayload(origin, accounts.viewer);
}

export async function loginPayload(origin, { email, password }) {
  const response = await fetch(`${origin}/api/users/login`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "user-agent": BROWSER_UA,
      accept: "application/json",
    },
    body: JSON.stringify({ email, password }),
  });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  const token = data?.token || data?.user?.token;
  return { status: response.status, data, token, user: data?.user ?? null };
}

export async function directoryEditorRequest(origin, path, { token, method = "GET", body } = {}) {
  const response = await fetch(`${origin}/api/directory-editor${path}`, {
    method,
    headers: {
      "user-agent": BROWSER_UA,
      accept: "application/json",
      ...(token ? authHeaders(token) : {}),
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  return { status: response.status, data };
}

export async function loginPayloadInBrowser(page, origin, { email, password }) {
  const response = await page.request.post(`${origin}/api/users/login`, {
    data: { email, password },
    headers: { "content-type": "application/json" },
  });
  if (!response.ok()) {
    throw new Error(`Payload login failed: HTTP ${response.status()}`);
  }
  await page.goto(`${origin}/admin`);
}

function cloneItems() {
  return [FIXTURE.first, FIXTURE.second, FIXTURE.removed, FIXTURE.deferred].map((item) => ({
    ...item,
    diffRows: item.diffRows ? item.diffRows.map((row) => ({ ...row })) : undefined,
  }));
}

function sendJson(res, status, body) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

function listingDetail() {
  return {
    organization: {
      id: FIXTURE.listing.id,
      name: FIXTURE.listing.name,
      status: FIXTURE.listing.status,
      statusLabel: FIXTURE.listing.statusLabel,
      address: FIXTURE.listing.address,
      phone: "04 237 0000",
      url: "https://e2e.example.test/whanau",
    },
    services: [
      {
        id: "svc-e2e-whanau",
        title: "Whānau support",
        address: FIXTURE.listing.address,
        status: "published",
        statusLabel: "On the site",
      },
    ],
  };
}

export async function portIsFree(port, host = "127.0.0.1") {
  return new Promise((resolve) => {
    const server = createServer();
    server.once("error", () => resolve(false));
    server.listen(port, host, () => {
      server.close(() => resolve(true));
    });
  });
}

export async function startMockOperations({ port = LOCAL_OPERATIONS_PORT } = {}) {
  if (!(await portIsFree(port))) return null;

  const received = [];
  let items = cloneItems();

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
      const url = new URL(req.url, `http://127.0.0.1:${port}`);
      received.push({ method: req.method, path: url.pathname, search: url.search, body });

      if (req.method === "GET" && url.pathname === "/health") {
        sendJson(res, 200, { ok: true });
        return;
      }
      if (req.method === "GET" && url.pathname === "/publish-status") {
        sendJson(res, 200, {
          unpublishedCount: 2,
          unpublishedNames: [FIXTURE.listing.name, FIXTURE.first.name],
          currentVersion: 13,
          previousVersion: 12,
          canUndoPublish: false,
        });
        return;
      }
      if (req.method === "GET" && url.pathname === "/listings") {
        sendJson(res, 200, { listings: [FIXTURE.listing] });
        return;
      }
      if (req.method === "GET" && url.pathname === `/listings/${FIXTURE.listing.id}`) {
        sendJson(res, 200, listingDetail());
        return;
      }
      if (req.method === "GET" && url.pathname === "/listings/name-matches") {
        sendJson(res, 200, { matches: [] });
        return;
      }
      if (req.method === "GET" && url.pathname === "/queue") {
        sendJson(res, 200, { items, recent: [] });
        return;
      }
      if (req.method === "GET" && url.pathname === "/geocode") {
        sendJson(res, 200, { results: [] });
        return;
      }
      if (req.method === "POST" && url.pathname === "/approve") {
        const keys = Array.isArray(body?.keys) ? body.keys.map(String) : [];
        items = items.filter((item) => !keys.includes(String(item.id)));
        sendJson(res, 200, { ok: true, undoId: "undo-e2e-1", succeeded: [{ undoId: "undo-e2e-1" }] });
        return;
      }
      if (req.method === "POST") {
        sendJson(res, 200, { ok: true, undoId: "undo-e2e-post" });
        return;
      }
      sendJson(res, 404, { error: "mock not found" });
    });
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });

  return {
    received,
    port,
    reset() {
      items = cloneItems();
      received.length = 0;
    },
    close() {
      return new Promise((resolve) => server.close(resolve));
    },
  };
}
