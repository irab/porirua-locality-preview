# 009 Google Sheet retired for the directory, retained for the Connections Map

**Status:** accepted
**Date:** 2026-09-08
**Sources:** `porirua_directory/README.md` data-sources block; `scripts/listings.mjs` (creates do not insert `review_queue_items`); `porirua_connections_map/` still documents the sheet. Contrast the stale “Connections Map data” section in the same README, which still tells directory editors to edit the sheet.

## Decision

Directory community listings are created and edited in the Directory module. The Porirua Locality Google Sheet remains the source for the **Community Connections Map** embed. Nothing syncs between the two products.

## Context

Phase 1 merged the sheet into `data/services.json` so one static site could show both community groups and FSD lines. Once Postgres became the catalog ([001](./001-public-catalog-from-database.md)), a sheet cell was no longer a publish. The map app never moved off the sheet.

## Alternatives considered

- **Keep the sheet as the directory editor, merge on a cron.** Lost: that is Phase 1. It cannot express hide, review, or snapshot publish.
- **Feed the map from the directory catalog.** Lost: the map is an Assembly-themed Squarespace embed with its own vocabulary (org-type, initiatives). Coupling it would drag that vocabulary back onto Find support.
- **Two-way sync.** Lost: conflict rules, and no one asked for them.

## Consequences

`npm run merge:services` can still read the sheet when rebuilding the **baked fallback**. That is a bootstrap/fallback pipeline, not a live editor path. A sheet edit does not appear on directory-dev until someone rebuilds JSON, re-imports, and publishes — and that path is not how editors work. A directory create never appears on the map. Two people can add the same organisation in both places and produce a duplicate card ([014](./014-disambiguate-duplicate-public-ids.md), [015](./015-diacritic-folding.md)).

## Revisit if

The Connections Map is retired, or Locality explicitly wants the map to read `/api/catalog`. Until then, do not “helpfully” sync the sheet into listings.
