import test from "node:test";
import assert from "node:assert/strict";
import {
  fakeRepository,
  publishedEnvelope,
  snapshot,
  withCatalogApi,
} from "./helpers/catalog-api.mjs";

test("GET /api/catalog returns the current published snapshot envelope", async (t) => {
  const envelope = publishedEnvelope();
  const repository = fakeRepository({
    current: snapshot(7, envelope),
  });

  await withCatalogApi(t, { repository }, async ({ get }) => {
    const response = await get("/api/catalog");
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /application\/json/);
    const body = await response.json();
    assert.deepEqual(body, envelope);
    assert.equal("generatedAt" in body, true);
    assert.equal(Array.isArray(body.services), true);
    assert.equal(typeof body.counts, "object");
  });
});

test("ETag is the snapshot version and a matching If-None-Match returns 304", async (t) => {
  const envelope = publishedEnvelope();
  const repository = fakeRepository({
    current: snapshot(12, envelope),
  });

  await withCatalogApi(t, { repository }, async ({ get }) => {
    const first = await get("/api/catalog");
    assert.equal(first.status, 200);
    assert.equal(first.headers.get("etag"), '"12"');
    assert.deepEqual(await first.json(), envelope);

    const cached = await get("/api/catalog", { "If-None-Match": '"12"' });
    assert.equal(cached.status, 304);
    assert.equal(cached.headers.get("etag"), '"12"');
    assert.equal(await cached.text(), "");
  });
});
