import test from "node:test";
import assert from "node:assert/strict";
import { catalogCountPreflight } from "../scripts/directus/publish-preflight.mjs";

test("preflight reports a warning when published count moves by 15% or more", () => {
  const result = catalogCountPreflight({ published: 200 }, { published: 160 });
  assert.match(result.warning, /Large catalog delta/);
  assert.equal(result.delta.published, -40);
});

test("preflight is quiet for a small delta", () => {
  const result = catalogCountPreflight({ published: 200 }, { published: 198 });
  assert.equal(result.warning, null);
  assert.equal(result.delta.published, -2);
});
