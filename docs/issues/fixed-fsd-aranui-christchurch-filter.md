# FSD Porirua filter: Christchurch Aranui false positive

**Status:** Fixed  
**Date fixed:** 2026-08-10  
**Last verified:** 2026-08-10

## Summary

The Porirua FSD import included listings whose addresses contained **Aranui, Christchurch** because the locality regex token for Porirua suburb **Rānui** matched the substring `ranui` inside **Aranui**. The Rānui token was tightened with a negative lookbehind and word boundary so true Porirua Rānui addresses still match.

## Symptoms

- Christchurch / **Aranui** providers appeared in the Porirua directory after `npm run build:data`.
- Dataset review showed many **Christchurch** mentions and duplicate-looking Salvation Army **Aranui** rows alongside legitimate Porirua listings.
- Rough scale before fix (Aug 2026 review): ~530 rows in `services.json`, ~57 Christchurch mentions, ~14 Salvation Army - Aranui rows.

## Root cause

`PORIRUA_LOCALITY_PATTERN` in `fsd-porirua-rules.mjs` included `r[āa]nui` to match Porirua **Rānui**. In JavaScript, `"Aranui".match(/r[āa]nui/i)` succeeds because **`aranui`** contains **`ranui`**.

Any FSD row whose `PHYSICAL_ADDRESS`, `POSTAL_ADDRESS`, or other scanned address field contained “Aranui, Christchurch” was treated as Porirua-relevant when district alone did not already include Porirua. Rows with `PHYSICAL_DISTRICT: Porirua` were still correctly included via the district rule.

## Fix

In `porirua_directory/scripts/fsd-porirua-rules.mjs`, the Rānui token in `PORIRUA_LOCALITY_PATTERN` is now:

```text
(?<![a-z])r[āa]nui\b
```

**Aranui** no longer matches; addresses such as **Ranui Grove, Porirua** still match.

After rebuild, published slice was ~461 listings (~52 community + ~409 FSD) with no Christchurch / Aranui pollution in the dataset (Salvation Army Porirua duplicate **service** cards remained a separate org/subservices issue).

## Verification

```bash
cd porirua_directory
npm test   # includes isPoriruaRelevant Aranui / Ranui cases
npm run build:data
# Optional: rg 'Christchurch|Aranui' data/services.json  → no matches
```

Unit tests in `porirua_directory/tests/fsd-import.test.mjs`:

- `excludes Christchurch suburb Aranui (not Porirua Rānui)`
- `includes Porirua suburb Rānui in address`

## Related code paths

| Path | Role |
|------|------|
| `porirua_directory/scripts/fsd-porirua-rules.mjs` | `PORIRUA_LOCALITY_PATTERN`, `isPoriruaRelevant` |
| `porirua_directory/scripts/fsd-import.mjs` | CSV import; applies filter before mapping |
| `porirua_directory/tests/fsd-import.test.mjs` | Regression tests for locality matching |
| `docs/porirua-directory-phase1-spec.md` | FSD inclusion rules (token list; no bug narrative) |

## See also

- [FSD org / subservice model plan](../plans/fsd-org-subservices-and-geo-filter.md) — duplicate FSD cards (separate from this geo bug)
