import test from "node:test";
import assert from "node:assert/strict";
import { catalogToRows } from "../scripts/catalog-rows.mjs";
import { collapseFsdRows } from "../scripts/fsd-sync-collapse.mjs";
import {
  diffFsdCatalog,
  isIncludedCountBelowSanityThreshold,
} from "../scripts/fsd-sync-diff.mjs";
import {
  ORA_TOA_GEOCODE_TIEBREAK,
  SALVATION_ARMY_EMERGENCY_HOUSING,
  SINGLETON_FOODBANK,
  mapFsdFixtureRow,
} from "./fixtures/fsd-duplicate-service-id.mjs";
import { GEOCODE_QA_REASON } from "../scripts/fsd-geocode-qa.mjs";

function collapsedFrom(rows) {
  return collapseFsdRows(rows.map(mapFsdFixtureRow));
}

function fingerprintFields(row) {
  return {
    name: row.name,
    serviceName: row.serviceName,
    description: row.description,
    phone: row.phone,
    url: row.url,
    address: row.address,
    lat: row.lat,
    lng: row.lng,
    categories: [...(row.categories ?? [])],
  };
}

function dbRow(collapsed, overrides = {}) {
  const fields = fingerprintFields(collapsed);
  return {
    fsd_service_id: collapsed.SERVICE_ID,
    status: "published",
    raw_import: { ...fields },
    ...fields,
    overrides: [],
    ...overrides,
  };
}

function itemByService(items, serviceId) {
  return items.find((item) => item.serviceId === serviceId);
}

test("fingerprint matching raw_import is unchanged and is not a queue item", () => {
  const [incoming] = collapsedFrom(SALVATION_ARMY_EMERGENCY_HOUSING);
  const items = diffFsdCatalog([incoming], [dbRow(incoming)]);
  const item = itemByService(items, "37470");
  assert.equal(item.kind, "unchanged");
  assert.equal(item.proposed, undefined);
});

test("fingerprint differing from raw_import is changed with incoming values in proposed.after", () => {
  const [incoming] = collapsedFrom(SALVATION_ARMY_EMERGENCY_HOUSING);
  const existing = dbRow(incoming, {
    raw_import: {
      ...fingerprintFields(incoming),
      description: "Last accepted housing text",
      phone: "04 000 0000",
    },
    description: "Last accepted housing text",
    phone: "04 000 0000",
  });
  const items = diffFsdCatalog([incoming], [existing]);
  const item = itemByService(items, "37470");
  assert.equal(item.kind, "changed");
  assert.equal(item.proposed.after.description, incoming.description);
  assert.equal(item.proposed.after.phone, incoming.phone);
  assert.equal(existing.description, "Last accepted housing text");
  assert.equal(existing.phone, "04 000 0000");
});

test("community_owned skips removed and flags a returning SERVICE_ID", () => {
  const [incoming] = collapsedFrom([SINGLETON_FOODBANK]);
  const owned = dbRow(incoming, {
    fsd_service_id: "gone-then-back",
    overrides: [{ action: "community_owned", status: "open", patch: { awaiting_return: true } }],
  });
  const removed = diffFsdCatalog([], [owned]);
  assert.equal(
    removed.some((item) => item.serviceId === "gone-then-back"),
    false
  );

  const returned = dbRow(incoming, {
    overrides: [{ action: "community_owned", status: "open", patch: { awaiting_return: true } }],
  });
  const items = diffFsdCatalog([incoming], [returned]);
  const item = itemByService(items, incoming.SERVICE_ID);
  assert.equal(item.kind, "changed");
  assert.equal(item.proposed.fsd_returned, true);
});

test("community_owned after keep-yours does not re-queue an unchanged return", () => {
  const [incoming] = collapsedFrom([SINGLETON_FOODBANK]);
  const existing = dbRow(incoming, {
    overrides: [{ action: "community_owned", status: "open", patch: { awaiting_return: false } }],
  });
  const items = diffFsdCatalog([incoming], [existing]);
  const item = itemByService(items, incoming.SERVICE_ID);
  assert.equal(item.kind, "unchanged");
});

