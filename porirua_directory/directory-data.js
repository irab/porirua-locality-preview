/** Loads catalog data for the directory UI (live API, then baked snapshot). */

import { expandServiceLines } from "./scripts/org-grouping.mjs";

const CATALOG_API_URL = "./api/catalog";
const CATALOG_STATIC_URL = "./data/services.json";
/** Same-origin catalog should answer quickly; a hung pod must not block render. */
const CATALOG_API_TIMEOUT_MS = 4000;

function isJsonContentType(res) {
  const type = res.headers?.get?.("content-type") ?? "";
  return /application\/json/i.test(type);
}

function asCatalogEnvelope(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  if (!Array.isArray(body.services)) return null;
  return body;
}

async function readLiveCatalog(res) {
  if (!res.ok || !isJsonContentType(res)) return null;
  try {
    return asCatalogEnvelope(await res.json());
  } catch {
    return null;
  }
}

async function tryLiveCatalog() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CATALOG_API_TIMEOUT_MS);
  try {
    const res = await fetch(CATALOG_API_URL, { signal: controller.signal });
    return await readLiveCatalog(res);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function loadCatalogEnvelope() {
  const live = await tryLiveCatalog();
  if (live) return live;
  const fallback = await fetch(CATALOG_STATIC_URL);
  if (!fallback.ok) throw new Error(`Failed to load services: ${fallback.status}`);
  return fallback.json();
}

export async function loadServices() {
  const envelope = await loadCatalogEnvelope();
  const entries = (envelope.services ?? []).filter((s) => !s.duplicateOf);
  const serviceLines = expandServiceLines(entries);
  return {
    meta: { generatedAt: envelope.generatedAt, counts: envelope.counts },
    entries,
    serviceLines,
    services: serviceLines,
  };
}
