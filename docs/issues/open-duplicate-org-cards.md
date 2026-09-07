# Open — duplicate organisation cards on the public catalog

**Status:** Open (seed backlog for the duplicate-merge editor task)  
**Date:** 2026-09-08  
**Related:** `scripts/lib/name-match.mjs`, `scripts/lib/org-cluster.mjs`, `scripts/lib/normalize.mjs`

## Summary

The published catalog shows four true-duplicate organisation pairs. Two come from `orgClusterKey` / sheet-entry splits. Two come from `normalizedOrgName` not folding te reo macrons, so community↔FSD merge never fires. Prefixes differ (`community-` vs `org-`), so there is no `public_id` collision — it is a duplicate-card bug, not a constraint violation.

Do **not** fold `normalizedOrgName` or change `orgClusterKey` as a drive-by. Closing the fold fork changes the published catalog (145 → 143 entries) and needs its own review plus a before-and-after snapshot diff.

Prefer an editor merge through the forthcoming merge tool over an automatic pipeline merge.

## The four pairs

| Pair | Cards | Why they split |
|------|-------|----------------|
| Te Waka Whaiora | `org-te-waka-whaiora-trust` (phone `04 237 9608`) and suffixed twin (`0800 826 428`), same address | `orgClusterKey` includes phone |
| Te Wāhi Tiaki Tātou | `community-te-wahi-tiaki-tatou` and suffixed twin | Sheet entered twice at slightly different addresses |
| Porirua Whānau Centre | `community-porirua-whanau-centre` “Porirua **Whānau** Centre”, 16 Bedford Court, Cannons Creek; `org-porirua-whanau-centre` “Porirua **Whanau** Centre”, same street | `normalizedOrgName` does not fold `ā` |
| Te Rūnanga o Toa Rangatira | `community-te-runanga-o-toa-rangatira` “Te **Rūnanga** O Toa Rangatira”; `org-te-runanga-o-toa-rangatira` “Te **Runanga** o Toa Rangatira” | `normalizedOrgName` does not fold `ū` |

Diacritic-and-punctuation folding on the current published catalog merges **exactly** the last two name groups. Zero false positives in current data.

## Three normalisation copies

A later clustering fix must reconcile all three or the split returns:

1. `normalizedOrgName` in `scripts/lib/org-cluster.mjs` — lowercase + trim only
2. Inlined `normalizeName(service.name).toLowerCase()` inside `orgClusterKey` in the same file
3. `slugId` / `foldDiacritics` in `scripts/lib/normalize.mjs` — NFD fold (already correct)

Create-time matching uses `foldOrgName` in `scripts/lib/name-match.mjs` (NFD + punctuation + legal suffixes). That module does **not** change clustering.

## Hard rule when they merge

Fold for comparison; **prefer the macronised form for display**.

- Survivors must be **Porirua Whānau Centre** and **Te Rūnanga o Toa Rangatira**, not the FSD spellings.
- Today the FSD row often holds `render_grain=organization` and the community row is `flat`. A naive grain-wins merge would strip macrons.
- Given two names that fold equal, the one retaining diacritics wins (`preferMacronisedName`). If the editor chooses, default to that form.

Encode the rule with a test wherever merge lands.

## Verification

`cd porirua_directory && node --test tests/name-match.test.mjs` — unfinished if Whānau/Whanau or Rūnanga/Runanga do not flag.
