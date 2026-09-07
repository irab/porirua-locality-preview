import test from "node:test";
import assert from "node:assert/strict";
import {
  actionSuccessMessage,
  deferActionLabel,
  keepAsCommunityLabel,
  kindLabel,
  needsConfirmationGroupLabel,
  primaryActionLabel,
  queueDiffRows,
  queueItemDto,
  queueSummaryLabel,
  rejectActionLabel,
  reviewCountLabel,
  reviewDeferredFinishLabel,
  reviewFinishedLabel,
  reviewStatusBandLabel,
  statusLabel,
  waitingCountLabel,
} from "../editor-core/queue-dto.mjs";

test("removed items use Take it off the site, not Accept", () => {
  assert.equal(primaryActionLabel("removed"), "Take it off the site");
  assert.equal(primaryActionLabel("changed"), "Accept this change");
  assert.equal(keepAsCommunityLabel(), "Keep it as a community listing");
  assert.equal(deferActionLabel(), "Needs confirmation");
  assert.equal(needsConfirmationGroupLabel(2), "Needs confirmation (2)");
  assert.equal(queueItemDto({ kind: "removed", id: "q1" }).primaryActionLabel, "Take it off the site");
});

test("queue DTO exposes you-set-this on reviewable locked fields", () => {
  const dto = queueItemDto({
    id: "q2",
    kind: "changed",
    entity_id: "fsd-1",
    proposed: {
      locked_fields: ["address", "phone"],
      reviewable_fields: ["address"],
      before: { address: "Old" },
      after: { address: "New government" },
    },
  });
  assert.deepEqual(dto.youSetThis, [{ field: "address", label: "Address" }]);
  assert.equal(dto.name, "");
  assert.equal(dto.after.address, "New government");
});

test("kind and status never stay as raw enums", () => {
  assert.equal(kindLabel("changed"), "Details changed");
  assert.equal(kindLabel("new"), "New service");
  assert.equal(kindLabel("removed"), "Gone from the government list");
  assert.equal(kindLabel("geocode_flag"), "Check the map pin");
  assert.equal(statusLabel("published"), "On the site");
  assert.equal(statusLabel("hidden"), "Off the site");
  assert.equal(statusLabel("draft"), "Off the site");
  assert.equal(queueItemDto({ kind: "geocode_flag" }).kindLabel, "Check the map pin");
});

test("closed-row summary names the fields that moved", () => {
  assert.equal(queueSummaryLabel({ kind: "new" }), "New service");
  assert.equal(queueSummaryLabel({ kind: "removed" }), "Gone from the government list");
  assert.equal(
    queueSummaryLabel({
      kind: "changed",
      diffRows: [
        { field: "phone", label: "Phone" },
        { field: "address", label: "Address" },
      ],
    }),
    "Phone and address changed"
  );
  assert.equal(
    queueItemDto({
      kind: "changed",
      proposed: {
        before: { phone: "04 1", address: "Old" },
        after: { phone: "04 2", address: "New" },
      },
    }).summaryLabel,
    "Phone and address changed"
  );
});

test("reject copy is kind-specific", () => {
  assert.equal(rejectActionLabel("new"), "Don't add this");
  assert.equal(rejectActionLabel("changed"), "Don't use this change");
  assert.equal(rejectActionLabel("geocode_flag"), "Skip this pin check");
});

test("changed diff is field-by-field in Moana's words and skips unchanged fields", () => {
  const rows = queueDiffRows({
    kind: "changed",
    before: { phone: "04 237 7749", address: "Same street", name: "Ora Toa" },
    after: { phone: "04 237 9608", address: "Same street", name: "Ora Toa" },
  });
  assert.deepEqual(
    rows.map((row) => row.line),
    ["Phone: 04 237 7749 → 04 237 9608"]
  );
  assert.equal(
    rows.some((row) => /lat|lng|-41|174/.test(row.line)),
    false
  );
});

test("new diff shows added fields with no left-hand side", () => {
  const rows = queueDiffRows({
    kind: "new",
    before: {},
    after: { name: "New Hub", phone: "04 111 0000", lat: -41.1, lng: 174.8 },
  });
  assert.deepEqual(
    rows.map((row) => row.line),
    ["Name: New Hub", "Phone: 04 111 0000"]
  );
});

test("removed diff shows what is coming off the site", () => {
  const rows = queueDiffRows({
    kind: "removed",
    before: { name: "Closed service", address: "1 Bedford Court" },
    after: {},
  });
  assert.deepEqual(
    rows.map((row) => row.line),
    [
      "Name is coming off the site: Closed service",
      "Address is coming off the site: 1 Bedford Court",
    ]
  );
});

test("a pin check has no field list — the map is the card", () => {
  const dto = queueItemDto(
    {
      kind: "geocode_flag",
      proposed: { geocode_flag: "sea" },
    },
    {
      name: "Literacy Aotearoa",
      title: "Literacy Aotearoa – Upper Hutt",
      phone: "04 111 0000",
      address: "1 Old Street",
    }
  );
  assert.deepEqual(dto.diffRows, []);
  assert.equal(dto.summaryLabel, "Check the map pin");
  assert.equal(
    dto.diffRows.some((row) => row.line.includes("→")),
    false
  );
});

