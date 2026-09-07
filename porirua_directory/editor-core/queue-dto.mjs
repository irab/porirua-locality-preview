import { fieldLabel, helpTypeOptions } from "./fields.mjs";

const HELP_TYPE_LABELS = Object.fromEntries(helpTypeOptions().map((item) => [item.id, item.label]));

export const KIND_LABELS = {
  changed: "Details changed",
  new: "New service",
  removed: "Gone from the government list",
  geocode_flag: "Check the pin",
};

const TEXT_DIFF_FIELDS = [
  "name",
  "title",
  "serviceName",
  "service_name",
  "description",
  "phone",
  "url",
  "address",
  "categories",
];

const NAME_ALIASES = new Set(["title", "serviceName", "service_name"]);

export function kindLabel(kind) {
  return KIND_LABELS[kind] || "Details changed";
}

export function statusLabel(status) {
  return status === "published" ? "On the site" : "Off the site";
}

export function rejectActionLabel(kind) {
  if (kind === "new") return "Don't add this";
  if (kind === "geocode_flag") return "Skip this pin check";
  return "Don't use this change";
}

export function primaryActionLabel(kind) {
  if (kind === "removed") return "Take it off the site";
  if (kind === "geocode_flag") return "The pin is fine";
  return "Accept";
}

export function actionSuccessMessage({ action, kind, unpublished = true } = {}) {
  const publishNext = unpublished ? " It will go on the public site when you publish." : "";
  if (action === "publish") return "Published. The public site is up to date.";
  if (action === "keep") return `Kept your details.${publishNext}`;
  if (action === "restore") return `Put back on the site.${publishNext}`;
  if (action === "archive") return "Taken off the site. It will leave the public site when you publish.";
  if (action === "save") return `Saved.${publishNext}`;
  if (action === "reject") {
    if (kind === "new") return "Not added. It will not go on the public site.";
    if (kind === "geocode_flag") return "Pin check skipped. The listing stays as it is.";
    return "Change declined. The listing stays as it is.";
  }
  if (kind === "removed") return "Taken off the site. It will leave the public site when you publish.";
  if (kind === "geocode_flag") return `Pin kept.${publishNext}`;
  if (kind === "new") return `Added.${publishNext}`;
  return `Accepted.${publishNext}`;
}

export function reviewCountLabel(count) {
  const n = Number(count) || 0;
  return n === 1 ? "1 change to review" : `${n} changes to review`;
}

export function reviewFinishedLabel(count) {
  const n = Number(count) || 0;
  if (n === 1) return "You've reviewed everything. Put 1 change on the public site.";
  return `You've reviewed everything. Put ${n} changes on the public site.`;
}

function helpTypeLabel(id) {
  return HELP_TYPE_LABELS[id] || String(id);
}

export function formatFieldValue(field, value) {
  if (field === "categories") {
    const list = Array.isArray(value) ? value : [];
    return list.map((id) => helpTypeLabel(id)).filter(Boolean).join(", ");
  }
  if (value == null) return "";
  return String(value).trim();
}

function hasDisplayValue(field, value) {
  return Boolean(formatFieldValue(field, value));
}

function valuesEqual(field, left, right) {
  return formatFieldValue(field, left) === formatFieldValue(field, right);
}

export function formatDiffLine(row, kind) {
  if (kind === "new") return `${row.label}: ${row.after}`;
  if (kind === "removed") return `${row.label}: ${row.before}`;
  if (!row.before) return `${row.label}: ${row.after}`;
  if (!row.after) return `${row.label}: ${row.before} → —`;
  return `${row.label}: ${row.before} → ${row.after}`;
}

function queuedBeforeOf(item) {
  const proposed = item.proposed && typeof item.proposed === "object" ? item.proposed : {};
  return proposed.before && typeof proposed.before === "object" ? proposed.before : {};
}

function editorBefore(item, live) {
  if (item.kind === "new") return {};
  if (live && typeof live === "object") return live;
  return queuedBeforeOf(item);
}

export function queueDiffRows({ kind, before = {}, after = {} } = {}) {
  const rows = [];
  const seenLabels = new Set();
  for (const field of TEXT_DIFF_FIELDS) {
    if (NAME_ALIASES.has(field) && valuesEqual("name", before.name ?? after.name, before[field] ?? after[field])) {
      continue;
    }
    if (kind === "new") {
      if (!hasDisplayValue(field, after[field])) continue;
    } else if (kind === "removed") {
      if (!hasDisplayValue(field, before[field])) continue;
    } else if (valuesEqual(field, before[field], after[field])) {
      continue;
    } else if (!hasDisplayValue(field, before[field]) && !hasDisplayValue(field, after[field])) {
      continue;
    }
    const label = fieldLabel(field);
    if (seenLabels.has(label) && NAME_ALIASES.has(field)) continue;
    seenLabels.add(label);
    const row = {
      field,
      label,
      before: formatFieldValue(field, before[field]),
      after: formatFieldValue(field, after[field]),
    };
    row.line = formatDiffLine(row, kind);
    rows.push(row);
  }
  return rows;
}

function asCoord(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function queuePin(after = {}, before = {}) {
  const lat = asCoord(after.lat) ?? asCoord(before.lat);
  const lng = asCoord(after.lng) ?? asCoord(before.lng);
  if (lat == null || lng == null) return null;
  return { lat, lng };
}

export function queueShowsPin({ kind, before = {}, after = {}, proposed = {} } = {}) {
  if (kind === "geocode_flag" || proposed.geocode_flag) return queuePin(after, before) != null;
  const beforeLat = asCoord(before.lat);
  const beforeLng = asCoord(before.lng);
  const afterLat = asCoord(after.lat);
  const afterLng = asCoord(after.lng);
  if (afterLat == null || afterLng == null) return false;
  return beforeLat !== afterLat || beforeLng !== afterLng;
}

function youSetThisFields(locked, reviewable, diffRows, showPin) {
  const drifted = new Set(diffRows.map((row) => row.field));
  if (showPin) {
    drifted.add("address");
    drifted.add("lat");
    drifted.add("lng");
  }
  const source = reviewable.length ? reviewable : [...drifted];
  const seen = new Set();
  const rows = [];
  for (const field of locked) {
    if (!source.includes(field)) continue;
    const label = fieldLabel(field);
    if (seen.has(label)) continue;
    seen.add(label);
    rows.push({ field, label });
  }
  return rows;
}

export function queueItemDto(item = {}, live = null) {
  const proposed = item.proposed && typeof item.proposed === "object" ? item.proposed : {};
  const locked = proposed.locked_fields ?? [];
  const reviewable = proposed.reviewable_fields ?? [];
  const after = proposed.after && typeof proposed.after === "object" ? proposed.after : {};
  const queuedBefore = queuedBeforeOf(item);
  const before = editorBefore(item, live);
  const pin = queuePin(after, before);
  const showPin = queueShowsPin({ kind: item.kind, before, after, proposed });
  const diffRows = queueDiffRows({ kind: item.kind, before, after });
  const youSetThis = youSetThisFields(locked, reviewable, diffRows, showPin);
  return {
    id: item.id,
    kind: item.kind,
    kindLabel: kindLabel(item.kind),
    status: item.status,
    entityId: item.entity_id ?? item.entityId,
    name: after.name || before.name || "",
    address: after.address || before.address || "",
    primaryActionLabel: primaryActionLabel(item.kind),
    rejectActionLabel: rejectActionLabel(item.kind),
    youSetThis,
    lockedFields: locked.map((field) => ({ field, label: fieldLabel(field) })),
    queuedBefore,
    before,
    after,
    diffRows,
    showPin,
    pin,
  };
}
