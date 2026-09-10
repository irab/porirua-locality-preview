/**
 * Fingerprint of the proposal she saw when she marked Needs confirmation.
 * Same field set as the visible diff and pin — not the whole proposed JSON.
 */

const VISIBLE_AFTER_FIELDS = [
  "name",
  "title",
  "serviceName",
  "service_name",
  "description",
  "phone",
  "url",
  "address",
  "lat",
  "lng",
  "categories",
];

function asCoord(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function visibleAfter(after = {}) {
  const out = {};
  for (const field of VISIBLE_AFTER_FIELDS) {
    if (!Object.hasOwn(after, field)) continue;
    if (field === "lat" || field === "lng") {
      out[field] = asCoord(after[field]);
    } else {
      out[field] = after[field];
    }
  }
  return out;
}

export function proposalFingerprint(item = {}) {
  const proposed = item.proposed && typeof item.proposed === "object" ? item.proposed : {};
  const after = proposed.after && typeof proposed.after === "object" ? proposed.after : {};
  return JSON.stringify({
    kind: item.kind ?? null,
    after: visibleAfter(after),
    geocode_flag: proposed.geocode_flag ?? null,
    fsd_returned: proposed.fsd_returned === true,
    auto_hide: proposed.auto_hide ?? null,
  });
}

export function deferMarksEqual(left, right) {
  return proposalFingerprint(left) === proposalFingerprint(right);
}
