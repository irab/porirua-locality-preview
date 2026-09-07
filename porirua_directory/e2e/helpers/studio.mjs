import { expect } from "@playwright/test";
import { ADMIN_ORIGIN, loadDevSecrets } from "./dev-env.mjs";

export async function loginAsEditor(page) {
  const { email, password } = loadDevSecrets();
  await page.goto(`${ADMIN_ORIGIN}/admin/login`);
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(sidebarLink(page, "Review queue")).toBeVisible({ timeout: 30_000 });
}

export function sidebarLink(page, name) {
  if (name === "Review queue") {
    return page.getByRole("link", { name: /bookmark Review queue/i });
  }
  if (name === "Catalog Snapshots") {
    return page.getByRole("link", { name: /Catalog Snapshots/i });
  }
  return page.getByRole("link", { name });
}

export async function openSidebarLink(page, name) {
  const link = sidebarLink(page, name);
  await expect(link).toBeVisible();
  await link.click();
}

export async function clearCollectionSearch(page) {
  const search = page.getByPlaceholder(/search/i);
  if ((await search.count()) === 0) return;
  if (!(await search.first().isVisible())) return;
  const value = await search.first().inputValue();
  if (!value) return;
  const clear = page.getByRole("button", { name: /clear/i });
  if (await clear.count()) {
    await clear.first().click();
  } else {
    await search.first().fill("");
  }
}

export async function searchCollection(page, query) {
  const existing = page.getByPlaceholder(/search/i);
  if ((await existing.count()) === 0 || !(await existing.first().isVisible())) {
    await page.getByRole("button", { name: /search/i }).click();
  }
  const search = page.getByPlaceholder(/search/i).or(page.getByRole("searchbox"));
  await expect(search.first()).toBeVisible();
  await search.first().fill(query);
}

/** Directus v-checkbox uses role=checkbox + aria-pressed, not aria-checked. */
export function rowCheckbox(row) {
  return row.getByRole("checkbox");
}

export async function selectCollectionRows(page, titles) {
  for (const title of titles) {
    const row = page.getByRole("row").filter({ hasText: title });
    const box = rowCheckbox(row);
    await expect(box).toBeVisible();
    if ((await box.getAttribute("aria-pressed")) !== "true") {
      await box.click();
    }
    await expect(box).toHaveAttribute("aria-pressed", "true");
  }
}

export function studioSidebar(page) {
  return page.getByRole("contentinfo", { name: "Module Sidebar" });
}

/** Directus exposes this as "bolt expand_more" in the a11y tree; aria-label "Flows" is not used. */
export function flowsToggle(page) {
  return studioSidebar(page).getByRole("button", { name: /Flows|bolt/i });
}

export async function openFlowsPanel(page, actionName) {
  const action = studioSidebar(page).getByRole("button", { name: actionName });
  if (await action.isVisible()) return action;

  const toggle = flowsToggle(page);
  await expect(toggle).toBeVisible();
  await toggle.click();
  await expect(action).toBeVisible();
  return action;
}

export async function confirmFlowDialog(page) {
  const dialog = page.getByRole("dialog").or(page.getByRole("alertdialog"));
  const visible = await dialog
    .first()
    .waitFor({ state: "visible", timeout: 3_000 })
    .then(() => true)
    .catch(() => false);
  if (!visible) return false;
  const confirm = dialog.getByRole("button", {
    name: /^(confirm|continue|done|publish directory|roll back)$/i,
  });
  await expect(confirm).toBeVisible();
  await confirm.click();
  await expect(dialog.first()).toBeHidden();
  return true;
}

export function flowTriggerKeys(requestBody) {
  const body = requestBody && typeof requestBody === "object" ? requestBody : {};
  const keys = body.keys ?? body.$trigger?.keys ?? body.payload?.keys;
  return Array.isArray(keys) ? keys.map(String) : [];
}

export async function runManualFlow(page, actionName) {
  const trigger = page.waitForResponse(
    (response) =>
      response.url().includes("/flows/trigger") && response.request().method() === "POST",
    { timeout: 45_000 }
  );
  const action = await openFlowsPanel(page, actionName);
  await expect(action).toBeEnabled();
  await action.click();
  await confirmFlowDialog(page);
  const response = await trigger;
  let requestBody = null;
  try {
    requestBody = JSON.parse(response.request().postData() ?? "null");
  } catch {
    requestBody = null;
  }
  return { response, requestBody, keys: flowTriggerKeys(requestBody) };
}
