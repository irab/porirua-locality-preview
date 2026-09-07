/** Keep aligned with porirua_directory/editor-core/form-highlight.mjs — the image build cannot import that file. */

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

function asIdList(value) {
  if (!Array.isArray(value)) return null;
  const ids = [];
  for (const item of value) {
    if (item == null || item === "") continue;
    if (typeof item !== "string" && typeof item !== "number") return null;
    ids.push(String(item));
  }
  return ids;
}

/** Same set difference as editor-core/queue-dto.mjs `listIdDelta`. */
function listIdDelta(beforeValue, afterValue) {
  const beforeIds = asIdList(beforeValue);
  const afterIds = asIdList(afterValue);
  if (!beforeIds || !afterIds) return null;
  const beforeSet = new Set(beforeIds);
  const afterSet = new Set(afterIds);
  const added = afterIds.filter((id) => !beforeSet.has(id));
  const removed = beforeIds.filter((id) => !afterSet.has(id));
  if (!added.length && !removed.length) return null;
  return { added, removed };
}

function listFieldDelta(field, before, after) {
  if (field !== "categories" && field !== "communityFilters") return null;
  return listIdDelta(beforeValue(before, field), afterValue(after, field));
}

export function formHighlightFields({ before = {}, after = {}, locked = [], alwaysMarkLocked = false } = {}) {
  const changed = [];
  for (const field of FORM_FIELDS) {
    if (asText(field, beforeValue(before, field)) === asText(field, afterValue(after, field))) {
      continue;
    }
    const row = { field, mark: "Changed in this update" };
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
    if (!alwaysMarkLocked && !changedIds.has(formField) && !changedIds.has(field)) continue;
    const key = field === "lat" || field === "lng" ? "pin" : field;
    if (seen.has(key)) continue;
    seen.add(key);
    youSetThis.push({
      field,
      label: field === "lat" || field === "lng" ? "Map pin" : field,
    });
  }
  const first = changed[0];
  return {
    changed,
    youSetThis,
    focusField: first?.field ?? null,
    focusOption: first?.added?.[0] ?? first?.removed?.[0] ?? null,
  };
}
