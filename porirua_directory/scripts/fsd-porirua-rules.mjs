/**
 * FSD Porirua inclusion and category mapping.
 *
 * Include when:
 * - PHYSICAL_DISTRICT matches /porirua/i
 * - PHYSICAL_ADDRESS, POSTAL_ADDRESS, or SERVICE_AREA fields match locality tokens
 *
 * Exclude Wellington-region-only rows with no Porirua signal.
 */

import { normalizePhone, normalizeUrl, parseCoord, slugId } from "./lib/normalize.mjs";

/** Porirua locality tokens; Rānui uses lookbehind so Christchurch suburb Aranui is not matched. */
export const PORIRUA_LOCALITY_PATTERN =
  /porirua|titahi\s*bay|whitby|cannons?\s*creek|waitangirua|kenepuru|plimmerton|paek[āa]k[āa]riki|(?<![a-z])r[āa]nui\b|elsdon|pukerua|takap[ūu]w[āa]hia|hongoeka/i;

/**
 * Localities that contradict a Porirua suburb/district token in the same address line
 * (e.g. Ranui, Auckland; Whitby Street, Dunedin; Ranui Avenue, Kerikeri).
 */
export const NON_PORIRUA_ADDRESS_LOCALITY_PATTERN =
  /\b(?:Auckland|Dunedin|Christchurch|Palmerston\s*North|Kerikeri|Levin|Hamilton|Tauranga|Rotorua|Invercargill|Nelson|New\s*Plymouth|Whang(?:ā|a)rei|Gisborne|Timaru|Queenstown|Blenheim|Oamaru|Greymouth|Taup(?:ō|o)|Masterton|Feilding|Whakat(?:ā|a)ne|Cambridge|Te\s*Awamutu|Huntly|Tokoroa|Pukekohe)\b/i;

const ADDRESS_FIELDS = [
  "PHYSICAL_ADDRESS",
  "POSTAL_ADDRESS",
  "PHYSICAL_DISTRICT",
  "SERVICE_AREA",
];

/** @param {string} text */
export function isPoriruaAddressContext(text) {
  const val = String(text ?? "").trim();
  if (!val) return true;
  if (/porirua/i.test(val)) return true;
  if (NON_PORIRUA_ADDRESS_LOCALITY_PATTERN.test(val)) return false;
  return true;
}

/** FSD sometimes lists Porirua City as district while the street address is elsewhere. */
export function physicalAddressContradictsPoriruaDistrict(row) {
  const district = String(row.PHYSICAL_DISTRICT ?? "").trim();
  if (!/porirua/i.test(district)) return false;
  const physical = String(row.PHYSICAL_ADDRESS ?? "").trim();
  if (!physical) return false;
  if (/porirua/i.test(physical)) return false;
  return NON_PORIRUA_ADDRESS_LOCALITY_PATTERN.test(physical);
}

/** FSD postal lines often omit the city; cross-check physical region/district/address. */
export function physicalLocationOutsidePorirua(row) {
  const region = String(row.PHYSICAL_REGION ?? "").trim();
  if (/\bauckland\b/i.test(region)) return true;
  const district = String(row.PHYSICAL_DISTRICT ?? "").trim();
  if (
    /\b(?:Waitakere|Henderson(?:\s*-\s*Massey)?|Massey|Rodney|North\s*Shore|Manukau|Papakura|Franklin|Upper\s*Harbour)\b/i.test(
      district
    )
  ) {
    return true;
  }
  const physical = String(row.PHYSICAL_ADDRESS ?? "").trim();
  if (!physical) return false;
  if (NON_PORIRUA_ADDRESS_LOCALITY_PATTERN.test(physical)) return true;
  if (/\b(?:Waitakere|Massey|Henderson|Westgate)\b/i.test(physical)) return true;
  return false;
}

