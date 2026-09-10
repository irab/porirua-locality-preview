# 001 Public data is served from a database, not the committed JSON

**Status:** accepted
**Date:** 2026-09-08
**Sources:** `c690b9e`, `4667290`, `7c316c0`; `porirua_directory/api/`; `porirua_directory/directory-data.js`. Related: [005](./005-services-json-static-fallback.md).

## Decision

The public directory reads a materialised catalog snapshot from PostgreSQL through `GET /api/catalog`. The committed `data/services.json` is no longer the live catalog.

## Context

Phase 1 published by baking JSON into the nginx image. The original Phase 2 assumption was that the public site would stay static: editors would change rows somewhere, and a rebuild would still be the publish step. That assumption died the moment Locality needed a change to reach `directory-dev.bsky.nz` without waiting for an image pin. Every later Phase 2 decision (snapshots, purge, fallback, sidecar, weekly queue) exists because this one was taken.

## Alternatives considered

- **Keep baking JSON and rebuild nginx to publish.** Lost: a pin is an ops action, not an editor action, and it couples content to the deploy path.
- **Cloudflare D1 + Workers as the store.** Documented as an exit in requirements v1.3, not the path being built. It would need a custom admin UI. Directus on Postgres was chosen so non-technical editors could work without a schema designer.
- **Do nothing (Phase 1 forever).** Lost: weekly FSD review and in-place publish cannot sit on a git file.

## Consequences

Postgres is the canonical store. The API serves a snapshot envelope, not a join of live rows. Prod at `directory.bsky.nz` still runs the Phase 1 nginx pin — this decision is live on **dev only**. The team now operates five images, a PVC, and a publish/purge path that Phase 1 never had.

## Revisit if

Locality withdraws Directus and accepts a custom admin (the D1 exit), or if the public site is required to run with no database at all — in which case the baked JSON becomes the catalog again and publish returns to an image rebuild.
