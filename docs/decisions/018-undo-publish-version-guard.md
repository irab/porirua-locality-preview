# 018 Undo publish is version-checked

**Status:** accepted
**Date:** 2026-09-08
**Sources:** `41199c9`, `5fdf33b`, `eb1e749`; `porirua_directory/scripts/undo-publish.mjs`; `editor-core/undo-publish.mjs`.

## Decision

Undo last publish points `is_current` at the previous snapshot only when the caller’s expected version is still current. A leftover tab, or a second editor who published later, is refused. Undo also purges the edge ([004](./004-cloudflare-purge-on-publish.md)). Availability is computed from the last server check, not a local timer; it lasts until the next publish or 24 hours.

## Context

Publish is an explicit, immediate action. Editors asked for undo. Without a version guard, Kahu’s leftover tab could roll back Moana’s later publish and the public site would silently rewind. That is worse than no undo.

## Alternatives considered

- **Undo always rolls back one version.** Lost: two-editor clobber.
- **No undo; tell them to pick a snapshot and Roll back.** Safer, slower, and the accepted interface required a toast / status-band undo.
- **Client-side 24-hour timer only.** Lost: a refresh or a second tab disagrees with the server (`eb1e749`).
- **Skip purge on undo.** Lost: undo would be cosmetic at the edge.

## Consequences

The sidecar 400s when the expected version does not match. Bulk approve/hide/reject must put `undoId` on the response body so the toast is not lost when those routes go through `runBulkQueue` (`4211743`). Roll back of an arbitrary historical version remains a separate, item-only action.

## Revisit if

Locality wants a longer undo window, or more than two editors publishing in the same hour and need an undo log rather than “last snapshot only.”
