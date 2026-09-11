import { formatNzDateTime } from "./fsd-sync-log.mjs";

export const PUBLISH_VERSIONS_COPY = {
  band: "Published versions",
  intro:
    "Each publish keeps a version of the public site. You can put an earlier version back on. Your saved listings stay as they are.",
  loading: "Looking for published versions…",
  loadError: "Could not load published versions.",
  tryAgain: "Try again",
  empty: "Nothing has been published yet.",
  onTheSiteNow: "On the site now",
  switch: "Put this version on the site",
  confirmSwitch: "Yes, put this version on the site",
  cancelSwitch: "Cancel",
};

export function listingCountFromCounts(counts = {}) {
  const published = Number(counts?.published);
  if (Number.isFinite(published) && published >= 0) return published;
  const organizations = Number(counts?.organizations);
  if (Number.isFinite(organizations) && organizations >= 0) return organizations;
  return 0;
}

export function listingCountLabel(count) {
  const n = Number(count) || 0;
  return n === 1 ? "1 listing" : `${n} listings`;
}

export function publishVersionDto(row = {}) {
  const version = Number(row.version);
  const listingCount = listingCountFromCounts(row.counts);
  const publishedAt = row.generated_at ?? row.generatedAt ?? row.publishedAt ?? null;
  const isCurrent = row.is_current === true || row.isCurrent === true;
  return {
    version: Number.isFinite(version) ? version : null,
    publishedAt: publishedAt ? new Date(publishedAt).toISOString() : "",
    publishedAtLabel: formatNzDateTime(publishedAt) || "Published version",
    listingCount,
    listingCountLabel: listingCountLabel(listingCount),
    isCurrent,
    currentLabel: PUBLISH_VERSIONS_COPY.onTheSiteNow,
    switchLabel: PUBLISH_VERSIONS_COPY.switch,
    confirmLabel: PUBLISH_VERSIONS_COPY.confirmSwitch,
  };
}
