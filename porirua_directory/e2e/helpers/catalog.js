/**
 * Capture the catalog HTTP exchange the page actually made.
 * Do not infer source from rendered cards — both envelopes look the same.
 */

import { expect } from "@playwright/test";

export function attachCatalogCapture(page) {
  const api = [];
  const apiRequests = [];
  const staticFile = [];
  const staticResponses = [];
  const pending = [];

  page.on("request", (request) => {
    const url = request.url();
    if (url.includes("/api/catalog")) apiRequests.push(url);
    if (url.includes("/data/services.json")) staticFile.push(url);
  });

  const record = (response) => {
    const url = response.url();
    if (url.includes("/data/services.json")) {
      pending.push(
        Promise.resolve()
          .then(() => {
            staticResponses.push({ url, status: response.status() });
          })
          .catch(() => {})
      );
    }
    if (url.includes("/api/catalog")) {
      pending.push(
        response
          .text()
          .then((text) => {
            let body = null;
            try {
              body = text ? JSON.parse(text) : null;
            } catch {
              body = null;
            }
            const headers = response.headers();
            api.push({
              url,
              status: response.status(),
              contentType: headers["content-type"] ?? "",
              etag: headers.etag ?? "",
              cacheControl: headers["cache-control"] ?? "",
              body,
              text,
            });
          })
          .catch(() => {})
      );
    }
  };

  page.on("response", record);

  return {
    api,
    apiRequests,
    staticFile,
    async settle() {
      await Promise.all(pending);
    },
    /** Successful JSON envelope — the body loadServices would accept. */
    usedLiveEnvelope() {
      return api.find(
        (entry) =>
          entry.status === 200 &&
          /application\/json/i.test(entry.contentType) &&
          Array.isArray(entry.body?.services)
      );
    },
    usedFallbackFile() {
      return staticResponses.some((entry) => entry.status === 200);
    },
  };
}

/** Directory JS attaches path-card listeners only after loadServices returns. */
export async function waitForDirectoryData(seen) {
  await expect
    .poll(
      async () => {
        await seen.settle();
        return Boolean(seen.usedLiveEnvelope() || seen.usedFallbackFile());
      },
      { timeout: 15_000 }
    )
    .toBe(true);
}

export function catalogIds(envelope) {
  return (envelope?.services ?? []).map((entry) => entry.id).filter(Boolean);
}

export async function fetchCatalogFromPage(page, { path = "/api/catalog", headers = {}, cache = "no-store" } = {}) {
  return page.evaluate(
    async ({ path, headers, cache }) => {
      const response = await fetch(path, { headers, cache });
      const text = await response.text();
      return {
        status: response.status,
        etag: response.headers.get("etag"),
        cacheControl: response.headers.get("cache-control"),
        contentType: response.headers.get("content-type"),
        text,
      };
    },
    { path, headers, cache }
  );
}

export function parseEtagVersion(etag) {
  const match = String(etag ?? "").match(/^(?:W\/)?"(\d+)"$/);
  return match ? Number(match[1]) : null;
}

export function parseEnvelope(result) {
  if (!result.text) return null;
  try {
    return JSON.parse(result.text);
  } catch {
    return null;
  }
}
