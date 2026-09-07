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

test("GET /api/catalog sends shared cache headers for browsers and CDN", async (t) => {
  const repository = fakeRepository({
    current: snapshot(3, publishedEnvelope()),
  });

  await withCatalogApi(t, { repository }, async ({ get }) => {
    const response = await get("/api/catalog");
    assert.equal(response.status, 200);
    assert.equal(
      response.headers.get("cache-control"),
      "public, max-age=60, s-maxage=86400"
    );

    const cached = await get("/api/catalog", { "If-None-Match": '"3"' });
    assert.equal(cached.status, 304);
    assert.equal(
      cached.headers.get("cache-control"),
      "public, max-age=60, s-maxage=86400"
    );
  });
});

test("GET /api/catalog?version=N serves that snapshot for rollback checks", async (t) => {
  const currentEnvelope = publishedEnvelope({
    services: [{ id: "community-awatea-community-garden", name: "Current" }],
  });
  const olderEnvelope = publishedEnvelope({
    services: [{ id: "community-awatea-community-garden", name: "Older" }],
  });
  const repository = fakeRepository({
    current: snapshot(5, currentEnvelope),
    byVersion: [[4, snapshot(4, olderEnvelope, { isCurrent: false })]],
  });

  await withCatalogApi(t, { repository }, async ({ get }) => {
    const pinned = await get("/api/catalog?version=4");
    assert.equal(pinned.status, 200);
    assert.equal(pinned.headers.get("etag"), '"4"');
    assert.deepEqual(await pinned.json(), olderEnvelope);

    const current = await get("/api/catalog");
    assert.deepEqual(await current.json(), currentEnvelope);

    const missing = await get("/api/catalog?version=99");
    assert.equal(missing.status, 404);
    assert.deepEqual(await missing.json(), { error: "snapshot not found" });

    const invalid = await get("/api/catalog?version=nope");
    assert.equal(invalid.status, 400);
    assert.deepEqual(await invalid.json(), { error: "invalid version" });
  });
});
