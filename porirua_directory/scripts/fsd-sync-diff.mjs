/**
 * Fingerprint diff between collapsed FSD rows and the last accepted catalog.
 * Pure: no file, database, or network access.
 *
 * Identity is SERVICE_ID only (database column fsd_service_id). That is not
 * fsdServiceId from mapFsdRowToService, which is FSD_ID.
 */

import {
  normalizeName,
  normalizePhone,
  normalizeUrl,
  parseCoord,
} from "./lib/normalize.mjs";
import { assessFsdRowGeocode } from "./fsd-geocode-qa.mjs";
import { serviceIdOf } from "./fsd-sync-collapse.mjs";

export const FSD_SYNC_SANITY_RATIO = 0.75;

function roundCoord(value) {
  const n = parseCoord(value);
  if (n == null) return null;
  return Math.round(n * 1000) / 1000;
}

function categoryFingerprint(value) {
  const list = Array.isArray(value) ? value : [];
  return [...new Set(list.map(String))].sort();
}

/**
 * @param {object|null|undefined} record
 * @returns {Record<string, unknown>}
 */
export function buildFsdFingerprint(record) {
  const row = record ?? {};
  return {
    name: normalizeName(row.name ?? row.title).toLowerCase(),
    serviceName: normalizeName(row.serviceName).toLowerCase(),
    description: normalizeName(row.description).toLowerCase(),
    phone: normalizePhone(row.phone),
    url: normalizeUrl(row.url),
    address: normalizeName(row.address).toLowerCase(),
    lat: roundCoord(row.lat),
    lng: roundCoord(row.lng),
    categories: categoryFingerprint(row.categories),
  };
}

export function fingerprintsEqual(a, b) {
  return JSON.stringify(buildFsdFingerprint(a)) === JSON.stringify(buildFsdFingerprint(b));
}

function incomingSnapshot(row) {
  const after = {
    id: row.id,
    SERVICE_ID: serviceIdOf(row),
    FSD_ID: row.FSD_ID,
    fsd_service_id: row.fsd_service_id ?? serviceIdOf(row),
    fsd_legacy_id: row.fsd_legacy_id ?? row.FSD_ID,
    fsdServiceId: row.fsdServiceId,
    name: row.name,
    serviceName: row.serviceName,
    description: row.description,
    phone: row.phone,
    url: row.url,
    address: row.address,
    lat: row.lat,
    lng: row.lng,
    categories: row.categories ?? [],
  };
  if (row.sourceRowCount != null) after.sourceRowCount = row.sourceRowCount;
  if (row.discardedFsdIds) after.discardedFsdIds = row.discardedFsdIds;
  return after;
}

function isOpenOverride(entry) {
  if (entry == null || typeof entry !== "object") return false;
  if (entry.open === true) return true;
  if (entry.open === false) return false;
  if (entry.status == null) return true;
  return String(entry.status).toLowerCase() === "open";
}

function overrideType(entry) {
  return String(entry?.type ?? entry?.kind ?? "").toLowerCase();
}

function isHiddenLocked(dbRow) {
  if (String(dbRow?.status ?? "").toLowerCase() === "hidden") return true;
  return (dbRow?.overrides ?? []).some(
    (entry) => isOpenOverride(entry) && overrideType(entry) === "hide"
  );
}

function lockedPatchFields(dbRow) {
  return (dbRow?.overrides ?? [])
    .filter((entry) => isOpenOverride(entry) && overrideType(entry) === "patch")
    .map((entry) => entry.field)
    .filter(Boolean);
}

function incomingGeocodeFlag(row) {
  const assessment = assessFsdRowGeocode({
    LATITUDE: row?.LATITUDE ?? row?.lat,
    LONGITUDE: row?.LONGITUDE ?? row?.lng,
  });
  if (!assessment) return null;
  return { code: assessment.code, detail: assessment.detail };
}

