import { importRunDto } from "../editor-core/fsd-sync-log.mjs";

export class FsdSyncLogError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.name = "FsdSyncLogError";
    this.statusCode = statusCode;
  }
}

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const NZ_OFFSET = /GMT([+-])(\d{1,2})(?::(\d{2}))?/;

function nzOffsetMinutes(date) {
  const label =
    new Intl.DateTimeFormat("en-NZ", {
      timeZone: "Pacific/Auckland",
      timeZoneName: "shortOffset",
    })
      .formatToParts(date)
      .find((part) => part.type === "timeZoneName")?.value || "GMT+12";
  const match = label.match(NZ_OFFSET);
  if (!match) return 12 * 60;
  const sign = match[1] === "-" ? -1 : 1;
  return sign * (Number(match[2]) * 60 + Number(match[3] || 0));
}

function dateFromNzCivil(year, month, day, hour, minute, second, ms) {
  let utc = Date.UTC(year, month - 1, day, hour, minute, second, ms);
  let offset = nzOffsetMinutes(new Date(utc));
  utc = Date.UTC(year, month - 1, day, hour, minute, second, ms) - offset * 60 * 1000;
  offset = nzOffsetMinutes(new Date(utc));
  return new Date(Date.UTC(year, month - 1, day, hour, minute, second, ms) - offset * 60 * 1000);
}

export function parseImportRunBound(value, { endOfDay = false } = {}) {
  if (value == null || value === "") return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const dateOnly = raw.match(DATE_ONLY);
  if (dateOnly) {
    const year = Number(dateOnly[1]);
    const month = Number(dateOnly[2]);
    const day = Number(dateOnly[3]);
    return endOfDay
      ? dateFromNzCivil(year, month, day, 23, 59, 59, 999)
      : dateFromNzCivil(year, month, day, 0, 0, 0, 0);
  }
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

export function parseImportRunRange({ from, to } = {}) {
  const start = parseImportRunBound(from);
  const end = parseImportRunBound(to, {
    endOfDay: DATE_ONLY.test(String(to || "").trim()),
  });
  if (from && !start) throw new FsdSyncLogError(400, "from is not a valid date");
  if (to && !end) throw new FsdSyncLogError(400, "to is not a valid date");
  if (start && end && start.getTime() > end.getTime()) {
    throw new FsdSyncLogError(400, "from must be before to");
  }
  return { from: start, to: end };
}

export async function listImportRuns({ db, from, to, source = "fsd", limit = 200 } = {}) {
  if (!db) throw new Error("listImportRuns requires db");
  const range = parseImportRunRange({ from, to });
  const cap = Math.min(Math.max(Number(limit) || 200, 1), 500);
  const result = await db.query(
    `SELECT id, source, status, fsd_csv_url, started_at, finished_at, error_message, stats, notes
       FROM import_runs
      WHERE source = $1
        AND ($2::timestamptz IS NULL OR started_at >= $2)
        AND ($3::timestamptz IS NULL OR started_at <= $3)
      ORDER BY started_at DESC
      LIMIT $4`,
    [source, range.from, range.to, cap]
  );
  return {
    runs: result.rows.map((row) => importRunDto(row)),
  };
}
