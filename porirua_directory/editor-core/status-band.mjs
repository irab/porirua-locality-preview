import { reviewCountLabel, waitingCountLabel } from "./queue-dto.mjs";

export function statusBandModel({
  reviewCount = 0,
  unpublishedCount = 0,
  canUndoPublish = false,
  thisHostCanPublish = true,
} = {}) {
  const review = Number(reviewCount) || 0;
  const waiting = Number(unpublishedCount) || 0;
  const canPublish = thisHostCanPublish !== false;
  return {
    role: "status",
    review: {
      count: review,
      label: reviewCountLabel(review),
      disabled: review === 0,
    },
    waiting: {
      count: waiting,
      label: waitingCountLabel(waiting),
      disabled: waiting === 0 || !canPublish,
    },
    undo: {
      visible: Boolean(canUndoPublish) && canPublish,
      label: "Undo last publish",
    },
  };
}

export function statusBandFromPublishStatus(status = {}, { reviewCount = 0 } = {}) {
  const unpublishedCount =
    status.unpublishedCount != null
      ? status.unpublishedCount
      : status.unpublished
        ? 1
        : 0;
  return statusBandModel({
    reviewCount,
    unpublishedCount,
    canUndoPublish: status.canUndoPublish === true,
    thisHostCanPublish: status.thisHostCanPublish !== false,
  });
}
