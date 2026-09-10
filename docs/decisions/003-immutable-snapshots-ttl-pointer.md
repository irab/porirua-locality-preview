# 003 Immutable snapshots with an `is_current` pointer

**Status:** accepted
**Date:** 2026-09-08
**Sources:** `15d8595`, `b1eab64`, `8640a62`; `porirua_directory/api/catalog-service.mjs`; `scripts/publish-catalog.mjs`; `CATALOG_CURRENT_TTL_MS` in `scripts/config.mjs`. **LISTEN/NOTIFY is not mentioned in any commit or file** — the rejected alternative below is reconstructed from the cache design and the orchestrator brief, not from git.

## Decision

Publish writes a new immutable `catalog_snapshots` row and flips a single `is_current` pointer in one transaction. The API caches snapshot **bodies** in process by version forever. It re-checks only `SELECT version FROM catalog_snapshots WHERE is_current` on a short TTL (default 30s; directory-dev sets `5000`).

## Context

Editors publish many times a day. Rolling the API pod on every publish is an ops action. Serving live `organizations` / `services` on each request would leak drafts and hidden rows, and would reshape the envelope at the edge. Snapshots give the public path one blob and a pointer.

## Alternatives considered

- **Unbounded cache of the current pointer (bodies + “this is current” forever).** Lost: a publish is invisible until the API pod rolls. That is the Phase 1 rebuild problem in a new costume.
- **LISTEN/NOTIFY to push pointer updates.** Reconstructed, not found in git. It would need a sticky Postgres connection and reconnect logic on a one-replica Node process. It does not help the 24-hour **edge** cache — that is [004](./004-cloudflare-purge-on-publish.md). A 30s (5s in dev) pointer lag is acceptable for editors. The extra moving part lost.
- **No in-process cache.** Lost: every browse hits Postgres for a large JSON document.
- **Rebuild the envelope from rows on each request.** Lost: unpublished ids can leak; Option B shaping becomes a runtime dependency.

## Consequences

A failed pointer refresh keeps the last known snapshot. With nothing cached and no database the API returns `503` `{ "error": "catalog unavailable" }` — never a stack trace. `?version=N` pins a historical body without flipping `is_current` (verified: directory-dev `?version=1` returns `ETag: "1"`). Rollback is “point the flag at an earlier row”, not a rewrite.

## Revisit if

More than one API replica must see a publish in well under the TTL **and** the edge purge is no longer in the path — then a notify channel or a shared pointer cache might earn its complexity. Do not cache “current” forever without a invalidate story.
