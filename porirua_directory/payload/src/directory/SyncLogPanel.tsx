"use client";

import { useEffect, useState, type FormEvent } from "react";
import { directoryEditorFetch } from "../../../editor-core/client.mjs";
import {
  FSD_SYNC_COPY,
  FSD_SYNC_PRESETS,
  importRunDto,
  importRunsPath,
} from "../../../editor-core/fsd-sync-log.mjs";

const CLIENT_BASE = "/api/directory-editor";

type SyncPreset = "all" | "7d" | "30d" | "custom";

type SyncRun = ReturnType<typeof importRunDto>;

export function SyncLogPanel() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [applied, setApplied] = useState({ preset: "all" as SyncPreset, from: "", to: "" });
  const [runs, setRuns] = useState<SyncRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const data = await directoryEditorFetch(
          importRunsPath({
            preset: applied.preset,
            from: applied.from,
            to: applied.to,
          }),
          { base: CLIENT_BASE }
        );
        if (cancelled) return;
        const list = Array.isArray(data?.runs) ? data.runs.map((row: unknown) => importRunDto(row)) : [];
        setRuns(list);
        setError("");
      } catch (loadError) {
        if (cancelled) return;
        setRuns([]);
        setError(loadError instanceof Error ? loadError.message : FSD_SYNC_COPY.loadError);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [applied]);

  function applyCustom(event: FormEvent) {
    event.preventDefault();
    setApplied({ preset: "custom", from, to });
  }

  return (
    <div className="sync-log">
      <p className="directory-hint">{FSD_SYNC_COPY.intro}</p>
      <div className="toolbar" role="group" aria-label="Filter FSD sync runs">
        {FSD_SYNC_PRESETS.filter((item) => item.id !== "custom").map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={applied.preset === item.id}
            className={applied.preset === item.id ? "active" : undefined}
            onClick={() => setApplied({ preset: item.id as SyncPreset, from: "", to: "" })}
          >
            {item.label}
          </button>
        ))}
      </div>
      <form className="sync-log-filter" onSubmit={applyCustom}>
        <label className="search">
          {FSD_SYNC_COPY.from}
          <input
            type="datetime-local"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
          />
        </label>
        <label className="search">
          {FSD_SYNC_COPY.to}
          <input type="datetime-local" value={to} onChange={(event) => setTo(event.target.value)} />
        </label>
        <button type="submit">{FSD_SYNC_COPY.apply}</button>
      </form>
      {error ? (
        <p className="error">
          {FSD_SYNC_COPY.loadError}{" "}
          <button type="button" onClick={() => setApplied({ ...applied })}>
            {FSD_SYNC_COPY.tryAgain}
          </button>
        </p>
      ) : null}
      {loading ? <p className="directory-hint">{FSD_SYNC_COPY.loading}</p> : null}
      {!loading && !error && !runs.length ? <p className="directory-hint">{FSD_SYNC_COPY.empty}</p> : null}
      <ol className="sync-log-list">
        {runs.map((run) => (
          <li key={run.id}>
            <article
              className={
                run.status === "failed" || run.stats?.sanity_aborted
                  ? "sync-log-run failed"
                  : "sync-log-run"
              }
            >
              <h2>{run.headline}</h2>
              <p>{run.summary}</p>
              {run.statLines.length ? (
                <details>
                  <summary>{FSD_SYNC_COPY.numbers}</summary>
                  <dl>
                    {run.statLines.map((line) => (
                      <div key={line.label}>
                        <dt>{line.label}</dt>
                        <dd>{line.value}</dd>
                      </div>
                    ))}
                  </dl>
                </details>
              ) : null}
            </article>
          </li>
        ))}
      </ol>
    </div>
  );
}
