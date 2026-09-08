import { reviewCountLabel, waitingCountLabel } from "./queue-dto.mjs";

export function statusBandModel({
  reviewCount = 0,
  unpublishedCount = 0,
  canUndoPublish = false,
} = {}) {
  const review = Number(reviewCount) || 0;
  const waiting = Number(unpublishedCount) || 0;
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
      disabled: waiting === 0,
    },
    undo: {
      visible: Boolean(canUndoPublish),
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
  });
}
