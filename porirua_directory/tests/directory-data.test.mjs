import test from "node:test";
import assert from "node:assert/strict";
import { loadServices } from "../directory-data.js";

function jsonResponse(body, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    json: async () => structuredClone(body),
  };
}

function envelope(name, extra = {}) {
  return {
    generatedAt: "2026-09-08T00:00:00.000Z",
    counts: { community: 1, fsd: 0, published: 1 },
    services: [
      {
        id: extra.id ?? "community-catalog-probe",
        name,
        description: extra.description ?? "Probe listing",
        source: extra.source ?? "community",
        categories: extra.categories ?? [],
        communityFilters: extra.communityFilters ?? [],
        badges: [],
      },
    ],
  };
}

function stubFetch(t, handler) {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, ...rest) => {
    calls.push(String(url));
    return handler(String(url), ...rest);
  };
  t.after(() => {
    globalThis.fetch = original;
  });
  return calls;
}

function isCatalogUrl(url) {
  return url.includes("api/catalog");
}

function isStaticUrl(url) {
  return url.includes("data/services.json");
}

test("loadServices uses the catalog API and never fetches the static file", async (t) => {
  const apiBody = envelope("From Catalog API");
  const calls = stubFetch(t, (url) => {
    if (isCatalogUrl(url)) return jsonResponse(apiBody);
    if (isStaticUrl(url)) return jsonResponse(envelope("From Static File"));
    throw new Error(`unexpected fetch: ${url}`);
  });

  const loaded = await loadServices();

  assert.equal(loaded.entries[0].name, "From Catalog API");
  assert.equal(loaded.serviceLines[0].name, "From Catalog API");
  assert.deepEqual(
    loaded.meta,
    { generatedAt: apiBody.generatedAt, counts: apiBody.counts }
  );
  assert.equal(calls.filter(isCatalogUrl).length, 1);
  assert.deepEqual(calls.filter(isStaticUrl), []);
});

test("loadServices falls back to the static file when the API rejects", async (t) => {
  const calls = stubFetch(t, (url) => {
    if (isCatalogUrl(url)) return Promise.reject(new Error("network down"));
    if (isStaticUrl(url)) return jsonResponse(envelope("From Static File"));
    throw new Error(`unexpected fetch: ${url}`);
  });

  const loaded = await loadServices();

  assert.equal(loaded.entries[0].name, "From Static File");
  assert.equal(calls.filter(isCatalogUrl).length, 1);
  assert.equal(calls.filter(isStaticUrl).length, 1);
});

test("loadServices falls back to the static file when the API returns 5xx", async (t) => {
  const calls = stubFetch(t, (url) => {
    if (isCatalogUrl(url)) return jsonResponse({ error: "upstream" }, { ok: false, status: 500 });
    if (isStaticUrl(url)) return jsonResponse(envelope("From Static File"));
    throw new Error(`unexpected fetch: ${url}`);
  });

  const loaded = await loadServices();

  assert.equal(loaded.entries[0].name, "From Static File");
  assert.equal(calls.filter(isCatalogUrl).length, 1);
  assert.equal(calls.filter(isStaticUrl).length, 1);
});

test("loadServices falls back when the API returns its 503 empty-catalog shape", async (t) => {
  const calls = stubFetch(t, (url) => {
    if (isCatalogUrl(url)) {
      return jsonResponse(
        { error: "catalog unavailable", retryAfterSeconds: 30 },
        { ok: false, status: 503 }
      );
    }
    if (isStaticUrl(url)) return jsonResponse(envelope("From Static File"));
    throw new Error(`unexpected fetch: ${url}`);
  });

  const loaded = await loadServices();

  assert.equal(loaded.entries[0].name, "From Static File");
  assert.equal(calls.filter(isCatalogUrl).length, 1);
  assert.equal(calls.filter(isStaticUrl).length, 1);
});

test("loadServices does not retry the API after a failure", async (t) => {
  const calls = stubFetch(t, (url) => {
    if (isCatalogUrl(url)) return jsonResponse({ error: "unavailable" }, { ok: false, status: 503 });
    if (isStaticUrl(url)) return jsonResponse(envelope("From Static File"));
    throw new Error(`unexpected fetch: ${url}`);
  });

  await loadServices();

  assert.equal(calls.filter(isCatalogUrl).length, 1);
  assert.equal(calls.filter(isStaticUrl).length, 1);
});

test("API rejection does not surface as an unhandledRejection", async (t) => {
  const unhandled = [];
  const onUnhandled = (reason) => {
    unhandled.push(reason);
  };
  process.on("unhandledRejection", onUnhandled);
  t.after(() => {
    process.off("unhandledRejection", onUnhandled);
  });

  const calls = stubFetch(t, (url) => {
    if (isCatalogUrl(url)) return Promise.reject(new Error("network down"));
    if (isStaticUrl(url)) return jsonResponse(envelope("From Static File"));
    throw new Error(`unexpected fetch: ${url}`);
  });

  await loadServices();
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(calls.filter(isCatalogUrl).length, 1);
  assert.equal(unhandled.length, 0);
});
