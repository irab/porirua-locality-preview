import test from "node:test";
import assert from "node:assert/strict";
import {
  formatDuration,
  formatNzDateTime,
  importRunDto,
  importRunsPath,
  summarizeImportRun,
} from "../editor-core/fsd-sync-log.mjs";
import { listImportRuns, parseImportRunRange } from "../scripts/fsd-sync-log.mjs";

const SUCCESS_STATS = {
  totalCsvRows: 18432,
  includedCount: 412,
  excludedCount: 18020,
  queued: 7,
  new: 3,
  changed: 2,
  removed: 1,
  geocode_flag: 1,
};

test("importRunsPath sends ISO from/to for presets and custom dates", () => {
  const now = Date.parse("2026-09-11T12:00:00.000Z");
  assert.equal(importRunsPath({ preset: "all", now }), "/import-runs");
  assert.equal(
    importRunsPath({ preset: "7d", now }),
    `/import-runs?from=${encodeURIComponent("2026-09-04T12:00:00.000Z")}`
  );
  assert.equal(
    importRunsPath({ preset: "30d", now }),
    `/import-runs?from=${encodeURIComponent("2026-08-12T12:00:00.000Z")}`
  );
  assert.match(
    importRunsPath({ preset: "custom", from: "2026-09-01T09:00", to: "2026-09-08T17:30" }),
    /^\/import-runs\?from=.+&to=.+/
  );
});

test("summarizeImportRun writes a NZ-time readable success log", () => {
  const summary = summarizeImportRun({
    status: "success",
    startedAt: "2026-09-07T01:00:00+12:00",
    finishedAt: "2026-09-07T01:02:00+12:00",
    stats: SUCCESS_STATS,
  });
  assert.match(summary, /Monday 7 September 2026, 1:00 am/);
  assert.match(summary, /Finished successfully in 2 minutes/);
  assert.match(summary, /Read 18,432 national rows and kept 412 Porirua listings/);
  assert.match(summary, /Queued 7 updates for review: 3 new, 2 changed, 1 removed, 1 map-pin check/);
  assert.match(summary, /The public site was not changed/);
});

test("summarizeImportRun explains a sanity abort without implying a publish", () => {
  const summary = summarizeImportRun({
    status: "failed",
    startedAt: "2026-09-07T01:00:00+12:00",
    finishedAt: "2026-09-07T01:00:12+12:00",
    stats: {
      includedCount: 200,
      lastSuccessfulIncludedCount: 412,
      sanity_aborted: true,
    },
    errorMessage: "Sanity abort: included count 200 is below 75% of last successful 412",
  });
  assert.match(summary, /Stopped early in 12 seconds/);
  assert.match(summary, /below 75% of the last good run \(412\)/);
  assert.match(summary, /Nothing was taken off the site/);
  assert.doesNotMatch(summary, /Sanity abort: included count/);
});

test("summarizeImportRun keeps a fetch failure readable", () => {
  const summary = summarizeImportRun({
    status: "failed",
    startedAt: "2026-09-07T01:00:00+12:00",
    errorMessage: "Failed to fetch FSD CSV: 503 Service Unavailable",
  });
  assert.match(summary, /Failed\./);
  assert.match(summary, /Failed to fetch FSD CSV: 503 Service Unavailable/);
});

test("duration and NZ clock helpers stay stable", () => {
  assert.equal(
    formatDuration("2026-09-07T01:00:00+12:00", "2026-09-07T01:00:01+12:00"),
    "1 second"
  );
  assert.match(formatNzDateTime("2026-09-07T01:00:00+12:00"), /7 September 2026/);
});

test("parseImportRunRange rejects inverted and invalid bounds", () => {
  assert.throws(() => parseImportRunRange({ from: "nope" }), (error) => error.statusCode === 400);
  assert.throws(
    () => parseImportRunRange({ from: "2026-09-10T00:00:00.000Z", to: "2026-09-01T00:00:00.000Z" }),
    (error) => error.statusCode === 400 && /from must be before to/.test(error.message)
  );
  const range = parseImportRunRange({ from: "2026-09-01", to: "2026-09-01" });
  assert.ok(range.from < range.to);
});

test("listImportRuns maps rows and filters on started_at", async () => {
  const calls = [];
  const db = {
    async query(sql, params) {
      calls.push({ sql, params });
      return {
        rows: [
          {
            id: "run-1",
            source: "fsd",
            status: "success",
            fsd_csv_url: "https://example.test/fsd.csv",
            started_at: new Date("2026-09-07T01:00:00+12:00"),
            finished_at: new Date("2026-09-07T01:02:00+12:00"),
            error_message: null,
            stats: SUCCESS_STATS,
          },
        ],
      };
    },
  };
  const listed = await listImportRuns({
    db,
    from: "2026-09-01T00:00:00.000Z",
    to: "2026-09-11T00:00:00.000Z",
  });
  assert.equal(listed.runs.length, 1);
  assert.equal(listed.runs[0].headline, "Finished successfully");
  assert.match(listed.runs[0].summary, /Queued 7 updates/);
  assert.equal(importRunDto(listed.runs[0]).id, "run-1");
  assert.match(calls[0].sql, /import_runs/);
  assert.equal(calls[0].params[0], "fsd");
  assert.ok(calls[0].params[1] instanceof Date);
  assert.ok(calls[0].params[2] instanceof Date);
});
