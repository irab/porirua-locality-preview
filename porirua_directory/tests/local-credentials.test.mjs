import test from "node:test";
import assert from "node:assert/strict";
import {
  COMPOSE_ADMIN_EMAIL,
  COMPOSE_ADMIN_PASSWORD,
  COMPOSE_EDITOR_EMAIL,
  COMPOSE_EDITOR_PASSWORD,
  isLoopbackDirectus,
  resolveDirectusCredentials,
} from "../scripts/directus/local-credentials.mjs";

test("loopback Directus ignores live-dev ADMIN_PASSWORD from the environment", () => {
  assert.equal(isLoopbackDirectus("http://127.0.0.1:18055"), true);
  assert.equal(isLoopbackDirectus("http://localhost:18055"), true);
  assert.equal(isLoopbackDirectus("https://admin-directory-dev.bsky.nz"), false);

  const previous = process.env.ADMIN_PASSWORD;
  process.env.ADMIN_PASSWORD = "live-dev-secret-must-not-win";
  try {
    const local = resolveDirectusCredentials("http://127.0.0.1:18055");
    assert.equal(local.adminEmail, COMPOSE_ADMIN_EMAIL);
    assert.equal(local.adminPassword, COMPOSE_ADMIN_PASSWORD);
    assert.equal(local.editorEmail, COMPOSE_EDITOR_EMAIL);
    assert.equal(local.editorPassword, COMPOSE_EDITOR_PASSWORD);

    const remote = resolveDirectusCredentials("https://admin-directory-dev.bsky.nz");
    assert.equal(remote.adminPassword, "live-dev-secret-must-not-win");
  } finally {
    if (previous === undefined) delete process.env.ADMIN_PASSWORD;
    else process.env.ADMIN_PASSWORD = previous;
  }
});
