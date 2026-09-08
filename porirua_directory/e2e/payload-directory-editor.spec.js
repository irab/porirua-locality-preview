import { test, expect } from "@playwright/test";
import {
  DEV_PAYLOAD_ORIGIN,
  FIXTURE,
  LOCAL_PAYLOAD_ORIGIN,
  assertAllowedPayloadOrigin,
  directoryEditorRequest,
  ensureViewerSession,
  loginPayload,
  loginPayloadInBrowser,
  payloadAccounts,
  probePayloadOrigin,
  startMockOperations,
} from "./helpers/payload-admin.mjs";

let origin = null;
let mock = null;
let accounts = null;
const skips = [];

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  origin = await probePayloadOrigin();
  if (!origin) {
    test.skip(
      true,
      `Payload admin is not up (${LOCAL_PAYLOAD_ORIGIN} or ${DEV_PAYLOAD_ORIGIN}). Start it with npm run payload:up or set PAYLOAD_ORIGIN.`
    );
    return;
  }
  assertAllowedPayloadOrigin(origin);
  accounts = payloadAccounts(origin);
  if (origin === LOCAL_PAYLOAD_ORIGIN) {
    mock = await startMockOperations();
    if (!mock) skips.push("operations mock not started; :18790 is already in use");
  } else {
    skips.push("remote Payload: operations mock not used");
  }
});

test.afterAll(async () => {
  if (mock) await mock.close();
  if (skips.length) console.log(`Payload Directory e2e skips: ${skips.join("; ")}`);
});

test("logged out Directory reads are 401", async () => {
  const status = await directoryEditorRequest(origin, "/publish-status");
  expect(status.status, JSON.stringify(status.data)).toBe(401);
  const queue = await directoryEditorRequest(origin, "/queue");
  expect(queue.status, JSON.stringify(queue.data)).toBe(401);
});

test("a Viewer session gets 403 on the same read route", async () => {
  const viewer = await ensureViewerSession(origin, accounts);
  if (!viewer.token) {
    skips.push("viewer session unavailable — 403 assertion skipped");
    test.skip(true, "No Viewer account on this Payload host; cannot prove the 403 gate");
    return;
  }
  const status = await directoryEditorRequest(origin, "/publish-status", { token: viewer.token });
  expect(status.status, JSON.stringify(status.data)).toBe(403);
  const queue = await directoryEditorRequest(origin, "/queue", { token: viewer.token });
  expect(queue.status, JSON.stringify(queue.data)).toBe(403);
});

test("an Editor session is allowed through on a read route", async () => {
  const editor = await loginPayload(origin, accounts.editor);
  expect(editor.token, JSON.stringify(editor.data)).toBeTruthy();
  const status = await directoryEditorRequest(origin, "/publish-status", { token: editor.token });
  expect(status.status, `editor publish-status ${status.status}`).not.toBe(401);
  expect(status.status, `editor publish-status ${status.status}`).not.toBe(403);
  if (status.status === 200) {
    expect(status.data.thisHostCanPublish).toBe(false);
    expect(status.data.catalogPublisher).toBe("directus");
  }
});

test("Payload refuses publish rather than succeeding", async () => {
  const editor = await loginPayload(origin, accounts.editor);
  expect(editor.token, JSON.stringify(editor.data)).toBeTruthy();
  const publish = await directoryEditorRequest(origin, "/publish", {
    token: editor.token,
    method: "POST",
    body: { createdBy: "attacker", user: "attacker" },
  });
  expect(publish.status, JSON.stringify(publish.data)).toBe(403);
  expect(JSON.stringify(publish.data)).toMatch(/admin-directory-dev\.bsky\.nz/);
  const undo = await directoryEditorRequest(origin, "/undo-publish", {
    token: editor.token,
    method: "POST",
    body: { expectedVersion: 13, createdBy: "attacker" },
  });
  expect(undo.status, JSON.stringify(undo.data)).toBe(403);
});

