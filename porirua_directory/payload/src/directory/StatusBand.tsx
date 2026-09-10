"use client";

import type { StatusBandProps } from "./types";

export function StatusBand({
  model,
  onReview,
  onPublish,
  onUndoPublish,
  onConfirmLargeDelta,
  publishing = false,
  undoing = false,
  publisherHint = "",
  largeDelta = null,
  error = "",
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
      {publisherHint || error || largeDelta?.visible ? (
        <div className="status-band-meta">
          {publisherHint ? <p className="directory-hint">{publisherHint}</p> : null}
          {largeDelta?.visible ? (
            <>
              <p className="error">{largeDelta.message}</p>
              <button
                type="button"
                className="band band-confirm"
                disabled={publishing || !onConfirmLargeDelta}
                onClick={onConfirmLargeDelta}
              >
                {largeDelta.confirmLabel}
              </button>
            </>
          ) : null}
          {error && !largeDelta?.visible ? <p className="error">{error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
