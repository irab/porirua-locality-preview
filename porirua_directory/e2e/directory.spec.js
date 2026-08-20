import { test, expect } from "@playwright/test";

const LOGO_ALT = "Te Wāhi Tiaki Tātou — Porirua Locality";
const PRODUCT_TITLE = "Your Porirua Directory";

async function pickSupportPath(page) {
  await page.locator("#view-landing .landing-paths").getByRole("button", { name: /Find support/i }).click();
}

async function pickCommunityPath(page) {
  await page.locator("#view-landing .landing-paths").getByRole("button", { name: /Connect with community/i }).click();
}

function browseSearch(page) {
  return page.getByRole("searchbox", { name: "Search organisations" });
}

async function fillBrowseSearch(page, query) {
  const input = browseSearch(page);
  await expect(input).toBeVisible();
  await input.fill(query);
}

/** Playwright context geolocation is unreliable with getCurrentPosition; stub in-page. */
async function mockGeolocation(page, { latitude, longitude, accuracy = 10 }) {
  await page.addInitScript(
    ({ latitude, longitude, accuracy }) => {
      const position = {
        coords: {
          latitude,
          longitude,
          accuracy,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
        },
        timestamp: Date.now(),
      };
      navigator.geolocation.getCurrentPosition = (success) => {
        queueMicrotask(() => success(position));
      };
    },
    { latitude, longitude, accuracy }
  );
}

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

