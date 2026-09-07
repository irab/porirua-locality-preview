import test from "node:test";
import assert from "node:assert/strict";
import { loadServices } from "../directory-data.js";

function headers(contentType) {
  return {
    get(name) {
      return String(name).toLowerCase() === "content-type" ? contentType : null;
    },
  };
}

function jsonResponse(body, { ok = true, status = 200, contentType = "application/json" } = {}) {
  return {
    ok,
    status,
    headers: headers(contentType),
    json: async () => structuredClone(body),
  };
}

function htmlResponse() {
  return {
    ok: true,
    status: 200,
    headers: headers("text/html; charset=utf-8"),
    json: async () => {
      throw new SyntaxError("Unexpected token '<'");
    },
  };
}

function abortError() {
  const err = new Error("The operation was aborted");
  err.name = "AbortError";
  return err;
}

function neverSettles(signal) {
  return new Promise((_, reject) => {
    if (signal?.aborted) {
      reject(abortError());
      return;
    }
    signal?.addEventListener("abort", () => reject(abortError()), { once: true });
  });
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

test("loadServices falls back when a 200 response is HTML, not the catalog", async (t) => {
  const calls = stubFetch(t, (url) => {
    if (isCatalogUrl(url)) return htmlResponse();
    if (isStaticUrl(url)) return jsonResponse(envelope("From Static File"));
    throw new Error(`unexpected fetch: ${url}`);
  });

  const loaded = await loadServices();

  assert.equal(loaded.entries[0].name, "From Static File");
  assert.equal(calls.filter(isCatalogUrl).length, 1);
  assert.equal(calls.filter(isStaticUrl).length, 1);
});

test("loadServices falls back when a 200 JSON body is not a catalog envelope", async (t) => {
  const calls = stubFetch(t, (url) => {
    if (isCatalogUrl(url)) return jsonResponse({ error: "not a catalog", ok: true });
    if (isStaticUrl(url)) return jsonResponse(envelope("From Static File"));
    throw new Error(`unexpected fetch: ${url}`);
  });

  const loaded = await loadServices();

  assert.equal(loaded.entries[0].name, "From Static File");
  assert.ok(loaded.entries.length > 0);
  assert.equal(calls.filter(isCatalogUrl).length, 1);
  assert.equal(calls.filter(isStaticUrl).length, 1);
});

test("loadServices falls back when the catalog request never settles", { timeout: 2000 }, async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });

  const calls = stubFetch(t, (url, init) => {
    if (isCatalogUrl(url)) return neverSettles(init?.signal);
    if (isStaticUrl(url)) return jsonResponse(envelope("From Static File"));
    throw new Error(`unexpected fetch: ${url}`);
  });

  const pending = loadServices();
  await Promise.resolve();

  assert.equal(calls.filter(isCatalogUrl).length, 1);
  assert.equal(calls.filter(isStaticUrl).length, 0);

  t.mock.timers.tick(2999);
  await Promise.resolve();
  assert.equal(calls.filter(isStaticUrl).length, 0);

  t.mock.timers.tick(2001);
  const loaded = await pending;

  assert.equal(loaded.entries[0].name, "From Static File");
  assert.equal(calls.filter(isCatalogUrl).length, 1);
  assert.equal(calls.filter(isStaticUrl).length, 1);
});
