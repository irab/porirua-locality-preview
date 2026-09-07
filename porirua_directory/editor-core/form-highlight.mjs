import { fieldLabel } from "./fields.mjs";

const FORM_FIELDS = ["name", "description", "address", "phone", "url", "categories", "communityFilters"];

function asText(field, value) {
  if (field === "categories" || field === "communityFilters") {
    return JSON.stringify([...(Array.isArray(value) ? value : [])].map(String).sort());
  }
  if (value == null) return "";
  return String(value).trim();
}

function afterValue(after, field) {
  if (field === "name") return after.name ?? after.title ?? after.serviceName ?? after.service_name;
  if (field === "url") return after.url;
  if (field === "communityFilters") return after.communityFilters ?? after.community_filters;
  return after[field];
}

function beforeValue(before, field) {
  if (field === "name") return before.name ?? before.title ?? before.serviceName ?? before.service_name;
  if (field === "url") return before.url;
  if (field === "communityFilters") return before.communityFilters ?? before.community_filters;
  return before[field];
}

/**
 * Fields the shared form should mark when opened from Use this, and I'll correct it.
 * `changed` is the government proposal vs live.
 * `youSetThis` is curated ∩ changed, or every curated field when `alwaysMarkLocked`.
 */
export function formHighlightFields({ before = {}, after = {}, locked = [], alwaysMarkLocked = false } = {}) {
  const changed = [];
  for (const field of FORM_FIELDS) {
    if (asText(field, beforeValue(before, field)) === asText(field, afterValue(after, field))) {
      continue;
    }
    changed.push({
      field,
      label: fieldLabel(field === "url" ? "url" : field),
      mark: "Changed in this update",
    });
  }
  const pinMoved =
    asText("lat", before.lat) !== asText("lat", after.lat) ||
    asText("lng", before.lng) !== asText("lng", after.lng);
  if (pinMoved && !changed.some((row) => row.field === "address")) {
    changed.push({ field: "address", label: fieldLabel("address"), mark: "Changed in this update" });
  }
  const changedIds = new Set(changed.map((row) => row.field));
  if (pinMoved) {
    changedIds.add("address");
    changedIds.add("lat");
    changedIds.add("lng");
  }
  const youSetThis = [];
  const seen = new Set();
  for (const field of locked) {
    const formField = field === "lat" || field === "lng" ? "address" : field === "url" ? "url" : field;
    if (!alwaysMarkLocked && !changedIds.has(formField) && !changedIds.has(field)) continue;
    const label = fieldLabel(field);
    if (seen.has(label)) continue;
    seen.add(label);
    youSetThis.push({ field, label, mark: "You set this earlier" });
  }
  return {
    changed,
    youSetThis,
    focusField: changed[0]?.field ?? null,
  };
}
