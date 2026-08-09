import { test, expect } from "@playwright/test";

const LOGO_ALT = "Te Wāhi Tiaki Tātou — Porirua Locality";
const PRODUCT_TITLE = "Your Porirua Directory";

test("accessibility smoke — skip link targets main landmark", async ({ page }) => {
  await page.goto("/index.html");
  const skip = page.getByRole("link", { name: "Skip to content" });
  await expect(skip).toHaveAttribute("href", "#main");
  await expect(page.locator("main#main")).toBeVisible();
});

test("accessibility smoke — about page main landmark and single h1", async ({ page }) => {
  await page.goto("/about.html");
  await expect(page.locator("main#main")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
});

test("landing — path buttons in subnav, crisis footer, no map", async ({ page }) => {
  await page.goto("/index.html");
  await expect(page.getByRole("link", { name: LOGO_ALT })).toBeVisible();
  await expect(page.getByRole("link", { name: PRODUCT_TITLE })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Site" }).getByRole("link", { name: "About" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Site" }).getByRole("link", { name: "My list" })).toBeVisible();
  await expect(page.getByText("I would like to…")).toBeVisible();
  const pathNav = page.getByRole("group", { name: "Choose a path" });
  await expect(pathNav.getByRole("button", { name: "Find support" })).toBeVisible();
  await expect(pathNav.getByRole("button", { name: "Connect with community" })).toBeVisible();
  await expect(page.getByRole("contentinfo", { name: "Crisis and emergency numbers" }).getByRole("link", { name: "111 Emergency" })).toBeVisible();
  await expect(page.locator("#search-input")).toBeHidden();
  await expect(page.locator(".leaflet-container")).toHaveCount(0);
  await expect(page.locator("#map-block")).toBeHidden();
});

test("about page — nav, copy, crisis footer", async ({ page }) => {
  await page.goto("/about.html");
  await expect(page.getByRole("heading", { name: "About Your Porirua Directory" })).toBeVisible();
  await expect(page.getByRole("link", { name: LOGO_ALT })).toBeVisible();
  await expect(page.locator(".site-product-title")).toHaveText(PRODUCT_TITLE);
  await expect(page.getByRole("link", { name: "Back to Your Porirua Directory" })).toBeVisible();
  await expect(page.getByRole("contentinfo", { name: "Crisis and emergency numbers" }).getByRole("link", { name: "1737" })).toBeVisible();
});

test("support path — all listings by default, no chip selected", async ({ page }) => {
  await page.goto("/index.html");
  await page.getByRole("group", { name: "Choose a path" }).getByRole("button", { name: "Find support" }).click();
  await expect(page.locator("#site-subnav")).toBeHidden();
  await expect(page.getByText("I would like to…")).toBeHidden();
  await expect(page.getByRole("contentinfo", { name: "Crisis and emergency numbers" }).getByRole("link", { name: "111 Emergency" })).toBeVisible();
  await expect(page.locator("#directory-results .card")).not.toHaveCount(0);
  await expect(page.locator("#need-chips .chip.is-on")).toHaveCount(0);
  await expect(page.locator("#map-block")).toBeHidden();
  await expect(page.locator(".leaflet-container")).toHaveCount(0);
});

test("support path — single-select need chip filters and toggles off", async ({ page }) => {
  await page.goto("/index.html#support");
  const chips = page.locator("#need-chips .chip");
  await expect(chips.first()).toBeVisible();
  const firstLabel = await chips.first().textContent();
  const initialCount = await page.locator("#directory-results .card").count();

  await chips.first().click();
  await expect(page.locator("#need-chips .chip.is-on")).toHaveCount(1);
  const filteredCount = await page.locator("#directory-results .card").count();
  expect(filteredCount).toBeLessThanOrEqual(initialCount);

  await chips.first().click();
  await expect(page.locator("#need-chips .chip.is-on")).toHaveCount(0);
  await expect(page.locator("#directory-results .card")).toHaveCount(initialCount);

  await chips.nth(1).click();
  await expect(page.locator("#need-chips .chip.is-on")).toHaveCount(1);
  await expect(page.locator("#need-chips .chip.is-on")).not.toHaveText(firstLabel ?? "");
});

test("support path — Show map reveals map when results have locations", async ({ page }) => {
  await page.goto("/index.html");
  await page.getByRole("group", { name: "Choose a path" }).getByRole("button", { name: "Find support" }).click();
  await expect(page.getByText(/Support with…/i)).toBeVisible();
  await expect(page.locator("#directory-results .card")).not.toHaveCount(0);
  await page.getByRole("checkbox", { name: "Show map" }).check();
  await expect(page.locator("#map-block")).toBeVisible();
  await expect(page.locator(".leaflet-container")).toBeVisible();
});

test("community path — marae filter finds Ngāti Toa", async ({ page }) => {
  await page.goto("/index.html");
  await page.getByRole("group", { name: "Choose a path" }).getByRole("button", { name: "Connect with community" }).click();
  await expect(page.getByRole("contentinfo", { name: "Crisis and emergency numbers" }).getByRole("link", { name: "111 Emergency" })).toBeVisible();
  await page.getByRole("button", { name: /Marae and iwi/i }).click();
  await expect(page.locator("#directory-results")).toContainText(/Ngāti Toa/i);
});

test("search filters results on support path", async ({ page }) => {
  await page.goto("/index.html");
  await page.getByRole("group", { name: "Choose a path" }).getByRole("button", { name: "Find support" }).click();
  await page.getByPlaceholder(/Search/i).fill("Wesley");
  await expect(page.locator("#directory-results")).toContainText(/Wesley/i);
});

