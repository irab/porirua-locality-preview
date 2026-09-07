/**
 * Create-time and merge-task organisation name matching.
 *
 * Folds the same way `slugId` does (NFD diacritics) plus punctuation and a
 * small legal-suffix list. Does not import or change `normalizedOrgName` /
 * `orgClusterKey` — those stay as-is so the published catalog card count
 * does not silently change.
 */

import { foldDiacritics, normalizeName } from "./normalize.mjs";

/** Comparison-only. Never strip these from a stored name or from `slugId` input. */
const COMPARE_SUFFIXES = [
  "charitable trust",
  "incorporated",
  "association",
  "society",
  "limited",
  "trust",
  "inc",
  "ltd",
];

export function foldOrgName(name) {
  const folded = foldDiacritics(normalizeName(name).toLowerCase())
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return stripCompareSuffixes(folded);
}

function stripCompareSuffixes(folded) {
  let current = folded;
  let changed = true;
  while (changed && current) {
    changed = false;
    for (const suffix of COMPARE_SUFFIXES) {
      if (current === suffix) continue;
      const ending = ` ${suffix}`;
      if (current.endsWith(ending)) {
        current = current.slice(0, -ending.length).trim();
        changed = true;
        break;
      }
    }
  }
  return current;
}

export function namesNearMatch(a, b) {
  const left = foldOrgName(a);
  const right = foldOrgName(b);
  if (!left || !right) return false;
  return left === right;
}

function diacriticCount(name) {
  return (String(name ?? "").normalize("NFD").match(/[\u0300-\u036f]/g) || [])
    .length;
}

/**
 * Fold for comparison; prefer the macronised form for display.
 * Given two names that fold equal, the one retaining diacritics wins.
 */
export function preferMacronisedName(a, b) {
  if (!b) return a;
  if (!a) return b;
  if (!namesNearMatch(a, b)) return a;
  return diacriticCount(b) > diacriticCount(a) ? b : a;
}

function orgMatchDto(org, viaMergedFrom = null) {
  return {
    id: org.id,
    publicId: org.public_id ?? org.publicId ?? org.id,
    name: org.name ?? "",
    address: org.address ?? "",
    phone: org.phone ?? "",
    status: org.status ?? "published",
    mergedInto: org.merged_into ?? org.mergedInto ?? null,
    viaMergedFrom,
  };
}

/**
 * @param {string} queryName
 * @param {Array<Record<string, unknown>>} organizations
 * @returns {Array<ReturnType<typeof orgMatchDto>>}
 */
export function findOrganisationNameMatches(queryName, organizations = []) {
  if (!foldOrgName(queryName)) return [];
  const byId = new Map(
    organizations
      .filter((org) => org && org.id)
      .map((org) => [org.id, org])
  );
  const seen = new Set();
  const matches = [];

  for (const org of organizations) {
    if (!org || !namesNearMatch(queryName, org.name)) continue;

    const mergedInto = org.merged_into ?? org.mergedInto ?? null;
    const target = mergedInto ? byId.get(mergedInto) : null;
    if (target) {
      if (seen.has(target.id)) continue;
      seen.add(target.id);
      matches.push(
        orgMatchDto(target, {
          id: org.id,
          publicId: org.public_id ?? org.publicId ?? org.id,
          name: org.name ?? "",
        })
      );
      continue;
    }

    if (seen.has(org.id)) continue;
    seen.add(org.id);
    matches.push(orgMatchDto(org));
  }

  return matches;
}

function lineName(service) {
  return service?.title || service?.service_name || service?.serviceName || service?.name || "";
}

/**
 * Same-organisation service-line check, including hidden lines.
 * Caller already scoped `services` to one `organization_id`.
 */
export function findServiceLineNameMatches(queryName, services = []) {
  if (!foldOrgName(queryName)) return [];
  const seen = new Set();
  const matches = [];
  for (const service of services) {
    if (!service || !namesNearMatch(queryName, lineName(service))) continue;
    const id = service.id ?? service.line_id;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    matches.push({
      id,
      organizationId: service.organization_id ?? service.organizationId ?? null,
      name: lineName(service),
      status: service.status ?? "published",
    });
  }
  return matches;
}
