# 005 `data/services.json` is a static fallback, not the source of truth

**Status:** accepted
**Date:** 2026-09-08
**Sources:** `4667290`, `3c337a7`; `porirua_directory/directory-data.js`; e2e asserts which source the page consumed.

## Decision

The UI fetches `./api/catalog` first. It falls back to the baked `./data/services.json` when the API is missing, hangs, or returns a body that is not a catalog envelope. The committed JSON is a point-in-time copy shipped in the nginx image.

## Context

[001](./001-public-catalog-from-database.md) moved the live catalog into Postgres. A hung or HTML-serving `/api` used to white-screen the directory (a 200 HTML catch-all is exactly what **prod** still does today). The site has to stay up when the new path fails, including on the Phase 1 host that has no API.

## Alternatives considered

- **API only, no fallback.** Lost: Postgres or API downtime takes the public directory down.
- **Fallback on any non-200, without a shape check.** Lost: nginx answering `/api/catalog` with HTML (`3c337a7`) looks like success until `res.json()` throws or the UI binds the wrong document.
- **Wait forever for the API.** Lost: a hung pod blocks render. The guard aborts the same-origin fetch after four seconds.
- **Keep treating committed JSON as publishable truth.** Lost: editors would keep committing JSON instead of publishing a snapshot.

## Consequences

When the database or API is unavailable the visitor sees the **baked** catalog. That copy only changes when the nginx image is rebuilt. On `main`, the image job is the nginx build. On directory-dev, the baked file is whatever SHA is pinned — it can be days or weeks behind snapshot `ETag` 12 (the live envelope on 8 Sep 2026). Fallback ids may still be the unsuffixed collision ids; the live API has both `org-te-waka-whaiora-trust` and `org-te-waka-whaiora-trust-342f` (and the matching Tiaki Tātou pair). Tests assert which source the page consumed so a silent fallback cannot hide an API outage.

## Revisit if

The nginx image is rebuilt from every publish (then the fallback is fresh, and [001](./001-public-catalog-from-database.md) is half undone), or the UI is allowed to show an explicit “catalog unavailable” empty state instead of stale data.