/** Stable reason codes for audit output (`data/fsd-porirua-excluded.json`). */
export const PORIRUA_EXCLUSION_REASON = {
  DISTRICT_CONTRADICTS_PHYSICAL: "DISTRICT_CONTRADICTS_PHYSICAL",
  ADDRESS_NON_PORIRUA_CITY: "ADDRESS_NON_PORIRUA_CITY",
  POSTAL_TOKEN_PHYSICAL_OUTSIDE: "POSTAL_TOKEN_PHYSICAL_OUTSIDE",
  NO_PORIRUA_SIGNAL: "NO_PORIRUA_SIGNAL",
};

/**
 * When `isPoriruaRelevant` is false, returns the primary exclusion reason for audit.
 * @param {Record<string, string>} row
 * @returns {{ code: string, detail?: string, matchedField?: string }}
 */
export function getPoriruaExclusionReason(row) {
  const district = String(row.PHYSICAL_DISTRICT ?? "").trim();
  if (/porirua/i.test(district) && physicalAddressContradictsPoriruaDistrict(row)) {
    return {
      code: PORIRUA_EXCLUSION_REASON.DISTRICT_CONTRADICTS_PHYSICAL,
      detail: "PHYSICAL_DISTRICT names Porirua but PHYSICAL_ADDRESS names another city without Porirua",
    };
  }

  for (const field of ADDRESS_FIELDS) {
    const val = String(row[field] ?? "");
    if (!PORIRUA_LOCALITY_PATTERN.test(val)) continue;
    if (
      (field === "PHYSICAL_ADDRESS" || field === "POSTAL_ADDRESS") &&
      !isPoriruaAddressContext(val)
    ) {
      return {
        code: PORIRUA_EXCLUSION_REASON.ADDRESS_NON_PORIRUA_CITY,
        matchedField: field,
        detail: "Suburb token matched but the same line names a non-Porirua city/town",
      };
    }
    if (
      field === "POSTAL_ADDRESS" &&
      !/porirua/i.test(val) &&
      physicalLocationOutsidePorirua(row)
    ) {
      return {
        code: PORIRUA_EXCLUSION_REASON.POSTAL_TOKEN_PHYSICAL_OUTSIDE,
        matchedField: field,
        detail: "POSTAL_ADDRESS suburb token ignored because physical location is outside Porirua",
      };
    }
  }

  return {
    code: PORIRUA_EXCLUSION_REASON.NO_PORIRUA_SIGNAL,
    detail: "No Porirua district and no qualifying suburb/service-area token",
  };
}

/** @param {Record<string, string>} row */
export function summarizeExcludedFsdRow(row) {
  const { code, detail, matchedField } = getPoriruaExclusionReason(row);
  return {
    reasonCode: code,
    ...(detail ? { reasonDetail: detail } : {}),
    ...(matchedField ? { matchedField } : {}),
    SERVICE_ID: String(row.SERVICE_ID ?? "").trim() || undefined,
    FSD_ID: String(row.FSD_ID ?? "").trim() || undefined,
    PROVIDER_NAME: String(row.PROVIDER_NAME ?? "").trim() || undefined,
    SERVICE_NAME: String(row.SERVICE_NAME ?? "").trim() || undefined,
    PHYSICAL_REGION: String(row.PHYSICAL_REGION ?? "").trim() || undefined,
    PHYSICAL_DISTRICT: String(row.PHYSICAL_DISTRICT ?? "").trim() || undefined,
    PHYSICAL_ADDRESS: String(row.PHYSICAL_ADDRESS ?? "").trim() || undefined,
    POSTAL_ADDRESS: String(row.POSTAL_ADDRESS ?? "").trim() || undefined,
  };
}

