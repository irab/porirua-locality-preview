import test from "node:test";
import assert from "node:assert/strict";
import {
  CATALOG_PUBLIC_URL,
  createMemoryEdgeCache,
  purgeCatalogCache,
} from "../scripts/lib/edge-cache.mjs";

test("purgeCatalogCache asks Cloudflare to drop the public catalog URL", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    return {
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
      text: async () => "",
    };
  };

  await purgeCatalogCache({
    fetchImpl,
    zoneId: "zone-1",
    apiToken: "token-1",
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://api.cloudflare.com/client/v4/zones/zone-1/purge_cache");
  assert.equal(calls[0].init.method, "POST");
  assert.equal(calls[0].init.headers.Authorization, "Bearer token-1");
  assert.deepEqual(JSON.parse(calls[0].init.body), { files: [CATALOG_PUBLIC_URL] });
});

test("purgeCatalogCache throws when Cloudflare rejects the purge", async () => {
  await assert.rejects(
    () =>
      purgeCatalogCache({
        fetchImpl: async () => ({
          ok: false,
          status: 403,
          json: async () => ({ success: false }),
          text: async () => "forbidden",
        }),
        zoneId: "zone-1",
        apiToken: "token-1",
      }),
    /cache purge failed/i
  );
});

test("a memory edge keeps serving the old catalog until purge, then the new version", async () => {
  const origin = {
    v1: { version: 1, name: "First" },
    v2: { version: 2, name: "Second" },
  };
  let originVersion = 1;
  const edge = createMemoryEdgeCache({
    originGet: async () => origin[`v${originVersion}`],
  });

  edge.seed(CATALOG_PUBLIC_URL, origin.v1);
  originVersion = 2;
  assert.deepEqual(await edge.get(CATALOG_PUBLIC_URL), origin.v1);

  await purgeCatalogCache({
    urls: [CATALOG_PUBLIC_URL],
    purge: (urls) => edge.purge(urls),
  });

  assert.deepEqual(await edge.get(CATALOG_PUBLIC_URL), origin.v2);
});
