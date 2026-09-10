/**
 * Edge cache invalidation for the public catalog URL.
 *
 * The catalog API sends Cache-Control: public, max-age=60, s-maxage=86400.
 * Publish is not finished until this purge succeeds.
 */

export const CATALOG_PUBLIC_URL =
  process.env.CATALOG_PUBLIC_URL || "https://directory.bsky.nz/api/catalog";

const CLOUDFLARE_PURGE_URL = (zoneId) =>
  `https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`;

export function createMemoryEdgeCache({ originGet } = {}) {
  const cached = new Map();
  return {
    seed(url, body) {
      cached.set(url, body);
    },
    async get(url) {
      if (cached.has(url)) return cached.get(url);
      if (typeof originGet !== "function") return undefined;
      return originGet(url);
    },
    async purge(urls = []) {
      for (const url of urls) cached.delete(url);
      return { ok: true, urls };
    },
  };
}

export async function purgeCatalogCache({
  urls = [CATALOG_PUBLIC_URL],
  purge,
  fetchImpl = globalThis.fetch,
  zoneId = process.env.CLOUDFLARE_ZONE_ID,
  apiToken = process.env.CLOUDFLARE_API_TOKEN,
} = {}) {
  const targets = Array.isArray(urls) && urls.length > 0 ? urls : [CATALOG_PUBLIC_URL];

  if (typeof purge === "function") {
    await purge(targets);
    return { urls: targets };
  }

  if (!zoneId || !apiToken) {
    throw new Error("catalog cache purge failed: CLOUDFLARE_ZONE_ID and CLOUDFLARE_API_TOKEN are required");
  }
  if (typeof fetchImpl !== "function") {
    throw new Error("catalog cache purge failed: no fetch implementation");
  }

  const response = await fetchImpl(CLOUDFLARE_PURGE_URL(zoneId), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ files: targets }),
  });

  if (!response?.ok) {
    const detail = typeof response?.text === "function" ? await response.text() : "";
    throw new Error(`catalog cache purge failed (${response?.status ?? "no-status"}): ${detail}`.trim());
  }

  return { urls: targets };
}
