"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { directoryEditorFetch } from "../../../editor-core/client.mjs";
import { directoryTabsModel, DIRECTORY_TAB_ORDER } from "../../../editor-core/directory-tabs.mjs";
import {
  largeDeltaState,
  parsePublishFailure,
  parseUndoFailure,
  publishBody,
  PUBLISH_ROUTES,
  publisherHint,
  publishToastModel,
  thisHostCanPublishFromStatus,
  undoPublishBody,
  undoPublishToastModel,
} from "../../../editor-core/publish-view.mjs";
import { landingTab } from "../../../editor-core/queue-dto.mjs";
import { statusBandFromPublishStatus } from "../../../editor-core/status-band.mjs";
import { DirectoryTabs } from "./DirectoryTabs";
import { ListingsPanel } from "./ListingsPanel";
import { ReviewPanel } from "./ReviewPanel";
import { StatusBand } from "./StatusBand";
import "./directory.css";
import type { DirectoryTabId } from "./types";

const CLIENT_BASE = "/api/directory-editor";
const TOAST_MS = 20000;

type PublishToast = {
  role: "status";
  message: string;
  undoPublish: boolean;
  undoLabel: string;
  undoFirst: boolean;
};

type PublishFailure = {
  kind: string;
  message: string;
  confirmLabel?: string;
  delta?: { published?: number } | null;
};

