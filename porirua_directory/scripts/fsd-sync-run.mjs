/**
 * Weekly FSD sync runner: filter → attach SERVICE_ID → collapse → diff → review queue.
 * Never publishes a catalog snapshot.
 */

import { parse } from "csv-parse/sync";
import { partitionFsdPoriruaRows } from "./fsd-import.mjs";

export function parseFsdCsvText(csvText) {
  return parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    trim: true,
  });
}

/**
 * Caller must attach SERVICE_ID / FSD_ID from the CSV before collapse.
 * Do not derive SERVICE_ID from FSD_ID — mapFsdRowToService may fall back to FSD_ID for `id`.
 */
export function attachFsdIdentity(mapped, csvRow) {
  return {
    ...mapped,
    SERVICE_ID: String(csvRow?.SERVICE_ID ?? "").trim(),
    FSD_ID: String(csvRow?.FSD_ID ?? "").trim(),
    LATITUDE: csvRow?.LATITUDE,
    LONGITUDE: csvRow?.LONGITUDE,
  };
}

export function missingServiceIdCount(mappedRows = []) {
  return mappedRows.filter((row) => !String(row?.SERVICE_ID ?? "").trim()).length;
}

/**
 * Included Porirua rows only, with CSV identity attached.
 * Excluded national rows never reach collapse/diff.
 */
export function includedRowsForCollapse(csvText, report) {
  const { includedRows } = partitionFsdPoriruaRows(parseFsdCsvText(csvText));
  const services = report?.services ?? [];
  if (includedRows.length !== services.length) {
    throw new Error(
      `included CSV rows (${includedRows.length}) != report.services (${services.length})`
    );
  }
  return includedRows.map((csvRow, index) => attachFsdIdentity(services[index], csvRow));
}
