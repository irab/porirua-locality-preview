/**
 * Post-inclusion geocode QA for FSD rows (included slice only).
 * Flags suspicious LATITUDE/LONGITUDE from DIA CSV — does not drop rows.
 */

import { parseCoord } from "./lib/normalize.mjs";
import { mapFsdRowToService } from "./fsd-porirua-rules.mjs";

/** Stable reason codes for `data/fsd-porirua-geocode-flags.json`. */
export const GEOCODE_QA_REASON = {
  GEOCODE_IN_MARINE_BBOX: "GEOCODE_IN_MARINE_BBOX",
  GEOCODE_OUTSIDE_PORIRUA_BOUNDS: "GEOCODE_OUTSIDE_PORIRUA_BOUNDS",
};

/**
 * Generous WGS84 box: Porirua City + Paekākāriki / Pukerua Bay / adjacent coast.
 * Used to flag pins that clearly belong outside the published map slice.
 */
export const PORIRUA_GEO_BOUNDS = {
  minLat: -41.21,
  maxLat: -41.02,
  minLng: 174.78,
  maxLng: 174.99,
};

/**
 * Cook Strait / Kapiti offshore area where FSD geocodes sometimes land (e.g. FSD_ID 4690).
 */
export const KAPITI_OFFSHORE_MARINE_BBOX = {
  minLat: -41.18,
  maxLat: -41.04,
  minLng: 174.62,
  maxLng: 174.775,
};

/** @param {number} lat @param {number} lng @param {{ minLat: number, maxLat: number, minLng: number, maxLng: number }} box */
export function isInGeoBox(lat, lng, box) {
  return (
    lat >= box.minLat &&
    lat <= box.maxLat &&
    lng >= box.minLng &&
    lng <= box.maxLng
  );
}

/**
 * @param {Record<string, string>} row FSD CSV row (included by geo filter)
 * @returns {{ code: string, detail: string } | null}
 */
export function assessFsdRowGeocode(row) {
  const lat = parseCoord(row.LATITUDE);
  const lng = parseCoord(row.LONGITUDE);
  if (lat == null || lng == null) return null;

  if (isInGeoBox(lat, lng, KAPITI_OFFSHORE_MARINE_BBOX)) {
    return {
      code: GEOCODE_QA_REASON.GEOCODE_IN_MARINE_BBOX,
      detail:
        "Coordinates fall in the Kapiti/Cook Strait offshore check box (common bad FSD geocode)",
    };
  }

  if (!isInGeoBox(lat, lng, PORIRUA_GEO_BOUNDS)) {
    return {
      code: GEOCODE_QA_REASON.GEOCODE_OUTSIDE_PORIRUA_BOUNDS,
      detail: "Coordinates outside the Porirua-relevant map bounding box",
    };
  }

  return null;
}

/**
 * @param {Record<string, string>} row
 * @param {ReturnType<typeof mapFsdRowToService>} service
 * @param {{ code: string, detail: string }} assessment
 */
export function summarizeGeocodeFlag(row, service, assessment) {
  return {
    reasonCode: assessment.code,
    reasonDetail: assessment.detail,
    serviceId: service.id,
    lat: service.lat,
    lng: service.lng,
    FSD_ID: String(row.FSD_ID ?? row.SERVICE_ID ?? "").trim() || undefined,
    SERVICE_ID: String(row.SERVICE_ID ?? "").trim() || undefined,
    PROVIDER_NAME: String(row.PROVIDER_NAME ?? "").trim() || undefined,
    SERVICE_NAME: String(row.SERVICE_NAME ?? "").trim() || undefined,
    PHYSICAL_DISTRICT: String(row.PHYSICAL_DISTRICT ?? "").trim() || undefined,
    PHYSICAL_ADDRESS: String(row.PHYSICAL_ADDRESS ?? "").trim() || undefined,
    POSTAL_ADDRESS: String(row.POSTAL_ADDRESS ?? "").trim() || undefined,
  };
}

/** @param {Record<string, string>[]} includedRows */
export function collectFsdGeocodeFlags(includedRows) {
  const flags = [];
  for (const row of includedRows) {
    const assessment = assessFsdRowGeocode(row);
    if (!assessment) continue;
    const service = mapFsdRowToService(row);
    flags.push(summarizeGeocodeFlag(row, service, assessment));
  }
  return flags;
}
