/**
 * Create-time identity for community listings.
 * Uses existing `slugId` / `orgClusterKey` / `publicIdSuffix`.
 * Does not change clustering behaviour.
 */

import { publicIdSuffix } from "./catalog-bootstrap.mjs";
import { orgClusterKey } from "./org-cluster.mjs";
import { slugId } from "./normalize.mjs";
import { serviceIdOf } from "../fsd-sync-collapse.mjs";

export function mintCommunityOrganizationIdentity(name, extras = {}) {
  const cluster_key = orgClusterKey({
    name,
    phone: extras.phone,
    address: extras.address,
    lat: extras.lat,
    lng: extras.lng,
  });
  const taken = new Set(extras.existingPublicIds ?? []);
  let public_id = slugId(name, "community-");
  if (taken.has(public_id)) {
    public_id = `${public_id}-${publicIdSuffix(cluster_key)}`;
  }
  return {
    id: public_id,
    public_id,
    cluster_key,
    render_grain: "flat",
  };
}

export function mintCommunityServiceLineIdentity({
  organizationId,
  title,
  existingIds = [],
} = {}) {
  const taken = new Set(existingIds);
  const base = slugId(title || "service", "line-");
  let id = `${organizationId}:${base}`;
  if (taken.has(id)) {
    id = `${id}-${publicIdSuffix(`${organizationId}|${title || "service"}`)}`;
  }
  return { id, line_id: id };
}

/** Same rules as the weekly FSD runner — extracted so create and sync share one mint. */
export function publicServiceId(incoming) {
  const serviceId = serviceIdOf(incoming);
  return incoming.id || (serviceId ? `fsd-${serviceId}` : slugId(incoming.name || "provider", "fsd-"));
}
