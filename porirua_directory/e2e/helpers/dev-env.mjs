import { existsSync, readFileSync } from "node:fs";

export const PUBLIC_ORIGIN = "https://directory-dev.bsky.nz";
export const ADMIN_ORIGIN = "https://admin-directory-dev.bsky.nz";
export const DISAMBIGUATED_ORG_ID = "org-te-waka-whaiora-trust-342f";

const ALLOWED_HOSTS = new Set(["directory-dev.bsky.nz", "admin-directory-dev.bsky.nz"]);

export function isDevE2EEnabled() {
  return process.env.RUN_DEV_E2E === "1";
}

export function parseSecretsFile(text) {
  const map = {};
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const i = line.indexOf("=");
    map[line.slice(0, i)] = line.slice(i + 1);
  }
  return map;
}

export function loadDevSecrets() {
  const fromFile = process.env.DIRECTORY_DEV_SECRETS;
  const fileMap =
    fromFile && existsSync(fromFile) ? parseSecretsFile(readFileSync(fromFile, "utf8")) : {};
  const email = process.env.EDITOR_EMAIL || fileMap.EDITOR_EMAIL;
  const password = process.env.EDITOR_PASSWORD || fileMap.EDITOR_PASSWORD;
  const adminEmail = process.env.ADMIN_EMAIL || fileMap.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD || fileMap.ADMIN_PASSWORD;
  if (!email || !password || !adminEmail || !adminPassword) {
    throw new Error(
      "Dev E2E needs EDITOR_EMAIL, EDITOR_PASSWORD, ADMIN_EMAIL, and ADMIN_PASSWORD (or DIRECTORY_DEV_SECRETS pointing at the gitignored admin file)"
    );
  }
  return { email, password, adminEmail, adminPassword };
}

export function assertAllowedOrigin(url, label) {
  const host = new URL(url).hostname;
  if (!ALLOWED_HOSTS.has(host)) {
    throw new Error(`${label} host ${host} is not a directory-dev target; refusing to run`);
  }
}

export function printDevTargets({ mutating }) {
  console.log(
    `Dev E2E targets public=${PUBLIC_ORIGIN} admin=${ADMIN_ORIGIN} mutating=${mutating ? "yes" : "no"}`
  );
}
