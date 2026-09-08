import test from "node:test";
import assert from "node:assert/strict";
import {
  actionSuccessMessage,
  deferActionLabel,
  finishedDecisionLabel,
  finishedWhenLabel,
  keepAsCommunityLabel,
  kindLabel,
  correctHeading,
  landingTab,
  queueLineLabel,
  needsConfirmationGroupLabel,
  needsConfirmationTabLabel,
  primaryActionLabel,
  queueDiffHighlight,
  listIdDelta,
  queueDiffRows,
  queueItemDto,
  queueItemHeading,
  queueSummaryLabel,
  recentQueueItemDto,
  rejectActionLabel,
  showRejectAction,
  reviewCountLabel,
  reviewDeferredFinishLabel,
  reviewFinishedLabel,
  reviewStatusBandLabel,
  statusLabel,
  waitingCountLabel,
} from "../editor-core/queue-dto.mjs";
import {
  actionSuccessMessage as moduleActionSuccessMessage,
  correctHeading as moduleCorrectHeading,
  landingTab as moduleLandingTab,
  queueItemHeading as moduleQueueItemHeading,
  queueLineLabel as moduleQueueLineLabel,
} from "../directus/extensions/directory-editor/src/module/copy.js";

test("removed items use Take it off the site, not Accept", () => {
  assert.equal(primaryActionLabel("removed"), "Take it off the site");
  assert.equal(primaryActionLabel("changed"), "Accept");
  assert.equal(primaryActionLabel("new"), "Accept");
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
  assert.equal(statusLabel("hidden"), "Not on the site");
  assert.equal(statusLabel("draft"), "Not on the site");
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

test("queue cards name the service line when it is not the organisation", () => {
  assert.equal(
    queueLineLabel({
      name: "Tenancy Services",
      lineTitle: "Dispute resolution service for tenants and landlords",
    }),
    "Dispute resolution service for tenants and landlords"
  );
  assert.equal(moduleQueueLineLabel({ name: "Tenancy Services", lineTitle: "Tenancy Services" }), "");
  assert.equal(queueLineLabel({ name: "KAPAI KIDZ", lineTitle: "kapai kidz" }), "");
  const twoLines = [
    queueItemDto(
      { kind: "changed", proposed: { before: { categories: ["housing"] }, after: { categories: ["housing", "legal"], name: "Tenancy Services" } } },
      { name: "Tenancy Services", title: "Dispute resolution service for tenants and landlords" }
    ),
    queueItemDto(
      { kind: "changed", proposed: { before: { categories: ["housing"] }, after: { categories: ["housing", "legal"], name: "Tenancy Services" } } },
      { name: "Tenancy Services", title: "Information, advice and templates on tenancy" }
    ),
  ];
  assert.equal(twoLines[0].name, "Tenancy Services");
  assert.equal(twoLines[1].name, "Tenancy Services");
  assert.notEqual(twoLines[0].lineLabel, twoLines[1].lineLabel);
  assert.equal(twoLines[0].lineLabel, "Dispute resolution service for tenants and landlords");
  assert.equal(
    queueItemDto({ kind: "changed", proposed: { after: { name: "KAPAI KIDZ" } } }, { name: "KAPAI KIDZ", title: "KAPAI KIDZ" })
      .lineLabel,
    ""
  );
});

test("landing opens Needs confirmation when only deferred work remains", () => {
  assert.equal(landingTab({ activeCount: 0, deferredCount: 3 }), "needs");
  assert.equal(moduleLandingTab({ activeCount: 0, deferredCount: 3 }), "needs");
  assert.equal(landingTab({ activeCount: 2, deferredCount: 1 }), "review");
  assert.equal(landingTab({ activeCount: 0, deferredCount: 0 }), "listings");
});

test("reject copy is kind-specific", () => {
  assert.equal(rejectActionLabel("new"), "Reject");
  assert.equal(rejectActionLabel("changed"), "Reject");
  assert.equal(rejectActionLabel("geocode_flag"), "Skip this pin check");
  assert.equal(showRejectAction("geocode_flag"), false);
  assert.equal(showRejectAction("changed"), true);
  assert.equal(queueItemDto({ kind: "geocode_flag" }).showRejectAction, false);
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

test("help type diffs mark only the types that were added or removed", () => {
  const rows = queueDiffRows({
    kind: "changed",
    before: { categories: ["health", "work"] },
    after: { categories: ["health", "work", "support"] },
  });
  assert.equal(
    rows[0].line,
    "Help types: Health, Work and learning → Health, Work and learning, Support and counselling"
  );
  assert.deepEqual(
    rows[0].highlight.after.filter((part) => part.mark === "added").map((part) => part.text),
    ["Support and counselling"]
  );
  assert.equal(
    rows[0].highlight.before.some((part) => part.mark === "removed"),
    false
  );
  assert.equal(rows[0].highlight.kind, "list");
});

test("help type diffs mark a type that left as well as a type that arrived", () => {
  const rows = queueDiffRows({
    kind: "changed",
    before: { categories: ["health", "legal"] },
    after: { categories: ["health", "support"] },
  });
  assert.deepEqual(
    rows[0].highlight.before.filter((part) => part.mark === "removed").map((part) => part.text),
    ["Legal advice"]
  );
  assert.deepEqual(
    rows[0].highlight.after.filter((part) => part.mark === "added").map((part) => part.text),
    ["Support and counselling"]
  );
});

test("scalar diffs mark the whole before and after instead of guessing a word delta", () => {
  const rows = queueDiffRows({
    kind: "changed",
    before: { phone: "04 237 7749" },
    after: { phone: "04 237 9608" },
  });
  assert.deepEqual(rows[0].highlight, {
    kind: "replace",
    before: [{ text: "04 237 7749", mark: "removed" }],
    after: [{ text: "04 237 9608", mark: "added" }],
  });
});

test("a category value that is not a list gets no guessed highlight", () => {
  assert.equal(
    queueDiffHighlight({
      field: "categories",
      beforeValue: "health, work",
      afterValue: ["health", "work", "support"],
      beforeText: "health, work",
      afterText: "Health, Work and learning, Support and counselling",
    }),
    null
  );
});

test("same help types in a different order do not invent a membership delta", () => {
  assert.equal(
    queueDiffHighlight({
      field: "categories",
      beforeValue: ["health", "work"],
      afterValue: ["work", "health"],
      beforeText: "Health, Work and learning",
      afterText: "Work and learning, Health",
    }),
    null
  );
  assert.equal(listIdDelta(["health", "work"], ["work", "health"]), null);
});

test("listIdDelta returns added and removed ids and refuses a non-list", () => {
  assert.deepEqual(listIdDelta(["health", "legal"], ["health", "support"]), {
    added: ["support"],
    removed: ["legal"],
  });
  assert.equal(listIdDelta("health, legal", ["health", "support"]), null);
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
  assert.deepEqual(dto.verifyComparePin, { lat: -41.2, lng: 174.9 });
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
    "Accepted. It stays unpublished until you publish."
  );
  assert.equal(
    actionSuccessMessage({
      action: "approve",
      kind: "changed",
      name: "Workmates Supported Employment Agency — Supported Employment Service",
    }),
    "Accepted Workmates Supported Employment Agency — Supported Employment Service. It stays unpublished until you publish."
  );
  assert.equal(
    actionSuccessMessage({ action: "defer" }),
    "Needs confirmation. It's waiting on the Needs confirmation tab."
  );
  assert.equal(
    actionSuccessMessage({ action: "defer", name: "Workmates Supported Employment Agency" }),
    "Needs confirmation. Workmates Supported Employment Agency is waiting on the Needs confirmation tab."
  );
  assert.equal(needsConfirmationTabLabel(0), "Needs confirmation");
  assert.equal(needsConfirmationTabLabel(2), "Needs confirmation (2)");
  assert.equal(
    correctHeading({ kind: "changed", name: "Capital & Coast DHB Rehabilitation Service" }),
    "Correcting Capital & Coast DHB Rehabilitation Service"
  );
  assert.equal(correctHeading({ kind: "geocode_flag", name: "KAPAI KIDZ" }), "Moving the pin for KAPAI KIDZ");
  assert.equal(
    correctHeading({
      kind: "changed",
      name: "Tenancy Services",
      lineLabel: "Dispute resolution service for tenants and landlords",
    }),
    "Correcting Tenancy Services — Dispute resolution service for tenants and landlords"
  );
  assert.equal(
    moduleCorrectHeading({
      kind: "geocode_flag",
      name: "Tenancy Services",
      lineLabel: "Information, advice and templates on tenancy",
    }),
    "Moving the pin for Tenancy Services — Information, advice and templates on tenancy"
  );
  assert.equal(
    actionSuccessMessage({ action: "keep-community" }),
    "Kept. This is now a community listing. Next week's government feed will not take it off."
  );
  assert.equal(actionSuccessMessage({ action: "keep" }), "Kept your details. They stay as you set them.");
  assert.equal(reviewDeferredFinishLabel(2), "You've decided the ones you can. 2 need confirmation.");
  assert.equal(waitingCountLabel(2), "2 unpublished");
  assert.equal(waitingCountLabel(0), "All published");
  assert.equal(
    actionSuccessMessage({ action: "reject", kind: "new" }),
    "Rejected. It will not go on the public site."
  );
  assert.equal(
    actionSuccessMessage({ action: "reject", kind: "new", name: "New Hub" }),
    "Rejected New Hub. It will not go on the public site."
  );
  assert.equal(
    actionSuccessMessage({ action: "reject", kind: "changed", name: "Workmates Supported Employment Agency" }),
    "Rejected the change to Workmates Supported Employment Agency. The listing stays as it is."
  );
  assert.equal(
    moduleActionSuccessMessage({ action: "reject", kind: "new", name: "New Hub" }),
    "Rejected New Hub. It will not go on the public site."
  );
  assert.equal(
    queueItemHeading({ name: "Workmates Supported Employment Agency", lineLabel: "Supported Employment Service" }),
    "Workmates Supported Employment Agency — Supported Employment Service"
  );
  assert.equal(
    moduleQueueItemHeading({ name: "Workmates Supported Employment Agency", lineLabel: "Supported Employment Service" }),
    "Workmates Supported Employment Agency — Supported Employment Service"
  );
  assert.equal(reviewCountLabel(4), "4 changes to review");
  assert.equal(
    reviewFinishedLabel(4),
    "You've reviewed everything. Put 4 changes on the public site."
  );
});

test("finished work names the decision in her words and keeps a path back to the listing", () => {
  assert.equal(finishedDecisionLabel({ action: "approve", kind: "changed" }), "Accepted this change");
  assert.equal(finishedDecisionLabel({ action: "keep", kind: "changed" }), "Kept yours");
  assert.equal(finishedDecisionLabel({ action: "reject", kind: "new" }), "Didn't add this");
  assert.equal(finishedDecisionLabel({ status: "rejected", kind: "changed" }), "Didn't use this change");
  const now = new Date("2026-09-08T07:32:00+12:00");
  assert.equal(finishedWhenLabel("2026-09-08T06:32:00.000Z", now), "Today, 6:32 pm");
  assert.equal(finishedWhenLabel("2026-09-07T04:10:00.000Z", now), "Yesterday, 4:10 pm");
  const dto = recentQueueItemDto({
    id: "q-done",
    kind: "changed",
    status: "accepted",
    updated_at: "2026-09-08T06:32:00.000Z",
    organization_id: "org-kelly",
    organization_name: "Kelly Sports Porirua",
    title: "After school sport",
    proposed: {
      editor_decision: { action: "approve", at: "2026-09-08T06:32:00.000Z" },
      before: { address: "Mana Esplanade" },
      after: { address: "3 Staithes Drive North", name: "Kelly Sports Porirua" },
    },
  });
  assert.equal(dto.name, "Kelly Sports Porirua");
  assert.equal(dto.lineLabel, "After school sport");
  assert.equal(dto.decisionLabel, "Accepted this change");
  assert.equal(dto.summaryLabel, "Address changed");
  assert.equal(dto.organizationId, "org-kelly");
  assert.equal(dto.listingLabel, "Open listing");
});
