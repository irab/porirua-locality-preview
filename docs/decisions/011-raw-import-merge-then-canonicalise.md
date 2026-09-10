# 011 `raw_import` contract: merge previous, then canonicalise

**Status:** accepted
**Date:** 2026-09-08
**Sources:** `5d3f58b`, `fc2e2dc`; `rawImportFromAccepted` in `porirua_directory/scripts/approve-review.mjs`.

## Decision

The last-accepted government baseline (`services.raw_import`) is refreshed by **overlaying keys that are present** in the accepted payload onto the previous object, then filling any missing fingerprint keys from defaults. An absent key must never overwrite a known value.

## Context

Weekly sync diffs the new CSV against `raw_import`, not against live columns ([019](./019-three-way-lock-sticky-curation.md)). Approve must refresh that baseline or the same change is queued every Monday. The first implementation **replaced** the object with the payload. A partial editor approve — Directus sending `address` but omitting `url` and `categories` — dropped those keys. Next week the feed looked new. That is the phantom re-queue.

The sparse-baseline case is the same bug from the other side: a seed or insert that wrote a partial `raw_import` (no `categories` key) made every later compare treat `[]` vs missing as a change. `fc2e2dc` pins filling omitted fingerprint keys (`categories` → `[]`, strings → `""`, lat/lng → `null`) so that failure is loud in tests instead of quiet in production.

## Alternatives considered

- **Replace `raw_import` with the payload.** Lost: the phantom re-queue. Partial approve wipes url and categories.
- **Write only the keys that changed.** Lost: the next differ treats omitted fingerprint keys as “unknown” and re-queues (`fc2e2dc`).
- **Diff against live columns instead.** Lost: an editor’s curated phone looks like a government change every week ([019](./019-three-way-lock-sticky-curation.md)).
- **Treat missing `raw_import` as unchanged.** Lost: bootstrap gaps would never surface (`missing_raw_import`).

## Consequences

Both `service_name` / `serviceName` and `title` spellings write live columns, because Directus edit-and-approve used both. Keep-curation refreshes `raw_import` without touching live fields. Reject of a non-new item restores columns from `raw_import` and does not write `status`. Skipping the refresh is a contract break — `approveReviewItem` throws if the write did not land.

## Revisit if

The fingerprint field list changes (then defaults and aliases must change in the same commit), or approve starts recording a full government row so merge-from-partial is no longer required.
