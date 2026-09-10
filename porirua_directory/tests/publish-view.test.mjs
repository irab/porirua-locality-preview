import test from "node:test";
import assert from "node:assert/strict";
import { catalogCountPreflight } from "../scripts/directus/publish-preflight.mjs";
import { UNDO_PUBLISH_STALE } from "../editor-core/undo-publish.mjs";
import {
  largeDeltaState,
  parsePublishFailure,
  parseUndoFailure,
  publishBody,
  PUBLISH_COPY,
  PUBLISH_ROUTES,
  publisherHint,
  publishToastModel,
  thisHostCanPublishFromStatus,
  undoPublishBody,
  undoPublishToastModel,
} from "../editor-core/publish-view.mjs";

test("publish body never sends createdBy and only sets confirmLargeDelta for that one confirm", () => {
  const normal = publishBody();
  assert.deepEqual(normal, {});
  assert.equal("createdBy" in normal, false);
  assert.equal("user" in normal, false);
  assert.equal("confirmLargeDelta" in normal, false);

  const confirmed = publishBody({ confirmLargeDelta: true });
  assert.deepEqual(confirmed, { confirmLargeDelta: true });
  assert.equal("createdBy" in confirmed, false);
});

test("undo publish sends the version this tab believes is current", () => {
  assert.deepEqual(undoPublishBody({ undoPublishVersion: 12, currentVersion: 12 }), {
    expectedVersion: 12,
  });
  assert.deepEqual(undoPublishBody({ currentVersion: 4 }), { expectedVersion: 4 });
  assert.equal("createdBy" in undoPublishBody({ currentVersion: 4 }), false);
});

test("a 409 large-delta is a named band error, not a general confirmation dialog", () => {
  const preflight = catalogCountPreflight({ published: 200 }, { published: 160 });
  assert.match(preflight.warning, /Large catalog delta/);
  const failure = parsePublishFailure({
    status: 409,
    message: "Directory editor 409",
    data: { ok: false, blocked: true, preflight },
  });
  assert.equal(failure.kind, "large-delta");
  assert.equal(failure.message, preflight.warning);
  assert.equal(failure.confirmLabel, PUBLISH_COPY.confirmLargeDelta);
  assert.equal(failure.delta.published, -40);
  const band = largeDeltaState(failure);
  assert.equal(band.visible, true);
  assert.match(band.message, /200 → 160/);
  assert.equal(band.confirmLabel, "Publish this large change");
  assert.equal(largeDeltaState(parsePublishFailure({ message: "nope" })), null);
});

test("ordinary publish and undo failures stay errors, and stale undo keeps the two-editor copy", () => {
  const failed = parsePublishFailure({
    status: 500,
    message: "cache purge failed",
    data: { error: "cache purge failed" },
  });
  assert.equal(failed.kind, "error");
  assert.equal(failed.message, "cache purge failed");

  const stale = parseUndoFailure({
    status: 409,
    data: { error: UNDO_PUBLISH_STALE },
  });
  assert.equal(stale.kind, "conflict");
  assert.equal(stale.message, UNDO_PUBLISH_STALE);
});

test("publish toast offers undo only when the server still can, and first-ever publish does not", () => {
  const withUndo = publishToastModel({ canUndoPublish: true });
  assert.equal(withUndo.message, "Published. The public site is up to date.");
  assert.equal(withUndo.undoPublish, true);
  assert.equal(withUndo.undoFirst, true);
  assert.equal(withUndo.undoLabel, "Undo publish");
  assert.equal(withUndo.role, "status");

  const first = publishToastModel({ canUndoPublish: false });
  assert.equal(first.undoPublish, false);
  assert.equal(first.undoFirst, false);

  const undone = undoPublishToastModel();
  assert.equal(undone.message, "Publish undone. Those changes are unpublished again.");
  assert.equal(undone.undoPublish, false);
});

test("Payload consumes publish-status fields and does not invent the waiting count", () => {
  assert.equal(PUBLISH_ROUTES.status, "/publish-status");
  assert.equal(PUBLISH_ROUTES.publish, "/publish");
  assert.equal(PUBLISH_ROUTES.undoPublish, "/undo-publish");
  assert.equal(thisHostCanPublishFromStatus({ thisHostCanPublish: false }), false);
  assert.equal(thisHostCanPublishFromStatus({ thisHostCanPublish: true }), true);
  assert.equal(thisHostCanPublishFromStatus({}), true);
  assert.equal(
    publisherHint({ thisHostCanPublish: false, catalogPublisher: "directus" }),
    "Publish lives on admin-directory-dev.bsky.nz."
  );
  assert.equal(publisherHint({ thisHostCanPublish: true, catalogPublisher: "directus" }), "");
});
