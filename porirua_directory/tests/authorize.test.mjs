import test from "node:test";
import assert from "node:assert/strict";
import { isEditorOrAdmin, unauthorizedError } from "../editor-core/authorize.mjs";

test("Editor and Admin may mutate; a logged-in low-privilege role may not", () => {
  assert.equal(isEditorOrAdmin({ admin: true, roleName: "Anything" }), true);
  assert.equal(isEditorOrAdmin({ admin: false, roleName: "Editor" }), true);
  assert.equal(isEditorOrAdmin({ admin: false, roleName: "Administrator" }), true);
  assert.equal(isEditorOrAdmin({ admin: false, roleName: "Viewer" }), false);
  assert.equal(isEditorOrAdmin({ admin: false, roleName: "Public" }), false);
  assert.equal(isEditorOrAdmin({}), false);
  assert.equal(unauthorizedError().statusCode, 403);
});