test("landing — welcome, path cards, no duplicate path choice, crisis footer, no map", async ({ page }) => {
  await page.goto("/index.html");
  await expect(page.getByRole("link", { name: LOGO_ALT })).toBeVisible();
  await expect(page.getByRole("link", { name: PRODUCT_TITLE })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Site" }).getByRole("link", { name: "About" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Site" }).getByRole("link", { name: "My list" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Where would you like to start?" })).toBeVisible();
  await expect(page.getByText(/Find support services or connect with community/i)).toBeVisible();
  const landingPaths = page.locator("#view-landing .landing-paths");
  await expect(landingPaths.getByRole("button", { name: /Find support/i })).toBeVisible();
  await expect(landingPaths.getByRole("button", { name: /Connect with community/i })).toBeVisible();
  await expect(page.locator("#site-subnav")).toBeHidden();
  await expect(page.getByText("I would like to…")).toBeHidden();
  await expect(page.getByRole("group", { name: "Choose a path" })).toHaveCount(0);
  await expect(page.getByRole("contentinfo", { name: "Crisis and emergency numbers" }).getByRole("link", { name: "111 Emergency" })).toBeVisible();
  await expect(
    page.getByRole("contentinfo", { name: "Crisis and emergency numbers" }).getByRole("link", { name: "Need to talk? 1737" })
  ).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Site" }).getByRole("button", { name: "← Back" })).toHaveCount(0);
  await expect(page.locator("#search-input")).toBeHidden();
  await expect(page.locator(".leaflet-container")).toHaveCount(0);
  await expect(page.locator("#map-block")).toBeHidden();
});

test("landing path card arrows sit on the right of each card", async ({ page }) => {
  await page.goto("/index.html");
  const cards = page.locator("#view-landing .landing-paths").getByRole("button");
  await expect(cards).toHaveCount(2);

  for (const name of [/Find support/i, /Connect with community/i]) {
    const card = page.locator("#view-landing .landing-paths").getByRole("button", { name });
    const arrow = card.getByText("→");
    await expect(arrow).toBeVisible();
    const cardBox = await card.boundingBox();
    const arrowBox = await arrow.boundingBox();
    expect(cardBox, `bounding box for ${name}`).toBeTruthy();
    expect(arrowBox, `arrow bounding box for ${name}`).toBeTruthy();
    expect(arrowBox.x).toBeGreaterThan(cardBox.x + cardBox.width * 0.55);
    expect(arrowBox.x + arrowBox.width).toBeLessThanOrEqual(cardBox.x + cardBox.width);
  }
});

test("about page — nav, copy, crisis footer", async ({ page }) => {
  await page.goto("/about.html");
  await expect(page.getByRole("heading", { name: "About Your Porirua Directory" })).toBeVisible();
  await expect(page.getByRole("link", { name: LOGO_ALT })).toBeVisible();
  await expect(page.locator(".site-product-title")).toHaveText(PRODUCT_TITLE);
  await expect(page.getByRole("link", { name: "Back to Your Porirua Directory" })).toBeVisible();
  await expect(
    page.getByRole("contentinfo", { name: "Crisis and emergency numbers" }).getByRole("link", { name: "Need to talk? 1737" })
  ).toBeVisible();
});

test("support path — all listings by default, no chip selected", async ({ page }) => {
  await page.goto("/index.html");
  await pickSupportPath(page);
  await expect(page.locator("#site-subnav")).toBeHidden();
  await expect(page.getByText("I would like to…")).toBeHidden();
  await expect(page.getByRole("contentinfo", { name: "Crisis and emergency numbers" }).getByRole("link", { name: "111 Emergency" })).toBeVisible();
  await expect(page.locator("#directory-results .card")).not.toHaveCount(0);
  await expect(page.locator("#need-chips .chip.is-on")).toHaveCount(0);
  await expect(page.locator("body")).toHaveAttribute("data-browse-layout", "three-column");
  await expect(page.locator("#map-block")).toBeVisible();
  await expect(page.locator(".leaflet-container")).toBeVisible();
  await expect(page.getByRole("button", { name: "Hide map" })).toHaveCount(0);
});

test("support path — multi-select need chips filter as a union", async ({ page }) => {
  await page.goto("/index.html#support");
  const needGroup = page.getByRole("group", { name: "Types of support" });
  const chips = needGroup.getByRole("button");
  await expect(chips.first()).toBeVisible();
  const firstChip = chips.first();
  const secondChip = chips.nth(1);
  const cards = page.locator("#directory-results .card");
  await expect(cards.first()).toBeVisible();
  const initialCount = await cards.count();

  await firstChip.click();
  await expect(page.locator("#need-chips .chip.is-on")).toHaveCount(1);
  await expect(firstChip).toHaveClass(/is-on/);
  const oneChipCount = await cards.count();
  expect(oneChipCount).toBeLessThan(initialCount);
  expect(oneChipCount).toBeGreaterThan(0);
  const oneChipTitles = await cards.locator(".card__title").allTextContents();

  await secondChip.click();
  await expect(page.locator("#need-chips .chip.is-on")).toHaveCount(2);
  await expect(firstChip).toHaveClass(/is-on/);
  await expect(secondChip).toHaveClass(/is-on/);
  const unionCount = await cards.count();
  expect(unionCount).toBeGreaterThan(0);
  expect(unionCount).toBeGreaterThanOrEqual(oneChipCount);
  expect(unionCount).toBeLessThanOrEqual(initialCount);
  expect(unionCount).toBeGreaterThan(oneChipCount);
  const unionTitles = await cards.locator(".card__title").allTextContents();
  for (const title of oneChipTitles) {
    expect(unionTitles).toContain(title);
  }

  await firstChip.click();
  await expect(page.locator("#need-chips .chip.is-on")).toHaveCount(1);
  await expect(firstChip).not.toHaveClass(/is-on/);
  await expect(secondChip).toHaveClass(/is-on/);

  await secondChip.click();
  await expect(page.locator("#need-chips .chip.is-on")).toHaveCount(0);
  await expect(cards).toHaveCount(initialCount);
});

test("support path — layout=top shows map when mappable, no toolbar toggle", async ({
  page,
}) => {
  await page.goto("/index.html?layout=top");
  await pickSupportPath(page);
  await expect(page.getByText(/Support with…/i)).toBeVisible();
  await expect(page.locator("#directory-results .card")).not.toHaveCount(0);
  await expect(page.locator("#map-block")).toBeVisible();
  await expect(page.locator(".leaflet-container")).toBeVisible();
  await expect(page.getByRole("button", { name: "Hide map" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Show map" })).toHaveCount(0);
});

test("support path — stacked mobile has no map toggle; map visible by default", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/index.html#support");
  await expect(page.locator("body")).toHaveAttribute("data-browse-layout", "three-column");
  await expect(page.locator("#map-block")).toBeVisible();
  await expect(page.getByRole("button", { name: "Hide map" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Show map" })).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator("#map-block")).toBeVisible();
  await expect(page.locator(".leaflet-container")).toBeVisible();
  await expect(page.getByRole("button", { name: "Hide map" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Show map" })).toHaveCount(0);
});

test("support path — mobile three-column shows map between filters and results", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/index.html#support");
  await expect(page.locator("body")).toHaveAttribute("data-browse-layout", "three-column");
  await expect(page.locator("#map-block")).toBeVisible();
  await expect(page.locator(".leaflet-container")).toBeVisible();

  const order = await page.evaluate(() => {
    const panel = document.querySelector(".browse-sticky-panel");
    const map = document.getElementById("map-block");
    const main = document.querySelector(".browse-main");
    const y = (el) => el?.getBoundingClientRect().top ?? 0;
    return { panel: y(panel), map: y(map), main: y(main) };
  });
  expect(order.panel).toBeLessThan(order.map);
  expect(order.map).toBeLessThan(order.main);
});

for (const width of [390, 600]) {
  test(`browse sticky panel sits flush under the top nav at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/index.html#community");
    await page.waitForSelector("#directory-results .card");
    await page.evaluate(() => window.scrollTo(0, 800));
    await expect
      .poll(async () => page.locator("body").getAttribute("data-browse-chrome"))
      .toBe("collapsed");

    const seam = await page.evaluate(() => {
      const nav = document.querySelector(".site-topnav");
      const panel = document.querySelector("#view-browse .browse-sticky-panel");
      if (!nav || !panel) return null;
      const nr = nav.getBoundingClientRect();
      const pr = panel.getBoundingClientRect();
      const gap = pr.top - nr.bottom;
      const x = pr.left + pr.width / 2;
      const y = nr.bottom + Math.min(2, Math.max(0, gap / 2));
      const el = document.elementFromPoint(x, y);
      return {
        gap,
        peekCard: Boolean(el?.closest?.(".card")),
      };
    });

    expect(seam).not.toBeNull();
    expect(seam.gap).toBeLessThanOrEqual(1);
    expect(seam.peekCard).toBe(false);
  });
}

test("browse sticky panel masks scrolling result cards on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/index.html#support");
  await page.waitForSelector("#directory-results .card");
  await page.evaluate(() => window.scrollTo(0, 800));

  const covered = await page.evaluate(() => {
    const panel = document.querySelector("#view-browse .browse-sticky-panel");
    const card = document.querySelector("#directory-results .card");
    if (!panel || !card) return null;
    const pr = panel.getBoundingClientRect();
    const cr = card.getBoundingClientRect();
    if (cr.top >= pr.bottom || cr.bottom <= pr.top) return { skipped: true };
    const x = pr.left + pr.width / 2;
    const y = Math.max(pr.top + 4, Math.min(pr.bottom - 4, cr.top + 20));
    const el = document.elementFromPoint(x, y);
    return { skipped: false, insidePanel: panel.contains(el) };
  });

  expect(covered).not.toBeNull();
  expect(covered.skipped || covered.insidePanel).toBe(true);
});

test("browse chrome collapses on scroll down and expands near top", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/index.html#support");
  await page.waitForSelector("#directory-results .card");
  await page.evaluate(async () => {
    window.scrollTo(0, 0);
    await new Promise((r) => requestAnimationFrame(r));
    window.scrollTo(0, 480);
    await new Promise((r) => requestAnimationFrame(r));
    await new Promise((r) => requestAnimationFrame(r));
  });
  await expect
    .poll(
      async () => {
        const chrome = await page.locator("body").getAttribute("data-browse-chrome");
        const expandVisible = await page.locator("#browse-chrome-expand").isVisible();
        return chrome === "collapsed" && expandVisible;
      },
      { timeout: 8000 }
    )
    .toBe(true);
  await expect(browseSearch(page)).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page.locator("body")).not.toHaveAttribute("data-browse-chrome", "collapsed");
});

test("browse chrome stays collapsed while scrolling down (no flicker)", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/index.html");
  await pickCommunityPath(page);
  await page.waitForSelector("#directory-results .card");

  const result = await page.evaluate(async () => {
    const flips = [];
    let prev = document.body.dataset.browseChrome || "expanded";
    const obs = new MutationObserver(() => {
      const next = document.body.dataset.browseChrome || "expanded";
      if (next !== prev) {
        flips.push(next);
        prev = next;
      }
    });
    obs.observe(document.body, { attributes: true, attributeFilter: ["data-browse-chrome"] });

    window.scrollTo(0, 0);
    await new Promise((r) => requestAnimationFrame(r));
    for (let y = 0; y <= 720; y += 12) {
      window.scrollTo(0, y);
      await new Promise((r) => requestAnimationFrame(r));
    }
    await new Promise((r) => setTimeout(r, 450));
    obs.disconnect();

    const expand = document.getElementById("browse-chrome-expand");
    return {
      flips,
      final: document.body.dataset.browseChrome || "expanded",
      expandVisible: Boolean(expand && !expand.hidden),
    };
  });

  expect(result.final).toBe("collapsed");
  expect(result.expandVisible).toBe(true);
  expect(result.flips.filter((state) => state === "collapsed")).toHaveLength(1);
  expect(result.flips.filter((state) => state === "expanded")).toHaveLength(0);
});

test("Filters reopen chips without laying the map over search", async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 700 });
  await page.goto("/index.html#community");
  await page.waitForSelector("#directory-results .card");
  await page.evaluate(() => window.scrollTo(0, 220));
  await expect(page.locator("body")).toHaveAttribute("data-browse-chrome", "collapsed");
  await page.getByRole("button", { name: "Filters" }).click();
  await expect(page.locator("body")).not.toHaveAttribute("data-browse-chrome", "collapsed");
  await page.getByRole("button", { name: /Councils and public agencies/i }).click();
  await expect(page.getByRole("button", { name: /Councils and public agencies/i })).toHaveClass(/is-on/);

  const search = browseSearch(page);
  await expect(search).toBeVisible();
  await expect(page.getByRole("heading", { name: "Organisation type" })).toBeVisible();
  await expect(page.locator("body")).toHaveAttribute("data-browse-map", "collapsed");
  await expect
    .poll(async () =>
      page.evaluate(() => document.getElementById("map-block")?.getBoundingClientRect().height ?? 0)
    )
    .toBeLessThanOrEqual(8);

  const overlap = await page.evaluate(() => {
    const searchBox = document.getElementById("search-input");
    const heading = document.getElementById("community-filters-heading");
    const map = document.getElementById("map-block");
    const sr = searchBox.getBoundingClientRect();
    const hr = heading.getBoundingClientRect();
    const mr = map.getBoundingClientRect();
    const mid = sr.left + sr.width / 2;
    const atSearch = document.elementFromPoint(mid, sr.top + sr.height / 2);
    return {
      searchCoveredByMap: Boolean(atSearch?.closest?.("#map-block, .leaflet-container")),
      mapOverlapsSearch: mr.height > 8 && !(mr.bottom <= sr.top || mr.top >= sr.bottom),
      headingAboveMap: hr.bottom <= mr.top + 1 || mr.height <= 8,
    };
  });
  expect(overlap.searchCoveredByMap).toBe(false);
  expect(overlap.mapOverlapsSearch).toBe(false);
  expect(overlap.headingAboveMap).toBe(true);
});

test("browse chrome does not collapse on three-column desktop scroll", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/index.html#support");
  await page.waitForSelector("#directory-results .card");
  await page.evaluate(async () => {
    window.scrollTo(0, 0);
    for (let y = 0; y <= 900; y += 90) {
      window.scrollTo(0, y);
      await new Promise((r) => requestAnimationFrame(r));
    }
  });
  await expect(page.locator("body")).not.toHaveAttribute("data-browse-chrome", "collapsed");
  await expect(page.locator("#need-chips .chip").first()).toBeVisible();
});

test("community path — marae filter finds Ngāti Toa", async ({ page }) => {
  await page.goto("/index.html");
  await pickCommunityPath(page);
  await expect(page.getByRole("contentinfo", { name: "Crisis and emergency numbers" }).getByRole("link", { name: "111 Emergency" })).toBeVisible();
  await page.getByRole("button", { name: /Marae and iwi/i }).click();
  await expect(page.locator("#directory-results")).toContainText(/Ngāti Toa/i);
});

test("community path — Food / Pātaka Kai finds kai organisations", async ({ page }) => {
  await page.goto("/index.html");
  await pickCommunityPath(page);
  await page.getByRole("button", { name: /Food \/ Pātaka Kai/i }).click();
  await expect(page.locator("#directory-results")).toContainText(/Kai Kaupapa Group/i);
  await expect(page.locator("#directory-results")).toContainText(/Te Umu ki Rangituhi/i);
});

test("search filters results on support path", async ({ page }) => {
  await page.goto("/index.html");
  await pickSupportPath(page);
  await fillBrowseSearch(page, "Wesley");
  await expect(page.locator("#directory-results")).toContainText(/Wesley/i);
});

test("browse search field is visible without a toggle", async ({ page }) => {
  await page.goto("/index.html#support");
  await expect(page.getByRole("button", { name: "Search", exact: true })).toHaveCount(0);
  const input = browseSearch(page);
  await expect(input).toBeVisible();
  await expect(input).toHaveAttribute("placeholder", "Search organisations…");
  await expect(page.getByRole("button", { name: "Clear search" })).toHaveCount(0);
});

test("clearing search restores listings", async ({ page }) => {
  await page.goto("/index.html#support");
  const cards = page.locator("#directory-results .card");
  await expect(cards.first()).toBeVisible();
  const initialCount = await cards.count();

  await fillBrowseSearch(page, "zzzxnotaservice999");
  await expect(page.getByText(/We couldn’t find anything/i)).toBeVisible();

  await page.getByRole("button", { name: "Clear search" }).click();
  await expect(browseSearch(page)).toBeVisible();
  await expect(browseSearch(page)).toHaveValue("");
  await expect(cards.first()).toBeVisible();
  await expect(cards).toHaveCount(initialCount);
});

test("Escape in search clears the query and keeps the field visible", async ({ page }) => {
  await page.goto("/index.html#support");
  const cards = page.locator("#directory-results .card");
  await expect(cards.first()).toBeVisible();
  const initialCount = await cards.count();

  const input = browseSearch(page);
  await input.fill("zzzxnotaservice999");
  await expect(page.getByText(/We couldn’t find anything/i)).toBeVisible();

  await input.press("Escape");
  await expect(input).toBeVisible();
  await expect(input).toHaveValue("");
  await expect(page.getByRole("button", { name: "Clear search" })).toHaveCount(0);
  await expect(cards).toHaveCount(initialCount);
});

test("browse search hides the native clear control while typing", async ({ page }) => {
  await page.goto("/index.html#support");
  const input = browseSearch(page);
  await expect(input).toBeVisible();
  await input.fill("asdas");
  await expect(page.getByRole("button", { name: "Clear search" })).toBeVisible();
  // type=search adds a second native × in Chrome/Safari that CSS cannot reliably hide.
  await expect(input).toHaveAttribute("type", "text");
});

test("browse search field stays in viewport on narrow screens", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/index.html");
  await pickSupportPath(page);
  const field = page.locator("#browse-search");
  await expect(browseSearch(page)).toBeVisible();
  const box = await field.boundingBox();
  expect(box).not.toBeNull();
  const { width: vw } = page.viewportSize();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(vw + 0.5);
});

test("browse search — field fits placeholder on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/index.html#support");
  const input = browseSearch(page);
  await expect(input).toBeVisible();
  await expect(input).toHaveAttribute("placeholder", "Search organisations…");

  const layout = await page.evaluate(() => {
    const inputEl = document.getElementById("search-input");
    const fieldEl = document.getElementById("browse-search-field");
    const prefixEl = fieldEl?.querySelector(".browse-search__prefix");
    if (!inputEl || !fieldEl || !prefixEl) return null;
    const style = window.getComputedStyle(inputEl);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.font = `${style.fontSize} ${style.fontFamily}`;
    const placeholderWidth = ctx.measureText(inputEl.placeholder).width;
    const fieldRect = fieldEl.getBoundingClientRect();
    const prefixRect = prefixEl.getBoundingClientRect();
    return {
      inputWidth: inputEl.clientWidth,
      placeholderWidth,
      prefixInsideField:
        prefixRect.left >= fieldRect.left - 1 &&
        prefixRect.right <= fieldRect.right + 1,
    };
  });
  expect(layout).not.toBeNull();
  expect(layout.inputWidth).toBeGreaterThanOrEqual(layout.placeholderWidth);
  expect(layout.prefixInsideField).toBe(true);
});

test("landing path card enters support browse", async ({ page }) => {
  await page.goto("/index.html");
  await page.locator("#view-landing .landing-paths").getByRole("button", { name: /Find support/i }).click();
  await expect(page.locator("#site-subnav")).toBeHidden();
  await expect(page.locator("#directory-results .card")).not.toHaveCount(0);
  await expect(page.locator("body")).toHaveAttribute("data-view", "browse");
});

test("back control returns to landing", async ({ page }) => {
  await page.goto("/index.html");
  await pickSupportPath(page);
  await expect(page.locator("#site-subnav")).toBeHidden();
  const siteNav = page.getByRole("navigation", { name: "Site" });
  const back = siteNav.getByRole("button", { name: "← Back" });
  const myList = siteNav.getByRole("link", { name: "My list" });
  await expect(back).toBeVisible();
  const backBox = await back.boundingBox();
  const myListBox = await myList.boundingBox();
  expect(backBox).not.toBeNull();
  expect(myListBox).not.toBeNull();
  expect(backBox.x).toBeLessThan(myListBox.x);
  await back.click();
  await expect(page.locator("#view-landing")).toBeVisible();
  await expect(siteNav.getByRole("button", { name: "← Back" })).toHaveCount(0);
  await expect(page.locator("#site-subnav")).toBeHidden();
  await expect(page.getByText("I would like to…")).toBeHidden();
  await expect(page.locator("#view-landing .landing-paths").getByRole("button", { name: /Find support/i })).toBeVisible();
  await expect(page.getByRole("contentinfo", { name: "Crisis and emergency numbers" }).getByRole("link", { name: "111 Emergency" })).toBeVisible();
});

test("my list — add to list, view list, privacy note", async ({ page }) => {
  await page.goto("/index.html");
  await pickSupportPath(page);
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
  await expect(page.getByRole("navigation", { name: "Site" }).getByRole("button", { name: "← Back" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "← Back to start" })).toBeVisible();
  await expect(page.getByText(/Places and organisations you’ve saved/i)).toBeVisible();
  await expect(page.getByText(/stay on this device while you keep this page open/i)).toBeVisible();
  await expect(page.getByRole("button", { name: "Print list" })).toBeVisible();
  await expect(page.locator("#mylist-results")).toContainText(serviceName ?? "");
  await expect(page.locator("#mylist-results .card").first().locator(".card__fav-icon")).toBeVisible();
});

test("my list — phone link in footer when saved service has phone", async ({ page }) => {
  await page.goto("/index.html#support");
  await fillBrowseSearch(page, "Little People");
  const card = page.locator("#directory-results .card").filter({ hasText: "Little People" }).first();
  const name = (await card.locator(".card__title").textContent())?.trim() ?? "";
  await card.getByRole("button", { name: `Add ${name} to your list` }).click();
  await page.getByRole("navigation", { name: "Site" }).getByRole("link", { name: "My list" }).click();
  await expect(page.locator("#view-mylist")).toBeVisible();
  const listCard = page.locator("#mylist-results .card").filter({ hasText: "Little People" }).first();
  await expect(listCard.getByRole("link", { name: "021 130 9377", exact: true })).toBeVisible();
  const callLink = listCard.locator(".card__call");
  await expect(callLink).toBeVisible();
  await expect(callLink.locator(".link-phone-icon")).toBeVisible();
  await expect(callLink).toHaveAttribute("href", "tel:0211309377");
  await expect(listCard.locator(".card__website")).toHaveAttribute("href", "http://www.lpnz.org.nz");
  await expect(listCard.locator(".card__website")).toContainText("lpnz.org.nz");
  await expect(listCard.locator(".card__website .link-external-icon")).toBeVisible();
});

test("my list — print list enables print mode without error", async ({ page }) => {
  await page.goto("/index.html");
  await pickSupportPath(page);
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

test("my list — print layout shows phone number in footer", async ({ page }) => {
  await page.goto("/index.html#support");
  await fillBrowseSearch(page, "Little People");
  const card = page.locator("#directory-results .card").filter({ hasText: "Little People" }).first();
  const name = (await card.locator(".card__title").textContent())?.trim() ?? "";
  await card.getByRole("button", { name: `Add ${name} to your list` }).click();
  await page.getByRole("navigation", { name: "Site" }).getByRole("link", { name: "My list" }).click();
  await expect(page.locator("#mylist-results .card").filter({ hasText: "Little People" })).toBeVisible();

  const printLayout = await page.evaluate(() => {
    document.body.classList.add("printing-mylist");
    const cards = [...document.querySelectorAll("#mylist-results .card")];
    const listCard = cards.find((el) => el.textContent?.includes("Little People"));
    const call = listCard?.querySelector(".card__call");
    const callVisible = !!call && getComputedStyle(call).display !== "none";
    const phoneText = call?.textContent?.replace(/\s+/g, " ").trim() ?? "";
    const icon = call?.querySelector(".link-phone-icon");
    const iconHidden = !icon || getComputedStyle(icon).display === "none";
    document.body.classList.remove("printing-mylist");
    return { callVisible, phoneText, iconHidden, hasCard: !!listCard };
  });

  expect(printLayout.hasCard).toBe(true);
  expect(printLayout.callVisible).toBe(true);
  expect(printLayout.phoneText).toBe("021 130 9377");
  expect(printLayout.iconHidden).toBe(true);
});

test("support card shows phone link in footer when phone exists", async ({ page }) => {
  await page.goto("/index.html#support");
  await fillBrowseSearch(page, "Little People");
  const card = page.locator("#directory-results .card").filter({ hasText: "Little People" }).first();
  await expect(card).toBeVisible();
  await expect(card.getByRole("link", { name: "021 130 9377", exact: true })).toBeVisible();
  const callLink = card.locator(".card__call");
  await expect(callLink).toBeVisible();
  await expect(callLink.locator(".link-phone-icon")).toBeVisible();
  await expect(callLink).toHaveAttribute("href", "tel:0211309377");
  const websiteLink = card.locator(".card__website");
  await expect(websiteLink).toBeVisible();
  await expect(websiteLink).toHaveAttribute("href", "http://www.lpnz.org.nz");
  await expect(websiteLink).toContainText("lpnz.org.nz");
  await expect(websiteLink.locator(".link-external-icon")).toBeVisible();
});

test("Call link on card does not open map popup", async ({ page }) => {
  await page.goto("/index.html#support");
  await fillBrowseSearch(page, "Little People");
  const card = page.locator("#directory-results .card").filter({ hasText: "Little People" }).first();
  await card.locator(".card__call").click();
  await expect(page.locator(".leaflet-popup-content .map-popup")).toHaveCount(0);
});

test("support path — card click opens rich map popup", async ({ page }) => {
  await page.goto("/index.html#support");
  await expect(page.locator(".leaflet-container")).toBeVisible();
  const firstCard = page.locator("#directory-results .card").first();
  const title = (await firstCard.locator(".card__title").textContent())?.trim();
  await firstCard.click();
  const popup = page.locator(".leaflet-popup-content .map-popup");
  await expect(popup).toBeVisible();
  await expect(popup.locator(".map-popup__title")).toHaveText(title ?? "");
  await expect(
    popup.locator(
      ".map-popup__desc, .map-popup__location, .map-popup__contact-strip, .map-popup__call, .map-popup__website, .map-popup__pill"
    )
  ).not.toHaveCount(0);
  await expect(popup).not.toContainText(/how we roll/i);
  await expect(popup.locator(".map-popup__pill--theme")).toHaveCount(0);
  await expect(popup.locator(".map-popup__pill--type")).toHaveCount(0);
});

test("map zoom controls sit in the bottom left", async ({ page }) => {
  await page.goto("/index.html#support");
  const map = page.locator(".leaflet-container");
  await expect(map).toBeVisible();
  const zoomIn = page.getByRole("button", { name: "Zoom in" });
  const zoomOut = page.getByRole("button", { name: "Zoom out" });
  await expect(zoomIn).toBeVisible();
  await expect(zoomOut).toBeVisible();

  const mapBox = await map.boundingBox();
  const inBox = await zoomIn.boundingBox();
  const outBox = await zoomOut.boundingBox();
  expect(mapBox).not.toBeNull();
  expect(inBox).not.toBeNull();
  expect(outBox).not.toBeNull();

  const mapMidX = mapBox.x + mapBox.width / 2;
  const mapMidY = mapBox.y + mapBox.height / 2;
  expect(inBox.x + inBox.width).toBeLessThan(mapMidX);
  expect(outBox.x + outBox.width).toBeLessThan(mapMidX);
  expect(inBox.y).toBeGreaterThan(mapMidY);
  expect(outBox.y).toBeGreaterThan(mapMidY);
});

test("community path — map popup shows org type, not Assembly themes", async ({ page }) => {
  await page.goto("/index.html#community");
  await expect(page.locator(".leaflet-container")).toBeVisible();
  await page.locator("#directory-results .card").first().click();
  const popup = page.locator(".leaflet-popup-content .map-popup");
  await expect(popup).toBeVisible();
  await expect(popup.locator(".map-popup__pill--type")).not.toHaveCount(0);
  await expect(popup.locator(".map-popup__pill--theme")).toHaveCount(0);
  await expect(popup.locator(".map-popup__list li")).toHaveCount(0);
  await expect(popup).not.toContainText(/key initiatives/i);
});

test("demo — three-column layout smoke with show map", async ({ page }) => {
  await page.goto("/index.html?demo=1#support");
  await expect(page.locator("#demo-tools")).toBeVisible();
  await expect(page.locator("#demo-layout-select")).toHaveValue("three-column");
  await expect(page.getByRole("button", { name: "Find support near me" })).toBeVisible();
  await expect(page.getByText(/Uses your device location once/i)).toBeVisible();
  await expect(page.locator("#map-block")).toBeVisible();
  await expect(page.locator(".leaflet-container")).toBeVisible();
  await expect(page.locator("#directory-results .card")).not.toHaveCount(0);
  await expect(page.locator("body")).toHaveAttribute("data-browse-layout", "three-column");
});

test("demo — near me toggle keeps map working", async ({ page, context }) => {
  await context.grantPermissions(["geolocation"]);
  await mockGeolocation(page, { latitude: -41.134, longitude: 174.84 });
  await page.goto("/index.html?demo=1#support");
  const nearBtn = page.locator("#find-near-me");
  await nearBtn.click();
  await expect(nearBtn).toHaveAttribute("aria-pressed", "true");
  await expect(nearBtn).toContainText(/Near me: on/i);
  await expect(page.locator("#map-block")).toBeVisible();
  await expect(page.locator(".leaflet-container")).toBeVisible();
  await expect(page.locator("#directory-results .card")).not.toHaveCount(0);
  await expect(page.locator("#near-me-status")).toContainText(/within 15 km/i);

  await nearBtn.click();
  await expect(nearBtn).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator("#directory-results .card")).not.toHaveCount(0);
  await expect(page.locator(".leaflet-container")).toBeVisible();
});

test("demo — near me far from Porirua keeps map with empty list", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["geolocation"]);
  await mockGeolocation(page, { latitude: -43.53, longitude: 172.63 });
  await page.goto("/index.html?demo=1#support");
  await page.locator("#find-near-me").click();
  await expect(page.locator("#find-near-me")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#directory-results .card")).toHaveCount(0);
  await expect(page.locator("#status-line")).toContainText(/within 15 km of you/i);
  await expect(page.locator("#map-block")).toBeVisible();
  await expect(page.locator(".leaflet-container")).toBeVisible();
});

test("demo — three-column need chip filters list and map markers", async ({ page }) => {
  await page.goto("/index.html?demo=1#support");
  await page.waitForSelector(".leaflet-overlay-pane svg path");
  const initialCount = await page.locator("#directory-results .card").count();
  const initialMarkers = await page.locator(".leaflet-overlay-pane svg path").count();
  expect(initialMarkers).toBe(initialCount);

  await page.locator("#need-chips .chip").first().click();
  await expect(page.locator("#need-chips .chip.is-on")).toHaveCount(1);

  const filteredCount = await page.locator("#directory-results .card").count();
  expect(filteredCount).toBeLessThan(initialCount);
  await expect(page.locator("#status-line")).toContainText(
    new RegExp(`${filteredCount} (listing|organisation)`)
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

test("org grouping — service row expands line detail", async ({ page }) => {
  await page.goto("/index.html#support");
  await expect(page.locator("#directory-results .card").first()).toBeVisible();
  const multiOrg = page
    .locator("#directory-results .card--org")
    .filter({ has: page.locator(".service-row:nth-child(2)") })
    .first();
  await expect(multiOrg).toBeVisible();
  const firstRow = multiOrg.locator(".service-row").first();
  const toggle = firstRow.getByRole("button", { name: /show details$/i });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  const detail = firstRow.locator(".service-row__detail");
  await expect(detail).toBeVisible();
  await expect(detail.locator(".service-row__detail-desc, .service-row__detail-empty")).toHaveCount(
    1
  );
});

test("org grouping — no category pills on service rows by default", async ({
  page,
}) => {
  await page.goto("/index.html#support");
  await expect(page.locator("#directory-results .card--org").first()).toBeVisible();
  const orgCard = page
    .locator("#directory-results .card--org")
    .filter({ has: page.locator(".service-row:nth-child(2)") })
    .first();
  await expect(orgCard).toBeVisible();
  await expect(orgCard.locator(".service-row .badge--need")).toHaveCount(0);
  await expect(orgCard.locator(".service-row .badge--need-match")).toHaveCount(0);
});

test("org grouping — need chip shows only matching service rows with category pills", async ({
  page,
}) => {
  await page.goto("/index.html#support");
  await page.locator("#need-chips").getByRole("button", { name: "Health" }).click();
  await expect(page.locator("#need-chips .chip.is-on")).toHaveCount(1);
  await expect(page.locator("#directory-results .card").first()).toBeVisible();
  await expect(page.locator("#status-line")).toContainText(
    /\d+ organisations? \(\d+ matching service lines?\)/i
  );

  const fwCard = page
    .locator("#directory-results .card--org")
    .filter({ hasText: /Family Works Central/i })
    .first();
  await expect(fwCard).toBeVisible();
  const rows = fwCard.locator(".service-row");
  await expect(rows).toHaveCount(1);
  await expect(rows.getByText("Family Works", { exact: true })).toBeVisible();
  await expect(fwCard.getByText(/Social Workers in Schools/i)).toHaveCount(0);

  const matchBadge = fwCard.locator(".service-row__toggle .badge--need-match");
  await expect(matchBadge).toHaveCount(1);
  await expect(matchBadge).toHaveText("Health");
});

test("org grouping — need chip + search does not keep org via non-matching sibling", async ({
  page,
}) => {
  await page.goto("/index.html#support");
  await page.locator("#need-chips").getByRole("button", { name: "Health" }).click();
  await fillBrowseSearch(page, "swis");
  await expect(
    page.locator("#directory-results .card--org").filter({ hasText: /Family Works Central/i })
  ).toHaveCount(0);
});

test("org grouping — See other services reveals hidden sibling rows with labels", async ({
  page,
}) => {
  await page.goto("/index.html#support");
  await page.getByRole("group", { name: "Types of support" }).getByRole("button", { name: "Health" }).click();
  const fwCard = page
    .getByRole("article")
    .filter({ hasText: /Family Works Central/i })
    .first();
  await expect(fwCard).toBeVisible();
  const services = fwCard.getByRole("list", { name: "Services offered" });
  await expect(services.getByText("Family Works", { exact: true })).toBeVisible();
  await expect(fwCard.getByText(/Social Workers in Schools/i)).toHaveCount(0);

  const seeOther = fwCard.getByRole("button", { name: "See other services" });
  await expect(seeOther).toBeVisible();
  await expect(seeOther).toHaveAttribute("aria-expanded", "false");
  await seeOther.click();

  const hideOther = fwCard.getByRole("button", { name: "Hide other services" });
  await expect(hideOther).toBeVisible();
  await expect(hideOther).toHaveAttribute("aria-expanded", "true");
  const swisRow = services.getByRole("listitem").filter({ hasText: /Social Workers in Schools/i });
  await expect(swisRow).toBeVisible();
  await expect(swisRow.getByText("Support and counselling", { exact: true })).toBeVisible();
  await expect(services.getByRole("listitem").first()).toContainText("Family Works");

  await hideOther.click();
  await expect(fwCard.getByRole("button", { name: "See other services" })).toBeVisible();
  await expect(fwCard.getByText(/Social Workers in Schools/i)).toHaveCount(0);
});

test("org grouping — See other services is omitted when nothing is hidden", async ({
  page,
}) => {
  await page.goto("/index.html#support");
  await expect(page.getByRole("article").first()).toBeVisible();
  const saCard = page
    .getByRole("article")
    .filter({ hasText: /The Salvation Army/i })
    .first();
  await expect(saCard).toBeVisible();
  await expect(saCard.getByRole("button", { name: "See other services" })).toHaveCount(0);

  await page.getByRole("group", { name: "Types of support" }).getByRole("button", { name: "Feeling unsafe" }).click();
  const fwCard = page
    .getByRole("article")
    .filter({ hasText: /Family Works Central/i })
    .first();
  await expect(fwCard).toBeVisible();
  await expect(fwCard.getByText(/Social Workers in Schools/i)).toBeVisible();
  await expect(fwCard.getByRole("button", { name: "See other services" })).toHaveCount(0);
});

test("org grouping — expanding a service row shows category labels with no chip", async ({
  page,
}) => {
  await page.goto("/index.html#support");
  const saCard = page
    .getByRole("article")
    .filter({ hasText: /The Salvation Army/i })
    .first();
  await expect(saCard).toBeVisible();
  const toggle = saCard.getByRole("button", {
    name: /Accommodation: Emergency — show details/i,
  });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  const detail = saCard.getByRole("listitem").filter({ hasText: /Accommodation: Emergency/i });
  await expect(detail.getByText(/Categories:/i)).toBeVisible();
  await expect(detail.getByText("Housing / a place to stay")).toBeVisible();
  await expect(detail.getByText("Support and counselling")).toBeVisible();
});

test("org grouping — map popup stays compact without See other services", async ({
  page,
}) => {
  await page.goto("/index.html#support");
  await page.getByRole("button", { name: "Food / kai" }).click();
  const card = page
    .getByRole("article")
    .filter({ hasText: /The Salvation Army/i })
    .first();
  await expect(card).toBeVisible();
  await card.click({ position: { x: 8, y: 8 } });
  const popup = page.locator(".leaflet-popup-content .map-popup");
  await expect(popup).toBeVisible();
  await expect(popup.getByRole("button", { name: "View in list" })).toBeVisible();
  await expect(popup.getByRole("button", { name: "See other services" })).toHaveCount(0);
});

test("org grouping — map popup View in list focuses org card", async ({ page }) => {
  await page.goto("/index.html#support");
  await expect(page.locator("#directory-results .card").first()).toBeVisible();
  await page.getByRole("button", { name: "Food / kai" }).click();
  const card = page.locator("#directory-results .card--org").first();
  await expect(card).toBeVisible();
  await card.click({ position: { x: 8, y: 8 } });
  const popup = page.locator(".leaflet-popup-content .map-popup");
  const viewInList = popup.getByRole("button", { name: "View in list" });
  await expect(viewInList).toBeVisible();
  await viewInList.evaluate((el) => el.click());
  await expect(card).toHaveClass(/card--focus-ring/);
});
