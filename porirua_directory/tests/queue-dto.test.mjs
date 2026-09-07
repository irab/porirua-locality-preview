import test from "node:test";
import assert from "node:assert/strict";
import {
  actionSuccessMessage,
  kindLabel,
  primaryActionLabel,
  queueDiffRows,
  queueItemDto,
  rejectActionLabel,
  reviewCountLabel,
  reviewFinishedLabel,
  statusLabel,
} from "../editor-core/queue-dto.mjs";

test("removed items use Take it off the site, not Accept", () => {
  assert.equal(primaryActionLabel("removed"), "Take it off the site");
  assert.equal(primaryActionLabel("changed"), "Accept");
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
  assert.equal(kindLabel("geocode_flag"), "Check the pin");
  assert.equal(statusLabel("published"), "On the site");
  assert.equal(statusLabel("hidden"), "Off the site");
  assert.equal(statusLabel("draft"), "Off the site");
  assert.equal(queueItemDto({ kind: "geocode_flag" }).kindLabel, "Check the pin");
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
    ["Name: Closed service", "Address: 1 Bedford Court"]
  );
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
});

test("success copy says what happens next", () => {
  assert.equal(
    actionSuccessMessage({ action: "approve", kind: "changed" }),
    "Accepted. It will go on the public site when you publish."
  );
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
