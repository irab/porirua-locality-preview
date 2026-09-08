# 015 Diacritic folding for matching; macronised form wins on display

**Status:** accepted (partial)
**Date:** 2026-09-08
**Sources:** `6dcd008`; `foldDiacritics` / `preferMacronisedName` in `porirua_directory/scripts/lib/normalize.mjs` and `name-match.mjs`; [open-duplicate-org-cards](../issues/open-duplicate-org-cards.md).

## Decision

Create-time and editor matching treat te reo macrons as the same letter (NFD fold, same as `slugId`). When two names fold equal, the form that **retains diacritics** wins for display. Published clustering does **not** yet use that fold.

## Context

`normalizedOrgName` is lowercase + trim only. That is why the catalog still shows two cards for Porirua Whānau / Whanau Centre and Te Rūnanga / Runanga o Toa Rangatira. Closing the fold on clustering drops the published catalog from 145 to 143 entries and needs its own before/after. The matcher was exported so create does not add a third card while that review is pending.

## Alternatives considered

- **Fold clustering now, in the same change as the matcher.** Lost: a silent 145→143 publish, and a naive grain-wins merge would keep the FSD spelling (no macron) because the FSD row often holds `render_grain=organization`.
- **Do not fold anywhere.** Lost: “Whanau” does not warn about “Porirua Whānau Centre”.
- **ASCII-fold to the FSD spelling for display.** Lost: Locality’s names are the macronised ones.

## Consequences

Partial on purpose. Survivors, when merge lands, must be **Porirua Whānau Centre** and **Te Rūnanga o Toa Rangatira**, not the FSD spellings. Three normalisation copies still exist (`normalizedOrgName`, inlined `normalizeName` in `orgClusterKey`, and `foldDiacritics`); a later clustering fix must reconcile all three. This is not a `public_id` collision ([014](./014-disambiguate-duplicate-public-ids.md)) — prefixes differ (`community-` vs `org-`).

## Revisit if

The merge tool ships with a snapshot diff, or someone changes `normalizedOrgName` without encoding `preferMacronisedName` in a test. Either is a catalog change, not a drive-by.