test("changed rows skip a field when after is missing that key", () => {
  const rows = queueDiffRows({
    kind: "changed",
    before: {
      name: "Workmates",
      title: "Supported Employment Service",
      categories: ["support"],
    },
    after: {
      name: "Workmates",
      categories: ["food"],
    },
  });
  assert.deepEqual(
    rows.map((row) => row.line),
    ["Help types: Support and counselling → Food / kai"]
  );
  assert.equal(
    rows.some((row) => /Supported Employment|→ —/.test(row.line)),
    false
  );
});

test("changed rows keep a real name change when both sides have a name", () => {
  const rows = queueDiffRows({
    kind: "changed",
    before: { title: "Supported Employment Service", categories: ["support"] },
    after: { serviceName: "Supported employment", categories: ["support"] },
  });
  assert.deepEqual(
    rows.map((row) => row.line),
    ["Service name: Supported Employment Service → Supported employment"]
  );
});

test("review counts use the active list, not pending-including-deferred", () => {
  const items = [
    { deferred: false },
    { deferred: false },
    { deferred: true },
  ];
  assert.equal(reviewStatusBandLabel(items), "2 changes to review");
  assert.equal(reviewStatusBandLabel([{ deferred: true }]), "1 needs confirmation");
  assert.equal(reviewCountLabel(0), "Nothing to review");
});

test("you-set-this appears for a curated locked field even without reviewable_fields", () => {
  const dto = queueItemDto(
    {
      kind: "changed",
      proposed: {
        locked_fields: ["address", "lat", "lng"],
        after: {
          address: "FSD third street",
          lat: -41.08,
          lng: 174.76,
        },
      },
    },
    {
      address: "22 Ngāti Toa Street, Takapūwāhia, Porirua",
      lat: -41.1248,
      lng: 174.835605,
    }
  );
  assert.ok(dto.diffRows.some((row) => row.line.startsWith("Address:")));
  assert.deepEqual(
    dto.youSetThis.map((row) => row.label),
    ["Address", "Map pin"]
  );
  assert.equal(dto.showPin, true);
});

test("editor before prefers the live listing over the queued snapshot", () => {
  const dto = queueItemDto(
    {
      kind: "changed",
      proposed: {
        before: { phone: "04 111 0000", address: "Queued street" },
        after: { phone: "04 237 9608", address: "New Street" },
      },
    },
    { phone: "04 237 7749", address: "Live street" }
  );
  assert.equal(dto.before.phone, "04 237 7749");
  assert.equal(dto.before.address, "Live street");
  assert.equal(dto.queuedBefore.phone, "04 111 0000");
  assert.ok(dto.diffRows.some((row) => row.line === "Phone: 04 237 7749 → 04 237 9608"));
});

test("queue DTO fills before from the live listing when weekly sync omitted it", () => {
  const dto = queueItemDto(
    {
      id: "q3",
      kind: "changed",
      proposed: {
        after: { phone: "04 237 9608", address: "New Street", lat: -41.2, lng: 174.9 },
      },
    },
    { phone: "04 237 7749", address: "Old Street", lat: -41.1, lng: 174.8 }
  );
  assert.equal(dto.before.phone, "04 237 7749");
  assert.ok(dto.diffRows.some((row) => row.line === "Phone: 04 237 7749 → 04 237 9608"));
  assert.equal(dto.showPin, true);
  assert.deepEqual(dto.pin, { lat: -41.2, lng: 174.9 });
  assert.equal(dto.currentAddress, "Old Street");
  assert.equal(dto.verifyAddressNote, "On the site now");
  assert.deepEqual(dto.verifyPin, { lat: -41.1, lng: 174.8 });
});

test("new items do not treat the already-inserted live row as a before side", () => {
  const dto = queueItemDto(
    {
      kind: "new",
      proposed: { after: { name: "Brand new", phone: "04 000" } },
    },
    { name: "Brand new", phone: "04 000" }
  );
  assert.deepEqual(dto.before, {});
  assert.deepEqual(dto.queuedBefore, {});
  assert.ok(dto.diffRows.some((row) => row.line === "Name: Brand new"));
  assert.equal(dto.verifyAddressNote, "");
});

test("success copy says what happens next", () => {
  assert.equal(
    actionSuccessMessage({ action: "approve", kind: "changed" }),
    "Accepted. It will go on the public site when you publish."
  );
  assert.equal(actionSuccessMessage({ action: "defer" }), "Needs confirmation. It stays in Review.");
  assert.equal(
    actionSuccessMessage({ action: "keep-community" }),
    "Kept. This is now a community listing. Next week's government feed will not take it off."
  );
  assert.equal(actionSuccessMessage({ action: "keep" }), "Kept your details. They stay as you set them.");
  assert.equal(reviewDeferredFinishLabel(2), "You've decided the ones you can. 2 need confirmation.");
  assert.equal(waitingCountLabel(2), "2 waiting to go on the site");
  assert.equal(
    actionSuccessMessage({ action: "reject", kind: "new" }),
    "Not added. It will not go on the public site."
  );
  assert.equal(reviewCountLabel(4), "4 changes to review");
  assert.equal(
    reviewFinishedLabel(4),
    "You've reviewed everything. Put 4 changes on the public site."
  );
});
