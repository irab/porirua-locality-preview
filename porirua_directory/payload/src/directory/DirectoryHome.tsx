"use client";

import { useEffect, useMemo, useState } from "react";
import { directoryEditorFetch } from "../../../editor-core/client.mjs";
import { directoryTabsModel, DIRECTORY_TAB_ORDER } from "../../../editor-core/directory-tabs.mjs";
import { landingTab } from "../../../editor-core/queue-dto.mjs";
import { statusBandFromPublishStatus } from "../../../editor-core/status-band.mjs";
import { DirectoryTabs } from "./DirectoryTabs";
import { ListingsPanel } from "./ListingsPanel";
import { ReviewPanel } from "./ReviewPanel";
import { StatusBand } from "./StatusBand";
import "./directory.css";
import type { DirectoryTabId } from "./types";

const CLIENT_BASE = "/api/directory-editor";

export function DirectoryHome() {
  const [tab, setTab] = useState<DirectoryTabId>("listings");
  const [reviewCount, setReviewCount] = useState(0);
  const [deferredCount, setDeferredCount] = useState(0);
  const [publishStatus, setPublishStatus] = useState<Record<string, unknown>>({});
  const [loadError, setLoadError] = useState("");
  const [reviewFocusNonce, setReviewFocusNonce] = useState(0);
  const [listingFocusId, setListingFocusId] = useState<string | null>(null);

  async function refreshPublish() {
    try {
      const status = await directoryEditorFetch("/publish-status", { base: CLIENT_BASE });
      setPublishStatus(status && typeof status === "object" ? status : {});
    } catch {
      setPublishStatus({});
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [status, queue] = await Promise.all([
          directoryEditorFetch("/publish-status", { base: CLIENT_BASE }),
          directoryEditorFetch("/queue", { base: CLIENT_BASE }),
        ]);
        if (cancelled) return;
        const items = Array.isArray(queue?.items) ? queue.items : [];
        const active = items.filter((item: { deferred?: boolean }) => !item.deferred).length;
        const deferred = items.filter((item: { deferred?: boolean }) => item.deferred).length;
        setPublishStatus(status && typeof status === "object" ? status : {});
        setReviewCount(active);
        setDeferredCount(deferred);
        setTab(landingTab({ activeCount: active, deferredCount: deferred }) as DirectoryTabId);
        setLoadError("");
      } catch (error) {
        if (cancelled) return;
        setLoadError(error instanceof Error ? error.message : "Could not load Directory.");
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const tabs = useMemo(
    () => directoryTabsModel({ deferredCount, reviewCount }),
    [deferredCount, reviewCount]
  );
  const band = useMemo(
    () => statusBandFromPublishStatus(publishStatus, { reviewCount }),
    [publishStatus, reviewCount]
  );
  return (
    <div className="directory-home">
      <h1>Directory</h1>
      <StatusBand
        model={band}
        onReview={() => {
          setTab("review");
          setReviewFocusNonce((count) => count + 1);
        }}
      />
      <DirectoryTabs tabs={tabs} active={tab} onChange={setTab}>
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
              onQueueChanged={({ activeCount, deferredCount: nextDeferred }) => {
                setReviewCount(activeCount);
                setDeferredCount(nextDeferred);
              }}
              onCatalogChanged={refreshPublish}
              onOpenListing={(organizationId) => {
                setListingFocusId(organizationId);
                setTab("listings");
              }}
              onKeepReviewingLater={() => setTab("needs")}
              onRequestTab={setTab}
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