function geocodeFlagOf(collapsed, dbRow) {
  return incomingGeocodeFlag(collapsed) ?? dbRow?.geocode_flag ?? null;
}

/**
 * Abort the runner when this week's included count is below 75% of the last success.
 * Exactly 75% is allowed. A missing or zero baseline does not trip the guard.
 *
 * @param {number} includedCount
 * @param {number|null|undefined} lastSuccessfulIncludedCount
 */
export function isIncludedCountBelowSanityThreshold(
  includedCount,
  lastSuccessfulIncludedCount
) {
  if (
    lastSuccessfulIncludedCount == null ||
    !Number.isFinite(lastSuccessfulIncludedCount) ||
    lastSuccessfulIncludedCount <= 0
  ) {
    return false;
  }
  if (!Number.isFinite(includedCount)) return true;
  return includedCount < lastSuccessfulIncludedCount * FSD_SYNC_SANITY_RATIO;
}

/**
 * @param {object[]} collapsed  output of collapseFsdRows
 * @param {object[]} dbRows     catalog rows keyed by fsd_service_id = SERVICE_ID
 * @param {object} [opts]
 * @returns {object[]}
 */
export function diffFsdCatalog(collapsed, dbRows, opts = {}) {
  void opts;
  const incoming = collapsed ?? [];
  const existing = dbRows ?? [];
  const dbByServiceId = new Map();
  for (const row of existing) {
    const key = String(row?.fsd_service_id ?? "").trim();
    if (key) dbByServiceId.set(key, row);
  }

  const items = [];
  const seen = new Set();

  const incomingSorted = [...incoming].sort((a, b) =>
    serviceIdOf(a).localeCompare(serviceIdOf(b), "en")
  );

  for (const row of incomingSorted) {
    const serviceId = serviceIdOf(row);
    if (!serviceId) continue;
    seen.add(serviceId);
    const dbRow = dbByServiceId.get(serviceId);
    const after = incomingSnapshot(row);
    const hiddenLock = dbRow ? isHiddenLocked(dbRow) : false;
    const lockedFields = dbRow ? lockedPatchFields(dbRow) : [];
    const flag = geocodeFlagOf(row, dbRow);

    if (!dbRow) {
      items.push({
        kind: "new",
        serviceId,
        proposed: {
          after,
          match_confidence: "low",
        },
      });
      continue;
    }

    const hasRawImport =
      dbRow.raw_import != null && typeof dbRow.raw_import === "object";
    const fingerprintMatches =
      hasRawImport && fingerprintsEqual(row, dbRow.raw_import);

    if (!hasRawImport) {
      items.push({
        kind: "changed",
        serviceId,
        proposed: {
          after,
          missing_raw_import: true,
          ...(hiddenLock
            ? { blocked_by_hidden: true, auto_publish: false }
            : {}),
          ...(lockedFields.length ? { locked_fields: lockedFields } : {}),
          ...(flag ? { geocode_flag: flag } : {}),
        },
      });
      continue;
    }

    if (fingerprintMatches) {
      if (flag) {
        items.push({
          kind: "geocode_flag",
          serviceId,
          proposed: { geocode_flag: flag },
        });
        continue;
      }
      items.push({ kind: "unchanged", serviceId });
      continue;
    }

    items.push({
      kind: "changed",
      serviceId,
      proposed: {
        after,
        ...(hiddenLock ? { blocked_by_hidden: true, auto_publish: false } : {}),
        ...(lockedFields.length ? { locked_fields: lockedFields } : {}),
        ...(flag ? { geocode_flag: flag } : {}),
      },
    });
  }

  const removedIds = [...dbByServiceId.keys()]
    .filter((id) => !seen.has(id))
    .sort((a, b) => a.localeCompare(b, "en"));

  for (const serviceId of removedIds) {
    items.push({
      kind: "removed",
      serviceId,
      proposed: { auto_hide: false },
    });
  }

  return items;
}
