import test from "node:test";
import assert from "node:assert/strict";
import {
  UNDO_PUBLISH_CLOSED,
  UNDO_PUBLISH_NONE,
  UNDO_PUBLISH_STALE,
  UNDO_PUBLISH_WINDOW_MS,
  refuseUndoPublish,
  undoPublishAvailability,
} from "../editor-core/undo-publish.mjs";

const HOUR = 60 * 60 * 1000;

test("first-ever publish cannot be undone", () => {
  const availability = undoPublishAvailability({
    currentVersion: 1,
    lastEvent: {
      action: "publish",
      snapshotVersion: 1,
      previousVersion: null,
      createdAt: "2026-09-08T00:00:00.000Z",
    },
    now: Date.parse("2026-09-08T00:10:00.000Z"),
  });
  assert.equal(availability.canUndoPublish, false);
  assert.equal(refuseUndoPublish({ expectedVersion: 1, currentVersion: 1, availability }).message, UNDO_PUBLISH_NONE);
});

test("a publish with a previous snapshot is undoable within 24 hours", () => {
  const availability = undoPublishAvailability({
    currentVersion: 4,
    lastEvent: {
      action: "publish",
      snapshotVersion: 4,
      previousVersion: 3,
      createdAt: "2026-09-08T00:00:00.000Z",
    },
    now: Date.parse("2026-09-08T00:00:00.000Z") + 23 * HOUR,
  });
  assert.deepEqual(availability, {
    canUndoPublish: true,
    previousVersion: 3,
    undoPublishVersion: 4,
  });
  assert.equal(refuseUndoPublish({ expectedVersion: 4, currentVersion: 4, availability }).refuse, false);
});

test("the window closes at 24 hours and is not a client-side timer", () => {
  const publishedAt = Date.parse("2026-09-08T00:00:00.000Z");
  const lastEvent = {
    action: "publish",
    snapshotVersion: 4,
    previousVersion: 3,
    createdAt: new Date(publishedAt).toISOString(),
  };
  assert.equal(
    undoPublishAvailability({
      currentVersion: 4,
      lastEvent,
      now: publishedAt + UNDO_PUBLISH_WINDOW_MS - 1,
    }).canUndoPublish,
    true
  );
  const closed = undoPublishAvailability({
    currentVersion: 4,
    lastEvent,
    now: publishedAt + UNDO_PUBLISH_WINDOW_MS,
  });
  assert.equal(closed.canUndoPublish, false);
  assert.equal(
    refuseUndoPublish({ expectedVersion: 4, currentVersion: 4, availability: closed }).message,
    UNDO_PUBLISH_CLOSED
  );
});

test("a stale expected version is someone else's publish, not a silent rollback", () => {
  const availability = undoPublishAvailability({
    currentVersion: 5,
    lastEvent: {
      action: "publish",
      snapshotVersion: 5,
      previousVersion: 4,
      createdAt: "2026-09-08T00:10:00.000Z",
    },
    now: Date.parse("2026-09-08T00:20:00.000Z"),
  });
  const refused = refuseUndoPublish({
    expectedVersion: 4,
    currentVersion: 5,
    availability,
  });
  assert.equal(refused.refuse, true);
  assert.equal(refused.statusCode, 409);
  assert.equal(refused.message, UNDO_PUBLISH_STALE);
});

test("undoing a publish is not itself undoable", () => {
  const availability = undoPublishAvailability({
    currentVersion: 3,
    lastEvent: {
      action: "undo-publish",
      snapshotVersion: 4,
      previousVersion: 3,
      createdAt: "2026-09-08T00:20:00.000Z",
    },
    now: Date.parse("2026-09-08T00:21:00.000Z"),
  });
  assert.equal(availability.canUndoPublish, false);
  assert.equal(
    refuseUndoPublish({ expectedVersion: 3, currentVersion: 3, availability }).message,
    UNDO_PUBLISH_NONE
  );
});
