"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { directoryEditorFetch } from "../../../editor-core/client.mjs";
import { communityGroupOptions, helpTypeOptions } from "../../../editor-core/fields.mjs";
import {
  REVIEW_COPY,
  REVIEW_ROUTES,
  correctionFormHighlight,
  correctionFormValues,
  correctionTitle,
  focusAfterReviewDecision,
  headingButtonName,
  nextActiveAfterDecision,
  otherDetailsLabel,
  queueActionUndoId,
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
} from "../../../editor-core/review-view.mjs";
import { reviewCountLabel } from "../../../editor-core/queue-dto.mjs";
import { verificationBarModel } from "../../../editor-core/verification-bar.mjs";
import { SharedListingForm } from "./SharedListingForm";
import { VerificationBar } from "./VerificationBar";
import type { DirectoryTabId, FormHighlight, GeoResult, ListingFormValues } from "./types";

const CLIENT_BASE = "/api/directory-editor";
const TOAST_MS = 20000;

type QueueItem = {
  id: string;
  kind: string;
  name: string;
  lineLabel?: string;
  summaryLabel?: string;
  kindLabel?: string;
  deferred?: boolean;
  changedSinceDeferred?: boolean;
  changedSinceDeferredLabel?: string;
  fsdReturned?: boolean;
  fsdReturnedLabel?: string;
  youSetThis?: Array<{ field: string; label: string }>;
  diffRows?: Array<{ field: string; line: string; label: string }>;
  otherRows?: Array<{ field: string; line: string }>;
  after?: Record<string, unknown>;
  before?: Record<string, unknown>;
  currentAddress?: string;
  verifyAddressNote?: string;
  verifyPin?: { lat: number; lng: number } | null;
  verifyComparePin?: { lat: number; lng: number } | null;
  showVerifyMap?: boolean;
  pin?: { lat: number; lng: number } | null;
  websiteUrl?: string;
  phone?: string;
  primaryActionLabel?: string;
  rejectActionLabel?: string;
  showRejectAction?: boolean;
  deferActionLabel?: string;
  keepAsCommunityLabel?: string;
};

type RecentItem = {
  id: string;
  name: string;
  lineLabel?: string;
  decisionLabel?: string;
  whenLabel?: string;
  organizationId?: string | null;
  listingLabel?: string;
};

type ToastState = {
  role: "status";
  message: string;
  undoId: string | null;
  undoFirst: boolean;
  undoLabel: string;
};

type ReviewPanelProps = {
  tab: "review" | "needs";
  unpublishedCount?: number;
  reviewFocusNonce?: number;
  onQueueChanged?: (counts: { activeCount: number; deferredCount: number }) => void;
  onCatalogChanged?: () => void;
  onOpenListing?: (organizationId: string) => void;
  onKeepReviewingLater?: () => void;
  onRequestTab?: (tab: DirectoryTabId) => void;
  onPublish?: () => void;
};

function DiffLines({ rows }: { rows: Array<{ field: string; line: string }> }) {
  if (!rows.length) return null;
  return (
    <ul className="diff">
      {rows.map((row) => (
        <li key={row.field}>{row.line}</li>
      ))}
    </ul>
  );
}

