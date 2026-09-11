export const FSD_SYNC_TIME_ZONE = "Pacific/Auckland";
export const FSD_SYNC_ROUTES = {
  importRuns: "/import-runs",
};

export const FSD_SYNC_COPY = {
  tab: "FSD sync",
  intro:
    "Each weekly government feed run. A run can add Review items. It does not change the public site.",
  from: "From",
  to: "To",
  apply: "Show runs",
  loading: "Looking for government feed runs…",
  loadError: "Could not load the FSD sync log.",
  tryAgain: "Try again",
  empty: "No government feed runs in this date range.",
  numbers: "Numbers from this run",
};

export const FSD_SYNC_PRESETS = [
  { id: "all", label: "All time" },
  { id: "7d", label: "Last 7 days" },
  { id: "30d", label: "Last 30 days" },
  { id: "custom", label: "Choose dates" },
];

function asDate(value) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (value == null || value === "") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function localDateTimeToIso(value, { endOfDay = false } = {}) {
  if (value == null || value === "") return "";
  const raw = String(value).trim();
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const time = endOfDay ? "T23:59:59" : "T00:00:00";
    const date = new Date(`${raw}${time}`);
    return Number.isNaN(date.getTime()) ? "" : date.toISOString();
  }
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

export function importRunsPath({ preset = "all", from = "", to = "", now = Date.now() } = {}) {
  const params = new URLSearchParams();
  if (preset === "7d" || preset === "30d") {
    const days = preset === "7d" ? 7 : 30;
    params.set("from", new Date(now - days * 86_400_000).toISOString());
  } else if (preset === "custom") {
    const start = localDateTimeToIso(from);
    const end = localDateTimeToIso(to, { endOfDay: /^\d{4}-\d{2}-\d{2}$/.test(String(to || "").trim()) });
    if (start) params.set("from", start);
    if (end) params.set("to", end);
  }
  const query = params.toString();
  return query ? `${FSD_SYNC_ROUTES.importRuns}?${query}` : FSD_SYNC_ROUTES.importRuns;
}

