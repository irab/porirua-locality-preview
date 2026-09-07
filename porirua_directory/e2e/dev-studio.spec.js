import { test, expect } from "@playwright/test";
import {
  ADMIN_ORIGIN,
  PUBLIC_ORIGIN,
  assertAllowedOrigin,
  isDevE2EEnabled,
  printDevTargets,
} from "./helpers/dev-env.mjs";
import {
  adminToken,
  cleanupSeed,
  fetchPublicCatalog,
  readCurrentSnapshot,
  readQueueItems,
  readServices,
  restoreSnapshotIfNeeded,
  seedReviewPair,
} from "./helpers/directus-admin.mjs";
import {
  clearCollectionSearch,
  loginAsEditor,
  openSidebarLink,
  runManualFlow,
  searchCollection,
  selectCollectionRows,
} from "./helpers/studio.mjs";
import { parseEtagVersion } from "./helpers/catalog.js";

test.skip(!isDevE2EEnabled(), "Set RUN_DEV_E2E=1 to hit admin-directory-dev");

if (isDevE2EEnabled()) {
  assertAllowedOrigin(ADMIN_ORIGIN, "admin");
  assertAllowedOrigin(PUBLIC_ORIGIN, "public");
  printDevTargets({ mutating: true });
}

test.describe.configure({ mode: "serial" });

