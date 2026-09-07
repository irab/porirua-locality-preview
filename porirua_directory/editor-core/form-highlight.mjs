import { fieldLabel } from "./fields.mjs";
import { listIdDelta } from "./queue-dto.mjs";

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

function listFieldDelta(field, before, after) {
  if (field !== "categories" && field !== "communityFilters") return null;
  return listIdDelta(beforeValue(before, field), afterValue(after, field));
}

/**
 * Fields the shared form should mark when opened from Accept and edit.
 * `changed` is the government proposal vs live.
 * `youSetThis` is curated ∩ changed, or every curated field when `alwaysMarkLocked`.
 * List fields carry `added` / `removed` ids when the set difference is reliable.
 */
export function formHighlightFields({ before = {}, after = {}, locked = [], alwaysMarkLocked = false } = {}) {
  const changed = [];
  for (const field of FORM_FIELDS) {
    if (asText(field, beforeValue(before, field)) === asText(field, afterValue(after, field))) {
      continue;
    }
    const row = {
      field,
      label: fieldLabel(field === "url" ? "url" : field),
      mark: "Changed in this update",
    };
    const delta = listFieldDelta(field, before, after);
    if (delta) {
      row.added = delta.added;
      row.removed = delta.removed;
    }
    changed.push(row);
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
  const first = changed[0];
  return {
    changed,
    youSetThis,
    focusField: first?.field ?? null,
    focusOption: first?.added?.[0] ?? first?.removed?.[0] ?? null,
  };
}
