import test from "node:test";
import assert from "node:assert/strict";
import { deferMarksEqual, proposalFingerprint } from "../editor-core/proposal-fingerprint.mjs";

const phoneChange = {
  kind: "changed",
  proposed: {
    after: { phone: "04 237 9608", address: "1 Street", lat: -41.1, lng: 174.8 },
    reviewable_fields: ["phone"],
    deferred_at: "2026-09-08T00:00:00.000Z",
  },
};

test("fingerprint ignores deferred_at, reviewable_fields, and import-run noise", () => {
  const other = {
    kind: "changed",
    proposed: {
      after: { phone: "04 237 9608", address: "1 Street", lat: -41.1, lng: 174.8 },
      import_run_id: "other-run",
    },
  };
  assert.equal(deferMarksEqual(phoneChange, other), true);
});

test("fingerprint changes when the visible phone changes", () => {
  const moved = {
    kind: "changed",
    proposed: { after: { phone: "04 111 0000", address: "1 Street", lat: -41.1, lng: 174.8 } },
  };
  assert.equal(deferMarksEqual(phoneChange, moved), false);
});

test("kind change is a different proposal even if after matches", () => {
  const removed = {
    kind: "removed",
    proposed: { after: phoneChange.proposed.after, auto_hide: false },
  };
  assert.equal(deferMarksEqual(phoneChange, removed), false);
});

test("pin-only change is visible", () => {
  const movedPin = {
    kind: "changed",
    proposed: { after: { phone: "04 237 9608", address: "1 Street", lat: -41.2, lng: 174.8 } },
  };
  assert.equal(deferMarksEqual(phoneChange, movedPin), false);
});

test("same numeric pin as string still matches", () => {
  const asString = {
    kind: "changed",
    proposed: {
      after: { phone: "04 237 9608", address: "1 Street", lat: "-41.1", lng: "174.8" },
    },
  };
  assert.equal(proposalFingerprint(phoneChange), proposalFingerprint(asString));
});
