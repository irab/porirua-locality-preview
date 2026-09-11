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
  return status === "published" ? "On the site" : "Not on the site";
}

export function rejectActionLabel(kind) {
  if (kind === "geocode_flag") return "Skip this pin check";
  return "Reject";
}

export function showRejectAction(kind) {
  return kind !== "geocode_flag";
}

export function primaryActionLabel(kind) {
  if (kind === "removed") return "Take it off the site";
  if (kind === "geocode_flag") return "The pin is fine";
  return "Accept";
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

export function needsConfirmationTabLabel(count) {
  const n = Number(count) || 0;
  return n ? needsConfirmationGroupLabel(n) : "Needs confirmation";
}

function foldLabel(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function queueLineLabel({ name, lineTitle } = {}) {
  const org = String(name || "").trim();
  const line = String(lineTitle || "").trim();
  if (!line) return "";
  if (foldLabel(line) === foldLabel(org)) return "";
  return line;
}

export function queueItemHeading(item, fallback = "this listing") {
  const name = item?.name || fallback;
  return item?.lineLabel ? `${name} — ${item.lineLabel}` : name;
}

export function correctHeading(item) {
  const who = queueItemHeading(item);
  if (item?.kind === "geocode_flag") return `Moving the pin for ${who}`;
  return `Correcting ${who}`;
}

export function landingTab({ activeCount = 0, deferredCount = 0 } = {}) {
  if (activeCount > 0) return "review";
  if (deferredCount > 0) return "needs";
  return "listings";
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

export function actionSuccessMessage({ action, kind, unpublished = true, name } = {}) {
  const who = String(name || "").trim();
  const publishNext = unpublished ? " It stays unpublished until you publish." : "";
  if (action === "publish") return "Published. The public site is up to date.";
  if (action === "undo-publish") {
    return "Publish undone. Those changes are unpublished again.";
  }
  if (action === "rollback") {
    return "This published version is on the public site now.";
  }
  if (action === "defer") {
    return who
      ? `Needs confirmation. ${who} is waiting on the Needs confirmation tab.`
      : "Needs confirmation. It's waiting on the Needs confirmation tab.";
  }
  if (action === "keep-community") {
    return who
      ? `Kept ${who} as a community listing. Next week's government feed will not take it off.`
      : "Kept. This is now a community listing. Next week's government feed will not take it off.";
  }
  if (action === "keep") {
    return who
      ? `Kept your details on ${who}. They stay as you set them.`
      : "Kept your details. They stay as you set them.";
  }
  if (action === "restore") {
    return who ? `Put ${who} back on the site.${publishNext}` : `Put back on the site.${publishNext}`;
  }
  if (action === "archive") {
    return who
      ? `Took ${who} off the site. It will leave the public site when you publish.`
      : "Taken off the site. It will leave the public site when you publish.";
  }
  if (action === "save") return who ? `Saved ${who}.${publishNext}` : `Saved.${publishNext}`;
  if (action === "reject") {
    if (kind === "new") {
      return who
        ? `Rejected ${who}. It will not go on the public site.`
        : "Rejected. It will not go on the public site.";
    }
    if (kind === "geocode_flag") {
      return who
        ? `Skipped the pin check for ${who}. The listing stays as it is.`
        : "Pin check skipped. The listing stays as it is.";
    }
    return who
      ? `Rejected the change to ${who}. The listing stays as it is.`
      : "Rejected. The listing stays as it is.";
  }
  if (kind === "removed") {
    return who
      ? `Took ${who} off the site. It will leave the public site when you publish.`
      : "Taken off the site. It will leave the public site when you publish.";
  }
  if (kind === "geocode_flag") {
    return who ? `Kept the pin for ${who}.${publishNext}` : `Pin kept.${publishNext}`;
  }
  if (kind === "new") return who ? `Added ${who}.${publishNext}` : `Added.${publishNext}`;
  return who ? `Accepted ${who}.${publishNext}` : `Accepted.${publishNext}`;
}

export function finishedDecisionLabel({ action, kind, status } = {}) {
  const resolved = action || (status === "rejected" ? "reject" : "approve");
  if (resolved === "keep") return "Kept yours";
  if (resolved === "keep-community") return "Kept it as a community listing";
  if (resolved === "hide" || (resolved === "approve" && kind === "removed")) {
    return "Took it off the site";
  }
  if (resolved === "reject") {
    if (kind === "new") return "Didn't add this";
    if (kind === "geocode_flag") return "Skipped this pin check";
    return "Didn't use this change";
  }
  if (kind === "new") return "Added this service";
  if (kind === "geocode_flag") return "The pin is fine";
  return "Accepted this change";
}

function aucklandDay(value) {
  return new Date(value).toLocaleDateString("en-CA", { timeZone: "Pacific/Auckland" });
}

function addIsoDay(isoDay, days) {
  const [year, month, day] = isoDay.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day));
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

export function finishedWhenLabel(iso, now = new Date()) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const time = date.toLocaleTimeString("en-NZ", {
    timeZone: "Pacific/Auckland",
    hour: "numeric",
    minute: "2-digit",
  });
  const day = aucklandDay(date);
  const today = aucklandDay(now);
  if (day === today) return `Today, ${time}`;
  if (day === addIsoDay(today, -1)) return `Yesterday, ${time}`;
  const short = date.toLocaleDateString("en-NZ", {
    timeZone: "Pacific/Auckland",
    day: "numeric",
    month: "short",
  });
  return `${short}, ${time}`;
}

export function recentQueueItemDto(row = {}) {
  const proposed = row.proposed && typeof row.proposed === "object" ? row.proposed : {};
  const action = proposed.editor_decision?.action;
  const after = proposed.after && typeof proposed.after === "object" ? proposed.after : {};
  const before = proposed.before && typeof proposed.before === "object" ? proposed.before : {};
  const diffRows = queueDiffRows({ kind: row.kind, before, after });
  const organizationId = row.organization_id || row.organizationId || null;
  const name = row.organization_name || after.name || before.name || "";
  const lineTitle = row.title || row.service_name || pickField(after, "serviceName") || pickField(before, "serviceName") || "";
  return {
    id: row.id,
    name,
    lineLabel: queueLineLabel({ name, lineTitle }),
    summaryLabel: queueSummaryLabel({ kind: row.kind, diffRows }),
    decisionLabel: finishedDecisionLabel({ action, kind: row.kind, status: row.status }),
    whenLabel: finishedWhenLabel(proposed.editor_decision?.at || row.updated_at),
    decidedAt: proposed.editor_decision?.at || row.updated_at || null,
    organizationId,
    listingLabel: organizationId ? "Open listing" : "",
  };
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

export function foldSearch(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function publishChangesLabel(count) {
  const n = Number(count) || 0;
  if (n === 0) return "";
  return n === 1 ? "Publish 1 change" : `Publish ${n} changes`;
}

export function waitingCountLabel(count) {
  return publishChangesLabel(count);
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

/** Set difference for help types / community groups. Null when the value is not a reliable id list. */
export function listIdDelta(beforeValue, afterValue) {
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

function joinMarkedParts(items) {
  const parts = [];
  items.forEach((item, index) => {
    if (index) parts.push({ text: ", " });
    parts.push(item);
  });
  return parts;
}

function listDiffHighlight(beforeValue, afterValue) {
  const beforeIds = asIdList(beforeValue);
  const afterIds = asIdList(afterValue);
  if (!beforeIds || !afterIds) return null;
  const beforeSet = new Set(beforeIds);
  const afterSet = new Set(afterIds);
  const before = joinMarkedParts(
    beforeIds.map((id) => ({
      text: helpTypeLabel(id),
      mark: afterSet.has(id) ? "same" : "removed",
    }))
  );
  const after = joinMarkedParts(
    afterIds.map((id) => ({
      text: helpTypeLabel(id),
      mark: beforeSet.has(id) ? "same" : "added",
    }))
  );
  const hasDelta = before.some((part) => part.mark === "removed") || after.some((part) => part.mark === "added");
  if (!hasDelta) return null;
  if (before.some((part) => part.mark && !String(part.text || "").trim())) return null;
  if (after.some((part) => part.mark && !String(part.text || "").trim())) return null;
  return { kind: "list", before, after };
}

function replaceDiffHighlight(beforeText, afterText) {
  if (isBlank(beforeText) || isBlank(afterText)) return null;
  return {
    kind: "replace",
    before: [{ text: beforeText, mark: "removed" }],
    after: [{ text: afterText, mark: "added" }],
  };
}

export function queueDiffHighlight({ field, beforeValue, afterValue, beforeText, afterText } = {}) {
  if (field === "categories") return listDiffHighlight(beforeValue, afterValue);
  return replaceDiffHighlight(beforeText, afterText);
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
    row.highlight =
      kind === "changed"
        ? queueDiffHighlight({ field, beforeValue, afterValue, beforeText, afterText })
        : null;
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

export function pinsDiffer(left, right) {
  if (!left || !right) return false;
  return left.lat !== right.lat || left.lng !== right.lng;
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
  const currentAddress = before.address || (item.kind === "new" ? after.address || "" : "");
  const beforePin = queuePin(before, {});
  const afterPin = queuePin(after, {});
  const verifyPin = beforePin || (item.kind === "geocode_flag" || item.kind === "new" ? afterPin : null);
  const verifyComparePin = pinsDiffer(beforePin, afterPin) ? afterPin : null;
  const name = live?.name || after.name || before.name || "";
  const lineTitle =
    live?.title || live?.serviceName || pickField(after, "serviceName") || pickField(before, "serviceName") || "";
  return {
    id: item.id,
    kind: item.kind,
    kindLabel: kindLabel(item.kind),
    summaryLabel: queueSummaryLabel({ kind: item.kind, diffRows }),
    status: item.status,
    entityId: item.entity_id ?? item.entityId,
    name,
    lineLabel: queueLineLabel({ name, lineTitle }),
    address: after.address || before.address || "",
    currentAddress,
    verifyAddressNote: currentAddress && item.kind !== "new" ? "On the site now" : "",
    verifyPin,
    verifyComparePin,
    showVerifyMap: Boolean(verifyPin || verifyComparePin) && (showPin || item.kind === "geocode_flag"),
    primaryActionLabel: primaryActionLabel(item.kind),
    rejectActionLabel: rejectActionLabel(item.kind),
    showRejectAction: showRejectAction(item.kind),
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
