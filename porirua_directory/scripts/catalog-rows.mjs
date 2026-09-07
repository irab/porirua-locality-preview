/**
 * Decompose a published Option B envelope into normalised catalog rows.
 * Grain and public ids are copied from the envelope — never re-clustered.
 */

import { flatRowToServiceLine } from "./org-grouping.mjs";

/**
 * CSV SERVICE_ID is not stored on the published envelope — there is no
 * `SERVICE_ID` key on `data/services.json` or the raw import JSON.
 * Public FSD ids are `fsd-<SERVICE_ID>` when SERVICE_ID was present, otherwise
 * `fsd-<FSD_ID>`. `fsdServiceId` on the envelope is FSD_ID (legacy), never
 * SERVICE_ID. Derive the weekly-sync diff key by stripping `fsd-` from the
 * line id. Do not read `fsdServiceId` here: that would make the first sync
 * match nothing and queue every FSD line as new+removed.
 *
 * Must stay aligned with `serviceIdOf()` in `fsd-sync-collapse.mjs` (its
 * fallback when SERVICE_ID is absent): strip the `fsd-` prefix from `id`.
 */
export function fsdServiceIdFromPublicId(publicId) {
  const id = String(publicId ?? "");
  if (id.startsWith("fsd-")) return id.slice("fsd-".length);
  return null;
}

function persistSourceCounts(envelope, services) {
  const derivedCommunity = services.filter((s) => s.source === "community").length;
  const derivedFsd = services.filter((s) => s.source === "fsd").length;
  const derivedDupes = services.filter((s) => s.duplicate_of).length;
  return {
    community: envelope?.counts?.community ?? derivedCommunity,
    fsd: envelope?.counts?.fsd ?? derivedFsd,
    duplicatesHidden: envelope?.counts?.duplicatesHidden ?? derivedDupes,
  };
}

function uniqueRowId(base, sortKey, seen) {
  if (!seen.has(base)) {
    seen.add(base);
    return base;
  }
  const disambiguated = `${base}#${sortKey}`;
  seen.add(disambiguated);
  return disambiguated;
}

function organizationFromEntry(entry, sortKey, seenIds) {
  return {
    id: uniqueRowId(entry.id, sortKey, seenIds),
    public_id: entry.id,
    render_grain: entry.kind === "organization" ? "organization" : "flat",
    name: entry.name ?? "",
    description: entry.description ?? "",
    phone: entry.phone ?? "",
    url: entry.url ?? "",
    email: entry.email ?? "",
    address: entry.address ?? "",
    lat: entry.lat ?? null,
    lng: entry.lng ?? null,
    org_type: entry.orgType ?? "",
    community_filters: entry.communityFilters ?? [],
    community_meta: entry.communityMeta ?? null,
    source_primary: entry.source ?? "",
    status: "published",
    duplicate_of: entry.duplicateOf ?? null,
    sort_key: sortKey,
  };
}

function serviceRowFromMappedLine(line, location, organizationId, sortKey, duplicateOf, seenIds) {
  const source = line.source;
  return {
    id: uniqueRowId(line.id, `${organizationId}:${sortKey}`, seenIds),
    organization_id: organizationId,
    line_id: line.lineId,
    title: line.title,
    service_name: line.serviceName ?? "",
    description: line.description ?? "",
    phone: line.phone ?? "",
    url: line.url ?? "",
    address: location.address ?? "",
    lat: location.lat ?? null,
    lng: location.lng ?? null,
    categories: line.categories ?? [],
    badges: line.badges ?? [],
    source,
    fsd_service_id: source === "fsd" ? fsdServiceIdFromPublicId(line.id) : null,
    fsd_legacy_id: line.fsdServiceId ?? null,
    status: "published",
    duplicate_of: duplicateOf ?? null,
    raw_import: null,
    sort_key: sortKey,
  };
}

function serviceRowFromFlat(row, organizationId, sortKey, seenIds) {
  return serviceRowFromMappedLine(
    flatRowToServiceLine(row),
    row,
    organizationId,
    sortKey,
    row.duplicateOf,
    seenIds
  );
}

function serviceRowFromOrgLine(line, orgEntry, organizationId, sortKey, seenIds) {
  const mapped = flatRowToServiceLine({
    id: line.id ?? line.lineId,
    serviceName: line.serviceName,
    description: line.description,
    phone: line.phone,
    url: line.url,
    categories: line.categories,
    badges: line.badges,
    source: line.source,
    fsdServiceId: line.fsdServiceId,
    communityMeta: line.communityMeta,
    name: orgEntry.name,
  });
  return serviceRowFromMappedLine(
    mapped,
    orgEntry,
    organizationId,
    sortKey,
    orgEntry.duplicateOf,
    seenIds
  );
}

function servicesFromEntry(entry, organizationId, seenIds) {
  if (entry.kind === "organization") {
    return (entry.services ?? []).map((line, index) =>
      serviceRowFromOrgLine(line, entry, organizationId, index, seenIds)
    );
  }
  return [serviceRowFromFlat(entry, organizationId, 0, seenIds)];
}

function overrideRowsFrom(overrides = {}) {
  const rows = [];
  for (const id of overrides.hiddenIds ?? []) {
    rows.push({
      target_type: "service",
      target_id: id,
      action: "hide",
      patch: null,
      reason: null,
    });
  }
  for (const [id, patch] of Object.entries(overrides.patches ?? {})) {
    rows.push({
      target_type: "service",
      target_id: id,
      action: "patch",
      patch,
      reason: null,
    });
  }
  return rows;
}

/**
 * @param {{ services?: object[], counts?: object }} envelope
 * @param {{ hiddenIds?: string[], patches?: Record<string, object> }} [overrides]
 * @returns {{ organizations: object[], services: object[], overrides: object[], counts: object }}
 */
export function catalogToRows(envelope, overrides = {}) {
  const entries = Array.isArray(envelope?.services) ? envelope.services : [];
  const organizations = [];
  const services = [];
  const seenOrganizationIds = new Set();
  const seenServiceIds = new Set();

  entries.forEach((entry, index) => {
    const organization = organizationFromEntry(entry, index, seenOrganizationIds);
    organizations.push(organization);
    services.push(...servicesFromEntry(entry, organization.id, seenServiceIds));
  });

  return {
    organizations,
    services,
    overrides: overrideRowsFrom(overrides),
    counts: persistSourceCounts(envelope, services),
  };
}
