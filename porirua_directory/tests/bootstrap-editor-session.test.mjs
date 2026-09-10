import test from "node:test";
import assert from "node:assert/strict";
import { existingEditorPatch, EDITOR_LANDING_PAGE } from "../scripts/directus/bootstrap.mjs";
import { clampEditorLastPage } from "../directus/extensions/directory-editor/src/hook/last-page.js";

test("an existing Editor is not password-patched when the current password still works", () => {
  const { body, passwordNeedsReset } = existingEditorPatch({
    role: "editor-role",
    lastPage: EDITOR_LANDING_PAGE,
    desiredRole: "editor-role",
    passwordNeedsReset: false,
  });
  assert.equal(passwordNeedsReset, false);
  assert.equal("password" in body, false);
  assert.deepEqual(body, {});
});

test("bootstrap still repairs last_page without touching the password", () => {
  const { body, passwordNeedsReset } = existingEditorPatch({
    role: "editor-role",
    lastPage: "/content",
    desiredRole: "editor-role",
    passwordNeedsReset: false,
  });
  assert.equal(passwordNeedsReset, false);
  assert.equal("password" in body, false);
  assert.equal(body.last_page, EDITOR_LANDING_PAGE);
});

test("a failed module boot cannot persist Content as the Editor landing page", () => {
  assert.equal(clampEditorLastPage("/content"), EDITOR_LANDING_PAGE);
  assert.equal(clampEditorLastPage("/users/me"), EDITOR_LANDING_PAGE);
  assert.equal(clampEditorLastPage("/directory"), EDITOR_LANDING_PAGE);
  assert.equal(clampEditorLastPage("/directory/listings"), "/directory/listings");
});
