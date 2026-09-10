# 002 Catalog envelope shape and lossless row ↔ envelope round-trip

**Status:** accepted
**Date:** 2026-09-08
**Sources:** `3c3e1ca`, `056e708`; `porirua_directory/scripts/catalog-rows.mjs`, `catalog-envelope.mjs`; `tests/catalog-roundtrip.test.mjs`.

## Decision

The public payload is an Option B envelope (`generatedAt`, `counts`, `services[]`) identical in shape to the Phase 1 JSON. Mapping through catalog rows and back must be lossless, except `generatedAt`. Grain and both FSD identifiers are stored on the rows, not inferred at read time.

## Context

The UI, My list hash codes, and map pins already consume the Phase 1 envelope. Phase 2 had to persist that document without inventing a second public schema. Inferring `render_grain` from line count, or treating one FSD identifier as the other, looked cheaper until one-line organisation cards flattened and saved shortlist links pointed at the wrong card.

## Alternatives considered

- **Reshape the public JSON to a normalised org/service tree.** Lost: every client and every Playwright spec would change at once, and Option B cards would have to be rebuilt in the browser.
- **Infer grain and FSD ids on the way out.** Lost: a one-line org card becomes a flat listing; `fsdServiceId` in the envelope is `FSD_ID`, not `SERVICE_ID` ([020](./020-fsd-service-id-prefix.md)); My list slugs break.
- **Allow lossy bootstrap.** Lost: a second import would not be the same catalog.

## Consequences

`catalogToRows` / `buildCatalogEnvelope` are inverses of the committed JSON. The API must serve `catalog_snapshots.envelope` as stored — no `applyOrgGrouping` on the request path. If the property is lost, public ids drift, org cards flatten, weekly sync cannot match `SERVICE_ID`, and bootstrap and publish stop being inverses.

Honest limit: bootstrap **suffixes** two colliding public ids ([014](./014-disambiguate-duplicate-public-ids.md)), so the live envelope is not byte-identical to `data/services.json`. The round-trip test is against the committed file, before that suffix.

## Revisit if

The public UI is rewritten to consume normalised rows, or My list stops encoding listing ids in the hash. Until then, do not “simplify” stored grain to a count of lines.
