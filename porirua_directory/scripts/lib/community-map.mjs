import { normalizeUrl, parseCoord, slugId } from "./normalize.mjs";
import { mapCategoriesFromFsd } from "../fsd-porirua-rules.mjs";

/** @param {string} orgType */
export function communityFiltersFromOrgType(orgType) {
  const t = String(orgType ?? "");
  const filters = [];
  if (/iwi\s*&\s*marae|marae/i.test(t)) filters.push("marae_iwi");
  else if (/community group|kaupapa group/i.test(t)) filters.push("community_groups");
  else if (/council|government/i.test(t)) filters.push("councils");
  else if (/school|kura/i.test(t)) filters.push("schools");
  else filters.push("other_community");
  return filters;
}

/** Infer need categories from Connections Map labels (not Assembly theme). */
export function categoriesFromLabels(labels) {
  const text = String(labels ?? "");
  return mapCategoriesFromFsd({
    LEVEL_1_CATEGORY: "",
    SERVICE_NAME: text,
    SERVICE_DETAIL: text,
  });
}

/**
 * @param {Record<string, string>} row
 */
export function mapCommunityRow(row) {
  const name = String(row.name ?? "").trim();
  const orgType = String(row.orgType ?? "").trim();
  const labels = String(row.labels ?? "").trim();
  const venue = String(row.venue ?? "").trim();
  const address = String(row.address ?? "").trim();
  const fullAddress = address || venue;

  const communityFilters = [...communityFiltersFromOrgType(orgType)];
  const labelLower = labels.toLowerCase();
  if (/\bkai\b|pātaka|pataka|\bfood\b/.test(labelLower)) {
    if (!communityFilters.includes("kai_initiatives")) {
      communityFilters.push("kai_initiatives");
    }
  }

  const categories = categoriesFromLabels(labels);

  return {
    id: slugId(name, "community-"),
    name,
    description: String(row.description ?? "").trim(),
    phone: "",
    url: normalizeUrl(row.url),
    address: fullAddress,
    lat: parseCoord(row.lat),
    lng: parseCoord(row.lng),
    categories,
    communityFilters,
    orgType,
    source: "community",
    badges: [],
    communityMeta: {
      theme: String(row.theme ?? "").trim(),
      themes: String(row.themes ?? "").trim(),
      initiatives: String(row.initiatives ?? "").trim(),
      labels,
    },
  };
}
