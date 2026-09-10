import { expect } from "@playwright/test";

export function landingPath(page, name) {
  return page.getByRole("main").getByRole("button", { name });
}

/**
 * Path cards are in the HTML before loadServices attaches listeners.
 * Resource Timing cannot tell a usable JSON catalog from a 200 HTML body, and
 * directory-dev does not ship a ready flag. Click until browse actually opens.
 */
async function enterBrowse(page, name) {
  const button = landingPath(page, name);
  await expect(button).toBeVisible();
  await expect(async () => {
    if ((await page.locator("body").getAttribute("data-view")) === "browse") return;
    await button.click();
    await expect(page.locator("body")).toHaveAttribute("data-view", "browse", {
      timeout: 400,
    });
  }).toPass({ timeout: 15_000 });
}

export async function pickSupportPath(page) {
  await enterBrowse(page, /Find support/i);
}

export async function pickCommunityPath(page) {
  await enterBrowse(page, /Connect with community/i);
}

export function browseSearch(page) {
  return page.getByRole("searchbox", { name: /Search for food/i });
}

export async function fillBrowseSearch(page, query) {
  const input = browseSearch(page);
  await expect(input).toBeVisible();
  await input.fill(query);
}

export async function pickSupportTopic(page, name = /Food \/ kai/i) {
  await page.getByRole("group", { name: "Types of support" }).getByRole("button", { name }).click();
}

export async function pickCommunityTopic(page, name = /Community groups/i) {
  await page.getByRole("group", { name: "Organisation types" }).getByRole("button", { name }).click();
}

export async function gotoSupportResults(page, url = "/index.html#support") {
  await page.goto(url);
  await expect(page.locator("#directory-results .card").first()).toBeVisible();
}

export async function gotoCommunityResults(page, url = "/index.html#community") {
  await page.goto(url);
  await expect(page.locator("#directory-results .card").first()).toBeVisible();
}

/** Public id is the bootstrap contract; names collide for the disambiguated pair. */
export function listingByPublicId(page, publicId) {
  return page.getByRole("article").and(page.locator(`[data-id="${publicId}"]`));
}
