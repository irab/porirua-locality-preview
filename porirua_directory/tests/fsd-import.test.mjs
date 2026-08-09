import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  getPoriruaExclusionReason,
  isPoriruaRelevant,
  mapFsdRowToService,
  normalizeDescriptionText,
  PORIRUA_EXCLUSION_REASON,
} from "../scripts/fsd-porirua-rules.mjs";
import {
  buildFsdImportReport,
  importFsdFromCsv,
  writeFsdExcludedAudit,
  writeFsdGeocodeFlagsAudit,
} from "../scripts/fsd-import.mjs";
import { GEOCODE_QA_REASON } from "../scripts/fsd-geocode-qa.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fsdFixture = path.join(__dirname, "fixtures/fsd-sample.csv");

test("includes Porirua district rows", () => {
  assert.equal(isPoriruaRelevant({ PHYSICAL_DISTRICT: "Porirua" }), true);
});

test("includes Wellington region service area when district empty", () => {
  assert.equal(
    isPoriruaRelevant({ PHYSICAL_REGION: "Wellington", PHYSICAL_DISTRICT: "" }),
    false
  );
});

test("includes suburb address when district empty", () => {
  assert.equal(
    isPoriruaRelevant({
      PHYSICAL_REGION: "Wellington",
      PHYSICAL_DISTRICT: "",
      PHYSICAL_ADDRESS: "5 Beach Road, Titahi Bay",
    }),
    true
  );
});

test("excludes Christchurch suburb Aranui (not Porirua Rānui)", () => {
  assert.equal(
    isPoriruaRelevant({
      PHYSICAL_REGION: "Canterbury",
      PHYSICAL_DISTRICT: "Christchurch",
      PHYSICAL_ADDRESS: "250 Pages Road, Aranui, Christchurch",
    }),
    false
  );
});

test("includes Porirua suburb Rānui in address", () => {
  assert.equal(
    isPoriruaRelevant({
      PHYSICAL_REGION: "Wellington",
      PHYSICAL_DISTRICT: "",
      PHYSICAL_ADDRESS: "12 Ranui Grove, Porirua",
    }),
    true
  );
});

test("excludes Dunedin Whitby Street (not Porirua suburb Whitby)", () => {
  assert.equal(
    isPoriruaRelevant({
      PHYSICAL_REGION: "Otago",
      PHYSICAL_DISTRICT: "Dunedin City",
      PHYSICAL_ADDRESS: "3 Whitby Street, Mornington, Dunedin, 9011",
    }),
    false
  );
});

test("excludes Auckland Ranui suburb (not Porirua Rānui)", () => {
  assert.equal(
    isPoriruaRelevant({
      PHYSICAL_REGION: "Auckland",
      PHYSICAL_DISTRICT: "Henderson - Massey",
      PHYSICAL_ADDRESS: "32 Pooks Road, Ranui, Auckland, 0612",
    }),
    false
  );
});

test("excludes Auckland Ranui postal when physical address is Waitakere (sKids Massey)", () => {
  assert.equal(
    isPoriruaRelevant({
      PHYSICAL_REGION: "Auckland",
      PHYSICAL_DISTRICT: "Henderson - Massey",
      PHYSICAL_ADDRESS: "326 Don Buck Road, Massey, Waitakere",
      POSTAL_ADDRESS: "16 Platinum Rise, Ranui, 0612",
    }),
    false
  );
});

test("excludes Kerikeri Ranui Avenue street name", () => {
  assert.equal(
    isPoriruaRelevant({
      PHYSICAL_REGION: "Auckland",
      PHYSICAL_DISTRICT: "Upper Harbour",
      PHYSICAL_ADDRESS: "41 Ranui Avenue, Kerikeri, 0230",
    }),
    false
  );
});

test("excludes FSD district Porirua when physical address is Palmerston North", () => {
  const row = {
    PHYSICAL_REGION: "Wellington",
    PHYSICAL_DISTRICT: "Porirua City",
    PHYSICAL_ADDRESS: "31 Princess Street, Palmerston North, 4410",
  };
  assert.equal(isPoriruaRelevant(row), false);
  assert.equal(
    getPoriruaExclusionReason(row).code,
    PORIRUA_EXCLUSION_REASON.DISTRICT_CONTRADICTS_PHYSICAL
  );
});

test("includes Porirua suburb Whitby when address names Porirua", () => {
  assert.equal(
    isPoriruaRelevant({
      PHYSICAL_REGION: "Wellington",
      PHYSICAL_DISTRICT: "",
      PHYSICAL_ADDRESS: "4 Hikoi Way, Whitby, Porirua, 5024",
    }),
    true
  );
});

