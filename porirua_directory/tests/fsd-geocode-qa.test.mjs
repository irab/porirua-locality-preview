import test from "node:test";
import assert from "node:assert/strict";
import {
  assessFsdRowGeocode,
  GEOCODE_QA_REASON,
  isInGeoBox,
  PORIRUA_GEO_BOUNDS,
} from "../scripts/fsd-geocode-qa.mjs";

test("legitimate Porirua City coordinates pass geocode QA", () => {
  assert.equal(
    assessFsdRowGeocode({
      LATITUDE: "-41.136116",
      LONGITUDE: "174.838977",
      PHYSICAL_DISTRICT: "Porirua City",
    }),
    null
  );
});

test("Ora Toa respiratory FSD offshore coords flag marine bbox", () => {
  const assessment = assessFsdRowGeocode({
    FSD_ID: "4690",
    PROVIDER_NAME: "Porirua Respiritory Support group - Ora Toa",
    PHYSICAL_DISTRICT: "Porirua City",
    PHYSICAL_ADDRESS: "",
    LATITUDE: "-41.080194",
    LONGITUDE: "174.760239",
  });
  assert.ok(assessment);
  assert.equal(assessment.code, GEOCODE_QA_REASON.GEOCODE_IN_MARINE_BBOX);
});

test("coordinates outside Porirua bounds but not marine box flag bounds", () => {
  const assessment = assessFsdRowGeocode({
    LATITUDE: "-41.29",
    LONGITUDE: "174.95",
    PHYSICAL_DISTRICT: "Porirua City",
  });
  assert.ok(assessment);
  assert.equal(assessment.code, GEOCODE_QA_REASON.GEOCODE_OUTSIDE_PORIRUA_BOUNDS);
});

test("missing coordinates are not flagged", () => {
  assert.equal(
    assessFsdRowGeocode({ PHYSICAL_DISTRICT: "Porirua City", LATITUDE: "", LONGITUDE: "" }),
    null
  );
});

test("western Porirua coast coords inside bounds (174.781)", () => {
  assert.equal(
    assessFsdRowGeocode({
      LATITUDE: "-41.0891",
      LONGITUDE: "174.781",
      PHYSICAL_DISTRICT: "Porirua City",
    }),
    null
  );
  assert.equal(isInGeoBox(-41.0891, 174.781, PORIRUA_GEO_BOUNDS), true);
});