test("database row absent upstream is removed and never auto-hidden", () => {
  const [incoming] = collapsedFrom([SINGLETON_FOODBANK]);
  const orphan = dbRow(incoming, { fsd_service_id: "gone-service" });
  const items = diffFsdCatalog([incoming], [orphan]);
  const removed = itemByService(items, "gone-service");
  assert.equal(removed.kind, "removed");
  assert.equal(removed.proposed?.auto_hide, false);
  assert.notEqual(removed.proposed?.status, "hidden");
});

test("hidden status locks the row: incoming stays in proposed and is not auto-published", () => {
  const [incoming] = collapsedFrom(SALVATION_ARMY_EMERGENCY_HOUSING);
  const existing = dbRow(incoming, {
    status: "hidden",
    raw_import: { ...fingerprintFields(incoming), phone: "04 000 0000" },
  });
  const items = diffFsdCatalog([incoming], [existing]);
  const item = itemByService(items, "37470");
  assert.equal(item.kind, "changed");
  assert.equal(item.proposed.blocked_by_hidden, true);
  assert.equal(item.proposed.after.phone, incoming.phone);
  assert.equal(item.proposed.auto_publish, false);
});

test("open overrides hide is the same lock as status=hidden", () => {
  const [incoming] = collapsedFrom(SALVATION_ARMY_EMERGENCY_HOUSING);
  const existing = dbRow(incoming, {
    overrides: [{ type: "hide", status: "open" }],
    raw_import: { ...fingerprintFields(incoming), address: "Old address" },
  });
  const items = diffFsdCatalog([incoming], [existing]);
  const item = itemByService(items, "37470");
  assert.equal(item.proposed.blocked_by_hidden, true);
  assert.equal(item.proposed.after.address, incoming.address);
});

test("open overrides patch keeps the incoming field in proposed", () => {
  const [incoming] = collapsedFrom(SALVATION_ARMY_EMERGENCY_HOUSING);
  const existing = dbRow(incoming, {
    description: "Editor-approved wording",
    overrides: [{ type: "patch", field: "description", status: "open" }],
    raw_import: { ...fingerprintFields(incoming), description: "Old FSD wording" },
  });
  const items = diffFsdCatalog([incoming], [existing]);
  const item = itemByService(items, "37470");
  assert.equal(item.kind, "changed");
  assert.equal(item.proposed.after.description, incoming.description);
  assert.deepEqual(item.proposed.locked_fields, ["description"]);
  assert.equal(existing.description, "Editor-approved wording");
});

test("catalogToRows patch rows lock every key on patch, not a type/field pair", () => {
  const oraToa = {
    FSD_ID: "4690",
    SERVICE_ID: "2964",
    PROVIDER_NAME: "Porirua Respiritory Support group - Ora Toa",
    SERVICE_NAME: "Support group - Ora Toa",
    SERVICE_DETAIL: "Respiratory support group.",
    PUBLISHED_PHONE_1: "04 237 6892",
    PHYSICAL_DISTRICT: "Porirua City",
    PHYSICAL_ADDRESS: "",
    LATITUDE: "-41.080194",
    LONGITUDE: "174.760239",
    LEVEL_1_CATEGORY: "Health",
  };
  const [incoming] = collapsedFrom([oraToa]);
  const { overrides } = catalogToRows(
    { services: [] },
    {
      patches: {
        "fsd-2964": {
          address: "22 Ngāti Toa Street, Takapūwāhia, Porirua",
          lat: -41.1248,
          lng: 174.835605,
        },
      },
    }
  );
  assert.equal(overrides[0].action, "patch");
  assert.equal(overrides[0].type, undefined);
  assert.equal(overrides[0].field, undefined);

  const existing = dbRow(incoming, {
    address: "22 Ngāti Toa Street, Takapūwāhia, Porirua",
    lat: -41.1248,
    lng: 174.835605,
    overrides,
    raw_import: {
      ...fingerprintFields(incoming),
      address: "22 Ngāti Toa Street, Takapūwāhia, Porirua",
      lat: -41.1248,
      lng: 174.835605,
    },
  });
  const items = diffFsdCatalog([incoming], [existing]);
  const item = itemByService(items, "2964");
  assert.equal(item.kind, "changed");
  assert.deepEqual(
    [...item.proposed.locked_fields].sort(),
    ["address", "lat", "lng"]
  );
  assert.equal(item.proposed.after.address, incoming.address);
  assert.equal(existing.address, "22 Ngāti Toa Street, Takapūwāhia, Porirua");
});

