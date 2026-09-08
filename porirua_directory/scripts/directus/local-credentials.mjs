/**
 * Credentials for the local compose Directus stack
 * (`docker-compose.directus.yml`, host port 18055).
 *
 * Live-dev `ADMIN_*` / `EDITOR_*` in the shell must not be used against
 * localhost — that is what 401'd the sequential suite.
 * Override only with DIRECTUS_TEST_* when you really mean to.
 */

export const LOCAL_DIRECTUS_URL = "http://127.0.0.1:18055";
export const COMPOSE_ADMIN_EMAIL = "admin@example.com";
export const COMPOSE_ADMIN_PASSWORD = "admin-local";
export const COMPOSE_EDITOR_EMAIL = "editor@example.com";
export const COMPOSE_EDITOR_PASSWORD = "editor-local";

export function resolveDirectusUrl(url = process.env.DIRECTUS_URL || LOCAL_DIRECTUS_URL) {
  return url;
}

export function isLoopbackDirectus(url = resolveDirectusUrl()) {
  try {
    const { hostname } = new URL(url);
    return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "::1";
  } catch {
    return false;
  }
}

export function resolveDirectusCredentials(url = resolveDirectusUrl()) {
  const local = isLoopbackDirectus(url);
  return {
    url,
    adminEmail:
      process.env.DIRECTUS_TEST_ADMIN_EMAIL ||
      (local ? COMPOSE_ADMIN_EMAIL : process.env.ADMIN_EMAIL || COMPOSE_ADMIN_EMAIL),
    adminPassword:
      process.env.DIRECTUS_TEST_ADMIN_PASSWORD ||
      (local ? COMPOSE_ADMIN_PASSWORD : process.env.ADMIN_PASSWORD || COMPOSE_ADMIN_PASSWORD),
    editorEmail:
      process.env.DIRECTUS_TEST_EDITOR_EMAIL ||
      (local ? COMPOSE_EDITOR_EMAIL : process.env.EDITOR_EMAIL || COMPOSE_EDITOR_EMAIL),
    editorPassword:
      process.env.DIRECTUS_TEST_EDITOR_PASSWORD ||
      (local ? COMPOSE_EDITOR_PASSWORD : process.env.EDITOR_PASSWORD || COMPOSE_EDITOR_PASSWORD),
  };
}
