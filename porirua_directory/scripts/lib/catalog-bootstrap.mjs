/**
 * Bootstrap helpers: make public_id unique and seed raw_import.
 * Collision suffixes are deterministic — never assigned by row order.
 */

import { createHash } from "node:crypto";
import { orgClusterKey } from "./org-cluster.mjs";

export function publicIdSuffix(clusterKey) {
  return createHash("sha256").update(String(clusterKey)).digest("hex").slice(0, 4);
}

function servicesByOrganization(services) {
  const byOrg = new Map();
  for (const service of services) {
    const key = service.organization_id;
    if (!byOrg.has(key)) byOrg.set(key, []);
    byOrg.get(key).push(service);
  }
  return byOrg;
}

function lowestLineId(lines) {
  return lines.map((line) => String(line.line_id ?? "")).sort()[0] ?? "";
}

function compareCollisionGroup(a, b) {
  if (b.lineCount !== a.lineCount) return b.lineCount - a.lineCount;
  if (a.lowestLineId !== b.lowestLineId) return a.lowestLineId.localeCompare(b.lowestLineId);
  return a.clusterKey.localeCompare(b.clusterKey);
}

function stableServiceId(service, organizationId, lineIdCounts) {
  if ((lineIdCounts.get(service.line_id) ?? 0) <= 1) return service.line_id;
  return `${organizationId}:${service.line_id}`;
}

/**
 * Assign unique public_ids when catalogToRows preserved colliding card ids.
 * Winner keeps the bare public_id; others get `-<first 4 hex of sha256(cluster_key)>`.
 * Organization row ids become the (possibly suffixed) public_id so a shuffled
 * envelope still bootstraps the same primary keys.
 */
export function disambiguatePublicIds(organizations = [], services = []) {
  const byOrg = servicesByOrganization(services);
  const grouped = new Map();

  for (const organization of organizations) {
    const lines = byOrg.get(organization.id) ?? [];
    const clusterKey = organization.cluster_key || orgClusterKey(organization);
    const item = {
      organization,
      clusterKey,
      lineCount: lines.length,
      lowestLineId: lowestLineId(lines),
    };
    const publicId = organization.public_id;
    if (!grouped.has(publicId)) grouped.set(publicId, []);
    grouped.get(publicId).push(item);
  }

  const idRemap = new Map();
  const resultOrganizations = [];

  for (const [publicId, group] of grouped) {
    const ordered = [...group].sort(compareCollisionGroup);
    ordered.forEach((item, index) => {
      const nextPublicId =
        group.length === 1 || index === 0
          ? publicId
          : `${publicId}-${publicIdSuffix(item.clusterKey)}`;
      idRemap.set(item.organization.id, nextPublicId);
      resultOrganizations.push({
        ...item.organization,
        id: nextPublicId,
        public_id: nextPublicId,
        cluster_key: item.clusterKey,
      });
    });
  }

  resultOrganizations.sort((a, b) => (a.sort_key ?? 0) - (b.sort_key ?? 0));

  const lineIdCounts = new Map();
  for (const service of services) {
    lineIdCounts.set(service.line_id, (lineIdCounts.get(service.line_id) ?? 0) + 1);
  }

  const resultServices = services.map((service) => {
    const organizationId = idRemap.get(service.organization_id) ?? service.organization_id;
    return {
      ...service,
      organization_id: organizationId,
      id: stableServiceId(service, organizationId, lineIdCounts),
    };
  });

  return { organizations: resultOrganizations, services: resultServices };
}

export function rawImportFromPublished(organization, service) {
  if (service?.source !== "fsd") return null;
  return {
    name: organization?.name ?? "",
    serviceName: service.service_name ?? "",
    description: service.description ?? "",
    phone: service.phone ?? "",
    url: service.url ?? "",
    address: service.address || organization?.address || "",
    lat: service.lat ?? organization?.lat ?? null,
    lng: service.lng ?? organization?.lng ?? null,
    categories: service.categories ?? [],
    fsd_service_id: service.fsd_service_id ?? null,
    fsd_legacy_id: service.fsd_legacy_id ?? null,
  };
}

export function seedRawImport(organizations = [], services = []) {
  const orgs = new Map(organizations.map((org) => [org.id, org]));
  return services.map((service) => ({
    ...service,
    raw_import: rawImportFromPublished(orgs.get(service.organization_id), service),
  }));
}

export function prepareBootstrapRows(organizations, services) {
  const disambiguated = disambiguatePublicIds(organizations, services);
  return {
    organizations: disambiguated.organizations,
    services: seedRawImport(disambiguated.organizations, disambiguated.services),
  };
}
