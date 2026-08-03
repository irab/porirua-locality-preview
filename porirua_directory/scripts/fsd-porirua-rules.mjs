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

export const PORIRUA_LOCALITY_PATTERN =
  /porirua|titahi\s*bay|whitby|cannons?\s*creek|waitangirua|kenepuru|plimmerton|paek[āa]k[āa]riki|r[āa]nui|elsdon|pukerua|takap[ūu]w[āa]hia|hongoeka/i;

const ADDRESS_FIELDS = [
  "PHYSICAL_ADDRESS",
  "POSTAL_ADDRESS",
  "PHYSICAL_DISTRICT",
  "SERVICE_AREA",
];

/** @param {Record<string, string>} row */
export function isPoriruaRelevant(row) {
  const district = String(row.PHYSICAL_DISTRICT ?? "").trim();
  if (/porirua/i.test(district)) return true;

  for (const field of ADDRESS_FIELDS) {
    const val = String(row[field] ?? "");
    if (PORIRUA_LOCALITY_PATTERN.test(val)) return true;
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

/** @param {Record<string, string>} row */
export function mapFsdRowToService(row) {
  const name = String(row.PROVIDER_NAME ?? row.SERVICE_NAME ?? "").trim();
  const fsdId = String(row.FSD_ID ?? row.SERVICE_ID ?? "").trim();
  const id = slugId(name || fsdId || "provider", "fsd-");

  const detail = String(row.SERVICE_DETAIL ?? "").trim();
  const serviceName = String(row.SERVICE_NAME ?? "").trim();
  const description = detail || serviceName || String(row.ORGANISATION_PURPOSE ?? "").trim();

  const url =
    normalizeUrl(row.PROVIDER_WEBSITE_1) ||
    normalizeUrl(row.USEFULWEBSITE) ||
    normalizeUrl(row.PROVIDER_WEBSITE_2);

  return {
    id,
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
