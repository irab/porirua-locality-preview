import { resolveDirectusCredentials } from "../../scripts/directus/local-credentials.mjs";

const localCreds = resolveDirectusCredentials();
export const DIRECTUS_URL = localCreds.url;
export const OPERATIONS_URL = process.env.OPERATIONS_URL || "http://127.0.0.1:18790";
export const ADMIN_EMAIL = localCreds.adminEmail;
export const ADMIN_PASSWORD = localCreds.adminPassword;
export const EDITOR_EMAIL = localCreds.editorEmail;
export const EDITOR_PASSWORD = localCreds.editorPassword;

export async function probeUrl(url, timeoutMs = 1500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export async function probeDirectus() {
  return probeUrl(`${DIRECTUS_URL}/server/health`);
}

export async function probeOperations() {
  return probeUrl(`${OPERATIONS_URL}/health`);
}

export async function loginDirectus(email, password) {
  const response = await fetch(`${DIRECTUS_URL}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Directus login failed for ${email}: ${JSON.stringify(data)}`);
  }
  return data.data.access_token;
}

export async function directusRequest(token, path, { method = "GET", body } = {}) {
  const response = await fetch(`${DIRECTUS_URL}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
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

export function skipUnless(t, ready, message) {
  if (!ready) {
    t.skip(message);
    return false;
  }
  return true;
}
