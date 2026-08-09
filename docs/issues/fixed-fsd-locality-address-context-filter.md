# FSD Porirua filter: suburb token false positives (Whitby, Rānui, district mismatch)

**Status:** Fixed  
**Date:** August 2026

## Summary

FSD rows outside Porirua were included because suburb locality tokens matched **street names** or **homonym suburbs** in other cities, or because FSD listed **Porirua City** as `PHYSICAL_DISTRICT` while the street address was elsewhere.

## Symptoms

- **3 Whitby Street, Mornington, Dunedin** — Dunedin childcare listed in Porirua directory.
- **32 Pooks Road, Ranui, Auckland** (and similar **464 Swanson Road, Ranui, Auckland**) — Auckland Ranui, not Porirua Rānui.
- **Tautoko Services** — **31 Princess Street, Palmerston North** with FSD `PHYSICAL_DISTRICT: Porirua City`.
- **41 Ranui Avenue, Kerikeri** — Northland clinic; `Ranui` is a street name.
- **326 Don Buck Road, Massey, Waitakere** (sKids Massey) — West Auckland; `POSTAL_ADDRESS: 16 Platinum Rise, Ranui, 0612` matched Porirua **Rānui** while physical location is Auckland / Waitakere.

Rough scale before fix (Aug 2026): **461** published services (`52` community + `409` FSD), including FSD import rows across the patterns above (often duplicate service rows per provider in FSD).

## Root cause

1. **`whitby` and `r[āa]nui` tokens** in `PORIRUA_LOCALITY_PATTERN` matched substrings in unrelated addresses (`Whitby Street`, `Ranui Avenue`, `Ranui, Auckland`) with no check that the address line also referred to Porirua or Wellington suburbs.
2. **District rule** trusted `PHYSICAL_DISTRICT` matching `/porirua/i` with no cross-check against `PHYSICAL_ADDRESS`. FSD metadata for Tautoko Services incorrectly set district to Porirua City while the physical address is Palmerston North.
3. **Postal-only suburb tokens** — `POSTAL_ADDRESS` can name **Ranui** without “Auckland” or “Porirua” on the same line (e.g. `16 Platinum Rise, Ranui, 0612`). The filter treated that like Porirua Rānui even when `PHYSICAL_REGION` / `PHYSICAL_ADDRESS` were clearly Waitakere / Massey.

Christchurch **Aranui** was fixed separately ([fixed-fsd-aranui-christchurch-filter.md](./fixed-fsd-aranui-christchurch-filter.md)).

## Fix

In `porirua_directory/scripts/fsd-porirua-rules.mjs`:

- **`NON_PORIRUA_ADDRESS_LOCALITY_PATTERN`** — named cities/towns that contradict a suburb-token match on the same address line.
- **`isPoriruaAddressContext`** — for `PHYSICAL_ADDRESS` / `POSTAL_ADDRESS`, require `Porirua` in the line or absence of a non-Porirua locality.
- **`physicalAddressContradictsPoriruaDistrict`** — drop rows where district is Porirua but the physical address names another city without Porirua.
- **`physicalLocationOutsidePorirua`** — ignore a `POSTAL_ADDRESS` suburb-token match when physical region/district/address indicates Auckland / West Auckland (sKids Massey pattern).

Legitimate **Whitby, Porirua** and **Ranui, Porirua** (and **Ranui Grove, Porirua**) rows still pass.

## Verification

```bash
cd porirua_directory
npm test   # Dunedin Whitby St, Auckland Ranui, Kerikeri Ranui Ave, Tautoko district mismatch, sKids Massey postal Ranui
npm run build:data
```

After rebuild: **434** published services (`52` community + **382** FSD), **−27** FSD rows vs the pre–address-context build (409 FSD).

```bash
rg 'Whitby Street|Pooks Road, Ranui, Auckland|Palmerston North|Ranui Avenue, Kerikeri|326 Don Buck Road, Massey' data/services.json
# → no matches
```

## Related

- `porirua_directory/tests/fsd-import.test.mjs`
- `docs/porirua-directory-phase1-spec.md` (FSD inclusion rules)
- [fsd-porirua-filter-rationale.md](../fsd-porirua-filter-rationale.md) (authoritative filter + audit)
