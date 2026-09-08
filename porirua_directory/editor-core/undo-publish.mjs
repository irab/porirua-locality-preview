export const UNDO_PUBLISH_WINDOW_MS = 24 * 60 * 60 * 1000;

export const UNDO_PUBLISH_STALE =
  "Someone else has published since. Your undo would remove their changes too.";
export const UNDO_PUBLISH_CLOSED = "Undo publish is no longer available.";
export const UNDO_PUBLISH_NONE = "There is nothing to undo.";
export const UNDO_PUBLISH_NEEDS_VERSION = "Undo publish needs the version you published.";

export function undoPublishAvailability({ currentVersion, lastEvent, now = Date.now() } = {}) {
  if (!lastEvent || lastEvent.action !== "publish") {
    return { canUndoPublish: false, previousVersion: null, reason: "none" };
  }
  if (currentVersion == null || Number(lastEvent.snapshotVersion) !== Number(currentVersion)) {
    return { canUndoPublish: false, previousVersion: null, reason: "none" };
  }
  if (lastEvent.previousVersion == null) {
    return { canUndoPublish: false, previousVersion: null, reason: "none" };
  }
  const at = new Date(lastEvent.createdAt).getTime();
  if (!Number.isFinite(at) || now - at >= UNDO_PUBLISH_WINDOW_MS) {
    return {
      canUndoPublish: false,
      previousVersion: lastEvent.previousVersion,
      reason: "closed",
    };
  }
  return {
    canUndoPublish: true,
    previousVersion: lastEvent.previousVersion,
    undoPublishVersion: Number(currentVersion),
  };
}

export function refuseUndoPublish({ expectedVersion, currentVersion, availability = {} } = {}) {
  if (expectedVersion == null || expectedVersion === "" || !Number.isFinite(Number(expectedVersion))) {
    return { refuse: true, statusCode: 400, message: UNDO_PUBLISH_NEEDS_VERSION };
  }
  if (currentVersion == null || Number(expectedVersion) !== Number(currentVersion)) {
    return { refuse: true, statusCode: 409, message: UNDO_PUBLISH_STALE };
  }
  if (availability.canUndoPublish) return { refuse: false };
  if (availability.reason === "closed") {
    return { refuse: true, statusCode: 409, message: UNDO_PUBLISH_CLOSED };
  }
  return { refuse: true, statusCode: 409, message: UNDO_PUBLISH_NONE };
}
