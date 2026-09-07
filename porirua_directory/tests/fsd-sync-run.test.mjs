import test from "node:test";
import assert from "node:assert/strict";
import { buildFsdImportReport } from "../scripts/fsd-import.mjs";
import {
  attachFsdIdentity,
  includedRowsForCollapse,
  missingServiceIdCount,
} from "../scripts/fsd-sync-run.mjs";
import { collapseFsdRows, serviceIdOf } from "../scripts/fsd-sync-collapse.mjs";
import { diffFsdCatalog } from "../scripts/fsd-sync-diff.mjs";

const HEADER = [
  "FSD_ID",
  "SERVICE_ID",
  "PROVIDER_NAME",
  "SERVICE_NAME",
  "SERVICE_DETAIL",
  "PUBLISHED_PHONE_1",
  "PROVIDER_WEBSITE_1",
  "PHYSICAL_DISTRICT",
  "PHYSICAL_ADDRESS",
  "LATITUDE",
  "LONGITUDE",
  "LEVEL_1_CATEGORY",
];

export function fsdCsv(rows) {
  const lines = [HEADER.map((h) => `"${h}"`).join(",")];
  for (const row of rows) {
    lines.push(
      HEADER.map((h) => `"${String(row[h] ?? "").replaceAll('"', '""')}"`).join(",")
    );
  }
  return `${lines.join("\n")}\n`;
}

export const PORIRUA_FOOD = {
  FSD_ID: "9001",
  SERVICE_ID: "9001-line-a",
  PROVIDER_NAME: "Test Provider",
  SERVICE_NAME: "Food bank",
  SERVICE_DETAIL: "Help with food",
  PUBLISHED_PHONE_1: "04 123 4567",
  PROVIDER_WEBSITE_1: "https://example.org",
  PHYSICAL_DISTRICT: "Porirua",
  PHYSICAL_ADDRESS: "1 Main St, Porirua",
  LATITUDE: "-41.13",
  LONGITUDE: "174.84",
  LEVEL_1_CATEGORY: "Food",
};

export const WELLINGTON_ONLY = {
  FSD_ID: "9002",
  SERVICE_ID: "well-only",
  PROVIDER_NAME: "Wellington Only Service",
  SERVICE_NAME: "Counselling",
  SERVICE_DETAIL: "Region-wide",
  PUBLISHED_PHONE_1: "04 999 0000",
  PHYSICAL_DISTRICT: "",
  PHYSICAL_ADDRESS: "100 Lambton Quay, Wellington",
  LATITUDE: "-41.28",
  LONGITUDE: "174.77",
  LEVEL_1_CATEGORY: "Support",
};

export const TITAHI_CLINIC = {
  FSD_ID: "9003",
  SERVICE_ID: "9003-clinic",
  PROVIDER_NAME: "Titahi Bay Community",
  SERVICE_NAME: "Clinic",
  SERVICE_DETAIL: "Free nurse",
  PHYSICAL_DISTRICT: "",
  PHYSICAL_ADDRESS: "5 Beach Road, Titahi Bay",
  LATITUDE: "-41.10",
  LONGITUDE: "174.82",
  LEVEL_1_CATEGORY: "Health",
};

test("attachFsdIdentity copies SERVICE_ID and FSD_ID from the CSV row", () => {
  const mapped = { id: "fsd-9001-line-a", fsdServiceId: "9001", name: "Test Provider" };
  const attached = attachFsdIdentity(mapped, PORIRUA_FOOD);
  assert.equal(attached.SERVICE_ID, "9001-line-a");
  assert.equal(attached.FSD_ID, "9001");
  assert.equal(attached.LATITUDE, "-41.13");
  assert.equal(attached.LONGITUDE, "174.84");
});

test("includedRowsForCollapse attaches identity and counts missing SERVICE_ID", () => {
  const missingId = { ...PORIRUA_FOOD, SERVICE_ID: "" };
  const csv = fsdCsv([missingId, TITAHI_CLINIC]);
  const report = buildFsdImportReport(csv);
  const mapped = includedRowsForCollapse(csv, report);
  assert.equal(mapped.length, 2);
  assert.equal(mapped[0].SERVICE_ID, "");
  assert.equal(mapped[0].FSD_ID, "9001");
  assert.equal(mapped[1].SERVICE_ID, "9003-clinic");
  assert.equal(missingServiceIdCount(mapped), 1);
});

test("diff receives only Porirua-included rows, not the rest of the national feed", () => {
  const csv = fsdCsv([PORIRUA_FOOD, WELLINGTON_ONLY, TITAHI_CLINIC]);
  const report = buildFsdImportReport(csv);
  assert.equal(report.includedCount, 2);
  assert.equal(report.excludedCount, 1);

  const mapped = includedRowsForCollapse(csv, report);
  const serviceIds = mapped.map((row) => serviceIdOf(row)).sort();
  assert.deepEqual(serviceIds, ["9001-line-a", "9003-clinic"]);
  assert.ok(!serviceIds.includes("well-only"));

  const collapsed = collapseFsdRows(mapped);
  const items = diffFsdCatalog(collapsed, []);
  const kinds = Object.fromEntries(items.map((item) => [item.serviceId, item.kind]));
  assert.equal(kinds["9001-line-a"], "new");
  assert.equal(kinds["9003-clinic"], "new");
  assert.equal(kinds["well-only"], undefined);
  assert.equal(items.filter((item) => item.kind === "new").length, 2);
});
