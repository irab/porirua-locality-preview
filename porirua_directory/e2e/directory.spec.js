import { test, expect } from "@playwright/test";

test("crisis strip and browse entry visible", async ({ page }) => {
  await page.goto("/index.html");
  await expect(page.getByRole("link", { name: "111 Emergency" })).toBeVisible();
  await expect(page.getByRole("button", { name: "I need help" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Connect with community" })).toBeVisible();
});

test("help path — food category shows results", async ({ page }) => {
  await page.goto("/index.html");
  await page.getByRole("button", { name: "I need help" }).click();
  await expect(page.getByText(/What do you need help with/i)).toBeVisible();
  await page.getByRole("button", { name: /Food \/ kai/i }).click();
  await expect(page.locator("#directory-results .card")).not.toHaveCount(0);
  await expect(page.locator(".leaflet-container")).toBeVisible();
});

test("community path — marae filter finds Ngāti Toa", async ({ page }) => {
  await page.goto("/index.html");
  await page.getByRole("button", { name: "Connect with community" }).click();
  await page.getByRole("button", { name: /Marae and iwi/i }).click();
  await expect(page.locator("#directory-results")).toContainText(/Ngāti Toa/i);
});

test("search filters results on help path", async ({ page }) => {
  await page.goto("/index.html");
  await page.getByRole("button", { name: "I need help" }).click();
  await page.getByPlaceholder(/Search/i).fill("Wesley");
  await expect(page.locator("#directory-results")).toContainText(/Wesley/i);
});
