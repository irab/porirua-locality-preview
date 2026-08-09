/** Org cluster key — shared by import grouping and analyze-org-clusters.mjs */

import {
  dedupeKey,
  normalizeName,
  normalizePhone,
} from "./normalize.mjs";

export function normalizeAddress(addr) {
  return String(addr ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/** @param {{ name?: string, phone?: string, address?: string, lat?: number|null, lng?: number|null }} service */
export function orgClusterKey(service) {
  const name = normalizeName(service.name).toLowerCase();
  const phone = normalizePhone(service.phone);
  const addr = normalizeAddress(service.address);
  const geo = dedupeKey(service.name, service.lat, service.lng)
    .split("|")
    .slice(1)
    .join("|");
  return `name:${name}|phone:${phone}|addr:${addr}|geo:${geo}`;
}

export function normalizedOrgName(name) {
  return normalizeName(name).toLowerCase();
}
