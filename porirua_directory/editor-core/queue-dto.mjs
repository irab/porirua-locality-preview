import { fieldLabel, helpTypeOptions } from "./fields.mjs";

const HELP_TYPE_LABELS = Object.fromEntries(helpTypeOptions().map((item) => [item.id, item.label]));

export const KIND_LABELS = {
  changed: "Details changed",
  new: "New service",
  removed: "Gone from the government list",
  geocode_flag: "Check the map pin",
};

const TEXT_DIFF_FIELDS = ["name", "serviceName", "description", "phone", "url", "address", "categories"];

function pickField(side, field) {
  if (!side || typeof side !== "object") return undefined;
  if (field === "serviceName") return side.serviceName ?? side.service_name ?? side.title;
  if (field === "url") return side.url ?? side.website;
  if (field === "categories") return side.categories ?? side.help_types;
  return side[field];
}

function hasField(side, field) {
  if (!side || typeof side !== "object") return false;
  if (field === "serviceName") {
    return "serviceName" in side || "service_name" in side || "title" in side;
  }
  if (field === "url") return "url" in side || "website" in side;
  if (field === "categories") return "categories" in side || "help_types" in side;
  return field in side;
}

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
  if (kind === "new") return "Add this service";
  return "Accept this change";
}

export function keepAsCommunityLabel() {
  return "Keep it as a community listing";
}

export function deferActionLabel() {
  return "Needs confirmation";
}

export function needsConfirmationGroupLabel(count) {
  const n = Number(count) || 0;
  return n === 1 ? "Needs confirmation (1)" : `Needs confirmation (${n})`;
}

export function needConfirmationOnlyTitle(count) {
  const n = Number(count) || 0;
  return n === 1 ? "1 needs confirmation" : `${n} need confirmation`;
}

export function queueSummaryLabel({ kind, diffRows = [] } = {}) {
  if (kind !== "changed") return kindLabel(kind);
  const labels = [];
  const seen = new Set();
  for (const row of diffRows) {
    if (!row.label || seen.has(row.label)) continue;
    seen.add(row.label);
    labels.push(row.label);
  }
  if (labels.length === 0) return kindLabel(kind);
  if (labels.length === 1) return `${labels[0]} changed`;
  if (labels.length === 2) return `${labels[0]} and ${labels[1].toLowerCase()} changed`;
  const middle = labels.slice(1, -1).map((label) => label.toLowerCase());
  return `${labels[0]}, ${middle.join(", ")}, and ${labels[labels.length - 1].toLowerCase()} changed`;
}

export function otherUnchangedRows({ kind, before = {}, after = {}, diffRows = [] } = {}) {
  if (kind === "new" || kind === "removed") return [];
  const shown = new Set(diffRows.map((row) => row.label));
  const rows = [];
  for (const field of ["name", "serviceName", "description", "address", "phone", "url", "categories"]) {
    const label = fieldLabel(field);
    if (shown.has(label)) continue;
    const value = formatFieldValue(field, pickField(after, field) ?? pickField(before, field));
    if (!value) continue;
    rows.push({ field, label, line: `${label}: ${value}` });
  }
  return rows;
}

export function actionSuccessMessage({ action, kind, unpublished = true } = {}) {
  const publishNext = unpublished ? " It will go on the public site when you publish." : "";
  if (action === "publish") return "Published. The public site is up to date.";
  if (action === "undo-publish") {
    return "Publish undone. Those changes are waiting to go on the site again.";
  }
  if (action === "defer") return "Needs confirmation. It stays in Review.";
  if (action === "keep-community") {
    return "Kept. This is now a community listing. Next week's government feed will not take it off.";
  }
  if (action === "keep") return "Kept your details. They stay as you set them.";
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
  if (n === 0) return "Nothing to review";
  return n === 1 ? "1 change to review" : `${n} changes to review`;
}

export function reviewActiveCount(items = []) {
  return items.filter((item) => !item.deferred).length;
}

