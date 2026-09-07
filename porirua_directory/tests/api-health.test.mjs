import test from "node:test";
import assert from "node:assert/strict";
import { fakeRepository, snapshot, publishedEnvelope, withCatalogApi } from "./helpers/catalog-api.mjs";

function assertNoConnectionLeak(text) {
  assert.equal(/ECONNREFUSED|5432|postgres:\/\//i.test(text), false, text);
}

test("GET /api/health reports database reachability without connection details", async (t) => {
  const repository = fakeRepository({
    current: snapshot(1, publishedEnvelope()),
  });

  await withCatalogApi(t, { repository }, async ({ get }) => {
    const response = await get("/api/health");
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /application\/json/);
    const body = await response.json();
    assert.equal(body.ok, true);
    assert.equal(body.database, "reachable");
    assert.equal("error" in body, false);
    assertNoConnectionLeak(JSON.stringify(body));
  });
});

test("GET /api/health is 503 when the database is down and does not leak the driver error", async (t) => {
  const repository = fakeRepository({
    unreachable: true,
    pingError: new Error("connect ECONNREFUSED 127.0.0.1:5432 password=secret"),
  });

  await withCatalogApi(t, { repository }, async ({ get }) => {
    const response = await get("/api/health");
    assert.equal(response.status, 503);
    const text = await response.text();
    assertNoConnectionLeak(text);
    const body = JSON.parse(text);
    assert.equal(body.ok, false);
    assert.equal(body.database, "unreachable");
    assert.equal("error" in body, false);
    assert.equal("message" in body, false);
    assert.equal("stack" in body, false);
  });
});
