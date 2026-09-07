/** Loads catalog data for the directory UI (live API, then baked snapshot). */

import { expandServiceLines } from "./scripts/org-grouping.mjs";

const CATALOG_API_URL = "./api/catalog";
const CATALOG_STATIC_URL = "./data/services.json";

async function fetchCatalogResponse() {
  try {
    const res = await fetch(CATALOG_API_URL);
    if (res.ok) return res;
  } catch {
    // Unreachable API — use the baked snapshot.
  }
  const fallback = await fetch(CATALOG_STATIC_URL);
  if (!fallback.ok) throw new Error(`Failed to load services: ${fallback.status}`);
  return fallback;
}

export async function loadServices() {
  const res = await fetchCatalogResponse();
  const envelope = await res.json();
  const entries = (envelope.services ?? []).filter((s) => !s.duplicateOf);
  const serviceLines = expandServiceLines(entries);
  return {
    meta: { generatedAt: envelope.generatedAt, counts: envelope.counts },
    entries,
    serviceLines,
    services: serviceLines,
  };
}