test("includes Porirua Rānui suburb in address line", () => {
  assert.equal(
    isPoriruaRelevant({
      PHYSICAL_REGION: "Wellington",
      PHYSICAL_DISTRICT: "",
      PHYSICAL_ADDRESS: "10 Awatea Street, Ranui, Porirua, 5024",
    }),
    true
  );
});

test("maps FSD row to service with source fsd", () => {
  const s = mapFsdRowToService({
    FSD_ID: "1",
    PROVIDER_NAME: "Test Provider",
    SERVICE_NAME: "Food bank",
    SERVICE_DETAIL: "Help with food",
    PUBLISHED_PHONE_1: "04 123 4567",
    PHYSICAL_ADDRESS: "1 Main St, Porirua",
    PHYSICAL_DISTRICT: "Porirua",
    LATITUDE: "-41.13",
    LONGITUDE: "174.84",
    LEVEL_1_CATEGORY: "Food",
  });
  assert.equal(s.source, "fsd");
  assert.equal(s.name, "Test Provider");
  assert.ok(s.categories.includes("food"));
  assert.equal(s.id, "fsd-1");
  assert.equal(s.fsdServiceId, "1");
});

test("normalizeDescriptionText converts CRLF and preserves paragraph breaks", () => {
  assert.equal(normalizeDescriptionText("  a\r\n\r\nb\r\n- item  "), "a\n\nb\n- item");
});

test("mapFsdRowToService preserves SERVICE_DETAIL newlines", () => {
  const s = mapFsdRowToService({
    FSD_ID: "99",
    PROVIDER_NAME: "Multiline Provider",
    SERVICE_DETAIL: "Intro line.\r\n\r\nDetail line.\r\n- eligibility item",
    PHYSICAL_DISTRICT: "Porirua",
  });
  assert.equal(s.description, "Intro line.\n\nDetail line.\n- eligibility item");
});

test("importFsdFromCsv filters fixture to Porirua-relevant rows", async () => {
  const csv = await fs.readFile(fsdFixture, "utf8");
  const services = importFsdFromCsv(csv);
  assert.equal(services.length, 2);
  assert.ok(services.every((s) => s.source === "fsd"));
});

test("buildFsdImportReport produces excluded audit rows with reason codes", async () => {
  const csv = await fs.readFile(fsdFixture, "utf8");
  const report = buildFsdImportReport(csv, { fsdCsvUrl: "fixture://fsd-sample.csv" });
  assert.equal(report.includedCount, 2);
  assert.ok(report.excludedCount >= 1);
  assert.equal(report.totalCsvRows, report.includedCount + report.excludedCount);
  for (const row of report.excluded) {
    assert.ok(row.reasonCode);
    assert.ok(row.reasonDetail);
    assert.ok(
      Object.values(PORIRUA_EXCLUSION_REASON).includes(row.reasonCode),
      row.reasonCode
    );
  }
});

test("writeFsdExcludedAudit writes JSON with expected top-level shape", async () => {
  const csv = await fs.readFile(fsdFixture, "utf8");
  const report = buildFsdImportReport(csv);
  const outPath = path.join(__dirname, ".tmp-fsd-excluded-test.json");
  await writeFsdExcludedAudit(outPath, report);
  const raw = await fs.readFile(outPath, "utf8");
  const data = JSON.parse(raw);
  assert.equal(typeof data.generatedAt, "string");
  assert.equal(typeof data.totalCsvRows, "number");
  assert.equal(typeof data.includedCount, "number");
  assert.equal(typeof data.excludedCount, "number");
  assert.ok(Array.isArray(data.excluded));
  await fs.unlink(outPath);
});

test("buildFsdImportReport includes geocodeFlags array", async () => {
  const csv = await fs.readFile(fsdFixture, "utf8");
  const report = buildFsdImportReport(csv);
  assert.ok(Array.isArray(report.geocodeFlags));
  assert.equal(typeof report.geocodeFlagCount, "number");
  assert.equal(report.geocodeFlagCount, report.geocodeFlags.length);
});

test("writeFsdGeocodeFlagsAudit writes JSON with expected top-level shape", async () => {
  const csv = await fs.readFile(fsdFixture, "utf8");
  const report = buildFsdImportReport(csv);
  const outPath = path.join(__dirname, ".tmp-fsd-geocode-flags-test.json");
  await writeFsdGeocodeFlagsAudit(outPath, report);
  const data = JSON.parse(await fs.readFile(outPath, "utf8"));
  assert.equal(typeof data.generatedAt, "string");
  assert.equal(typeof data.includedCount, "number");
  assert.equal(typeof data.geocodeFlagCount, "number");
  assert.ok(Array.isArray(data.geocodeFlags));
  for (const row of data.geocodeFlags) {
    assert.ok(Object.values(GEOCODE_QA_REASON).includes(row.reasonCode));
  }
  await fs.unlink(outPath);
});
