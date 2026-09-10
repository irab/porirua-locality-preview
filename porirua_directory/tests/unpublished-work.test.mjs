import test from "node:test";
import assert from "node:assert/strict";
import { unpublishedWork } from "../scripts/listings.mjs";

test("unpublished work is empty when envelopes match", () => {
  const envelope = { services: [{ id: "a", name: "Hub" }], counts: { community: 1 } };
  assert.deepEqual(unpublishedWork(envelope, { ...envelope }), {
    unpublishedCount: 0,
    unpublishedNames: [],
  });
});

test("unpublished work names organisations that moved or appeared", () => {
  const current = { services: [{ id: "a", name: "Hub", phone: "04 1" }] };
  const next = {
    services: [
      { id: "a", name: "Hub", phone: "04 2" },
      { id: "b", name: "New Place" },
    ],
  };
  const work = unpublishedWork(current, next);
  assert.equal(work.unpublishedCount, 2);
  assert.deepEqual(work.unpublishedNames, ["Hub", "New Place"]);
});
