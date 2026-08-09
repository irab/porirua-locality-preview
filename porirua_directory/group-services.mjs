/**
 * Org grouping display helpers (Option B).
 * Pipeline truth lives in scripts/org-grouping.mjs; this module is imported by directory.js.
 */
import {
  expandServiceLines,
  isCommunityOrgGrain,
  organizationEntryToDisplayOrg,
  orgClusterKey,
  serviceLineTitle,
} from "./scripts/org-grouping.mjs";
import { slugId } from "./scripts/lib/normalize.mjs";

export {
  isCommunityOrgGrain,
  orgClusterKey,
  serviceLineTitle,
  expandServiceLines,
  organizationEntryToDisplayOrg,
};

function orgIdForMembers(members) {
  const ids = [...new Set(members.map((m) => m.id))];
  if (ids.length === 1) return ids[0];
  return slugId(orgClusterKey(members[0]), "org-");
}

/** Legacy runtime cluster (flat JSON or tests). Prefer groupCatalogForDisplay when entries exist. */
export function buildOrgFromMembers(members, orderIndex = 0) {
  const sorted = [...members].sort((a, b) => {
    const ta = serviceLineTitle(a).toLowerCase();
    const tb = serviceLineTitle(b).toLowerCase();
    if (ta !== tb) return ta.localeCompare(tb);
    return String(a.description ?? "").localeCompare(String(b.description ?? ""));
  });
  const first = sorted[0];
  const orgId = orgIdForMembers(sorted);
  const services = sorted.map((service, index) => ({
    lineId: `${orgId}::line-${index}`,
    service,
    title: serviceLineTitle(service),
    categories: service.categories ?? [],
    badges: service.badges ?? [],
  }));

  return {
    orgId,
    name: first.name,
    phone: first.phone,
    url: first.url,
    address: first.address,
    lat: first.lat,
    lng: first.lng,
    orgType: first.orgType,
    source: first.source,
    badges: [...new Set(sorted.flatMap((m) => m.badges ?? []))],
    orderIndex,
    services,
  };
}

/**
 * Build display items from pipeline catalog entries + filtered service lines.
 * @param {object[]} entries
 * @param {object[]} filteredLines
 */
export function groupCatalogForDisplay(entries, filteredLines) {
  const entryByOrgId = new Map();
  const flatById = new Map();
  for (const e of entries) {
    if (e.kind === "organization") entryByOrgId.set(e.id, e);
    else flatById.set(e.id, e);
  }

  const seen = new Set();
  /** @type {Array<{ type: 'card', service } | { type: 'org', org }>} */
  const items = [];

  for (const line of filteredLines) {
    if (line.orgId) {
      if (seen.has(line.orgId)) continue;
      seen.add(line.orgId);
      const entry = entryByOrgId.get(line.orgId);
      if (!entry) continue;
      const matching = filteredLines
        .filter((l) => l.orgId === line.orgId)
        .map((l) => entry.services.find((s) => s.lineId === l.lineId))
        .filter(Boolean);
      const seenLine = new Set();
      const uniqueMatching = matching.filter((s) => {
        if (seenLine.has(s.lineId)) return false;
        seenLine.add(s.lineId);
        return true;
      });
      items.push({
        type: "org",
        org: organizationEntryToDisplayOrg(entry, uniqueMatching),
      });
    } else {
      if (seen.has(line.id)) continue;
      seen.add(line.id);
      const entry = flatById.get(line.id);
      if (entry) items.push({ type: "card", service: entry });
    }
  }
  return items;
}

/**
 * Group filtered flat services into community cards + FSD org cards (legacy flat JSON).
 */
export function groupForDisplay(services) {
  /** @type {Array<{ type: 'card', service, orderIndex: number } | { type: 'org', org, orderIndex: number }>} */
  const items = [];
  const fsdClusters = new Map();

  services.forEach((service, orderIndex) => {
    if (isCommunityOrgGrain(service)) {
      items.push({ type: "card", service, orderIndex });
      return;
    }
    const ck = orgClusterKey(service);
    if (!fsdClusters.has(ck)) fsdClusters.set(ck, { members: [], firstIndex: orderIndex });
    const bucket = fsdClusters.get(ck);
    bucket.members.push(service);
    bucket.firstIndex = Math.min(bucket.firstIndex, orderIndex);
  });

  for (const { members, firstIndex } of fsdClusters.values()) {
    if (members.length === 1) {
      items.push({ type: "card", service: members[0], orderIndex: firstIndex });
    } else {
      items.push({
        type: "org",
        org: buildOrgFromMembers(members, firstIndex),
        orderIndex: firstIndex,
      });
    }
  }

  items.sort((a, b) => a.orderIndex - b.orderIndex);
  return items.map(({ type, service, org }) =>
    type === "card" ? { type, service } : { type, org }
  );
}

export function groupServicesByOrg(services) {
  const fsd = services.filter((s) => !isCommunityOrgGrain(s));
  const byKey = new Map();
  for (const s of fsd) {
    const ck = orgClusterKey(s);
    if (!byKey.has(ck)) byKey.set(ck, []);
    byKey.get(ck).push(s);
  }
  return [...byKey.values()].map((members, i) => buildOrgFromMembers(members, i));
}

export function lineMatchesNeed(line, activeNeeds) {
  if (!activeNeeds || activeNeeds.size === 0) return false;
  return line.categories?.some((c) => activeNeeds.has(c));
}

export function lineMatchesSearch(line, org, query) {
  if (!query) return false;
  const q = query.trim().toLowerCase();
  if (!q) return false;
  const hay = [org.name, line.title, line.service?.description, line.service?.serviceName]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

export function orgMapAnchor(org) {
  if (org.lat == null || org.lng == null) return null;
  return { lat: org.lat, lng: org.lng };
}
