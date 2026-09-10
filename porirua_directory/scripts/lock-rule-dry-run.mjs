/**
 * Read-only: compare today's locked-field skip with the three-way rule
 * against live catalog rows + this week's FSD CSV. Never writes queue rows
 * or import_runs. The weekly runner now uses shouldQueueDiffItemThreeWay;
 * this script still compares both so a later feed can be recounted.
 *
 *   DATABASE_URL=... node scripts/lock-rule-dry-run.mjs
 */
import pg from "pg";
import { pathToFileURL } from "node:url";
import { FSD_CSV_URL } from "./config.mjs";
import { buildFsdImportReport } from "./fsd-import.mjs";
import { collapseFsdRows } from "./fsd-sync-collapse.mjs";
import { diffFsdCatalog } from "./fsd-sync-diff.mjs";
import {
  includedRowsForCollapse,
  loadFsdRowsForDiff,
  shouldQueueDiffItem,
  shouldQueueDiffItemThreeWay,
  threeWayQueuedFields,
} from "./fsd-sync-run.mjs";

const { Client } = pg;

function asPatch(overrides = []) {
  const byTarget = new Map();
  for (const row of overrides) {
    if (row.action !== "patch" || row.status !== "open") continue;
    byTarget.set(row.target_id, row.patch && typeof row.patch === "object" ? row.patch : {});
  }
  return byTarget;
}

function patchForRow(dbRow, patchesByTarget) {
  if (!dbRow) return {};
  const fromAttached = (dbRow.overrides ?? [])
    .filter((entry) => entry.action === "patch" && entry.status === "open")
    .map((entry) => (entry.patch && typeof entry.patch === "object" ? entry.patch : {}));
  if (fromAttached.length) return Object.assign({}, ...fromAttached);
  return (
    patchesByTarget.get(dbRow.id) ??
    patchesByTarget.get(dbRow.fsd_service_id) ??
    {}
  );
}

export function summarizeLockRuleDelta(items, dbRows, patchesByServiceId) {
  const suppressedToday = [];
  for (const item of items) {
    if (item.kind !== "changed") continue;
    const dbRow =
      dbRows.find((row) => String(row.fsd_service_id) === String(item.serviceId)) ?? {};
    const patch = patchForRow(dbRow, patchesByServiceId);
    const today = shouldQueueDiffItem(item, dbRow);
    const next = shouldQueueDiffItemThreeWay(item, dbRow, patch);
    if (!today && next) {
      suppressedToday.push({
        serviceId: item.serviceId,
        fields: threeWayQueuedFields(item, dbRow, patch),
      });
    }
  }
  const byField = {};
  for (const row of suppressedToday) {
    for (const field of row.fields) {
      byField[field] = (byField[field] ?? 0) + 1;
    }
  }
  return {
    newlyQueued: suppressedToday.length,
    byField,
    items: suppressedToday,
  };
}

export async function runLockRuleDryRunReadOnly({ db, csvText, fetchCsv } = {}) {
  if (!db) throw new Error("runLockRuleDryRunReadOnly requires db");
  const dbRows = await loadFsdRowsForDiff(db);
  let text = csvText;
  if (text == null) {
    const url = FSD_CSV_URL;
    const fetcher =
      fetchCsv ??
      (async (target) => {
        const res = await fetch(target);
        if (!res.ok) throw new Error(`Failed to fetch FSD CSV: ${res.status} ${res.statusText}`);
        return res.text();
      });
    text = await fetcher(url);
  }
  const report = buildFsdImportReport(text, { fsdCsvUrl: FSD_CSV_URL });
  const mapped = includedRowsForCollapse(text, report);
  const collapsed = collapseFsdRows(mapped);
  const items = diffFsdCatalog(collapsed, dbRows);
  const patches = asPatch(dbRows.flatMap((row) => row.overrides ?? []));
  const delta = summarizeLockRuleDelta(items, dbRows, patches);
  const kindCounts = items.reduce((acc, item) => {
    acc[item.kind] = (acc[item.kind] ?? 0) + 1;
    return acc;
  }, {});
  return {
    source: "live-dev-read-only",
    fsdServices: dbRows.length,
    includedCount: report.includedCount,
    collapsedCount: collapsed.length,
    kindCounts,
    newlyQueued: delta.newlyQueued,
    byField: delta.byField,
    items: delta.items,
  };
}

async function openReadOnlyClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  const client = new Client({
    connectionString,
    connectionTimeoutMillis: 8000,
  });
  await client.connect();
  await client.query("SET default_transaction_read_only = on");
  await client.query("SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY");
  return client;
}

async function main() {
  const client = await openReadOnlyClient();
  try {
    const result = await runLockRuleDryRunReadOnly({ db: client });
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await client.end();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