test("editor reaches the review queue from the sidebar and can approve every selected row", async ({
  page,
}, testInfo) => {
  const token = await adminToken();
  const stamp = `pw${Date.now().toString(36)}`;
  const seed = await seedReviewPair(token, stamp);
  await testInfo.attach("seed", {
    contentType: "application/json",
    body: Buffer.from(
      JSON.stringify(
        {
          stamp,
          orgId: seed.orgId,
          queueIds: seed.queueItems.map((item) => item.id),
        },
        null,
        2
      )
    ),
  });

  try {
    await test.step("log in through the Data Studio form", async () => {
      await loginAsEditor(page);
    });

    await test.step("open Review queue from the sidebar, not a deep content URL", async () => {
      await openSidebarLink(page, "Catalog Snapshots");
      await expect(page.getByRole("heading", { name: "Catalog Snapshots" })).toBeVisible();
      await openSidebarLink(page, "Review queue");
      await expect(page.getByRole("heading", { name: "Review queue" })).toBeVisible();
      await expect(page).toHaveURL(/review_queue_items/);
    });

    await test.step("seeded rows show listing name, organisation, and a word summary", async () => {
      await searchCollection(page, stamp);
      for (const item of seed.queueItems) {
        const row = page.getByRole("row").filter({ hasText: item.title });
        await expect(row).toBeVisible();
        await expect(row).toContainText(item.orgName);
        await expect(row).toContainText(item.changeSummary);
        await expect(row).not.toHaveText(/"after"\s*:/);
        await expect(row).not.toContainText("9 New Street");
        expect(item.changeSummary).toMatch(/^Changing /);
        expect(item.changeSummary).not.toMatch(/[{[]/);
      }
    });

    await test.step("Approve both selected rows; Postgres matches the selection count", async () => {
      await selectCollectionRows(
        page,
        seed.queueItems.map((item) => item.title)
      );

      const trigger = await runManualFlow(page, "Approve");
      expect(trigger.response.ok(), `Approve flow HTTP ${trigger.response.status()}`).toBe(true);
      expect(trigger.keys.sort()).toEqual(seed.queueItems.map((item) => String(item.id)).sort());
      expect(trigger.keys.every((key) => seed.queueItems.some((item) => String(item.id) === key))).toBe(
        true
      );

      await expect
        .poll(
          async () => {
            const rows = await readQueueItems(
              token,
              seed.queueItems.map((item) => item.id)
            );
            return rows.filter((row) => row.status === "accepted").length;
          },
          { timeout: 20_000 }
        )
        .toBe(seed.queueItems.length);

      const queueRows = await readQueueItems(
        token,
        seed.queueItems.map((item) => item.id)
      );
      expect(queueRows).toHaveLength(seed.queueItems.length);
      expect(queueRows.every((row) => row.status === "accepted")).toBe(true);

      const services = await readServices(
        token,
        seed.queueItems.map((item) => item.serviceId)
      );
      expect(services).toHaveLength(seed.queueItems.length);
      expect(services.every((row) => String(row.id).startsWith("e2e-"))).toBe(true);
      for (const item of seed.queueItems) {
        const service = services.find((row) => row.id === item.serviceId);
        expect(service, `service ${item.serviceId} missing after approve`).toBeTruthy();
        expect(service.address).toBe(item.after.address);
        expect(service.phone).toBe(item.after.phone);
        expect(service.status).toBe("published");
      }
    });
  } finally {
    await cleanupSeed(token, seed);
  }
});

test("Publish directory moves the public catalog; Roll back restores it", async ({ page }, testInfo) => {
  const token = await adminToken();
  const beforeSnapshot = await readCurrentSnapshot(token);
  const beforeCatalog = await fetchPublicCatalog();
  expect(beforeCatalog.status).toBe(200);
  expect(beforeCatalog.etag).toBeTruthy();
  await testInfo.attach("before-catalog", {
    contentType: "application/json",
    body: Buffer.from(
      JSON.stringify(
        {
          version: beforeSnapshot.version,
          etag: beforeCatalog.etag,
          published: beforeCatalog.body?.counts?.published,
        },
        null,
        2
      )
    ),
  });

  try {
    await loginAsEditor(page);
    await openSidebarLink(page, "Catalog Snapshots");
    await expect(page.getByRole("heading", { name: /Catalog Snapshots/i })).toBeVisible();
    await clearCollectionSearch(page);

    await test.step("Publish directory from the collection Flows panel", async () => {
      const trigger = await runManualFlow(page, "Publish directory");
      expect(trigger.response.ok(), `Publish flow HTTP ${trigger.response.status()}`).toBe(true);

      await expect
        .poll(
          async () => {
            const current = await readCurrentSnapshot(token);
            return String(current.version);
          },
          { timeout: 45_000 }
        )
        .not.toBe(String(beforeSnapshot.version));

      await expect
        .poll(
          async () => {
            const catalog = await fetchPublicCatalog();
            return parseEtagVersion(catalog.etag);
          },
          { timeout: 45_000 }
        )
        .not.toBe(parseEtagVersion(beforeCatalog.etag));
    });

    const publishedSnapshot = await readCurrentSnapshot(token);
    const publishedCatalog = await fetchPublicCatalog();
    expect(String(publishedSnapshot.version)).not.toBe(String(beforeSnapshot.version));
    expect(parseEtagVersion(publishedCatalog.etag)).toBe(Number(publishedSnapshot.version));
    expect(publishedCatalog.body?.counts?.published).toBe(beforeCatalog.body?.counts?.published);

    await test.step("open the previous snapshot and Roll back", async () => {
      await openSidebarLink(page, "Catalog Snapshots");
      await expect(page.getByRole("heading", { name: /Catalog Snapshots/i })).toBeVisible();
      await clearCollectionSearch(page);
      const versionCell = page.getByRole("cell", {
        name: String(beforeSnapshot.version),
        exact: true,
      });
      const previous = page.getByRole("row").filter({ has: versionCell });
      await expect(previous).toHaveCount(1);
      await previous.getByRole("cell", { name: String(beforeSnapshot.version), exact: true }).click();
      await expect(page).toHaveURL(
        new RegExp(`/catalog_snapshots/${beforeSnapshot.version}(?:\\?|$)`)
      );
      await expect(
        page.getByRole("heading", { name: `v${beforeSnapshot.version}` })
      ).toBeVisible();

      const trigger = await runManualFlow(page, "Roll back");
      expect(trigger.response.ok(), `Roll back flow HTTP ${trigger.response.status()}`).toBe(true);

      await expect
        .poll(
          async () => {
            const current = await readCurrentSnapshot(token);
            return String(current.version);
          },
          { timeout: 45_000 }
        )
        .toBe(String(beforeSnapshot.version));

      await expect
        .poll(
          async () => {
            const catalog = await fetchPublicCatalog();
            return parseEtagVersion(catalog.etag);
          },
          { timeout: 45_000 }
        )
        .toBe(parseEtagVersion(beforeCatalog.etag));
    });
  } finally {
    await restoreSnapshotIfNeeded(token, beforeSnapshot.version);
  }
});