export function formatNzDateTime(value) {
  const date = asDate(value);
  if (!date) return "";
  const parts = new Intl.DateTimeFormat("en-NZ", {
    timeZone: FSD_SYNC_TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value || "";
  const dayPeriod = get("dayPeriod").toLowerCase();
  return `${get("weekday")} ${get("day")} ${get("month")} ${get("year")}, ${get("hour")}:${get("minute")} ${dayPeriod}`;
}

export function formatDuration(startedAt, finishedAt) {
  const start = asDate(startedAt);
  const end = asDate(finishedAt);
  if (!start || !end) return "";
  const ms = end.getTime() - start.getTime();
  if (!Number.isFinite(ms) || ms < 0) return "";
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return seconds === 1 ? "1 second" : `${seconds} seconds`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return minutes === 1 ? "1 minute" : `${minutes} minutes`;
  const hours = Math.round(minutes / 60);
  return hours === 1 ? "1 hour" : `${hours} hours`;
}

function localeCount(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString("en-NZ") : "";
}

export function importRunStatusLabel(status) {
  if (status === "success") return "Finished successfully";
  if (status === "failed") return "Failed";
  if (status === "running") return "Still running";
  return status ? String(status) : "Unknown";
}

export function importRunHeadline(run = {}) {
  const stats = run.stats && typeof run.stats === "object" ? run.stats : {};
  if (stats.sanity_aborted) return "Stopped early";
  return importRunStatusLabel(run.status);
}

function queuedKindParts(stats) {
  const parts = [];
  const next = Number(stats.new) || 0;
  const changed = Number(stats.changed) || 0;
  const removed = Number(stats.removed) || 0;
  const pins = Number(stats.geocode_flag) || 0;
  if (next) parts.push(`${next} new`);
  if (changed) parts.push(`${changed} changed`);
  if (removed) parts.push(`${removed} removed`);
  if (pins) parts.push(`${pins} map-pin check${pins === 1 ? "" : "s"}`);
  return parts;
}

export function summarizeImportRun(run = {}) {
  const when = formatNzDateTime(run.startedAt ?? run.started_at);
  const duration = formatDuration(run.startedAt ?? run.started_at, run.finishedAt ?? run.finished_at);
  const stats = run.stats && typeof run.stats === "object" ? run.stats : {};
  const headline = importRunHeadline(run);
  const lead = duration && run.status !== "running" ? `${headline} in ${duration}.` : `${headline}.`;
  const sentences = [lead];

  if (run.status === "running") {
    const text = sentences.join(" ");
    return when ? `${when} — ${text}` : text;
  }

  if (stats.sanity_aborted) {
    const included = localeCount(stats.includedCount ?? stats.included_count);
    const last = localeCount(stats.lastSuccessfulIncludedCount);
    if (included && last) {
      sentences.push(
        `This week's ${included} Porirua listings were below 75% of the last good run (${last}). Nothing was taken off the site.`
      );
    } else {
      sentences.push("Nothing was taken off the site.");
    }
    const text = sentences.join(" ");
    return when ? `${when} — ${text}` : text;
  }

  if (run.status === "failed") {
    const error = run.errorMessage ?? run.error_message;
    if (error) sentences.push(String(error));
    const text = sentences.join(" ");
    return when ? `${when} — ${text}` : text;
  }

  const total = localeCount(stats.totalCsvRows);
  const included = localeCount(stats.includedCount ?? stats.included_count);
  const excluded = localeCount(stats.excludedCount ?? stats.excluded_count);
  if (total && included) {
    sentences.push(`Read ${total} national rows and kept ${included} Porirua listings.`);
  }
  if (excluded && Number(stats.excludedCount ?? stats.excluded_count) > 0) {
    sentences.push(`Left ${excluded} rows out of Porirua.`);
  }

  const queued = Number(stats.queued) || 0;
  const kinds = queuedKindParts(stats);
  if (queued > 0) {
    sentences.push(
      `Queued ${queued} update${queued === 1 ? "" : "s"} for review${kinds.length ? `: ${kinds.join(", ")}` : ""}.`
    );
  } else {
    sentences.push("No new review items.");
  }
  sentences.push("The public site was not changed.");

  const text = sentences.join(" ");
  return when ? `${when} — ${text}` : text;
}

export function importRunStatLines(run = {}) {
  const stats = run.stats && typeof run.stats === "object" ? run.stats : {};
  const lines = [];
  const total = localeCount(stats.totalCsvRows);
  const included = localeCount(stats.includedCount ?? stats.included_count);
  const excluded = localeCount(stats.excludedCount ?? stats.excluded_count);
  const queued = localeCount(stats.queued);
  if (total) lines.push({ label: "National rows", value: total });
  if (included) lines.push({ label: "Porirua listings kept", value: included });
  if (excluded) lines.push({ label: "Left out of Porirua", value: excluded });
  if (queued) lines.push({ label: "Queued for review", value: queued });
  const kinds = queuedKindParts(stats);
  if (kinds.length) lines.push({ label: "Review mix", value: kinds.join(", ") });
  return lines;
}

export function importRunDto(row = {}) {
  const startedAt = row.startedAt ?? row.started_at ?? null;
  const finishedAt = row.finishedAt ?? row.finished_at ?? null;
  const errorMessage = row.errorMessage ?? row.error_message ?? null;
  const stats = row.stats && typeof row.stats === "object" ? row.stats : {};
  const started = asDate(startedAt);
  const finished = asDate(finishedAt);
  const run = {
    id: row.id,
    source: row.source || "fsd",
    status: row.status,
    fsdCsvUrl: row.fsdCsvUrl ?? row.fsd_csv_url ?? null,
    startedAt: started ? started.toISOString() : null,
    finishedAt: finished ? finished.toISOString() : null,
    errorMessage,
    stats,
    headline: importRunHeadline({ status: row.status, stats }),
    statLines: [],
    summary: "",
  };
  run.statLines = importRunStatLines(run);
  run.summary = summarizeImportRun(run);
  return run;
}
