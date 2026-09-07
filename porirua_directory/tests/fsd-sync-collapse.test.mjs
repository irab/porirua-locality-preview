import test from "node:test";
import assert from "node:assert/strict";
import { collapseFsdRows } from "../scripts/fsd-sync-collapse.mjs";
import {
  ORA_TOA_GEOCODE_TIEBREAK,
  SALVATION_ARMY_EMERGENCY_HOUSING,
  SINGLETON_FOODBANK,
  SPARSE_EQUAL_SERVICE,
  mapFsdFixtureRow,
} from "./fixtures/fsd-duplicate-service-id.mjs";

function mapped(rows) {
  return rows.map(mapFsdFixtureRow);
}

function permute(items, order) {
  return order.map((i) => items[i]);
}

test("duplicate SERVICE_ID group collapses to the richest in-bounds winner", () => {
  const rows = mapped(SALVATION_ARMY_EMERGENCY_HOUSING);
  const [collapsed] = collapseFsdRows(rows);

  assert.equal(collapsed.SERVICE_ID, "37470");
  assert.equal(collapsed.FSD_ID, "40002");
  assert.equal(collapsed.fsd_service_id, "37470");
  assert.equal(collapsed.fsd_legacy_id, "40002");
  assert.notEqual(collapsed.fsd_service_id, collapsed.fsd_legacy_id);
  assert.equal(collapsed.id, "fsd-37470");
  assert.equal(collapsed.fsdServiceId, "40002");
  assert.equal(collapsed.sourceRowCount, 2);
  assert.deepEqual(collapsed.discardedFsdIds, ["40001"]);
  assert.match(collapsed.address, /Warspite Avenue/);
  assert.equal(collapsed.lat, -41.13684);
  assert.equal(collapsed.lng, 174.872683);
});

test("shuffling input order does not change collapsed output", () => {
  const rows = mapped([
    ...SALVATION_ARMY_EMERGENCY_HOUSING,
    SINGLETON_FOODBANK,
    ...SPARSE_EQUAL_SERVICE,
  ]);
  const baseline = collapseFsdRows(rows);
  const orders = [
    [2, 0, 4, 1, 3],
    [4, 3, 2, 1, 0],
    [1, 3, 0, 4, 2],
  ];
  for (const order of orders) {
    assert.deepEqual(collapseFsdRows(permute(rows, order)), baseline);
  }
});

test("categories are unioned across the SERVICE_ID group", () => {
  const [collapsed] = collapseFsdRows(mapped(SALVATION_ARMY_EMERGENCY_HOUSING));
  assert.ok(collapsed.categories.includes("housing"));
  assert.ok(collapsed.categories.includes("support"));
});

test("singleton groups pass through unchanged aside from collapse metadata", () => {
  const [only] = mapped([SINGLETON_FOODBANK]);
  const [collapsed] = collapseFsdRows([only]);
  assert.equal(collapsed.SERVICE_ID, "9001-line-a");
  assert.equal(collapsed.FSD_ID, "9001");
  assert.equal(collapsed.sourceRowCount, 1);
  assert.deepEqual(collapsed.discardedFsdIds, []);
  assert.equal(collapsed.name, only.name);
  assert.equal(collapsed.serviceName, only.serviceName);
  assert.equal(collapsed.description, only.description);
  assert.equal(collapsed.phone, only.phone);
  assert.deepEqual(collapsed.categories, only.categories);
});

test("equally sparse rows still resolve deterministically by lowest FSD_ID", () => {
  const rows = mapped(SPARSE_EQUAL_SERVICE);
  const [collapsed] = collapseFsdRows(rows);
  assert.equal(collapsed.FSD_ID, "8801");
  assert.deepEqual(collapsed.discardedFsdIds, ["8802"]);

  const reversed = collapseFsdRows([...rows].reverse());
  assert.equal(reversed[0].FSD_ID, "8801");
});

test("in-bounds geocode beats a marine-flagged pin when richness ties", () => {
  const [collapsed] = collapseFsdRows(mapped(ORA_TOA_GEOCODE_TIEBREAK));
  assert.equal(collapsed.FSD_ID, "4691");
  assert.equal(collapsed.lat, -41.1248);
  assert.equal(collapsed.lng, 174.835605);
  assert.deepEqual(collapsed.discardedFsdIds, ["4690"]);
});

test("collapse output keeps fsd_service_id and fsd_legacy_id distinct", () => {
  const [collapsed] = collapseFsdRows(mapped(SALVATION_ARMY_EMERGENCY_HOUSING));
  assert.equal(collapsed.fsd_service_id, collapsed.SERVICE_ID);
  assert.equal(collapsed.fsd_legacy_id, collapsed.FSD_ID);
  assert.equal(collapsed.fsdServiceId, collapsed.fsd_legacy_id);
  assert.notEqual(collapsed.fsd_service_id, collapsed.fsdServiceId);
});

test("groups by SERVICE_ID not FSD_ID", () => {
  const sharedFsdId = [
    {
      ...SINGLETON_FOODBANK,
      FSD_ID: "23604",
      SERVICE_ID: "37470",
    },
    {
      ...SINGLETON_FOODBANK,
      FSD_ID: "23604",
      SERVICE_ID: "37471",
      SERVICE_NAME: "Addiction: Bridge programme",
      LEVEL_1_CATEGORY: "Support",
    },
  ];
  const collapsed = collapseFsdRows(mapped(sharedFsdId));
  assert.equal(collapsed.length, 2);
  assert.deepEqual(
    collapsed.map((row) => row.SERVICE_ID).sort(),
    ["37470", "37471"]
  );
});
