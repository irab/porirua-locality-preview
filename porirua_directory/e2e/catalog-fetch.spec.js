import { test, expect } from "@playwright/test";

const API_PROBE_NAME = "Catalog API Probe Org";
const STATIC_KNOWN_NAME = "Little People";

function apiProbeEnvelope() {
  return {
    generatedAt: "2026-09-08T00:00:00.000Z",
    counts: { community: 0, fsd: 1, published: 1 },
    services: [
      {
        id: "fsd-catalog-api-probe",
        name: API_PROBE_NAME,
        serviceName: "Catalog probe",
        description: "Listing that exists only on the live catalog API stub.",
        source: "fsd",
        categories: ["support"],
        communityFilters: [],
        badges: [],
      },
    ],
  };
}

async function pickSupportPath(page) {
  await page.locator("#view-landing .landing-paths").getByRole("button", { name: /Find support/i }).click();
}

function catalogRequests(page) {
  const api = [];
  const staticFile = [];
  page.on("request", (req) => {
    const url = req.url();
    if (url.includes("/api/catalog")) api.push(url);
    if (url.includes("/data/services.json")) staticFile.push(url);
  });
  return { api, staticFile };
}

test("browse consumes the catalog API and never requests the static file", async ({ page }) => {
  const seen = catalogRequests(page);

  await page.route("**/api/catalog", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(apiProbeEnvelope()),
    });
  });
  await page.route("**/data/services.json", async (route) => {
    await route.abort("failed");
  });

  await page.goto("/index.html");
  await pickSupportPath(page);

  await expect(page.getByRole("article").filter({ hasText: API_PROBE_NAME })).toBeVisible();
  await expect(page.getByRole("article").filter({ hasText: STATIC_KNOWN_NAME })).toHaveCount(0);
  expect(seen.api).toHaveLength(1);
  expect(seen.staticFile).toHaveLength(0);
});

test("browse falls back to the baked file when the catalog API is unreachable", async ({
  page,
}) => {
  const seen = catalogRequests(page);

  await page.route("**/api/catalog", async (route) => {
    await route.abort("failed");
  });

  await page.goto("/index.html");
  await pickSupportPath(page);

  await expect(page.getByRole("article").first()).toBeVisible();
  await page.getByRole("searchbox", { name: "Search organisations" }).fill(STATIC_KNOWN_NAME);
  await expect(page.getByRole("article").filter({ hasText: STATIC_KNOWN_NAME })).toBeVisible();
  await expect(page.getByRole("article").filter({ hasText: API_PROBE_NAME })).toHaveCount(0);
  expect(seen.api).toHaveLength(1);
  expect(seen.staticFile).toHaveLength(1);
});

test("browse falls back to the baked file when the catalog API returns 503", async ({
  page,
}) => {
  const seen = catalogRequests(page);

  await page.route("**/api/catalog", async (route) => {
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "catalog unavailable", retryAfterSeconds: 30 }),
    });
  });

  await page.goto("/index.html");
  await pickSupportPath(page);

  await expect(page.getByRole("article").first()).toBeVisible();
  await page.getByRole("searchbox", { name: "Search organisations" }).fill(STATIC_KNOWN_NAME);
  await expect(page.getByRole("article").filter({ hasText: STATIC_KNOWN_NAME })).toBeVisible();
  await expect(page.getByRole("article").filter({ hasText: API_PROBE_NAME })).toHaveCount(0);
  expect(seen.api).toHaveLength(1);
  expect(seen.staticFile).toHaveLength(1);
});