export function DirectoryHome() {
  const [tab, setTab] = useState<DirectoryTabId>("listings");
  const [reviewCount, setReviewCount] = useState(0);
  const [deferredCount, setDeferredCount] = useState(0);
  const [publishStatus, setPublishStatus] = useState<Record<string, unknown>>({});
  const [loadError, setLoadError] = useState("");
  const [reviewFocusNonce, setReviewFocusNonce] = useState(0);
  const [listingFocusId, setListingFocusId] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [undoing, setUndoing] = useState(false);
  const [publishToast, setPublishToast] = useState<PublishToast | null>(null);
  const [publishFailure, setPublishFailure] = useState<PublishFailure | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastUndoRef = useRef<HTMLButtonElement | null>(null);
  const tabChosen = useRef(false);

  // The landing tab is only a default. Once anything has moved the editor on
  // purpose, the first queue load must not drag them back.
  function chooseTab(next: DirectoryTabId) {
    tabChosen.current = true;
    setTab(next);
  }

  async function refreshPublish() {
    try {
      const status = await directoryEditorFetch(PUBLISH_ROUTES.status, { base: CLIENT_BASE });
      const next = status && typeof status === "object" ? status : {};
      setPublishStatus(next);
      return next as Record<string, unknown>;
    } catch {
      setPublishStatus({});
      return {};
    }
  }

  function showPublishToast(next: PublishToast) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setPublishToast(next);
    toastTimer.current = setTimeout(() => setPublishToast(null), TOAST_MS);
  }

  async function publishCatalog({ confirmLargeDelta = false } = {}) {
    if (publishing) return;
    setPublishing(true);
    setPublishFailure(null);
    try {
      await directoryEditorFetch(PUBLISH_ROUTES.publish, {
        method: "POST",
        base: CLIENT_BASE,
        body: publishBody({ confirmLargeDelta }),
      });
      const next = await refreshPublish();
      showPublishToast(publishToastModel({ canUndoPublish: next.canUndoPublish === true }));
    } catch (error) {
      setPublishFailure(parsePublishFailure(error));
    } finally {
      setPublishing(false);
    }
  }

  async function undoLastPublish() {
    if (undoing) return;
    setUndoing(true);
    setPublishFailure(null);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setPublishToast(null);
    try {
      await directoryEditorFetch(PUBLISH_ROUTES.undoPublish, {
        method: "POST",
        base: CLIENT_BASE,
        body: undoPublishBody(publishStatus),
      });
      await refreshPublish();
      showPublishToast(undoPublishToastModel());
    } catch (error) {
      setPublishFailure(parseUndoFailure(error));
      await refreshPublish();
    } finally {
      setUndoing(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [status, queue] = await Promise.all([
          directoryEditorFetch(PUBLISH_ROUTES.status, { base: CLIENT_BASE }),
          directoryEditorFetch("/queue", { base: CLIENT_BASE }),
        ]);
        if (cancelled) return;
        const items = Array.isArray(queue?.items) ? queue.items : [];
        const active = items.filter((item: { deferred?: boolean }) => !item.deferred).length;
        const deferred = items.filter((item: { deferred?: boolean }) => item.deferred).length;
        setPublishStatus(status && typeof status === "object" ? status : {});
        setReviewCount(active);
        setDeferredCount(deferred);
        if (!tabChosen.current) {
          setTab(landingTab({ activeCount: active, deferredCount: deferred }) as DirectoryTabId);
        }
        setLoadError("");
      } catch (error) {
        if (cancelled) return;
        setLoadError(error instanceof Error ? error.message : "Could not load Directory.");
      }
    }
    load();
    return () => {
      cancelled = true;
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  useEffect(() => {
    if (publishToast?.undoFirst) toastUndoRef.current?.focus();
  }, [publishToast]);

  const tabs = useMemo(
    () => directoryTabsModel({ deferredCount, reviewCount }),
    [deferredCount, reviewCount]
  );
  const band = useMemo(
    () => statusBandFromPublishStatus(publishStatus, { reviewCount }),
    [publishStatus, reviewCount]
  );
  const canPublishHere = thisHostCanPublishFromStatus(publishStatus);
  const publishAction = canPublishHere && !publishing ? () => void publishCatalog() : undefined;
  const undoAction = canPublishHere && !undoing ? () => void undoLastPublish() : undefined;
  const largeDelta = largeDeltaState(publishFailure);
  return (
    <div className="directory-home">
      <h1>Directory</h1>
      {publishToast ? (
        <p className="toast" role="status">
          {publishToast.undoPublish ? (
            <button
              ref={toastUndoRef}
              type="button"
              className="toast-undo"
              disabled={undoing || !undoAction}
              onClick={undoAction}
            >
              {publishToast.undoLabel}
            </button>
          ) : null}
          <span>{publishToast.message}</span>
        </p>
      ) : null}
      <StatusBand
        model={band}
        onReview={() => {
          chooseTab("review");
          setReviewFocusNonce((count) => count + 1);
        }}
        onPublish={publishAction}
        onUndoPublish={band.undo.visible ? undoAction : undefined}
        onConfirmLargeDelta={
          largeDelta && canPublishHere && !publishing
            ? () => void publishCatalog({ confirmLargeDelta: true })
            : undefined
        }
        publishing={publishing}
        undoing={undoing}
        publisherHint={publisherHint(publishStatus)}
        largeDelta={largeDelta}
        error={publishFailure && !largeDelta ? publishFailure.message : ""}
      />
      <DirectoryTabs tabs={tabs} active={tab} onChange={chooseTab}>
        <section
          id={`${tab}-panel`}
          className="directory-panel"
          role="tabpanel"
          aria-labelledby={`tab-${tab}`}
        >
          {loadError ? <p className="directory-hint">{loadError}</p> : null}
          {tab === "needs" || tab === "review" ? (
            <ReviewPanel
              tab={tab}
              unpublishedCount={Number(publishStatus.unpublishedCount) || 0}
              reviewFocusNonce={reviewFocusNonce}
              publishing={publishing}
              onQueueChanged={({ activeCount, deferredCount: nextDeferred }) => {
                setReviewCount(activeCount);
                setDeferredCount(nextDeferred);
              }}
              onCatalogChanged={refreshPublish}
              onOpenListing={(organizationId) => {
                setListingFocusId(organizationId);
                chooseTab("listings");
              }}
              onKeepReviewingLater={() => chooseTab("needs")}
              onRequestTab={chooseTab}
              onPublish={publishAction}
            />
          ) : null}
          {tab === "listings" ? (
            <ListingsPanel
              onCatalogChanged={refreshPublish}
              openOrganizationId={listingFocusId}
              onOpened={() => setListingFocusId(null)}
            />
          ) : null}
        </section>
      </DirectoryTabs>
      <p className="directory-hint">
        Tab order is {DIRECTORY_TAB_ORDER.join(", ")}. Shared form, status band, and verification bar live in{" "}
        <code>payload/src/directory/</code>.
      </p>
    </div>
  );
}