test("catalogToRows hide rows lock the same way as status=hidden", () => {
  const [incoming] = collapsedFrom(SALVATION_ARMY_EMERGENCY_HOUSING);
  const { overrides } = catalogToRows(
    { services: [] },
    { hiddenIds: ["fsd-37470"], patches: {} }
  );
  assert.equal(overrides[0].action, "hide");
  const existing = dbRow(incoming, {
    overrides,
    raw_import: { ...fingerprintFields(incoming), phone: "04 000 0000" },
  });
  const items = diffFsdCatalog([incoming], [existing]);
  const item = itemByService(items, "37470");
  assert.equal(item.proposed.blocked_by_hidden, true);
  assert.equal(item.proposed.auto_publish, false);
});

test("editor edits to live fields do not re-queue when raw_import is unchanged", () => {
  const [incoming] = collapsedFrom(SALVATION_ARMY_EMERGENCY_HOUSING);
  const existing = dbRow(incoming, {
    name: "Salvation Army Porirua (editor title)",
    description: "Rewritten by an editor for plain language",
    phone: "04 111 1111",
  });
  const items = diffFsdCatalog([incoming], [existing]);
  const item = itemByService(items, "37470");
  assert.equal(item.kind, "unchanged");
  assert.equal(item.proposed, undefined);
});

test("missing raw_import is changed and flagged as a bootstrap gap", () => {
  const [incoming] = collapsedFrom(SALVATION_ARMY_EMERGENCY_HOUSING);
  const existing = dbRow(incoming, { raw_import: null });
  const items = diffFsdCatalog([incoming], [existing]);
  const item = itemByService(items, "37470");
  assert.equal(item.kind, "changed");
  assert.equal(item.proposed.missing_raw_import, true);
  assert.equal(item.proposed.after.name, incoming.name);
});

test("geocode flag on an otherwise unchanged row is a standalone geocode_flag item", () => {
  const marineOnly = [ORA_TOA_GEOCODE_TIEBREAK[0]];
  const [incoming] = collapsedFrom(marineOnly);
  assert.ok(incoming.lng < 174.78);
  const items = diffFsdCatalog([incoming], [dbRow(incoming)]);
  const item = itemByService(items, incoming.SERVICE_ID);
  assert.equal(item.kind, "geocode_flag");
  assert.equal(item.proposed.geocode_flag.code, GEOCODE_QA_REASON.GEOCODE_IN_MARINE_BBOX);
});

test("unmatched incoming SERVICE_ID is new with low match confidence", () => {
  const [incoming] = collapsedFrom([SINGLETON_FOODBANK]);
  const items = diffFsdCatalog([incoming], []);
  const item = itemByService(items, "9001-line-a");
  assert.equal(item.kind, "new");
  assert.equal(item.proposed.match_confidence, "low");
  assert.equal(item.proposed.after.SERVICE_ID, "9001-line-a");
});

test("matches database rows on SERVICE_ID only, never FSD_ID", () => {
  const [incoming] = collapsedFrom(SALVATION_ARMY_EMERGENCY_HOUSING);
  const wrongKey = dbRow(incoming, { fsd_service_id: incoming.FSD_ID });
  const items = diffFsdCatalog([incoming], [wrongKey]);
  assert.equal(itemByService(items, incoming.SERVICE_ID).kind, "new");
  assert.equal(itemByService(items, incoming.FSD_ID).kind, "removed");
});

test("exactly 75 of 100 is not below the sanity threshold", () => {
  assert.equal(isIncludedCountBelowSanityThreshold(75, 100), false);
  assert.notEqual(isIncludedCountBelowSanityThreshold(75, 100), true);
});

test("isIncludedCountBelowSanityThreshold is strict below 75%", () => {
  assert.equal(isIncludedCountBelowSanityThreshold(75, 100), false);
  assert.equal(isIncludedCountBelowSanityThreshold(74, 100), true);
  assert.equal(isIncludedCountBelowSanityThreshold(3, 4), false);
  assert.equal(isIncludedCountBelowSanityThreshold(2, 4), true);
  assert.equal(isIncludedCountBelowSanityThreshold(0, 100), true);
  assert.equal(isIncludedCountBelowSanityThreshold(10, 0), false);
  assert.equal(isIncludedCountBelowSanityThreshold(10, null), false);
});
