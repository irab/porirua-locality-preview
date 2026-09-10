# 020 FSD bootstrap identity is `fsd-` + `SERVICE_ID`

**Status:** accepted
**Date:** 2026-09-08
**Sources:** `4aa6919`; `porirua_directory/scripts/lib/listing-identity.mjs`; comment on `attachFsdIdentity` in `fsd-sync-run.mjs`.

## Decision

FSD service row ids are `fsd-{SERVICE_ID}` from the national CSV. Weekly sync matches on that id. The published envelope field `fsdServiceId` is **`FSD_ID`** (legacy), not `SERVICE_ID`. The two must not be swapped.

## Context

The published JSON never stores `SERVICE_ID`. Treating `fsdServiceId` as the diff key queued every line as new plus removed on the first sync — the catalog looked like a complete replacement. `mapFsdRowToService` may fall back to `FSD_ID` for a display id; collapse and sync must attach CSV `SERVICE_ID` before that happens.

## Alternatives considered

- **Use `FSD_ID` as the durable key.** Lost: it is not unique in the way the weekly feed identity is; SERVICE_ID is what collapse already keys on.
- **Mint new UUIDs at bootstrap.** Lost: the next CSV cannot match.
- **Derive SERVICE_ID from the published id.** Lost: the published id is not SERVICE_ID.

## Consequences

Bootstrap must lock to the `fsd-` prefix so the first weekly run is a diff, not a wipe. Collapse is Porirua-included rows only, deterministic winner (richness, in-bounds geocode, FSD_ID) — first-row-wins would mark listings changed when only CSV order moved (`44a4373`). New SERVICE_IDs seed `raw_import` on insert so week two is `unchanged`, not `missing_raw_import`.

## Revisit if

DIA changes the meaning of SERVICE_ID / FSD_ID, or the public envelope starts exposing SERVICE_ID under a new field. Do not silently reuse `fsdServiceId` for that.
