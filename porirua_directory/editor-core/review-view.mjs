import { formHighlightFields } from "./form-highlight.mjs";
import {
  actionSuccessMessage,
  correctHeading,
  queueItemHeading,
  reviewCountLabel,
  reviewDeferredFinishLabel,
  reviewFinishedLabel,
} from "./queue-dto.mjs";

export const REVIEW_INBOX = "review_queue_items";

export const REVIEW_COPY = {
  loading: "Looking for government updates…",
  loadError: "Could not load Review.",
  tryAgain: "Try again",
  empty: "Nothing to review.",
  emptyNeeds: "Nothing needs confirmation.",
  otherShow: "Other details are unchanged. Show them",
  otherHide: "Hide unchanged details",
  undo: "Undo",
  keepYours: "Keep yours",
  acceptAndEdit: "Accept and edit",
  movePin: "I'll move the pin",
  publishNow: "Publish now",
  keepReviewingLater: "Keep reviewing later",
  recentlyFinished: "Recently finished",
  openListing: "Open listing",
  actError: "Could not save that decision. Try again.",
  undoError: "Could not undo that.",
  youSetThis: "You set this earlier",
};

export const REVIEW_ROUTES = {
  queue: "/queue",
  approve: "/approve",
  keepCuration: "/keep-curation",
  hide: "/hide",
  reject: "/reject",
  editAndApprove: "/edit-and-approve",
  defer: "/defer",
  keepCommunity: "/keep-community",
  reviewUndo: "/review-undo",
};

export function splitQueueItems(items = []) {
  const list = Array.isArray(items) ? items : [];
  return {
    active: list.filter((item) => !item.deferred),
    deferred: list.filter((item) => item.deferred),
  };
}

export function queueActionUndoId(result) {
  if (result?.undoId) return result.undoId;
  const succeeded = Array.isArray(result?.succeeded) ? result.succeeded : [];
  for (let i = succeeded.length - 1; i >= 0; i -= 1) {
    if (succeeded[i]?.undoId) return succeeded[i].undoId;
  }
  return null;
}

export function reviewDecisionBody(item, payload) {
  const body = { keys: [item.id] };
  if (payload !== undefined) body.payload = payload;
  return body;
}

export function reviewUndoBody(undoId) {
  return { undoId };
}

export function headingButtonName(item) {
  const parts = [item?.name || "this listing"];
  if (item?.lineLabel) parts.push(item.lineLabel);
  const summary = item?.summaryLabel || item?.kindLabel;
  if (summary) parts.push(summary);
  return parts.join(", ");
}

export function reviewActionButtons(item = {}) {
  const defer = {
    id: "defer",
    label: item.deferActionLabel || "Needs confirmation",
    route: REVIEW_ROUTES.defer,
    action: "defer",
    show: item.deferred !== true,
    equal: false,
    keyboardDefault: false,
    opensForm: false,
  };

  if (item.kind === "removed") {
    return [
      {
        id: "hide",
        label: item.primaryActionLabel || "Take it off the site",
        route: REVIEW_ROUTES.hide,
        action: "approve",
        show: true,
        equal: true,
        keyboardDefault: false,
        opensForm: false,
      },
      {
        id: "keep-community",
        label: item.keepAsCommunityLabel || "Keep it as a community listing",
        route: REVIEW_ROUTES.keepCommunity,
        action: "keep-community",
        show: true,
        equal: true,
        keyboardDefault: false,
        opensForm: false,
      },
      defer,
    ].filter((row) => row.show);
  }

  if (item.kind === "geocode_flag") {
    return [
      {
        id: "approve",
        label: item.primaryActionLabel || "The pin is fine",
        route: REVIEW_ROUTES.approve,
        action: "approve",
        show: true,
        equal: false,
        keyboardDefault: false,
        opensForm: false,
      },
      {
        id: "edit",
        label: REVIEW_COPY.movePin,
        route: REVIEW_ROUTES.editAndApprove,
        action: "approve",
        show: true,
        equal: false,
        keyboardDefault: false,
        opensForm: true,
      },
      defer,
    ].filter((row) => row.show);
  }

  const keepYours = {
    id: "keep",
    label: REVIEW_COPY.keepYours,
    route: REVIEW_ROUTES.keepCuration,
    action: "keep",
    show: item.kind === "changed" && Array.isArray(item.youSetThis) && item.youSetThis.length > 0,
    equal: false,
    keyboardDefault: false,
    opensForm: false,
  };

  const edit = {
    id: "edit",
    label: REVIEW_COPY.acceptAndEdit,
    route: REVIEW_ROUTES.editAndApprove,
    action: "approve",
    show: item.kind === "changed",
    equal: false,
    keyboardDefault: false,
    opensForm: true,
  };

  const reject = {
    id: "reject",
    label: item.rejectActionLabel || "Reject",
    route: REVIEW_ROUTES.reject,
    action: "reject",
    show: item.showRejectAction !== false,
    equal: false,
    keyboardDefault: false,
    opensForm: false,
  };

  return [
    {
      id: "approve",
      label: item.primaryActionLabel || "Accept",
      route: REVIEW_ROUTES.approve,
      action: "approve",
      show: true,
      equal: false,
      keyboardDefault: false,
      opensForm: false,
    },
    keepYours,
    edit,
    reject,
    defer,
  ].filter((row) => row.show);
}

