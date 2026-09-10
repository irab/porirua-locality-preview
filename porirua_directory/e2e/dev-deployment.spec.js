import { test, expect } from "@playwright/test";
import {
  DISAMBIGUATED_COMMUNITY_ID,
  DISAMBIGUATED_ORG_ID,
  EXPECTED_CACHE_CONTROL,
  requireDevDeployment,
} from "./helpers/target.js";
import {
  browseSearch,
  fillBrowseSearch,
  listingByPublicId,
  pickSupportPath,
} from "./helpers/browse.js";
import {
  attachCatalogCapture,
  catalogIds,
  fetchCatalogFromPage,
  parseEnvelope,
  parseEtagVersion,
  waitForDirectoryData,
} from "./helpers/catalog.js";

test.beforeEach(() => {
  requireDevDeployment();
});

test("the page uses the /api/catalog response, not the baked file", async ({ page }) => {
  const seen = attachCatalogCapture(page);

  await page.goto("/index.html");
  await waitForDirectoryData(seen);
  await pickSupportPath(page);
  await expect(page.getByRole("article").first()).toBeVisible();
  await seen.settle();

  const used = seen.usedLiveEnvelope();
  expect(used, "page never received a JSON catalog envelope from /api/catalog").toBeTruthy();
  expect(new URL(used.url).pathname).toBe("/api/catalog");
  expect(used.url).not.toMatch(/[?&]version=/);

  const ids = catalogIds(used.body);
  expect(ids).toContain(DISAMBIGUATED_ORG_ID);
  expect(ids).toContain(DISAMBIGUATED_COMMUNITY_ID);
  expect(seen.staticFile, "baked services.json was requested — silent fallback").toEqual([]);

  const baked = await page.evaluate(async () => {
    const response = await fetch("./data/services.json", { cache: "no-store" });
    return response.json();
  });
  const bakedIds = catalogIds(baked);
  expect(bakedIds).not.toContain(DISAMBIGUATED_ORG_ID);
  expect(bakedIds).not.toContain(DISAMBIGUATED_COMMUNITY_ID);
  expect(used.body.generatedAt).not.toBe(baked.generatedAt);
});

test("browse falls back to /data/services.json when /api/catalog is unreachable", async ({
  page,
}) => {
  const seen = attachCatalogCapture(page);
  await page.route("**/api/catalog*", (route) => route.abort("failed"));

  await page.goto("/index.html");
  await waitForDirectoryData(seen);
  await pickSupportPath(page);
  await expect(page.getByRole("article").first()).toBeVisible();
  await fillBrowseSearch(page, "Little People");
  await expect(page.getByRole("article").filter({ hasText: "Little People" })).toBeVisible();
  await expect(page.getByText(/We couldn’t load the listings/i)).toHaveCount(0);
  await seen.settle();
  expect(seen.apiRequests.length).toBeGreaterThanOrEqual(1);
  expect(seen.staticFile).toHaveLength(1);
});

test("ETag / If-None-Match returns 304 with no body and the documented Cache-Control", async ({
  page,
}) => {
  await page.goto("/index.html");
  await expect(page.getByRole("heading", { name: "Where would you like to start?" })).toBeVisible();

  const first = await fetchCatalogFromPage(page);
  expect(first.status).toBe(200);
  expect(parseEtagVersion(first.etag)).toBeGreaterThan(0);
  expect(first.cacheControl).toBe(EXPECTED_CACHE_CONTROL);
  expect(parseEnvelope(first)?.services?.length).toBeGreaterThan(0);

  const cached = await fetchCatalogFromPage(page, {
    headers: { "If-None-Match": first.etag },
    cache: "no-store",
  });
  expect(cached.status).toBe(304);
  expect(parseEtagVersion(cached.etag)).toBe(parseEtagVersion(first.etag));
  expect(cached.cacheControl).toBe(EXPECTED_CACHE_CONTROL);
  expect(cached.text).toBe("");
});

test("?version=N serves an older snapshot", async ({ page }) => {
  await page.goto("/index.html");
  await expect(page.getByRole("heading", { name: "Where would you like to start?" })).toBeVisible();

  const current = await fetchCatalogFromPage(page);
  expect(current.status).toBe(200);
  const currentVersion = parseEtagVersion(current.etag);
  expect(currentVersion).toBeGreaterThanOrEqual(2);

  const olderVersion = currentVersion - 1;
  const older = await fetchCatalogFromPage(page, {
    path: `/api/catalog?version=${olderVersion}`,
  });
  expect(older.status).toBe(200);
  expect(parseEtagVersion(older.etag)).toBe(olderVersion);
  const olderBody = parseEnvelope(older);
  const currentBody = parseEnvelope(current);
  expect(olderBody?.generatedAt).toBeTruthy();
  expect(olderBody.generatedAt).not.toBe(currentBody.generatedAt);

  const missing = await fetchCatalogFromPage(page, {
    path: `/api/catalog?version=${currentVersion + 1000}`,
  });
  expect(missing.status).toBe(404);
  expect(parseEnvelope(missing)).toEqual({ error: "snapshot not found" });

  const invalid = await fetchCatalogFromPage(page, { path: "/api/catalog?version=nope" });
  expect(invalid.status).toBe(400);
  expect(parseEnvelope(invalid)).toEqual({ error: "invalid version" });
});

