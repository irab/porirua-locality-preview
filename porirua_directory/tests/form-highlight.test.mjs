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

test("unchanged form has no highlight and no focus steal", () => {
  const result = formHighlightFields({
    before: { name: "Same", phone: "04 1" },
    after: { name: "Same", phone: "04 1" },
  });
  assert.deepEqual(result.changed, []);
  assert.equal(result.focusField, null);
});
