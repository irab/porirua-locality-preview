/**
 * Rebuild a published Option B envelope from normalised catalog rows.
 * Reads persisted render_grain — does not call applyOrgGrouping.
 */

import { buildOrganizationRecord } from "./org-grouping.mjs";

function omitUndefined(value) {
  if (Array.isArray(value)) return value.map(omitUndefined);
  if (value && typeof value === "object") {
    const out = {};
    for (const [key, child] of Object.entries(value)) {
      if (child === undefined) continue;
      out[key] = omitUndefined(child);
    }
    return out;
  }
  return value;
}

function orgShell(organization) {
  return {
    name: organization.name,
    description: organization.description,
    phone: organization.phone,
    url: organization.url,
    address: organization.address,
    lat: organization.lat,
    lng: organization.lng,
    orgType: organization.org_type,
    communityFilters: organization.community_filters ?? [],
    communityMeta: organization.community_meta ?? undefined,
    source: organization.source_primary,
  };
}

function memberFromService(organization, service) {
  return {
    id: service.line_id ?? service.id,
    name: organization.name,
    serviceName: service.service_name,
    description: service.description,
    phone: service.phone,
    url: service.url,
    address: organization.address,
    lat: organization.lat,
    lng: organization.lng,
    categories: service.categories ?? [],
    badges: service.badges ?? [],
    source: service.source,
    fsdServiceId: service.fsd_legacy_id ?? undefined,
    communityMeta: service.community_meta ?? undefined,
  };
}

function reconstructOrganization(organization, lines) {
  const members = lines.map((line) => memberFromService(organization, line));
  return omitUndefined(
    buildOrganizationRecord(members, {
      id: organization.public_id,
      source: organization.source_primary,
      shell: orgShell(organization),
    })
  );
}

function reconstructFlat(organization, service) {
  const entry = {
    id: organization.public_id,
    name: organization.name,
    description: organization.description ?? "",
    phone: organization.phone ?? "",
    url: organization.url ?? "",
    address: organization.address ?? "",
    lat: organization.lat ?? null,
    lng: organization.lng ?? null,
    categories: service?.categories ?? [],
    communityFilters: organization.community_filters ?? [],
    orgType: organization.org_type ?? "",
    source: organization.source_primary || service?.source,
    badges: service?.badges ?? [],
  };

  if (organization.source_primary === "fsd" || service?.source === "fsd") {
    return omitUndefined({
      id: entry.id,
      fsdServiceId: service?.fsd_legacy_id,
      serviceName: service?.service_name,
      name: entry.name,
      description: entry.description,
      phone: entry.phone,
      url: entry.url,
      address: entry.address,
      lat: entry.lat,
      lng: entry.lng,
      categories: entry.categories,
      communityFilters: entry.communityFilters,
      orgType: entry.orgType,
      source: entry.source,
      badges: entry.badges,
      ...(organization.duplicate_of ? { duplicateOf: organization.duplicate_of } : {}),
    });
  }

  if (organization.community_meta != null) {
    entry.communityMeta = organization.community_meta;
  }
  if (organization.duplicate_of) {
    entry.duplicateOf = organization.duplicate_of;
  }
  return omitUndefined(entry);
}

function isHiddenRow(row) {
  return Boolean(row?.duplicate_of) || row?.status === "hidden";
}

function groupServicesByOrganization(services) {
  const byOrg = new Map();
  for (const service of services) {
    const key = service.organization_id;
    if (!byOrg.has(key)) byOrg.set(key, []);
    byOrg.get(key).push(service);
  }
  for (const list of byOrg.values()) {
    list.sort((a, b) => (a.sort_key ?? 0) - (b.sort_key ?? 0));
  }
  return byOrg;
}

function countsFromEntries(entries) {
  let organizations = 0;
  let serviceLines = 0;
  for (const entry of entries) {
    if (entry.kind === "organization") {
      organizations += 1;
      serviceLines += entry.services.length;
    } else {
      serviceLines += 1;
    }
  }
  return {
    published: entries.length,
    serviceLines,
    organizations,
  };
}

/**
 * @param {{ organizations?: object[], services?: object[], counts?: object }} rows
 */
export function buildCatalogEnvelope({ organizations = [], services = [], counts: persistedCounts } = {}) {
  const servicesByOrg = groupServicesByOrganization(services);
  const orderedOrgs = [...organizations].sort((a, b) => (a.sort_key ?? 0) - (b.sort_key ?? 0));

  const entries = [];
  for (const organization of orderedOrgs) {
    if (isHiddenRow(organization)) continue;
    const lines = (servicesByOrg.get(organization.id) ?? []).filter((row) => !isHiddenRow(row));
    if (organization.render_grain === "organization") {
      entries.push(reconstructOrganization(organization, lines));
    } else {
      entries.push(reconstructFlat(organization, lines[0]));
    }
  }

  const derived = countsFromEntries(entries);
  return {
    generatedAt: new Date().toISOString(),
    counts: {
      community: persistedCounts?.community ?? services.filter((s) => s.source === "community").length,
      fsd: persistedCounts?.fsd ?? services.filter((s) => s.source === "fsd").length,
      published: derived.published,
      serviceLines: derived.serviceLines,
      organizations: derived.organizations,
      duplicatesHidden:
        persistedCounts?.duplicatesHidden ?? services.filter((s) => s.duplicate_of).length,
    },
    services: entries,
  };
}
