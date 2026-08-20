# Community filter: Food / Pātaka Kai returned no listings

**Status:** Fixed  
**Date fixed:** 2026-08-20  
**Last verified:** 2026-08-20

## Summary

The community-path chip **Food / Pātaka Kai** (`kai_initiatives`) matched nothing because the tag was inferred only from the Connections Map `labels` column, and the published dataset has empty labels on every community row.

## Symptoms

- Connect with community → **Food / Pātaka Kai** showed an empty list.
- Other community chips (e.g. Marae and iwi) still returned results.

## Root cause

`mapCommunityRow` in `community-map.mjs` added `kai_initiatives` only when `labels` matched `kai` / `pātaka` / `food`. Merge prefers the live Google Sheet; that export (and therefore `data/services.json`) stored `communityMeta.labels` as `""` for all community orgs. Name and initiatives still described kai work (Kai Kaupapa Group, Te Umu, community gardens), but the filter never saw them.

A bare `pātaka` / `pataka` token would also have tagged **Pātaka Art + Museum** if the search were widened to names without tightening the phrase.

## Fix

Infer `kai_initiatives` from **name + labels + initiatives** using:

```text
\b(?:kai|food|pātaka kai|pataka kai)\b
```

`Pātaka Kai` matches; **Pātaka Art + Museum** does not.

Published community rows in `data/services.json` were retagged with the same mapper (no full FSD rebuild).

## Verification

```bash
cd porirua_directory
npm test
npx playwright test e2e/directory.spec.js -g "Food / Pātaka Kai"
```

## Related code paths

- `porirua_directory/scripts/lib/community-map.mjs`
- `porirua_directory/tests/community-map.test.mjs`
- `porirua_directory/e2e/directory.spec.js`
- `porirua_directory/config-directory.js` (`kai_initiatives`)
- `docs/porirua-directory-phase1-spec.md`
