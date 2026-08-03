import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isPoriruaRelevant, mapFsdRowToService } from "../scripts/fsd-porirua-rules.mjs";
import { importFsdFromCsv } from "../scripts/fsd-import.mjs";

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
  assert.equal(s.id.startsWith("fsd-"), true);
});

test("importFsdFromCsv filters fixture to Porirua-relevant rows", async () => {
  const csv = await fs.readFile(fsdFixture, "utf8");
  const services = importFsdFromCsv(csv);
  assert.equal(services.length, 2);
  assert.ok(services.every((s) => s.source === "fsd"));
});
