import test from "node:test";
import assert from "node:assert/strict";
import { formHighlightFields } from "../editor-core/form-highlight.mjs";

test("highlights only the fields the proposal changed and focuses the first", () => {
  const result = formHighlightFields({
    before: { name: "Ora Toa", phone: "04 237 7749", address: "Old street", url: "https://a.example" },
    after: { name: "Ora Toa", phone: "04 237 9608", address: "Old street", url: "https://a.example" },
  });
  assert.deepEqual(
    result.changed.map((row) => row.field),
    ["phone"]
  );
  assert.equal(result.changed[0].mark, "Changed in this update");
  assert.equal(result.focusField, "phone");
  assert.equal(result.focusOption, null);
  assert.deepEqual(result.youSetThis, []);
});

test("keeps You set this earlier on a curated changed field", () => {
  const result = formHighlightFields({
    before: { address: "22 Ngāti Toa Street", lat: -41.12, lng: 174.83, phone: "04 1" },
    after: { address: "FSD third street", lat: -41.08, lng: 174.76, phone: "04 1" },
    locked: ["address", "lat", "lng"],
  });
  assert.ok(result.changed.some((row) => row.field === "address"));
  assert.deepEqual(
    result.youSetThis.map((row) => row.label),
    ["Address", "Map pin"]
  );
  assert.equal(result.focusField, "address");
});

test("plain edit marks curated fields even when nothing changed this visit", () => {
  const result = formHighlightFields({
    locked: ["address", "lat", "lng", "phone"],
    alwaysMarkLocked: true,
  });
  assert.deepEqual(result.changed, []);
  assert.deepEqual(
    result.youSetThis.map((row) => row.label),
    ["Address", "Map pin", "Phone"]
  );
});

test("unchanged form has no highlight and no focus steal", () => {
  const result = formHighlightFields({
    before: { name: "Same", phone: "04 1" },
    after: { name: "Same", phone: "04 1" },
  });
  assert.deepEqual(result.changed, []);
  assert.equal(result.focusField, null);
  assert.equal(result.focusOption, null);
});

test("help types mark the added and removed ids and focus the first added option", () => {
  const result = formHighlightFields({
    before: { categories: ["health", "work"] },
    after: { categories: ["health", "work", "support"] },
  });
  assert.deepEqual(result.changed, [
    {
      field: "categories",
      label: "Help types",
      mark: "Changed in this update",
      added: ["support"],
      removed: [],
    },
  ]);
  assert.equal(result.focusField, "categories");
  assert.equal(result.focusOption, "support");
});

test("help types that cannot be compared as id lists keep a field mark and do not guess options", () => {
  const result = formHighlightFields({
    before: { categories: "health, work" },
    after: { categories: ["health", "work", "support"] },
  });
  assert.deepEqual(result.changed, [
    {
      field: "categories",
      label: "Help types",
      mark: "Changed in this update",
    },
  ]);
  assert.equal(result.changed[0].added, undefined);
  assert.equal(result.changed[0].removed, undefined);
  assert.equal(result.focusOption, null);
});

test("help types that only lost an option focus the first removed checkbox", () => {
  const result = formHighlightFields({
    before: { categories: ["health", "legal"] },
    after: { categories: ["health"] },
  });
  assert.deepEqual(result.changed[0].removed, ["legal"]);
  assert.deepEqual(result.changed[0].added, []);
  assert.equal(result.focusOption, "legal");
});

test("community groups use the same added and removed option marks", () => {
  const result = formHighlightFields({
    before: { communityFilters: ["schools"] },
    after: { community_filters: ["schools", "kai_initiatives"] },
  });
  assert.deepEqual(result.changed, [
    {
      field: "communityFilters",
      label: "Community groups",
      mark: "Changed in this update",
      added: ["kai_initiatives"],
      removed: [],
    },
  ]);
  assert.equal(result.focusOption, "kai_initiatives");
});