test("a client-supplied createdBy does not reach the audit trail", async () => {
  if (!mock) {
    skips.push("createdBy overwrite observed only when the local operations mock is bound");
    test.skip(true, "No local operations mock; not writing a live override to prove createdBy");
    return;
  }
  mock.reset();
  const editor = await loginPayload(origin, accounts.editor);
  expect(editor.token, JSON.stringify(editor.data)).toBeTruthy();
  const result = await directoryEditorRequest(origin, "/approve", {
    token: editor.token,
    method: "POST",
    body: { keys: [FIXTURE.first.id], createdBy: "attacker", user: "attacker" },
  });
  expect(result.status, JSON.stringify(result.data)).toBe(200);
  const forwarded = mock.received.find((row) => row.method === "POST" && row.path === "/approve");
  expect(forwarded, "proxy never reached the sidecar").toBeTruthy();
  expect(forwarded.body.createdBy).toBe(String(editor.user.id));
  expect(forwarded.body.user).toBe(String(editor.user.id));
  expect(forwarded.body.createdBy).not.toBe("attacker");
  expect(forwarded.body.keys).toEqual([FIXTURE.first.id]);
});

test("Editor lands on Directory, not stock collections", async ({ page }) => {
  test.setTimeout(90_000);
  if (mock) mock.reset();
  await loginPayloadInBrowser(page, origin, accounts.editor);
  await expect(page.getByRole("heading", { name: "Directory", level: 1 })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByRole("heading", { name: "Directory", level: 1 })).toBeVisible();
  await expect(page.getByRole("status", { name: "Directory status" })).toBeVisible();
  await expect(page.getByRole("link", { name: /collections/i })).toHaveCount(0);
});

test("the listing form draws an OpenStreetMap pin and the verification bar stays its own height", async ({
  page,
}) => {
  test.setTimeout(90_000);
  if (mock) mock.reset();
  await loginPayloadInBrowser(page, origin, accounts.editor);
  await expect(page.getByRole("heading", { name: "Directory", level: 1 })).toBeVisible({
    timeout: 30_000,
  });

  // A bare .verify inherited Payload's verify-email rule (min-height: 100vh)
  // and stretched this bar into a blank screen-high gap.
  const viewport = page.viewportSize()?.height ?? 720;
  const bars = page.locator(".directory-verify");
  await expect(page.locator(".verify")).toHaveCount(0);
  for (let i = 0; i < (await bars.count()); i++) {
    const box = await bars.nth(i).boundingBox();
    if (box) expect(box.height).toBeLessThan(viewport / 2);
  }

  await page.getByRole("tab", { name: /^Listings$/ }).click();
  const search = page.getByLabel("Find an organisation");
  await expect(search).toBeVisible();
  await search.fill("Whanau");
  const result = page.getByRole("button", { name: /Porirua Whānau Centre|Whanau/i }).first();
  await expect(result).toBeVisible();
  await result.click();
  await page.getByRole("button", { name: "Edit", exact: true }).first().click();

  const canvas = page.locator(".pin-map-canvas.leaflet-container");
  await expect(canvas).toBeVisible();
  await expect(page.locator("img.leaflet-tile").first()).toHaveAttribute(
    "src",
    /tile\.openstreetmap\.org/
  );
  await expect(page.locator(".leaflet-control-attribution").first()).toContainText("OpenStreetMap");

  // The map removes itself when no tile arrives, so surviving the absence
  // window is what proves the tiles actually drew.
  await page.waitForTimeout(4000);
  await expect(canvas).toBeVisible();
});