test("deep links open browse and the bootstrap-disambiguated listings", async ({ page }) => {
  await page.goto("/index.html#support");
  await expect(page.getByRole("searchbox", { name: /Search for food/i })).toBeVisible();
  await expect(page).toHaveURL(/#support$/);

  await fillBrowseSearch(page, "South Wairarapa Truancy");
  const orgCard = listingByPublicId(page, DISAMBIGUATED_ORG_ID);
  await expect(orgCard).toBeVisible();
  await expect(orgCard).toHaveAttribute("data-id", DISAMBIGUATED_ORG_ID);
  await expect(orgCard.getByRole("heading", { name: "Te Waka Whaiora Trust" })).toBeVisible();
  await expect(orgCard.getByText(/South Wairarapa Truancy Service/i)).toBeVisible();

  await page.goto("/index.html#community");
  await expect(page).toHaveURL(/#community$/);
  await page.getByRole("group", { name: "Organisation types" }).getByRole("button", { name: /Marae and iwi/i }).click();
  const communityCard = listingByPublicId(page, DISAMBIGUATED_COMMUNITY_ID);
  await expect(communityCard).toBeVisible();
  await expect(communityCard.getByRole("heading", { name: "Te Wāhi Tiaki Tātou" })).toBeVisible();
  await expect(listingByPublicId(page, "community-te-wahi-tiaki-tatou")).toHaveCount(0);
});

test("my list keyed on the disambiguated public id survives a reload", async ({ page }) => {
  await page.goto("/index.html#support");
  await fillBrowseSearch(page, "South Wairarapa Truancy");
  const card = listingByPublicId(page, DISAMBIGUATED_ORG_ID);
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "Add Te Waka Whaiora Trust to your list" }).click();
  await expect(card.getByRole("button", { name: "Remove Te Waka Whaiora Trust from your list" })).toBeVisible();

  const storedBefore = await page.evaluate(() => ({
    local: window.localStorage.getItem("porirua-directory-favorites"),
    session: window.sessionStorage.getItem("porirua-directory-favorites"),
  }));
  const storedIds = JSON.parse(storedBefore.session || storedBefore.local || "[]");
  expect(storedIds).toContain(DISAMBIGUATED_ORG_ID);

  await page.reload();
  await page.getByRole("navigation", { name: "Site" }).getByRole("link", { name: "My list" }).click();
  await expect(page.getByRole("heading", { name: "My list" })).toBeVisible();
  const listCard = listingByPublicId(page, DISAMBIGUATED_ORG_ID);
  await expect(listCard).toBeVisible();
  await expect(listCard.getByRole("heading", { name: "Te Waka Whaiora Trust" })).toBeVisible();
});

test("search, category filter, and map run against the live catalog", async ({ page }) => {
  const seen = attachCatalogCapture(page);
  await page.goto("/index.html");
  await waitForDirectoryData(seen);
  await pickSupportPath(page);
  await seen.settle();
  const used = seen.usedLiveEnvelope();
  expect(used, "browse did not consume /api/catalog").toBeTruthy();

  await fillBrowseSearch(page, "Wesley");
  await expect(page.getByRole("article").filter({ hasText: /Wesley/i }).first()).toBeVisible();

  await page.getByRole("button", { name: "Clear search" }).click();
  await expect(browseSearch(page)).toHaveValue("");

  const cards = page.getByRole("article");
  await expect(cards.first()).toBeVisible();
  const initialCount = await cards.count();
  const health = page.getByRole("group", { name: "Types of support" }).getByRole("button", { name: "Health" });
  await health.click();
  await expect.poll(async () => cards.count()).toBeLessThan(initialCount);
  await expect(cards.first()).toBeVisible();
  await expect(page.getByRole("status")).toContainText(/\d+ organisations? \(\d+ matching service lines?\)/i);

  await expect(page.getByLabel("Map of listed places")).toBeVisible();
  await expect(page.getByRole("button", { name: "Zoom in" })).toBeVisible();
});
