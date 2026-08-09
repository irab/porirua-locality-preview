#!/usr/bin/env node
/**
 * Read-only cluster analysis for org / multi-service patterns in services.json.
 * Usage: node scripts/analyze-org-clusters.mjs [--out path]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  dedupeKey,
  normalizeName,
  normalizePhone,
  slugId,
} from "./lib/normalize.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const servicesPath = path.join(__dirname, "../data/services.json");

function normalizeAddress(addr) {
  return String(addr ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function descriptionFingerprint(desc) {
  const d = String(desc ?? "").trim();
  if (d.length < 80) return "";
  return d.slice(0, 200).toLowerCase().replace(/\s+/g, " ");
}

function clusterKey(row) {
  const name = normalizeName(row.name).toLowerCase();
  const phone = normalizePhone(row.phone);
  const addr = normalizeAddress(row.address);
  const geo = dedupeKey(row.name, row.lat, row.lng).split("|").slice(1).join("|");
  return `name:${name}|phone:${phone}|addr:${addr}|geo:${geo}`;
}

function loadServices() {
  const raw = JSON.parse(fs.readFileSync(servicesPath, "utf8"));
  return raw.services ?? raw;
}

function summarizeCluster(members) {
  const sources = [...new Set(members.map((m) => m.source))];
  const ids = [...new Set(members.map((m) => m.id))];
  const dupDesc = new Set(
    members.map((m) => descriptionFingerprint(m.description)).filter(Boolean)
  );
  const categories = [
    ...new Set(members.flatMap((m) => m.categories ?? [])),
  ];
  return {
    count: members.length,
    name: members[0]?.name,
    sources,
    distinctIds: ids.length,
    sharedId: ids.length === 1 ? ids[0] : null,
    duplicateDescriptionLines: dupDesc.size <= 1 && members.length > 1,
    categoryCount: categories.length,
    sampleServiceTitles: members
      .slice(0, 5)
      .map((m) => {
        const firstLine = String(m.description ?? "").split("\n")[0]?.slice(0, 80);
        return firstLine || m.name;
      }),
  };
}

function main() {
  const services = loadServices();
  const byName = new Map();
  const byClusterKey = new Map();
  const bySharedId = new Map();
  const byDupDesc = new Map();

  for (const row of services) {
    const nameKey = normalizeName(row.name).toLowerCase();
    if (!byName.has(nameKey)) byName.set(nameKey, []);
    byName.get(nameKey).push(row);

    const ck = clusterKey(row);
    if (!byClusterKey.has(ck)) byClusterKey.set(ck, []);
    byClusterKey.get(ck).push(row);

    if (!bySharedId.has(row.id)) bySharedId.set(row.id, []);
    bySharedId.get(row.id).push(row);

    const fp = descriptionFingerprint(row.description);
    if (fp) {
      const dk = `${nameKey}|${fp}`;
      if (!byDupDesc.has(dk)) byDupDesc.set(dk, []);
      byDupDesc.get(dk).push(row);
    }
  }

  const multiByName = [...byName.entries()]
    .filter(([, rows]) => rows.length >= 2)
    .map(([key, rows]) => ({ key, ...summarizeCluster(rows), rows: rows.length }));

  const multiByCluster = [...byClusterKey.entries()]
    .filter(([, rows]) => rows.length >= 2)
    .map(([key, rows]) => ({ clusterKey: key, ...summarizeCluster(rows) }));

  const multiById = [...bySharedId.entries()]
    .filter(([, rows]) => rows.length >= 2)
    .map(([id, rows]) => ({ id, ...summarizeCluster(rows) }));

  const multiByDupDesc = [...byDupDesc.entries()]
    .filter(([, rows]) => rows.length >= 2)
    .map(([key, rows]) => ({
      key: key.slice(0, 120),
      ...summarizeCluster(rows),
    }));

  const fsdOnly = services.filter((s) => s.source === "fsd");
  const communityOnly = services.filter((s) => s.source === "community");

  const fsdMultiName = multiByName.filter((g) =>
    g.sources.every((s) => s === "fsd")
  );

  const patternMatchers = [
    /capital coast|ccdhb|te whatu ora.*capital/i,
    /family works/i,
    /salvation army/i,
    /little shadow/i,
    /literacy aotearoa/i,
  ];

  const citedExamples = patternMatchers.map((re) => {
    const hits = multiByName.filter((g) => re.test(g.name ?? g.key));
    return {
      pattern: re.source,
      groups: hits.map((h) => ({
        name: h.name,
        count: h.count,
        sources: h.sources,
        sharedId: h.sharedId,
      })),
    };
  });

  const communityNames = new Set(
    communityOnly.map((c) => normalizeName(c.name).toLowerCase())
  );
  const fsdRowsMatchingCommunityName = fsdOnly.filter((f) =>
    communityNames.has(normalizeName(f.name).toLowerCase())
  );

  const summary = {
    generatedAt: new Date().toISOString(),
    sourceFile: "data/services.json",
    totals: {
      published: services.length,
      community: communityOnly.length,
      fsd: fsdOnly.length,
    },
    clustering: {
      orgsWithSameNormalizedName2Plus: multiByName.length,
      listingsInThoseGroups: multiByName.reduce((a, g) => a + g.count, 0),
      clusterKeyGroups2Plus: multiByCluster.length,
      sharedIdGroups2Plus: multiById.length,
      duplicateDescriptionGroups2Plus: multiByDupDesc.length,
      fsdOnlyNameGroups2Plus: fsdMultiName.length,
    },
    topMultiServiceOrgsByName: multiByName
      .sort((a, b) => b.count - a.count)
      .slice(0, 25)
      .map(({ key, count, name, sources, sharedId, distinctIds, duplicateDescriptionLines }) => ({
        normalizedName: key,
        displayName: name,
        count,
        sources,
        sharedId,
        distinctIds,
        duplicateDescriptionLines,
      })),
    citedExamples,
    communityVsFsd: {
      communityListingCount: communityOnly.length,
      fsdListingCount: fsdOnly.length,
      fsdRowsWhoseNameMatchesACommunityOrg: fsdRowsMatchingCommunityName.length,
      note:
        "Merge hides FSD duplicate when community row wins dedupeKey; these counts are name overlap only.",
    },
  };

  const outArg = process.argv.indexOf("--out");
  const outPath =
    outArg >= 0
      ? process.argv[outArg + 1]
      : path.join(__dirname, "../data/org-clusters-preview.json");

  fs.writeFileSync(outPath, `${JSON.stringify(summary, null, 2)}\n`);
  console.log(JSON.stringify(summary, null, 2));
}

main();
