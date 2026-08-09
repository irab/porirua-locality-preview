/**
 * Option B — org header + service lines at merge time.
 * FSD flat rows → organization records; community rows stay flat unless name-matched to FSD cluster.
 */

import {
  dedupeKey,
  normalizeName,
  normalizePhone,
  slugId,
} from "./lib/normalize.mjs";
import {
  normalizedOrgName,
  normalizeAddress,
  orgClusterKey,
} from "./lib/org-cluster.mjs";

export { orgClusterKey, normalizeAddress, normalizedOrgName };

export function isCommunityOrgGrain(service) {
  return (
    service.source === "community" ||
    (service.communityFilters?.length ?? 0) > 0
  );
}

export function serviceLineTitle(service) {
  const fromName = String(service.serviceName ?? "").trim();
  if (fromName) return fromName.length <= 120 ? fromName : `${fromName.slice(0, 117)}…`;
  const first = String(service.description ?? "")
    .split("\n")[0]
    ?.trim();
  if (!first) return service.name || "Service";
  if (first.length <= 120) return first;
  return `${first.slice(0, 117)}…`;
}

/** @param {object} row published flat service row */
export function flatRowToServiceLine(row) {
  const lineId = row.id;
  return {
    lineId,
    id: lineId,
    serviceName: String(row.serviceName ?? "").trim(),
    title: serviceLineTitle(row),
    description: row.description ?? "",
    phone: row.phone ?? "",
    url: row.url ?? "",
    categories: row.categories ?? [],
    badges: row.badges ?? [],
    source: row.source,
    fsdServiceId: row.fsdServiceId,
    communityMeta: row.communityMeta,
  };
}

function orgIdForCluster(members) {
  const rep = members[0];
  const nameKey = slugId(normalizeName(rep.name), "org-");
  const ids = [...new Set(members.map((m) => m.id))];
  if (ids.length === 1 && ids[0].startsWith("community-")) return ids[0];
  return nameKey;
}

/**
 * @param {object[]} members sorted FSD (or merged) flat rows
 * @param {{ id?: string, source?: string, shell?: object }} [opts]
 */
export function buildOrganizationRecord(members, opts = {}) {
  const sorted = [...members].sort((a, b) => {
    const ta = serviceLineTitle(a).toLowerCase();
    const tb = serviceLineTitle(b).toLowerCase();
    if (ta !== tb) return ta.localeCompare(tb);
    return String(a.id).localeCompare(String(b.id));
  });
  const shell = opts.shell ?? sorted[0];
  const orgId = opts.id ?? orgIdForCluster(sorted);
  const services = sorted.map((row) => flatRowToServiceLine(row));
  const categories = [...new Set(sorted.flatMap((m) => m.categories ?? []))];

  return {
    kind: "organization",
    id: orgId,
    name: shell.name,
    description: shell.description ?? "",
    phone: shell.phone ?? "",
    url: shell.url ?? "",
    address: shell.address ?? "",
    lat: shell.lat ?? null,
    lng: shell.lng ?? null,
    orgType: shell.orgType ?? "",
    source: opts.source ?? shell.source ?? "fsd",
    badges: [...new Set(sorted.flatMap((m) => m.badges ?? []))],
    communityFilters: shell.communityFilters ?? [],
    communityMeta: shell.communityMeta,
    categories,
    services,
  };
}

/** Same site / contact signals — avoids merging same name at different locations. */
export function communityFsdTieBreakMatch(community, fsdRep) {
  if (
    dedupeKey(community.name, community.lat, community.lng) ===
    dedupeKey(fsdRep.name, fsdRep.lat, fsdRep.lng)
  ) {
    return true;
  }
  const cPhone = normalizePhone(community.phone);
  const fPhone = normalizePhone(fsdRep.phone);
  if (cPhone && fPhone && cPhone === fPhone) return true;
  const cAddr = normalizeAddress(community.address);
  const fAddr = normalizeAddress(fsdRep.address);
  if (cAddr && fAddr && cAddr === fAddr) return true;
  return false;
}

/** Exact normalised name + tie-break (geo, phone, or address). */
export function communityMatchesFsdCluster(community, clusterMembers) {
  const rep = clusterMembers[0];
  if (normalizedOrgName(community.name) !== normalizedOrgName(rep.name)) return false;
  return communityFsdTieBreakMatch(community, rep);
}

