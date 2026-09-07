/**
 * Deterministic SERVICE_ID collapse for the weekly FSD sync.
 * Pure: no file, database, or network access.
 *
 * SERVICE_ID and FSD_ID are not interchangeable. A mapped row must carry both.
 * - `fsd_service_id` / `SERVICE_ID` is the only weekly-diff key (database `fsd_service_id`).
 * - `fsd_legacy_id` / `FSD_ID` is the DIA row id; the public payload still emits it as
 *   `fsdServiceId` so existing clients keep the same value.
 * `mapFsdRowToService` already puts FSD_ID on `fsdServiceId`. Treating that field as
 * the catalog identity reintroduces the bug this module exists to prevent.
 */

import { parseCoord } from "./lib/normalize.mjs";
import { assessFsdRowGeocode } from "./fsd-geocode-qa.mjs";

export const FSD_FINGERPRINT_FIELDS = [
  "name",
  "serviceName",
  "description",
  "phone",
  "url",
  "address",
  "lat",
  "lng",
  "categories",
];

/** @param {object} row */
export function serviceIdOf(row) {
  const explicit = String(
    row?.SERVICE_ID ?? row?.serviceId ?? row?.fsd_service_id ?? ""
  ).trim();
  if (explicit) return explicit;
  const id = String(row?.id ?? "");
  if (id.startsWith("fsd-")) return id.slice(4);
  return "";
}

/** @param {object} row */
export function fsdIdOf(row) {
  return String(row?.FSD_ID ?? row?.fsd_legacy_id ?? row?.fsdServiceId ?? "").trim();
}

/** @param {unknown} a @param {unknown} b */
export function compareFsdIdAsc(a, b) {
  const left = String(a ?? "").trim();
  const right = String(b ?? "").trim();
  if (!left && !right) return 0;
  if (!left) return 1;
  if (!right) return -1;
  const na = Number(left);
  const nb = Number(right);
  if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
  return left.localeCompare(right, "en");
}

/**
 * Non-null LATITUDE/LONGITUDE that pass fsd-geocode-qa (in Porirua bounds, not marine).
 * @param {object} row
 */
export function hasInBoundsGeocode(row) {
  const lat = parseCoord(row?.LATITUDE ?? row?.lat);
  const lng = parseCoord(row?.LONGITUDE ?? row?.lng);
  if (lat == null || lng == null) return false;
  return assessFsdRowGeocode({ LATITUDE: lat, LONGITUDE: lng }) === null;
}

function isNonEmptyFingerprintValue(field, value) {
  if (field === "categories") {
    return Array.isArray(value) && value.length > 0;
  }
  if (field === "lat" || field === "lng") {
    return parseCoord(value) != null;
  }
  return String(value ?? "").trim() !== "";
}

/** @param {object} row */
export function countNonEmptyFingerprintFields(row) {
  let count = 0;
  for (const field of FSD_FINGERPRINT_FIELDS) {
    if (isNonEmptyFingerprintValue(field, row?.[field])) count += 1;
  }
  return count;
}

function compareCandidates(a, b) {
  const richness = countNonEmptyFingerprintFields(b) - countNonEmptyFingerprintFields(a);
  if (richness !== 0) return richness;
  const geo = Number(hasInBoundsGeocode(b)) - Number(hasInBoundsGeocode(a));
  if (geo !== 0) return geo;
  const byFsdId = compareFsdIdAsc(fsdIdOf(a), fsdIdOf(b));
  if (byFsdId !== 0) return byFsdId;
  return a._csvIndex - b._csvIndex;
}

function unionCategories(winner, group) {
  const ordered = [...group].sort(compareCandidates);
  const ids = [];
  for (const row of [winner, ...ordered.filter((row) => row !== winner)]) {
    for (const id of row.categories ?? []) {
      if (!ids.includes(id)) ids.push(id);
    }
  }
  return ids;
}

function toCollapsedRecord(winner, group) {
  const discardedFsdIds = group
    .filter((row) => row !== winner)
    .map((row) => fsdIdOf(row))
    .filter(Boolean)
    .sort(compareFsdIdAsc);

  const {
    _csvIndex: _ignored,
    LATITUDE: _lat,
    LONGITUDE: _lng,
    ...rest
  } = winner;

  const serviceId = serviceIdOf(winner);
  const fsdId = fsdIdOf(winner);

  return {
    ...rest,
    categories: unionCategories(winner, group),
    SERVICE_ID: serviceId,
    FSD_ID: fsdId || undefined,
    fsd_service_id: serviceId,
    fsd_legacy_id: fsdId || undefined,
    fsdServiceId: fsdId || rest.fsdServiceId,
    sourceRowCount: group.length,
    discardedFsdIds,
  };
}

/**
 * Group mapped FSD records by SERVICE_ID and keep one deterministic winner per id.
 * Caller should attach SERVICE_ID and FSD_ID (mapFsdRowToService puts FSD_ID on fsdServiceId).
 *
 * @param {object[]} mappedRows
 * @returns {object[]}
 */
export function collapseFsdRows(mappedRows) {
  const groups = new Map();
  const emptySingletons = [];

  (mappedRows ?? []).forEach((row, index) => {
    const decorated = { ...row, _csvIndex: index };
    const serviceId = serviceIdOf(decorated);
    if (!serviceId) {
      emptySingletons.push([decorated]);
      return;
    }
    if (!groups.has(serviceId)) groups.set(serviceId, []);
    groups.get(serviceId).push(decorated);
  });

  const collapsed = [];
  for (const group of groups.values()) {
    const ranked = [...group].sort(compareCandidates);
    collapsed.push(toCollapsedRecord(ranked[0], group));
  }
  for (const group of emptySingletons) {
    collapsed.push(toCollapsedRecord(group[0], group));
  }

  return collapsed.sort((a, b) => {
    const byService = String(a.SERVICE_ID ?? "").localeCompare(String(b.SERVICE_ID ?? ""), "en");
    if (byService !== 0) return byService;
    return compareFsdIdAsc(a.FSD_ID, b.FSD_ID);
  });
}
