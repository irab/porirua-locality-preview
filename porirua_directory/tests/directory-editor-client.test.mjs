import test from "node:test";
import assert from "node:assert/strict";
import { directoryEditorFetch, directoryEditorUrl } from "../editor-core/client.mjs";

test("directory editor URLs default to the Directus /directory-editor mount", () => {
  assert.equal(directoryEditorUrl("/listings"), "/directory-editor/listings");
  assert.equal(directoryEditorUrl("queue"), "/directory-editor/queue");
  assert.equal(directoryEditorUrl("/listings/name-matches"), "/directory-editor/listings/name-matches");
});

test("directory editor URLs accept a Payload (or other) base without forking the helper", () => {
  assert.equal(directoryEditorUrl("/listings", "/api/directory-editor"), "/api/directory-editor/listings");
  assert.equal(directoryEditorUrl("publish-status", { base: "/api/directory-editor" }), "/api/directory-editor/publish-status");
  assert.equal(directoryEditorUrl("/listings", "/api/directory-editor/"), "/api/directory-editor/listings");
});

test("directory editor fetch forwards the configured base", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  const data = await directoryEditorFetch("/listings", {
    base: "/api/directory-editor",
    fetchImpl,
  });
  assert.equal(calls[0].url, "/api/directory-editor/listings");
  assert.equal(calls[0].init.credentials, "same-origin");
  assert.deepEqual(data, { ok: true });
});
