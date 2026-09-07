import test from "node:test";
import assert from "node:assert/strict";
import { createCatalogRepository } from "../api/catalog-repository.mjs";
import { createCatalogServer } from "../api/server.mjs";
import { fakeRepository, snapshot, publishedEnvelope, withCatalogApi } from "./helpers/catalog-api.mjs";

function assertNoConnectionLeak(text) {
  assert.equal(/ECONNREFUSED|5432|postgres:\/\//i.test(text), false, text);
}

test("the API process starts without DATABASE_URL and health reports unreachable", async (t) => {
  const previous = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  t.after(() => {
    if (previous == null) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previous;
  });

  assert.doesNotThrow(() => createCatalogRepository());
  const server = createCatalogServer({ repository: createCatalogRepository() });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(
    () =>
      new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve()))
      )
  );
  const { port } = server.address();
  const health = await fetch(`http://127.0.0.1:${port}/api/health`);
  assert.equal(health.status, 503);
  const healthBody = await health.json();
  assert.equal(healthBody.database, "unreachable");
  assertNoConnectionLeak(JSON.stringify(healthBody));

  const catalog = await fetch(`http://127.0.0.1:${port}/api/catalog`);
  assert.equal(catalog.status, 503);
  assert.deepEqual(await catalog.json(), { error: "catalog unavailable" });
});


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