export function removalActionsAreEqual(buttons = []) {
  const pair = buttons.filter((row) => row.id === "hide" || row.id === "keep-community");
  if (pair.length !== 2) return false;
  return pair.every((row) => row.equal === true && row.keyboardDefault === false);
}

export function nextActiveAfterDecision({ tab, activeItems = [] } = {}) {
  if (tab !== "review") return null;
  return activeItems.find((item) => !item.deferred) || null;
}

export function shouldAutoOpenItem(tab, item) {
  return tab === "review" && Boolean(item) && !item.deferred;
}

export function focusAfterReviewDecision({ nextItem, finish = false } = {}) {
  if (nextItem && !nextItem.deferred) {
    return { type: "heading", itemId: nextItem.id, control: "heading" };
  }
  if (finish) return { type: "finish", itemId: null, control: "finish" };
  return { type: "none", itemId: null, control: null };
}

export function reviewFinishModel({
  tab = "review",
  activeCount = 0,
  deferredCount = 0,
  reviewedThisSession = 0,
  unpublishedCount = 0,
} = {}) {
  if (tab === "needs") {
    return {
      kind: deferredCount ? "queue" : "empty",
      heading: "",
      message: deferredCount ? "" : REVIEW_COPY.emptyNeeds,
      showPublishNow: false,
      showKeepReviewingLater: false,
    };
  }
  if (activeCount > 0) {
    return {
      kind: "queue",
      heading: reviewCountLabel(activeCount),
      message: "",
      showPublishNow: false,
      showKeepReviewingLater: false,
    };
  }
  if (reviewedThisSession > 0) {
    const deferred = Number(deferredCount) || 0;
    return {
      kind: "finish",
      heading: deferred
        ? reviewDeferredFinishLabel(deferred)
        : reviewFinishedLabel(Number(unpublishedCount) || reviewedThisSession),
      message: "",
      showPublishNow: true,
      showKeepReviewingLater: deferred > 0,
    };
  }
  return {
    kind: "empty",
    heading: reviewCountLabel(0),
    message: REVIEW_COPY.empty,
    showPublishNow: false,
    showKeepReviewingLater: false,
  };
}

export function reviewToast({ action, kind, name, undoId } = {}) {
  return {
    role: "status",
    message: actionSuccessMessage({ action, kind, unpublished: true, name }),
    undoId: undoId || null,
    undoFirst: true,
    undoLabel: REVIEW_COPY.undo,
  };
}

export function toastName(item) {
  return queueItemHeading(item, "");
}

export function correctionFormValues(item = {}) {
  const after = item.after && typeof item.after === "object" ? item.after : {};
  const before = item.before && typeof item.before === "object" ? item.before : {};
  const community =
    after.communityFilters ||
    after.community_filters ||
    before.communityFilters ||
    before.community_filters ||
    [];
  return {
    name: after.name || after.title || after.serviceName || after.service_name || item.name || "",
    description: after.description || "",
    address: after.address || "",
    phone: after.phone || "",
    url: after.url || "",
    lat: after.lat ?? item.pin?.lat ?? null,
    lng: after.lng ?? item.pin?.lng ?? null,
    categories: Array.isArray(after.categories) ? after.categories : [],
    communityFilters: Array.isArray(community) ? community : [],
  };
}

export function correctionFormHighlight(item = {}) {
  return formHighlightFields({
    before: item.before || {},
    after: item.after || {},
    locked: (item.youSetThis || []).map((row) => row.field),
  });
}

export function correctionTitle(item) {
  return correctHeading(item);
}

export function reviewVerificationSource(item = {}) {
  const after = item.after && typeof item.after === "object" ? item.after : {};
  return {
    governmentUrl: after.url || "",
    listingUrl: item.websiteUrl || after.url || "",
    phone: item.phone || after.phone || "",
    address: item.currentAddress || "",
    addressNote: item.verifyAddressNote || "",
    pin: item.verifyPin || item.pin || null,
    comparePin: item.verifyComparePin || null,
    showMap: Boolean(item.showVerifyMap),
  };
}

export function tabAfterUndo(restored) {
  if (restored?.deferred) return "needs";
  if (restored) return "review";
  return null;
}

export function visibleRecent(recent = [], { showAll = false, limit = 5 } = {}) {
  const rows = Array.isArray(recent) ? recent : [];
  return showAll ? rows : rows.slice(0, limit);
}

export function otherDetailsLabel(expanded) {
  return expanded ? REVIEW_COPY.otherHide : REVIEW_COPY.otherShow;
}
