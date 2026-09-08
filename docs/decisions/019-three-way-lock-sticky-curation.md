# 019 Three-way lock / sticky curation

**Status:** accepted
**Date:** 2026-09-08
**Sources:** `abe2a73`, `814b9a6`; `porirua_directory/scripts/directus/sticky-curation.mjs`; `tests/should-queue-three-way.test.mjs`.

## Decision

Weekly sync diffs the incoming CSV against `raw_import` (the last accepted government values), not against the live listing. Fields an editor curated are stored as one `overrides` patch row per FSD target. Those fields stay on the published columns unless the editor accepts a later government change. Incoming values still appear on the queue item so the editor can see what they are refusing.

## Context

Without a lock, every Monday undoes Friday’s phone fix. Diffing against live columns would queue the editor’s own curation as a “government change.” The Ngāti Toa Street patch on `fsd-2964` is the concrete case that must not be proposed for reversion.

The rule was written (`814b9a6`) before it was enabled in the weekly runner (`abe2a73`), so a half-landed lock could not silently change the queue.

## Alternatives considered

- **Diff against live columns.** Lost: curated fields re-queue forever.
- **Drop incoming locked fields from `proposed`.** Lost: the editor cannot see what the government now says.
- **Auto-apply government values onto curated fields.** Lost: that is not curation.
- **Let editors type patch JSON.** Lost: they will not. Save upserts `{target_type, target_id, action: "patch", patch}`.

## Consequences

`hidden` and open hide/patch overrides keep incoming values in `proposed` and never auto-publish. Keep-curation refreshes `raw_import` without overwriting live columns ([011](./011-raw-import-merge-then-canonicalise.md)). `proposed.before` is recorded at queue time so Review diffs against the live listing, not against a stale form.

## Revisit if

Curation moves onto the organisation rather than the service line, or Locality wants a “accept all government fields except these” default that is wider than today’s patch keys.