/**
 * @param {object[]} flatRows published rows (no duplicateOf, not hidden)
 * @returns {{ entries: object[], stats: { organizations: number, flatListings: number, serviceLines: number } }}
 */
export function applyOrgGrouping(flatRows) {
  const published = flatRows.filter((s) => !s.duplicateOf);
  const communityRows = published.filter((s) => isCommunityOrgGrain(s));
  const fsdRows = published.filter((s) => s.source === "fsd");

  const clusters = new Map();
  for (const row of fsdRows) {
    const ck = orgClusterKey(row);
    if (!clusters.has(ck)) clusters.set(ck, []);
    clusters.get(ck).push(row);
  }

  const nameIndex = new Map();
  for (const members of clusters.values()) {
    const nk = normalizedOrgName(members[0].name);
    if (!nameIndex.has(nk)) nameIndex.set(nk, []);
    nameIndex.get(nk).push(members);
  }

  const consumedClusterKeys = new Set();
  /** @type {object[]} */
  const entries = [];

  for (const community of communityRows) {
    const nk = normalizedOrgName(community.name);
    const candidates = nameIndex.get(nk) ?? [];
    let matched = null;
    let matchedKey = null;
    for (const members of candidates) {
      const ck = orgClusterKey(members[0]);
      if (consumedClusterKeys.has(ck)) continue;
      if (!communityMatchesFsdCluster(community, members)) continue;
      if (matched) {
        matched = null;
        matchedKey = null;
        break;
      }
      matched = members;
      matchedKey = ck;
    }

    if (matched && matchedKey) {
      consumedClusterKeys.add(matchedKey);
      entries.push(
        buildOrganizationRecord([community, ...matched], {
          id: community.id,
          source: "community",
          shell: community,
        })
      );
    } else {
      entries.push({ ...community });
    }
  }

  for (const [ck, members] of clusters) {
    if (consumedClusterKeys.has(ck)) continue;
    if (members.length === 1) {
      entries.push({ ...members[0] });
    } else {
      entries.push(buildOrganizationRecord(members));
    }
  }

  let organizations = 0;
  let flatListings = 0;
  let serviceLines = 0;
  for (const e of entries) {
    if (e.kind === "organization") {
      organizations += 1;
      serviceLines += e.services.length;
    } else {
      flatListings += 1;
      serviceLines += 1;
    }
  }

  return {
    entries,
    stats: { organizations, flatListings, serviceLines },
  };
}

/** Expand catalog entries to filterable service-line grain. */
export function expandServiceLines(entries) {
  /** @type {object[]} */
  const lines = [];
  for (const entry of entries) {
    if (entry.kind === "organization") {
      for (const line of entry.services) {
        lines.push({
          ...line,
          orgId: entry.id,
          name: entry.name,
          phone: line.phone || entry.phone,
          url: line.url || entry.url,
          address: entry.address,
          lat: entry.lat,
          lng: entry.lng,
          orgType: entry.orgType,
          communityFilters: entry.communityFilters ?? [],
          communityMeta: entry.communityMeta,
          source: line.source ?? entry.source,
        });
      }
    } else {
      lines.push({ ...entry, orgId: null, lineId: entry.id });
    }
  }
  return lines;
}

/** UI display shape from a catalog organization entry. */
export function organizationEntryToDisplayOrg(entry, serviceSubset = null) {
  const services = (serviceSubset ?? entry.services).map((line) => ({
    lineId: line.lineId,
    service: {
      id: line.id,
      name: entry.name,
      serviceName: line.serviceName,
      description: line.description,
      categories: line.categories,
      badges: line.badges,
      source: line.source,
    },
    title: line.title,
    categories: line.categories ?? [],
    badges: line.badges ?? [],
  }));

  return {
    orgId: entry.id,
    name: entry.name,
    phone: entry.phone,
    url: entry.url,
    address: entry.address,
    lat: entry.lat,
    lng: entry.lng,
    orgType: entry.orgType,
    source: entry.source,
    badges: entry.badges ?? [],
    services,
  };
}
