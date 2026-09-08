"use client";

import type { StatusBandProps } from "./types";

export function StatusBand({
  model,
  onReview,
  onPublish,
  onUndoPublish,
  publishing = false,
  undoing = false,
}: StatusBandProps) {
  return (
    <div className="status-band" role="status" aria-label="Directory status">
      <button
        type="button"
        className={model.review.disabled ? "band zero" : "band"}
        disabled={model.review.disabled || !onReview}
        onClick={onReview}
      >
        {model.review.label}
      </button>
      <button
        type="button"
        className={model.waiting.disabled ? "band zero" : "band"}
        disabled={model.waiting.disabled || publishing || !onPublish}
        onClick={onPublish}
      >
        {model.waiting.label}
      </button>
      {model.undo.visible ? (
        <button type="button" className="band" disabled={undoing || !onUndoPublish} onClick={onUndoPublish}>
          {model.undo.label}
        </button>
      ) : null}
    </div>
  );
}