export function ReviewPanel({
  tab,
  unpublishedCount = 0,
  reviewFocusNonce = 0,
  onQueueChanged,
  onCatalogChanged,
  onOpenListing,
  onKeepReviewingLater,
  onRequestTab,
  onPublish,
}: ReviewPanelProps) {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [recent, setRecent] = useState<RecentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [correctingId, setCorrectingId] = useState<string | null>(null);
  const [form, setForm] = useState<ListingFormValues>(correctionFormValues({}));
  const [highlight, setHighlight] = useState<FormHighlight>(correctionFormHighlight({}));
  const [geoResults, setGeoResults] = useState<GeoResult[]>([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [actionError, setActionError] = useState("");
  const [shownOther, setShownOther] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<ToastState | null>(null);
  const [reviewedThisSession, setReviewedThisSession] = useState(0);
  const [showAllRecent, setShowAllRecent] = useState(false);
  const [waitingCount, setWaitingCount] = useState(unpublishedCount);
  const headingRefs = useRef(new Map<string, HTMLButtonElement>());
  const finishRef = useRef<HTMLHeadingElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousTab = useRef(tab);
  const didLand = useRef(false);
  const lastFocusNonce = useRef(reviewFocusNonce);

  const helpTypes = useMemo(() => helpTypeOptions(), []);
  const communityGroups = useMemo(() => communityGroupOptions(), []);
  const { active, deferred } = useMemo(() => splitQueueItems(items), [items]);
  const tabItems = tab === "needs" ? deferred : active;
  const finish = useMemo(
    () =>
      reviewFinishModel({
        tab,
        activeCount: active.length,
        deferredCount: deferred.length,
        reviewedThisSession,
        unpublishedCount: waitingCount,
      }),
    [tab, active.length, deferred.length, reviewedThisSession, waitingCount]
  );
  const shownRecent = useMemo(
    () => visibleRecent(recent, { showAll: showAllRecent }),
    [recent, showAllRecent]
  );

  function setHeadingRef(id: string, node: HTMLButtonElement | null) {
    if (node) headingRefs.current.set(id, node);
    else headingRefs.current.delete(id);
  }

  function focusTarget(target: { type: string; itemId?: string | null }) {
    if (target.type === "heading" && target.itemId) {
      const node = headingRefs.current.get(target.itemId);
      node?.focus();
      node?.scrollIntoView({ block: "nearest" });
      return;
    }
    if (target.type === "finish") {
      finishRef.current?.focus();
      finishRef.current?.scrollIntoView({ block: "nearest" });
    }
  }

  function showToast(next: ToastState) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(next);
    toastTimer.current = setTimeout(() => setToast(null), TOAST_MS);
  }

  async function refreshQueue({ initial = false } = {}) {
    if (initial) setLoading(true);
    try {
      const data = await directoryEditorFetch(REVIEW_ROUTES.queue, { base: CLIENT_BASE });
      const nextItems = Array.isArray(data?.items) ? data.items : [];
      const nextRecent = Array.isArray(data?.recent) ? data.recent : [];
      setItems(nextItems);
      setRecent(nextRecent);
      const split = splitQueueItems(nextItems);
      onQueueChanged?.({ activeCount: split.active.length, deferredCount: split.deferred.length });
      setError("");
      return nextItems as QueueItem[];
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : REVIEW_COPY.loadError);
      return items;
    } finally {
      setLoading(false);
    }
  }

  async function refreshWaiting() {
    try {
      const status = await directoryEditorFetch("/publish-status", { base: CLIENT_BASE });
      const count = Number(status?.unpublishedCount) || 0;
      setWaitingCount(count);
    } catch {
      setWaitingCount(unpublishedCount);
    }
  }

  useEffect(() => {
    refreshQueue({ initial: true });
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  useEffect(() => {
    setWaitingCount(unpublishedCount);
  }, [unpublishedCount]);

  useEffect(() => {
    if (loading) return;
    if (!didLand.current) {
      didLand.current = true;
      if (tab === "review" && active[0]) {
        setOpenId(active[0].id);
      }
      return;
    }
    if (previousTab.current !== tab) {
      previousTab.current = tab;
      if (tab === "review" && active[0]) {
        setOpenId(active[0].id);
        setCorrectingId(null);
        queueMicrotask(() => focusTarget({ type: "heading", itemId: active[0].id }));
      }
      if (tab === "needs") {
        setCorrectingId(null);
        setOpenId((current) => (current && deferred.some((item) => item.id === current) ? current : null));
      }
    }
  }, [loading, tab, active, deferred]);

  useEffect(() => {
    if (!reviewFocusNonce || reviewFocusNonce === lastFocusNonce.current) return;
    lastFocusNonce.current = reviewFocusNonce;
    if (active[0]) {
      setOpenId(active[0].id);
      setCorrectingId(null);
      queueMicrotask(() => focusTarget({ type: "heading", itemId: active[0].id }));
    }
  }, [reviewFocusNonce, active]);

  function toggleOpen(item: QueueItem) {
    if (correctingId && correctingId !== item.id) return;
    setOpenId((current) => (current === item.id ? null : item.id));
    setActionError("");
  }

  function startCorrect(item: QueueItem) {
    setCorrectingId(item.id);
    setOpenId(item.id);
    setForm(correctionFormValues(item));
    setHighlight(correctionFormHighlight(item));
    setGeoResults([]);
    setFormError("");
    setActionError("");
  }

  function cancelCorrect() {
    setCorrectingId(null);
    setFormError("");
    setGeoResults([]);
  }

  async function lookupAddress() {
    if (!form.address) return;
    try {
      const data = await directoryEditorFetch(`/geocode?q=${encodeURIComponent(form.address)}`, {
        base: CLIENT_BASE,
      });
      setGeoResults(Array.isArray(data?.results) ? data.results : []);
    } catch {
      setGeoResults([]);
    }
  }

  function applyGeo(result: GeoResult) {
    setForm({ ...form, address: result.label, lat: result.lat, lng: result.lng });
    setGeoResults([]);
  }

  function advanceAfterDecision(nextItems: QueueItem[], decidedId: string) {
    const split = splitQueueItems(nextItems);
    const remaining = split.active.filter((item) => item.id !== decidedId);
    const next = nextActiveAfterDecision({ tab, activeItems: remaining });
    const nextId = shouldAutoOpenItem(tab, next) ? next.id : null;
    setOpenId(nextId);
    setCorrectingId(null);
    const target = focusAfterReviewDecision({
      nextItem: nextId ? next : null,
      finish: tab === "review" && remaining.length === 0 && reviewedThisSession + 1 > 0,
    });
    queueMicrotask(() => focusTarget(target));
  }

  async function runDecision(item: QueueItem, button: ReturnType<typeof reviewActionButtons>[number]) {
    if (button.opensForm) {
      startCorrect(item);
      return;
    }
    setActionError("");
    try {
      const result = await directoryEditorFetch(button.route, {
        method: "POST",
        base: CLIENT_BASE,
        body: reviewDecisionBody(item),
      });
      setReviewedThisSession((count) => count + 1);
      showToast(
        reviewToast({
          action: button.action,
          kind: item.kind,
          name: toastName(item),
          undoId: queueActionUndoId(result),
        })
      );
      const nextItems = await refreshQueue();
      await refreshWaiting();
      onCatalogChanged?.();
      advanceAfterDecision(nextItems, item.id);
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : REVIEW_COPY.actError);
    }
  }

  async function saveCorrection(item: QueueItem) {
    setSaving(true);
    setFormError("");
    try {
      const result = await directoryEditorFetch(REVIEW_ROUTES.editAndApprove, {
        method: "POST",
        base: CLIENT_BASE,
        body: reviewDecisionBody(item, form),
      });
      setReviewedThisSession((count) => count + 1);
      showToast(
        reviewToast({
          action: "approve",
          kind: item.kind,
          name: toastName(item),
          undoId: queueActionUndoId(result),
        })
      );
      const nextItems = await refreshQueue();
      await refreshWaiting();
      onCatalogChanged?.();
      advanceAfterDecision(nextItems, item.id);
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : REVIEW_COPY.actError);
    } finally {
      setSaving(false);
    }
  }

  async function undoLast() {
    const undoId = toast?.undoId;
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(null);
    if (!undoId) return;
    try {
      const result = await directoryEditorFetch(REVIEW_ROUTES.reviewUndo, {
        method: "POST",
        base: CLIENT_BASE,
        body: reviewUndoBody(undoId),
      });
      setReviewedThisSession((count) => Math.max(0, count - 1));
      const nextItems = await refreshQueue();
      await refreshWaiting();
      onCatalogChanged?.();
      const restoredId = result?.queueItemId || null;
      const restored = nextItems.find((item) => item.id === restoredId) || null;
      const nextTab = tabAfterUndo(restored);
      if (nextTab && nextTab !== tab) onRequestTab?.(nextTab);
      setOpenId(restoredId);
      setCorrectingId(null);
      if (restoredId) {
        queueMicrotask(() => focusTarget({ type: "heading", itemId: restoredId }));
      }
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : REVIEW_COPY.undoError);
      await refreshQueue();
    }
  }

  const correcting = items.find((item) => item.id === correctingId) || null;

  return (
    <div className="review-panel">
      {toast ? (
        <p className="toast" role="status">
          {toast.undoId ? (
            <button type="button" className="toast-undo" onClick={undoLast}>
              {toast.undoLabel}
            </button>
          ) : null}
          <span>{toast.message}</span>
        </p>
      ) : null}

      {tab === "review" && finish.kind === "queue" ? (
        <h2 className="review-title">{reviewCountLabel(active.length)}</h2>
      ) : null}

      {error ? (
        <p className="error">
          {REVIEW_COPY.loadError}{" "}
          <button type="button" onClick={() => refreshQueue()}>
            {REVIEW_COPY.tryAgain}
          </button>
        </p>
      ) : null}

      {loading ? <p className="directory-hint">{REVIEW_COPY.loading}</p> : null}

      <div className="review-list">
        {tabItems.map((item) => {
          const open = openId === item.id;
          const lockedOut = Boolean(correcting && correcting.id !== item.id);
          const verify = verificationBarModel(reviewVerificationSource(item));
          const buttons = reviewActionButtons(item);
          const equal = item.kind === "removed";
          return (
            <article
              key={item.id}
              className={
                correcting?.id === item.id ? "review-card is-correcting" : lockedOut ? "review-card is-inert" : "review-card"
              }
              inert={lockedOut || undefined}
            >
              <button
                ref={(node) => setHeadingRef(item.id, node)}
                type="button"
                className="review-row"
                aria-expanded={open}
                aria-label={headingButtonName(item)}
                disabled={lockedOut}
                onClick={() => toggleOpen(item)}
              >
                <strong>{item.name}</strong>
                {item.lineLabel ? <span className="line-name">{item.lineLabel}</span> : null}
                <span className="kind">{item.summaryLabel || item.kindLabel}</span>
                {item.changedSinceDeferred ? <span className="badge">{item.changedSinceDeferredLabel}</span> : null}
              </button>
              {open ? (
                <div className="review-body">
                  {item.fsdReturned ? <p className="banner-note">{item.fsdReturnedLabel}</p> : null}
                  {item.youSetThis?.length ? (
                    <p>
                      {REVIEW_COPY.youSetThis}: {item.youSetThis.map((row) => row.label).join(", ")}
                    </p>
                  ) : null}
                  <DiffLines rows={item.diffRows || []} />
                  {item.otherRows?.length ? (
                    <div className="other">
                      <button
                        type="button"
                        className="other-toggle"
                        onClick={() => setShownOther((current) => ({ ...current, [item.id]: !current[item.id] }))}
                      >
                        {otherDetailsLabel(Boolean(shownOther[item.id]))}
                      </button>
                      {shownOther[item.id] ? <DiffLines rows={item.otherRows} /> : null}
                    </div>
                  ) : null}
                  {correcting?.id !== item.id ? (
                    <>
                      <VerificationBar model={verify} />
                      <div className={equal ? "review-actions equal" : "review-actions"}>
                        {buttons.map((button) => (
                          <button
                            key={button.id}
                            type="button"
                            className={button.equal ? "equal-action" : button.id === "approve" ? "decide" : undefined}
                            onClick={() => runDecision(item, button)}
                          >
                            {button.label}
                          </button>
                        ))}
                      </div>
                      {actionError && openId === item.id ? <p className="error">{REVIEW_COPY.actError}</p> : null}
                    </>
                  ) : (
                    <SharedListingForm
                      title={correctionTitle(item)}
                      value={form}
                      onChange={setForm}
                      highlight={highlight}
                      helpTypes={helpTypes}
                      communityGroups={communityGroups}
                      geoResults={geoResults}
                      saving={saving}
                      error={formError}
                      onSave={() => saveCorrection(item)}
                      onCancel={cancelCorrect}
                      onLookupAddress={lookupAddress}
                      onApplyGeo={applyGeo}
                      onPinMove={(pin) => setForm({ ...form, lat: pin.lat, lng: pin.lng })}
                    />
                  )}
                </div>
              ) : null}
            </article>
          );
        })}
      </div>

      {tab === "review" && finish.kind === "finish" ? (
        <div className="finish">
          <h2 ref={finishRef} tabIndex={-1} className="heading">
            {finish.heading}
          </h2>
          <div className="actions">
            <button type="button" disabled={!onPublish || !waitingCount} onClick={onPublish}>
              {REVIEW_COPY.publishNow}
            </button>
            {finish.showKeepReviewingLater ? (
              <button type="button" onClick={onKeepReviewingLater}>
                {REVIEW_COPY.keepReviewingLater}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {tab === "review" && finish.kind === "empty" && !loading ? (
        <p className="directory-hint">{REVIEW_COPY.empty}</p>
      ) : null}

      {tab === "needs" && !deferred.length && !loading ? (
        <p className="directory-hint">{REVIEW_COPY.emptyNeeds}</p>
      ) : null}

      {tab === "review" && recent.length ? (
        <section className="recent" aria-labelledby="recent-finished-heading">
          <h2 id="recent-finished-heading" className="heading">
            {REVIEW_COPY.recentlyFinished}
          </h2>
          <ul>
            {shownRecent.map((row) => (
              <li key={row.id}>
                <strong>{row.name}</strong>
                {row.lineLabel ? <span className="line-name">{row.lineLabel}</span> : null}
                <span>{row.decisionLabel}</span>
                <span className="kind">{row.whenLabel}</span>
                {row.organizationId ? (
                  <button type="button" className="other-toggle" onClick={() => onOpenListing?.(row.organizationId || "")}>
                    {row.listingLabel || REVIEW_COPY.openListing}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
          {recent.length > shownRecent.length ? (
            <button type="button" className="other-toggle" onClick={() => setShowAllRecent(true)}>
              Show all
            </button>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
