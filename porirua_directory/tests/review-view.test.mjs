import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { formHighlightFields } from "../editor-core/form-highlight.mjs";
import { queueItemDto, reviewCountLabel } from "../editor-core/queue-dto.mjs";
import {
  REVIEW_COPY,
  REVIEW_INBOX,
  REVIEW_ROUTES,
  correctionFormHighlight,
  correctionFormValues,
  correctionTitle,
  focusAfterReviewDecision,
  headingButtonName,
  nextActiveAfterDecision,
  otherDetailsLabel,
  queueActionUndoId,
  removalActionsAreEqual,
  reviewActionButtons,
  reviewDecisionBody,
  reviewFinishModel,
  reviewToast,
  reviewUndoBody,
  reviewVerificationSource,
  shouldAutoOpenItem,
  splitQueueItems,
  tabAfterUndo,
  toastName,
  visibleRecent,
} from "../editor-core/review-view.mjs";

const oraToa = queueItemDto(
  {
    id: "q-ora",
    kind: "changed",
    proposed: {
      locked_fields: ["address", "lat", "lng"],
      before: {
        address: "22 Ngāti Toa Street, Takapūwāhia, Porirua",
        phone: "04 237 7749",
      },
      after: {
        name: "Support group - Ora Toa",
        address: "FSD third street",
        phone: "04 237 7749",
        lat: -41.08,
        lng: 174.76,
        url: "https://oratoa.example",
      },
    },
  },
  {
    name: "Support group - Ora Toa",
    title: "Support group - Ora Toa",
    address: "22 Ngāti Toa Street, Takapūwāhia, Porirua",
    phone: "04 237 7749",
    lat: -41.1248,
    lng: 174.835605,
    url: "https://oratoa.example",
  }
);

test("inbox is review_queue_items and every Review write has a named route", () => {
  assert.equal(REVIEW_INBOX, "review_queue_items");
  assert.deepEqual(
    Object.values(REVIEW_ROUTES).sort(),
    [
      "/approve",
      "/defer",
      "/edit-and-approve",
      "/hide",
      "/keep-community",
      "/keep-curation",
      "/queue",
      "/reject",
      "/review-undo",
    ].sort()
  );
  const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../editor-core/review-view.mjs"), "utf8");
  assert.equal(source.includes("pending_review"), false);
});

test("changed cards expose Keep yours only when she curated a drifted field", () => {
  const withLock = reviewActionButtons(oraToa);
  assert.deepEqual(
    withLock.map((row) => row.id),
    ["approve", "keep", "edit", "reject", "defer"]
  );
  assert.equal(withLock.find((row) => row.id === "keep").route, "/keep-curation");
  assert.equal(withLock.find((row) => row.id === "edit").opensForm, true);
  assert.equal(
    reviewActionButtons({ kind: "changed", youSetThis: [], showRejectAction: true }).some((row) => row.id === "keep"),
    false
  );
});

test("new service is Accept / Reject / Needs confirmation", () => {
  assert.deepEqual(
    reviewActionButtons({ kind: "new", primaryActionLabel: "Accept", showRejectAction: true }).map((row) => row.label),
    ["Accept", "Reject", "Needs confirmation"]
  );
});

test("gone-from-FSD actions are equal weight and neither is a keyboard default", () => {
  const buttons = reviewActionButtons({
    kind: "removed",
    primaryActionLabel: "Take it off the site",
    keepAsCommunityLabel: "Keep it as a community listing",
    deferActionLabel: "Needs confirmation",
  });
  assert.deepEqual(
    buttons.map((row) => row.label),
    ["Take it off the site", "Keep it as a community listing", "Needs confirmation"]
  );
  assert.equal(removalActionsAreEqual(buttons), true);
  assert.equal(
    buttons.some((row) => row.keyboardDefault),
    false
  );
  assert.equal(buttons.find((row) => row.id === "hide").route, "/hide");
  assert.equal(buttons.find((row) => row.id === "keep-community").route, "/keep-community");
});

test("pin check is pin-is-fine / move the pin / Needs confirmation, with no Reject", () => {
  const buttons = reviewActionButtons({
    kind: "geocode_flag",
    primaryActionLabel: "The pin is fine",
    showRejectAction: false,
  });
  assert.deepEqual(
    buttons.map((row) => row.label),
    ["The pin is fine", "I'll move the pin", "Needs confirmation"]
  );
  assert.equal(
    buttons.some((row) => /reject|skip/i.test(row.label)),
    false
  );
  assert.equal(buttons.find((row) => row.id === "edit").opensForm, true);
});

test("already-deferred items keep the decision buttons but not a second Needs confirmation", () => {
  const buttons = reviewActionButtons({
    kind: "changed",
    deferred: true,
    youSetThis: [],
    showRejectAction: true,
    primaryActionLabel: "Accept",
  });
  assert.equal(
    buttons.some((row) => row.id === "defer"),
    false
  );
  assert.equal(
    buttons.some((row) => row.id === "approve"),
    true
  );
});

test("auto-advance is the first remaining active item on Review, never a deferred card", () => {
  const active = [
    { id: "a", deferred: false },
    { id: "b", deferred: false },
  ];
  assert.equal(nextActiveAfterDecision({ tab: "review", activeItems: active }).id, "a");
  assert.equal(nextActiveAfterDecision({ tab: "needs", activeItems: active }), null);
  assert.equal(shouldAutoOpenItem("review", active[0]), true);
  assert.equal(shouldAutoOpenItem("needs", { id: "d", deferred: true }), false);
  assert.equal(shouldAutoOpenItem("review", { id: "d", deferred: true }), false);
});

