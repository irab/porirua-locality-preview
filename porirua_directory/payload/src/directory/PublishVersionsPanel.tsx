"use client";

import { useEffect, useState } from "react";
import { directoryEditorFetch } from "../../../editor-core/client.mjs";
import { PUBLISH_ROUTES } from "../../../editor-core/publish-view.mjs";
import { PUBLISH_VERSIONS_COPY, publishVersionDto } from "../../../editor-core/publish-versions.mjs";

const CLIENT_BASE = "/api/directory-editor";

type PublishVersion = ReturnType<typeof publishVersionDto>;

type PublishVersionsPanelProps = {
  canSwitch?: boolean;
  switching?: boolean;
  onSwitch?: (version: number) => void;
  refreshNonce?: number;
};

export function PublishVersionsPanel({
  canSwitch = true,
  switching = false,
  onSwitch,
  refreshNonce = 0,
}: PublishVersionsPanelProps) {
  const [versions, setVersions] = useState<PublishVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [confirmVersion, setConfirmVersion] = useState<number | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const data = await directoryEditorFetch(PUBLISH_ROUTES.versions, { base: CLIENT_BASE });
        if (cancelled) return;
        const list = Array.isArray(data?.versions)
          ? data.versions.map((row: unknown) => publishVersionDto(row as Record<string, unknown>))
          : [];
        setVersions(list);
        setError("");
        setConfirmVersion(null);
      } catch (loadError) {
        if (cancelled) return;
        setVersions([]);
        setError(loadError instanceof Error ? loadError.message : PUBLISH_VERSIONS_COPY.loadError);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [refreshNonce, retryNonce]);

  return (
    <div className="publish-versions">
      <p className="directory-hint">{PUBLISH_VERSIONS_COPY.intro}</p>
      {error ? (
        <p className="error">
          {PUBLISH_VERSIONS_COPY.loadError}{" "}
          <button type="button" onClick={() => setRetryNonce((count) => count + 1)}>
            {PUBLISH_VERSIONS_COPY.tryAgain}
          </button>
        </p>
      ) : null}
      {loading ? <p className="directory-hint">{PUBLISH_VERSIONS_COPY.loading}</p> : null}
      {!loading && !error && !versions.length ? (
        <p className="directory-hint">{PUBLISH_VERSIONS_COPY.empty}</p>
      ) : null}
      <ol className="publish-versions-list">
        {versions.map((version) => (
          <li key={version.version}>
            <article className={version.isCurrent ? "publish-version current" : "publish-version"}>
              <h2>{version.publishedAtLabel}</h2>
              <p>
                {version.listingCountLabel}
                {version.isCurrent ? ` · ${version.currentLabel}` : ""}
              </p>
              {!version.isCurrent && canSwitch ? (
                <div className="publish-version-actions">
                  {confirmVersion === version.version ? (
                    <>
                      <button
                        type="button"
                        className="band-publish"
                        disabled={switching || !onSwitch || version.version == null}
                        onClick={() => version.version != null && onSwitch(version.version)}
                      >
                        {version.confirmLabel}
                      </button>
                      <button type="button" disabled={switching} onClick={() => setConfirmVersion(null)}>
                        {PUBLISH_VERSIONS_COPY.cancelSwitch}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      disabled={switching || version.version == null}
                      onClick={() => setConfirmVersion(version.version)}
                    >
                      {version.switchLabel}
                    </button>
                  )}
                </div>
              ) : null}
            </article>
          </li>
        ))}
      </ol>
    </div>
  );
}