/** @param {Record<string, string>} row */
export function isPoriruaRelevant(row) {
  const district = String(row.PHYSICAL_DISTRICT ?? "").trim();
  if (/porirua/i.test(district)) {
    if (physicalAddressContradictsPoriruaDistrict(row)) return false;
    return true;
  }

  for (const field of ADDRESS_FIELDS) {
    const val = String(row[field] ?? "");
    if (!PORIRUA_LOCALITY_PATTERN.test(val)) continue;
    if (
      (field === "PHYSICAL_ADDRESS" || field === "POSTAL_ADDRESS") &&
      !isPoriruaAddressContext(val)
    ) {
      continue;
    }
    if (
      field === "POSTAL_ADDRESS" &&
      !/porirua/i.test(val) &&
      physicalLocationOutsidePorirua(row)
    ) {
      continue;
    }
    return true;
  }

  return false;
}

const CATEGORY_RULES = [
  { id: "food", pattern: /\b(food|kai|meal|nutrition|pantry|supermarket)\b/i },
  {
    id: "housing",
    pattern: /\b(housing|shelter|tenancy|accommodation|homeless|rent)\b/i,
  },
  {
    id: "money",
    pattern: /\b(money|budget|benefit|financial|hardship|debt|finance)\b/i,
  },
  {
    id: "safety",
    pattern: /\b(violence|refuge|safety|abuse|protection order)\b/i,
  },
  {
    id: "support",
    pattern:
      /\b(support|counsell|mental health|addiction|grief|relationship|wellbeing)\b/i,
  },
  { id: "health", pattern: /\b(health|medical|gp|clinic|sexual health|nurse)\b/i },
  { id: "legal", pattern: /\b(legal|law centre|community law|tenancy dispute)\b/i },
  {
    id: "work",
    pattern: /\b(work|employment|training|driver|licen[cs]|learning|job)\b/i,
  },
  {
    id: "everyday",
    pattern: /\b(clothing|shower|transport|older person|everyday|practical)\b/i,
  },
];

/**
 * @param {Record<string, string>} row
 * @returns {string[]}
 */
export function mapCategoriesFromFsd(row) {
  const text = [
    row.LEVEL_1_CATEGORY,
    row.LEVEL_2_CATEGORY,
    row.SERVICE_NAME,
    row.SERVICE_DETAIL,
    row.ORGANISATION_PURPOSE,
  ]
    .filter(Boolean)
    .join(" ");

  const ids = [];
  for (const { id, pattern } of CATEGORY_RULES) {
    if (pattern.test(text) && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

/** Preserve FSD multiline text; normalize line endings only. */
export function normalizeDescriptionText(text) {
  return String(text ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();
}

/** @param {Record<string, string>} row */
export function mapFsdRowToService(row) {
  const name = String(row.PROVIDER_NAME ?? row.SERVICE_NAME ?? "").trim();
  const fsdServiceId = String(row.FSD_ID ?? row.SERVICE_ID ?? "").trim();

  const detail = normalizeDescriptionText(row.SERVICE_DETAIL);
  const serviceName = normalizeDescriptionText(row.SERVICE_NAME);
  const description =
    detail || serviceName || normalizeDescriptionText(row.ORGANISATION_PURPOSE);

  const id = fsdServiceId
    ? slugId(fsdServiceId, "fsd-")
    : slugId(`${name}-${serviceName}` || name || "provider", "fsd-");

  const url =
    normalizeUrl(row.PROVIDER_WEBSITE_1) ||
    normalizeUrl(row.USEFULWEBSITE) ||
    normalizeUrl(row.PROVIDER_WEBSITE_2);

  return {
    id,
    fsdServiceId: fsdServiceId || undefined,
    serviceName: serviceName || undefined,
    name: name || serviceName || "Unknown provider",
    description,
    phone: normalizePhone(row.PUBLISHED_PHONE_1 || row.PUBLISHED_PHONE_2),
    url,
    address: String(row.PHYSICAL_ADDRESS ?? "").trim(),
    lat: parseCoord(row.LATITUDE),
    lng: parseCoord(row.LONGITUDE),
    categories: mapCategoriesFromFsd(row),
    communityFilters: [],
    orgType: "",
    source: "fsd",
    badges: [],
  };
}
