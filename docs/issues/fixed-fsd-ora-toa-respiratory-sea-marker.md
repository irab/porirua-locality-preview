# FSD bad geocode: Porirua Respiratory Support group – Ora Toa (sea marker)

**Status:** Fixed  
**Date:** August 2026

## Summary

The asthma support group at Ora Toa appeared on the directory map **in the Tasman Sea** west of Porirua because FSD published **district-level coordinates with no physical address**, and those lat/lng values were wrong for Porirua City.

## Symptoms

- Map marker for **Porirua Respiritory Support group - Ora Toa** sat offshore near Kapiti/Mana while other Porirua services clustered on land.
- Service card showed **no street address**; phone and Asthma Foundation link only.

## Root cause

1. **Source:** FSD CSV row `FSD_ID` **4690** (`import:fsd` → `mapFsdRowToService` copies `LATITUDE` / `LONGITUDE` unchanged).
2. FSD fields: `PHYSICAL_ADDRESS` and `POSTAL_ADDRESS` **empty**; `PHYSICAL_DISTRICT` **Porirua City**.
3. FSD coordinates **−41.080194, 174.760239** (~174.76°E) plot **offshore** northwest of Porirua (~174.84°E on land). Not introduced by merge or community map (no duplicate row).
4. Inclusion in the Porirua filter is correct (district = Porirua City); the defect is **upstream FSD geocoding**, not the geo filter.

## Correct location

Monthly respiratory support group meets at **Ora Toa Health Unit**, **22 Ngāti Toa Street, Takapūwāhia, Porirua** (same site as Ora Toa community health; see [oratoa.co.nz/community-health](https://www.oratoa.co.nz/community-health)).

Geocode (OpenStreetMap/Nominatim, Aug 2026): **−41.1248, 174.835605**.

## Fix

`data/overrides.json` patch on service id `fsd-porirua-respiritory-support-group-ora-toa`:

- Set `address`, `lat`, and `lng` at merge time (no import-rule change; not systematic across FSD).

## Verification

```bash
cd porirua_directory
npm run merge:services   # or npm run build:data
npm test
node -e "const s=require('./data/services.json').services.find(x=>x.id.includes('respiritory')); console.log(s.address, s.lat, s.lng)"
# → 22 Ngāti Toa Street…  -41.1248  174.835605
```

## Related

- `porirua_directory/data/overrides.json`
- `porirua_directory/scripts/merge-services.mjs`
- `docs/porirua-directory-phase1-spec.md` (overrides)
- `porirua_directory/tests/merge-services.test.mjs` (patch regression)
