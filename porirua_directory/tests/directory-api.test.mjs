import test from "node:test";
import assert from "node:assert/strict";
import {
  directoryEditorRequest,
  queueActionUndoId,
} from "../directus/extensions/directory-editor/src/module/directory-api.js";

test("directoryEditorRequest uses Axios request(), not the removed SDK transport", async () => {
  const calls = [];
  const client = {
    request: async (config) => {
      calls.push(config);
      return { data: { listings: [{ id: "org-1" }] } };
    },
    transport: undefined,
  };
  const data = await directoryEditorRequest(client, "/listings");
  assert.deepEqual(data, { listings: [{ id: "org-1" }] });
  assert.deepEqual(calls, [
    { method: "GET", url: "/directory-editor/listings", data: undefined, params: undefined },
  ]);
});

test("directoryEditorRequest posts a body on mutating calls", async () => {
  const client = {
    request: async (config) => ({ data: { ok: true, echo: config } }),
  };
  const data = await directoryEditorRequest(client, "/undo-publish", {
    method: "POST",
    body: { expectedVersion: 4 },
  });
  assert.equal(data.ok, true);
  assert.deepEqual(data.echo, {
    method: "POST",
    url: "/directory-editor/undo-publish",
    data: { expectedVersion: 4 },
    params: undefined,
  });
});

test("queueActionUndoId reads the nested bulk-approve undo id", () => {
  assert.equal(queueActionUndoId({ undoId: "top" }), "top");
  assert.equal(
    queueActionUndoId({ succeeded: [{ queueItemId: "a" }, { queueItemId: "b", undoId: "nested" }] }),
    "nested"
  );
  assert.equal(queueActionUndoId({ succeeded: [] }), null);
});

test("directoryEditorRequest refuses a client that only has the old transport shape", async () => {
  await assert.rejects(
    () =>
      directoryEditorRequest(
        { transport: { request: async () => ({ raw: {} }) } },
        "/listings"
      ),
    /could not reach the API/
  );
});