test("status band, tabs, Listings, and Review match the accepted jobs", async ({ page }) => {
  test.setTimeout(90_000);
  if (mock) mock.reset();
  const editor = await loginPayload(origin, accounts.editor);
  expect(editor.token, JSON.stringify(editor.data)).toBeTruthy();
  const publishStatus = await directoryEditorRequest(origin, "/publish-status", {
    token: editor.token,
  });
  const catalogUp = publishStatus.status === 200;
  if (!catalogUp) {
    skips.push(`Directory catalog reads returned HTTP ${publishStatus.status}; UI data steps skipped`);
  }

  await loginPayloadInBrowser(page, origin, accounts.editor);
  await expect(page.getByRole("heading", { name: "Directory", level: 1 })).toBeVisible({
    timeout: 30_000,
  });

  const band = page.getByRole("status", { name: "Directory status" });
  await expect(band).toBeVisible();
  if (catalogUp && mock) {
    await expect(band.getByRole("button", { name: "3 changes to review" })).toBeVisible();
    const waiting = band.getByRole("button", { name: "2 waiting to go on the site" });
    await expect(waiting).toBeVisible();
    await expect(waiting).toBeDisabled();
    await expect(page.getByText("Publish lives on admin-directory-dev.bsky.nz.")).toBeVisible();
  } else {
    await expect(band.getByRole("button").first()).toBeVisible();
  }

  const tabs = page.getByRole("tablist", { name: "Directory" });
  const tabButtons = tabs.getByRole("tab");
  await expect(tabButtons).toHaveCount(3);
  await expect(tabButtons.nth(0)).toHaveText(/Needs confirmation/);
  await expect(tabButtons.nth(1)).toHaveText(/^Review/);
  await expect(tabButtons.nth(2)).toHaveText(/^Listings$/);

  if (!catalogUp) return;

  await test.step("Needs confirmation is its own first tab and does not auto-open", async () => {
    await tabButtons.nth(0).click();
    await expect(tabButtons.nth(0)).toHaveAttribute("aria-selected", "true");
    if (mock) {
      const parked = page.getByRole("button", { name: "E2E Parked Org, Phone changed" });
      await expect(parked).toBeVisible();
      await expect(parked).toHaveAttribute("aria-expanded", "false");
      await expect(page.getByRole("button", { name: "Accept" })).toHaveCount(0);
    }
  });

  await test.step("Listings search and open", async () => {
    await page.getByRole("tab", { name: /^Listings$/ }).click();
    const search = page.getByLabel("Find an organisation");
    await expect(search).toBeVisible();
    await search.fill("Whanau");
    const result = page.getByRole("button", { name: /Porirua Whānau Centre|Whanau/i }).first();
    await expect(result).toBeVisible();
    await result.click();
    await expect(page.getByRole("heading", { name: /Porirua Whānau Centre|Whanau/i })).toBeVisible();
    // The mock organisation has one service; a real one has several, each with its own Edit.
    await expect(page.getByRole("button", { name: "Edit", exact: true }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Edit organisation" })).toBeVisible();
  });

  if (!mock) {
    const queue = await directoryEditorRequest(origin, "/queue", { token: editor.token });
    const items = Array.isArray(queue.data?.items) ? queue.data.items : [];
    const fixture = items.find((item) => /^E2E /i.test(item.name || "") && !item.deferred);
    if (!fixture) {
      skips.push("no E2E Review fixture on the live queue; did not decide a government row");
      return;
    }
  }

  await test.step("Review: removal actions have no keyboard default; Accept auto-advances to the heading", async () => {
    await page.getByRole("tab", { name: /^Review/ }).click();
    const removed = page.getByRole("button", {
      name: "E2E Removal Org, Gone from the government list",
    });
    await expect(removed).toBeVisible();
    await removed.click();
    const takeOff = page.getByRole("button", { name: "Take it off the site" });
    const keepCommunity = page.getByRole("button", { name: "Keep it as a community listing" });
    await expect(takeOff).toBeVisible();
    await expect(keepCommunity).toBeVisible();
    await expect(takeOff).toHaveAttribute("type", "button");
    await expect(keepCommunity).toHaveAttribute("type", "button");
    await expect(takeOff).not.toHaveAttribute("autofocus", /.*/);
    await expect(keepCommunity).not.toHaveAttribute("autofocus", /.*/);
    await expect(takeOff).not.toBeFocused();
    await expect(keepCommunity).not.toBeFocused();

    const firstHeading = page.getByRole("button", { name: "E2E First Org, Phone changed" });
    await firstHeading.click();
    await page.getByRole("button", { name: "Accept", exact: true }).click();
    await expect(page.getByText(/Accepted E2E First Org/)).toBeVisible();
    const nextHeading = page.getByRole("button", { name: "E2E Second Org, Address changed" });
    await expect(nextHeading).toBeVisible();
    await expect(nextHeading).toBeFocused();
    await expect(page.getByRole("button", { name: "Accept", exact: true })).not.toBeFocused();
  });
});
