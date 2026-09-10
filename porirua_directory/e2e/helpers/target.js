import { test } from "@playwright/test";

export const DEV_HOST = "directory-dev.bsky.nz";
export const PROD_HOST = "directory.bsky.nz";
export const DEV_ORIGIN = `https://${DEV_HOST}`;
export const EXPECTED_CACHE_CONTROL = "public, max-age=60, s-maxage=86400";

export const DISAMBIGUATED_ORG_ID = "org-te-waka-whaiora-trust-342f";
export const DISAMBIGUATED_COMMUNITY_ID = "community-te-wahi-tiaki-tatou-ea82";

function hostnameFromBaseURL() {
  const raw = process.env.BASE_URL;
  if (!raw) return null;
  const host = new URL(raw).hostname;
  if (host === PROD_HOST) {
    throw new Error("Refusing to run Playwright against production directory.bsky.nz");
  }
  return host;
}

export function isDevDeployment() {
  return process.env.RUN_DEV_E2E === "1" || hostnameFromBaseURL() === DEV_HOST;
}

/** Skip when this file is included in the local suite. Throws if pointed at prod. */
export function requireDevDeployment() {
  hostnameFromBaseURL();
  if (!isDevDeployment()) {
    test.skip(true, "Live-chain specs run only with RUN_DEV_E2E=1 and BASE_URL=https://directory-dev.bsky.nz");
  }
}
