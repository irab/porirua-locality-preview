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