test("back control returns to landing", async ({ page }) => {
  await page.goto("/index.html");
  await page.getByRole("group", { name: "Choose a path" }).getByRole("button", { name: "Find support" }).click();
  await expect(page.locator("#site-subnav")).toBeHidden();
  await page.getByRole("button", { name: "← Back" }).click();
  await expect(page.locator("#site-subnav")).toBeVisible();
  await expect(page.getByText("I would like to…")).toBeVisible();
  await expect(page.getByRole("group", { name: "Choose a path" }).getByRole("button", { name: "Find support" })).toBeVisible();
  await expect(page.getByRole("contentinfo", { name: "Crisis and emergency numbers" }).getByRole("link", { name: "111 Emergency" })).toBeVisible();
});

test("my list — add to list, view list, privacy note", async ({ page }) => {
  await page.goto("/index.html");
  await page.getByRole("group", { name: "Choose a path" }).getByRole("button", { name: "Find support" }).click();
  const firstCard = page.locator("#directory-results .card").first();
  await expect(firstCard).toBeVisible();
  const serviceName = await firstCard.locator(".card__title").textContent();
  expect(serviceName?.trim()).toBeTruthy();

  const name = serviceName?.trim() ?? "";
  await firstCard.getByRole("button", { name: `Add ${name} to your list` }).click();
  await expect(firstCard.getByRole("button", { name: `Remove ${name} from your list` })).toBeVisible();
  await expect(firstCard.locator(".card__fav-icon")).toBeVisible();

  await page.getByRole("navigation", { name: "Site" }).getByRole("link", { name: "My list" }).click();
  await expect(page.getByRole("heading", { name: "My list" })).toBeVisible();
  await expect(page.getByText(/Places and organisations you’ve saved/i)).toBeVisible();
  await expect(page.getByText(/stay on this device while you keep this page open/i)).toBeVisible();
  await expect(page.getByRole("button", { name: "Print list" })).toBeVisible();
  await expect(page.locator("#mylist-results")).toContainText(serviceName ?? "");
  await expect(page.locator("#mylist-results .card").first().locator(".card__fav-icon")).toBeVisible();
});

test("my list — print list enables print mode without error", async ({ page }) => {
  await page.goto("/index.html");
  await page.getByRole("group", { name: "Choose a path" }).getByRole("button", { name: "Find support" }).click();
  const firstCard = page.locator("#directory-results .card").first();
  const serviceName = (await firstCard.locator(".card__title").textContent())?.trim() ?? "";
  await firstCard.getByRole("button", { name: `Add ${serviceName} to your list` }).click();
  await page.getByRole("navigation", { name: "Site" }).getByRole("link", { name: "My list" }).click();
  await expect(page.getByRole("button", { name: "Print list" })).toBeEnabled();

  const printSmoke = await page.evaluate(() => {
    const errors = [];
    const onError = (e) => errors.push(e.message ?? String(e));
    window.addEventListener("error", onError);
    const origPrint = window.print;
    window.print = () => {};
    try {
      document.getElementById("mylist-print")?.click();
      window.dispatchEvent(new Event("beforeprint"));
      const hasClass = document.body.classList.contains("printing-mylist");
      window.dispatchEvent(new Event("afterprint"));
      const cleared = !document.body.classList.contains("printing-mylist");
      return { errors, hasClass, cleared };
    } finally {
      window.print = origPrint;
      window.removeEventListener("error", onError);
    }
  });

  expect(printSmoke.errors).toEqual([]);
  expect(printSmoke.hasClass).toBe(true);
  expect(printSmoke.cleared).toBe(true);
});

test("demo — three-column layout smoke with show map", async ({ page }) => {
  await page.goto("/index.html?demo=1&layout=three-column#support");
  await expect(page.locator("#demo-layout-wrap")).toBeVisible();
  await expect(page.locator("#demo-layout-select")).toHaveValue("three-column");
  await expect(page.getByRole("button", { name: "Find support near me" })).toBeVisible();
  await expect(page.locator("#map-block")).toBeVisible();
  await expect(page.locator(".leaflet-container")).toBeVisible();
  await expect(page.locator("#directory-results .card")).not.toHaveCount(0);
  await expect(page.locator("body")).toHaveAttribute("data-browse-layout", "three-column");
});

test("demo — three-column need chip filters list and map markers", async ({ page }) => {
  await page.goto("/index.html?demo=1&layout=three-column#support");
  await page.waitForSelector(".leaflet-overlay-pane svg path");
  const initialCount = await page.locator("#directory-results .card").count();
  const initialMarkers = await page.locator(".leaflet-overlay-pane svg path").count();
  expect(initialMarkers).toBe(initialCount);

  await page.locator("#need-chips .chip").first().click();
  await expect(page.locator("#need-chips .chip.is-on")).toHaveCount(1);

  const filteredCount = await page.locator("#directory-results .card").count();
  expect(filteredCount).toBeLessThan(initialCount);
  await expect(page.locator("#status-line")).toContainText(
    new RegExp(`${filteredCount} listing`)
  );

  await expect(page.locator(".leaflet-overlay-pane svg path")).toHaveCount(
    filteredCount
  );

  const stroke = await page
    .locator(".leaflet-overlay-pane svg path")
    .first()
    .getAttribute("stroke");
  expect(stroke?.toLowerCase()).toBe("#60164c");
});