export function reviewStatusBandLabel(items = []) {
  const active = reviewActiveCount(items);
  const deferred = items.filter((item) => item.deferred).length;
  if (active === 0 && deferred > 0) return needConfirmationOnlyTitle(deferred);
  return reviewCountLabel(active);
}

export function reviewFinishedLabel(count) {
  const n = Number(count) || 0;
  if (n === 1) return "You've reviewed everything. Put 1 change on the public site.";
  return `You've reviewed everything. Put ${n} changes on the public site.`;
}

export function reviewDeferredFinishLabel(count) {
  const n = Number(count) || 0;
  return n === 1
    ? "You've decided the ones you can. 1 needs confirmation."
    : `You've decided the ones you can. ${n} need confirmation.`;
}

export function waitingCountLabel(count) {
  const n = Number(count) || 0;
  if (n === 0) return "Nothing waiting to go on the site";
  return n === 1 ? "1 waiting to go on the site" : `${n} waiting to go on the site`;
}

export function nothingToReviewLabel() {
  return "Nothing to review";
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

function isBlank(value) {
  return value == null || String(value).trim() === "";
}

export function formatDiffLine(row, kind) {
  if (kind === "removed" && !isBlank(row.before) && isBlank(row.after)) {
    return `${row.label} is coming off the site: ${row.before}`;
  }
  if (kind === "new" && !isBlank(row.after)) {
    return `${row.label}: ${row.after}`;
  }
  if (isBlank(row.before) || isBlank(row.after)) return "";
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
  if (kind === "geocode_flag") return [];
  const rows = [];
  const seenLabels = new Set();
  for (const field of TEXT_DIFF_FIELDS) {
    const beforeValue = pickField(before, field);
    const afterValue = pickField(after, field);
    if (
      field === "serviceName" &&
      valuesEqual("name", pickField(before, "name"), beforeValue) &&
      valuesEqual("name", pickField(after, "name"), afterValue)
    ) {
      continue;
    }
    const beforeText = formatFieldValue(field, beforeValue);
    const afterText = formatFieldValue(field, afterValue);
    const afterMissing = !hasField(after, field) || !hasDisplayValue(field, afterValue);
    const beforeMissing = !hasField(before, field) || !hasDisplayValue(field, beforeValue);

    if (kind === "new") {
      if (afterMissing) continue;
    } else if (kind === "removed") {
      if (beforeMissing) continue;
    } else {
      if (valuesEqual(field, beforeValue, afterValue)) continue;
      if (afterMissing || beforeMissing) continue;
    }

    const label = fieldLabel(field);
    if (seenLabels.has(label)) continue;
    const row = {
      field,
      label,
      before: beforeText,
      after: afterText,
    };
    row.line = formatDiffLine(row, kind);
    if (!row.line) continue;
    seenLabels.add(label);
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
  const otherRows = otherUnchangedRows({ kind: item.kind, before, after, diffRows });
  return {
    id: item.id,
    kind: item.kind,
    kindLabel: kindLabel(item.kind),
    summaryLabel: queueSummaryLabel({ kind: item.kind, diffRows }),
    status: item.status,
    entityId: item.entity_id ?? item.entityId,
    name: after.name || before.name || "",
    address: after.address || before.address || "",
    primaryActionLabel: primaryActionLabel(item.kind),
    rejectActionLabel: rejectActionLabel(item.kind),
    deferActionLabel: deferActionLabel(),
    keepAsCommunityLabel: keepAsCommunityLabel(),
    deferred: Boolean(proposed.deferred_at),
    changedSinceDeferred: proposed.changed_since_deferred === true,
    changedSinceDeferredLabel: "This update changed since you set it aside.",
    fsdReturned: proposed.fsd_returned === true,
    fsdReturnedLabel: "The government listed this again.",
    youSetThis,
    otherRows,
    lockedFields: locked.map((field) => ({ field, label: fieldLabel(field) })),
    queuedBefore,
    before,
    after,
    diffRows,
    showPin,
    pin,
  };
}
