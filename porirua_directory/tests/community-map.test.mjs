import test from "node:test";
import assert from "node:assert/strict";
import { mapCommunityRow } from "../scripts/lib/community-map.mjs";

function row(overrides = {}) {
  return {
    name: "Example Community Group",
    orgType: "Community Group",
    labels: "",
    initiatives: "",
    description: "",
    ...overrides,
  };
}

test("empty labels still tag Pātaka Kai from the organisation name", () => {
  const mapped = mapCommunityRow(row({ name: "Pātaka Kai" }));
  assert.ok(mapped.communityFilters.includes("kai_initiatives"));
});

test("Pātaka Art + Museum is not a kai initiative", () => {
  const mapped = mapCommunityRow(
    row({ name: "Pātaka Art + Museum", orgType: "Council / Government" })
  );
  assert.equal(mapped.communityFilters.includes("kai_initiatives"), false);
});

test("empty labels still tag kai initiatives from the initiatives column", () => {
  const mapped = mapCommunityRow(
    row({
      name: "Te Umu ki Rangituhi — Porirua's Social Supermarket",
      orgType: "Social Enterprise",
      initiatives: "Affordable, dignified kai access | Reducing stigma in food support",
    })
  );
  assert.ok(mapped.communityFilters.includes("kai_initiatives"));
});
