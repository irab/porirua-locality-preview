import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parse } from "csv-parse/sync";
import { FSD_RAW_JSON } from "./config.mjs";
import { isPoriruaRelevant, mapFsdRowToService } from "./fsd-porirua-rules.mjs";

async function fetchCsvText(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch FSD CSV: ${res.status} ${res.statusText}`);
  }
  return res.text();
}

export function importFsdFromCsv(csvText) {
  const rows = parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    trim: true,
  });
  return rows.filter(isPoriruaRelevant).map(mapFsdRowToService);
}

async function main() {
  const { FSD_CSV_URL } = await import("./config.mjs");
  const url = process.env.FSD_CSV_URL || FSD_CSV_URL;
  console.log(`Fetching FSD CSV from ${url}`);
  const csvText = await fetchCsvText(url);
  const services = importFsdFromCsv(csvText);
  const outDir = path.dirname(FSD_RAW_JSON);
  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(FSD_RAW_JSON, `${JSON.stringify(services, null, 2)}\n`, "utf8");
  console.log(`Wrote ${services.length} Porirua-relevant services to ${FSD_RAW_JSON}`);
}

const modulePath = pathToFileURL(path.resolve(process.argv[1] ?? "")).href;
if (import.meta.url === modulePath) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
