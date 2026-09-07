/** Keep aligned with porirua_directory/editor-core/form-highlight.mjs — the image build cannot import that file. */

const FORM_FIELDS = ["name", "description", "address", "phone", "url", "categories"];

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
  return after[field];
}

function beforeValue(before, field) {
  if (field === "name") return before.name ?? before.title ?? before.serviceName ?? before.service_name;
  if (field === "url") return before.url;
  return before[field];
}

export function formHighlightFields({ before = {}, after = {}, locked = [] } = {}) {
  const changed = [];
  for (const field of FORM_FIELDS) {
    if (asText(field, beforeValue(before, field)) === asText(field, afterValue(after, field))) {
      continue;
    }
    changed.push({ field, mark: "Changed in this update" });
  }
  const pinMoved =
    asText("lat", before.lat) !== asText("lat", after.lat) ||
    asText("lng", before.lng) !== asText("lng", after.lng);
  if (pinMoved && !changed.some((row) => row.field === "address")) {
    changed.push({ field: "address", mark: "Changed in this update" });
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
    const formField = field === "lat" || field === "lng" ? "address" : field;
    if (!changedIds.has(formField) && !changedIds.has(field)) continue;
    const key = field === "lat" || field === "lng" ? "pin" : field;
    if (seen.has(key)) continue;
    seen.add(key);
    youSetThis.push({ field, label: field === "lat" || field === "lng" ? "Map pin" : field });
  }
  return {
    changed,
    youSetThis,
    focusField: changed[0]?.field ?? null,
  };
}
