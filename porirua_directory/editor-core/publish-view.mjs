import { publisherHint } from "./catalog-publisher.mjs";
import { actionSuccessMessage } from "./queue-dto.mjs";

export const PUBLISH_ROUTES = {
  status: "/publish-status",
  publish: "/publish",
  undoPublish: "/undo-publish",
};

export const PUBLISH_COPY = {
  undoPublish: "Undo publish",
  undoLastPublish: "Undo last publish",
  confirmLargeDelta: "Publish this large change",
  publishError: "Could not publish. Try again.",
  undoError: "Could not undo that publish.",
};

export function publishBody({ confirmLargeDelta = false } = {}) {
  const body = {};
  if (confirmLargeDelta === true) body.confirmLargeDelta = true;
  return body;
}

export function undoPublishBody(status = {}) {
  const expectedVersion = status.undoPublishVersion ?? status.currentVersion ?? null;
  return { expectedVersion };
}

export function parsePublishFailure(error) {
  const data = error?.data && typeof error.data === "object" ? error.data : {};
  const preflight = data.preflight && typeof data.preflight === "object" ? data.preflight : null;
  const warning = preflight?.warning ? String(preflight.warning) : "";
  if ((data.blocked === true || error?.status === 409) && warning) {
    return {
      kind: "large-delta",
      message: warning,
      confirmLabel: PUBLISH_COPY.confirmLargeDelta,
      delta: preflight.delta ?? null,
    };
  }
  return {
    kind: "error",
    message: data.error || error?.message || PUBLISH_COPY.publishError,
    confirmLabel: "",
    delta: null,
  };
}

export function parseUndoFailure(error) {
  const data = error?.data && typeof error.data === "object" ? error.data : {};
  return {
    kind: error?.status === 409 || error?.status === 400 ? "conflict" : "error",
    message: data.error || error?.message || PUBLISH_COPY.undoError,
    confirmLabel: "",
    delta: null,
  };
}

export function largeDeltaState(failure) {
  if (failure?.kind !== "large-delta") return null;
  return {
    visible: true,
    message: failure.message,
    confirmLabel: failure.confirmLabel || PUBLISH_COPY.confirmLargeDelta,
  };
}

export function publishToastModel({ canUndoPublish = false } = {}) {
  const undo = canUndoPublish === true;
  return {
    role: "status",
    message: actionSuccessMessage({ action: "publish" }),
    undoPublish: undo,
    undoLabel: PUBLISH_COPY.undoPublish,
    undoFirst: undo,
  };
}

export function undoPublishToastModel() {
  return {
    role: "status",
    message: actionSuccessMessage({ action: "undo-publish" }),
    undoPublish: false,
    undoLabel: "",
    undoFirst: false,
  };
}

export function thisHostCanPublishFromStatus(status = {}) {
  return status.thisHostCanPublish !== false;
}

export { publisherHint };
