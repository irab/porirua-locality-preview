import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parse } from "csv-parse/sync";
import {
  CONNECTIONS_CSV_FALLBACK,
  DATA_DIR,
  GOOGLE_SHEET_CSV_URL,
  FSD_RAW_JSON,
  OVERRIDES_JSON,
  SERVICES_JSON,
} from "./config.mjs";
import { mapCommunityRow } from "./lib/community-map.mjs";
import { dedupeKey } from "./lib/normalize.mjs";

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch failed ${res.status}: ${url}`);
  return res.text();
}

async function loadCommunityCsvText() {
  try {
    return await fetchText(GOOGLE_SHEET_CSV_URL);
  } catch (err) {
    console.warn(`Sheet fetch failed (${err.message}); using fallback CSV`);
    return fs.readFile(CONNECTIONS_CSV_FALLBACK, "utf8");
  }
}

export function parseCommunityCsv(csvText) {
  const rows = parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    trim: true,
  });
  return rows.filter((r) => String(r.name ?? "").trim()).map(mapCommunityRow);
}

/**
 * @param {{ community?: object[], fsd?: object[], hiddenIds?: string[], patches?: Record<string, object> }} input
 */
export function mergeServices({ community = [], fsd = [], hiddenIds = [], patches = {} }) {
  const hidden = new Set(hiddenIds);

  const communityRows = community.map((c) => ({
    ...c,
    badges:
      c.badges?.length > 0
        ? c.badges
        : c.source === "community"
          ? ["Community map"]
          : [],
  }));

  const keyToCommunityId = new Map();
  for (const c of communityRows) {
    keyToCommunityId.set(dedupeKey(c.name, c.lat, c.lng), c.id);
  }

  const fsdRows = fsd.map((f) => {
    let row = { ...f };
    if (patches[row.id]) {
      row = { ...row, ...patches[row.id] };
    }
    const matchId = keyToCommunityId.get(dedupeKey(row.name, row.lat, row.lng));
    if (matchId) {
      row = { ...row, duplicateOf: matchId };
    }
    return row;
  });

  const all = [...communityRows, ...fsdRows];
  const services = all.filter((s) => !hidden.has(s.id));

  const duplicatesHidden = services.filter((s) => s.duplicateOf).length;
  const published = services.filter((s) => !s.duplicateOf).length;

  return {
    counts: {
      community: communityRows.length,
      fsd: fsdRows.length,
      published,
      duplicatesHidden,
    },
    services,
  };
}

async function loadOverrides() {
  try {
    const raw = await fs.readFile(OVERRIDES_JSON, "utf8");
    const data = JSON.parse(raw);
    return {
      hiddenIds: Array.isArray(data.hiddenIds) ? data.hiddenIds : [],
      patches: data.patches && typeof data.patches === "object" ? data.patches : {},
    };
  } catch {
    return { hiddenIds: [], patches: {} };
  }
}

export async function buildServicesEnvelope() {
  const communityCsv = await loadCommunityCsvText();
  const community = parseCommunityCsv(communityCsv);

  let fsd = [];
  try {
    const raw = await fs.readFile(FSD_RAW_JSON, "utf8");
    fsd = JSON.parse(raw);
    if (!Array.isArray(fsd)) fsd = [];
  } catch {
    console.warn(`No FSD raw JSON at ${FSD_RAW_JSON}; continuing with community only`);
  }

  const { hiddenIds, patches } = await loadOverrides();
  const merged = mergeServices({ community, fsd, hiddenIds, patches });

  return {
    generatedAt: new Date().toISOString(),
    counts: merged.counts,
    services: merged.services,
  };
}

async function main() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const envelope = await buildServicesEnvelope();
  await fs.writeFile(SERVICES_JSON, `${JSON.stringify(envelope, null, 2)}\n`, "utf8");
  console.log(
    `Wrote ${SERVICES_JSON}: community=${envelope.counts.community} fsd=${envelope.counts.fsd} published=${envelope.counts.published} duplicatesHidden=${envelope.counts.duplicatesHidden}`
  );
}

const modulePath = pathToFileURL(path.resolve(process.argv[1] ?? "")).href;
if (import.meta.url === modulePath) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
