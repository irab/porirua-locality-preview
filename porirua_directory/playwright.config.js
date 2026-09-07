import { defineConfig } from "@playwright/test";

const DEFAULT_LOCAL = "http://127.0.0.1:5173";
const DEV_HOST = "directory-dev.bsky.nz";
const PROD_HOST = "directory.bsky.nz";

function resolveBaseURL() {
  const raw = process.env.BASE_URL || DEFAULT_LOCAL;
  const url = new URL(raw);
  if (url.hostname === PROD_HOST) {
    throw new Error("Refusing to run Playwright against production https://directory.bsky.nz");
  }
  return raw.replace(/\/$/, "");
}

const baseURL = resolveBaseURL();
const isDevHost = new URL(baseURL).hostname === DEV_HOST;
const runDevE2E = process.env.RUN_DEV_E2E === "1";
const ignore = ["**/helpers/**"];
if (!isDevHost && !runDevE2E) ignore.push("**/dev-deployment.spec.js");
if (!runDevE2E) ignore.push("**/dev-studio.spec.js");

export default defineConfig({
  testDir: "e2e",
  testIgnore: ignore,
  timeout: isDevHost || runDevE2E ? 120_000 : 30_000,
  expect: {
    timeout: isDevHost || runDevE2E ? 15_000 : 5_000,
  },
  workers: isDevHost || runDevE2E ? 1 : undefined,
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  webServer:
    process.env.BASE_URL || runDevE2E
      ? undefined
      : {
          command: "python3 -m http.server 5173",
          port: 5173,
          reuseExistingServer: !process.env.CI,
        },
});