test("after a decision, focus is the next heading button, not Accept", () => {
  const focus = focusAfterReviewDecision({ nextItem: { id: "next", deferred: false } });
  assert.equal(focus.type, "heading");
  assert.equal(focus.itemId, "next");
  assert.equal(focus.control, "heading");
  assert.notEqual(focus.control, "accept");
  assert.equal(focusAfterReviewDecision({ finish: true }).type, "finish");
});

test("finish state only after she worked this session; Needs confirmation never auto-finishes Review", () => {
  assert.equal(reviewFinishModel({ activeCount: 2, reviewedThisSession: 1 }).kind, "queue");
  assert.equal(reviewFinishModel({ activeCount: 0, reviewedThisSession: 0 }).kind, "empty");
  assert.equal(reviewFinishModel({ activeCount: 0, reviewedThisSession: 0 }).message, REVIEW_COPY.empty);
  const done = reviewFinishModel({
    activeCount: 0,
    deferredCount: 0,
    reviewedThisSession: 4,
    unpublishedCount: 4,
  });
  assert.equal(done.kind, "finish");
  assert.match(done.heading, /You've reviewed everything/);
  assert.equal(done.showPublishNow, true);
  const parked = reviewFinishModel({
    activeCount: 0,
    deferredCount: 2,
    reviewedThisSession: 2,
    unpublishedCount: 2,
  });
  assert.match(parked.heading, /2 need confirmation/);
  assert.equal(parked.showKeepReviewingLater, true);
  assert.equal(reviewFinishModel({ tab: "needs", deferredCount: 0 }).message, REVIEW_COPY.emptyNeeds);
});

test("decision body is keys-only and never lets the client supply createdBy", () => {
  const body = reviewDecisionBody({ id: "q1" });
  assert.deepEqual(body, { keys: ["q1"] });
  assert.equal("createdBy" in body, false);
  assert.equal("user" in body, false);
  const edited = reviewDecisionBody({ id: "q1" }, { phone: "04 1" });
  assert.deepEqual(edited.payload, { phone: "04 1" });
  assert.deepEqual(reviewUndoBody("undo-1"), { undoId: "undo-1" });
  assert.equal(queueActionUndoId({ succeeded: [{ undoId: "nested" }] }), "nested");
});

test("Accept and edit is pre-filled from the government after values, with text marks", () => {
  const form = correctionFormValues(oraToa);
  assert.equal(form.address, "FSD third street");
  assert.notEqual(form.address, "22 Ngāti Toa Street, Takapūwāhia, Porirua");
  const highlight = correctionFormHighlight(oraToa);
  assert.equal(highlight.changed.some((row) => row.field === "address" && row.mark === "Changed in this update"), true);
  assert.equal(highlight.youSetThis.some((row) => row.mark === "You set this earlier"), true);
  assert.equal(highlight.focusField, "address");
  assert.deepEqual(highlight, formHighlightFields({
    before: oraToa.before,
    after: oraToa.after,
    locked: oraToa.youSetThis.map((row) => row.field),
  }));
  assert.equal(correctionTitle(oraToa), "Correcting Support group - Ora Toa");
  assert.equal(
    correctionTitle({ kind: "geocode_flag", name: "KAPAI KIDZ" }),
    "Moving the pin for KAPAI KIDZ"
  );
});

test("Ora Toa review card keeps a before-and-after and You set this earlier", () => {
  assert.ok(oraToa.diffRows.some((row) => row.line.startsWith("Address:")));
  assert.ok(oraToa.youSetThis.some((row) => row.label === "Address"));
  assert.equal(headingButtonName(oraToa), `Support group - Ora Toa, ${oraToa.summaryLabel}`);
  assert.match(oraToa.summaryLabel, /Address/);
  assert.equal(toastName(oraToa), "Support group - Ora Toa");
  const toast = reviewToast({
    action: "keep",
    kind: "changed",
    name: toastName(oraToa),
    undoId: "u1",
  });
  assert.equal(toast.role, "status");
  assert.equal(toast.undoFirst, true);
  assert.equal(toast.undoLabel, "Undo");
  assert.match(toast.message, /Kept your details on Support group - Ora Toa/);
});

test("verification source prefers the government website and the live address as On the site now", () => {
  const source = reviewVerificationSource({
    ...oraToa,
    websiteUrl: "https://live.example",
    phone: "04 237 7749",
  });
  assert.equal(source.governmentUrl, "https://oratoa.example");
  assert.equal(source.addressNote, "On the site now");
  assert.ok(source.pin);
});

test("undo of a parked item returns her to Needs confirmation; a live restore returns to Review", () => {
  assert.equal(tabAfterUndo({ id: "d", deferred: true }), "needs");
  assert.equal(tabAfterUndo({ id: "a", deferred: false }), "review");
  assert.equal(tabAfterUndo(null), null);
});

test("Needs confirmation items are split out of the Review list", () => {
  const split = splitQueueItems([
    { id: "a", deferred: false },
    { id: "b", deferred: true },
    { id: "c" },
  ]);
  assert.deepEqual(
    split.active.map((row) => row.id),
    ["a", "c"]
  );
  assert.deepEqual(
    split.deferred.map((row) => row.id),
    ["b"]
  );
  assert.equal(reviewCountLabel(split.active.length), "2 changes to review");
  assert.equal(otherDetailsLabel(false), "Other details are unchanged. Show them");
  assert.equal(visibleRecent([{ id: "1" }, { id: "2" }, { id: "3" }], { limit: 2 }).length, 2);
});
