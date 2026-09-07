import test from "node:test";
import assert from "node:assert/strict";
import {
  shouldQueueDiffItem,
  shouldQueueDiffItemThreeWay,
  threeWayQueuedFields,
} from "../scripts/fsd-sync-run.mjs";
import { summarizeLockRuleDelta } from "../scripts/lock-rule-dry-run.mjs";

const lockedItem = {
  kind: "changed",
  proposed: {
    after: { address: "FSD address", lat: -41.08, lng: 174.76, categories: ["health"] },
    locked_fields: ["address", "lat", "lng"],
  },
};

const rawImport = {
  address: "22 Ngāti Toa Street, Takapūwāhia, Porirua",
  lat: -41.1248,
  lng: 174.835605,
  categories: ["health"],
};

test("today's rule still skips locked-field-only drift (not enabled yet)", () => {
  assert.equal(shouldQueueDiffItem(lockedItem, { raw_import: rawImport }), false);
});

test("three-way queues a locked field when incoming is a third value", () => {
  const patch = { address: "Editor street", lat: -41.12, lng: 174.83 };
  assert.equal(shouldQueueDiffItemThreeWay(lockedItem, { raw_import: rawImport }, patch), true);
  assert.deepEqual(
    threeWayQueuedFields(lockedItem, { raw_import: rawImport }, patch).sort(),
    ["address", "lat", "lng"]
  );
});

test("three-way does not queue when incoming matches the editor patch", () => {
  const patch = { address: "FSD address", lat: -41.08, lng: 174.76 };
  assert.equal(shouldQueueDiffItemThreeWay(lockedItem, { raw_import: rawImport }, patch), false);
  assert.deepEqual(threeWayQueuedFields(lockedItem, { raw_import: rawImport }, patch), []);
});

test("three-way does not queue when incoming matches raw_import (already ruled on)", () => {
  const item = {
    kind: "changed",
    proposed: {
      after: { ...rawImport },
      locked_fields: ["address"],
    },
  };
  assert.equal(
    shouldQueueDiffItemThreeWay(item, { raw_import: rawImport }, { address: "Editor street" }),
    false
  );
});

test("dry-run summary counts items today's rule suppresses that three-way would queue", () => {
  const items = [
    {
      kind: "changed",
      serviceId: "2964",
      proposed: lockedItem.proposed,
    },
  ];
  const dbRows = [{ id: "fsd-2964", fsd_service_id: "2964", raw_import: rawImport }];
  const patches = new Map([["fsd-2964", { address: "Editor street", lat: -41.12, lng: 174.83 }]]);
  const summary = summarizeLockRuleDelta(items, dbRows, patches);
  assert.equal(summary.newlyQueued, 1);
  assert.ok(summary.byField.address >= 1);
});

test("three-way still queues unlocked field drift", () => {
  const item = {
    kind: "changed",
    proposed: {
      after: { ...rawImport, categories: ["food"] },
      locked_fields: ["address"],
    },
  };
  assert.equal(
    shouldQueueDiffItemThreeWay(item, { raw_import: rawImport }, { address: "Editor street" }),
    true
  );
  assert.deepEqual(threeWayQueuedFields(item, { raw_import: rawImport }, { address: "Editor street" }), [
    "categories",
  ]);
});
