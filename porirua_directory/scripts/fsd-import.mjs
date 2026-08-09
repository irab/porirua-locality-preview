import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parse } from "csv-parse/sync";
import {
  FSD_EXCLUDED_JSON,
  FSD_GEOCODE_FLAGS_JSON,
  FSD_RAW_JSON,
} from "./config.mjs";
import { collectFsdGeocodeFlags } from "./fsd-geocode-qa.mjs";
import {
  isPoriruaRelevant,
  mapFsdRowToService,
  summarizeExcludedFsdRow,
} from "./fsd-porirua-rules.mjs";

async function fetchCsvText(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch FSD CSV: ${res.status} ${res.statusText}`);
  }
  return res.text();
}

function parseFsdCsvRows(csvText) {
  return parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    trim: true,
  });
}

/** @param {ReturnType<typeof parseFsdCsvRows>} rows */
export function partitionFsdPoriruaRows(rows) {
  const includedRows = [];
  const excluded = [];
  for (const row of rows) {
    if (isPoriruaRelevant(row)) includedRows.push(row);
    else excluded.push(summarizeExcludedFsdRow(row));
  }
  return { includedRows, excluded };
}

export function importFsdFromCsv(csvText) {
  const rows = parseFsdCsvRows(csvText);
  return partitionFsdPoriruaRows(rows).includedRows.map(mapFsdRowToService);
}

/**
 * @param {string} csvText
 * @param {{ fsdCsvUrl?: string }} [meta]
 */
export function buildFsdImportReport(csvText, meta = {}) {
  const rows = parseFsdCsvRows(csvText);
  const { includedRows, excluded } = partitionFsdPoriruaRows(rows);
  const geocodeFlags = collectFsdGeocodeFlags(includedRows);
  return {
    generatedAt: new Date().toISOString(),
    fsdCsvUrl: meta.fsdCsvUrl ?? null,
    totalCsvRows: rows.length,
    includedCount: includedRows.length,
    excludedCount: excluded.length,
    geocodeFlagCount: geocodeFlags.length,
    excluded,
    geocodeFlags,
    services: includedRows.map(mapFsdRowToService),
  };
}

/** @param {string} outPath @param {ReturnType<typeof buildFsdImportReport>} report */
export async function writeFsdExcludedAudit(outPath, report) {
  const payload = {
    generatedAt: report.generatedAt,
    fsdCsvUrl: report.fsdCsvUrl,
    totalCsvRows: report.totalCsvRows,
    includedCount: report.includedCount,
    excludedCount: report.excludedCount,
    excluded: report.excluded,
  };
  await fs.writeFile(outPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

/** @param {string} outPath @param {ReturnType<typeof buildFsdImportReport>} report */
export async function writeFsdGeocodeFlagsAudit(outPath, report) {
  const payload = {
    generatedAt: report.generatedAt,
    fsdCsvUrl: report.fsdCsvUrl,
    includedCount: report.includedCount,
    geocodeFlagCount: report.geocodeFlagCount,
    geocodeFlags: report.geocodeFlags,
  };
  await fs.writeFile(outPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

async function main() {
  const { FSD_CSV_URL } = await import("./config.mjs");
  const url = process.env.FSD_CSV_URL || FSD_CSV_URL;
  console.log(`Fetching FSD CSV from ${url}`);
  const csvText = await fetchCsvText(url);
  const report = buildFsdImportReport(csvText, { fsdCsvUrl: url });
  const outDir = path.dirname(FSD_RAW_JSON);
  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(
    FSD_RAW_JSON,
    `${JSON.stringify(report.services, null, 2)}\n`,
    "utf8"
  );
  await writeFsdExcludedAudit(FSD_EXCLUDED_JSON, report);
  await writeFsdGeocodeFlagsAudit(FSD_GEOCODE_FLAGS_JSON, report);
  console.log(`Wrote ${report.includedCount} Porirua-relevant services to ${FSD_RAW_JSON}`);
  console.log(
    `Wrote ${report.excludedCount} excluded FSD rows (audit) to ${FSD_EXCLUDED_JSON}`
  );
  console.log(
    `Wrote ${report.geocodeFlagCount} geocode QA flag(s) to ${FSD_GEOCODE_FLAGS_JSON}`
  );
}

const modulePath = pathToFileURL(path.resolve(process.argv[1] ?? "")).href;
if (import.meta.url === modulePath) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
