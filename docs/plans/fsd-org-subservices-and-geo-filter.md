# FSD org / subservice model

**Date:** 2026-08-10  
**Status:** Org grouping proposed for Phase 2 (optional Phase 1.5 import tweak).

**Fixed geo false positives** (e.g. non-Porirua addresses in the FSD slice) are documented in [issues/README.md](../issues/README.md), not in this plan.

---

## 1. Problems reported

| Issue | Symptom | Root cause |
|-------|---------|------------|
| Duplicate cards | e.g. 13× “The Salvation Army - Porirua” | FSD is **one CSV row per service**; import maps each row to a flat `service` but **`id` is slugged from `PROVIDER_NAME` only**, so many rows share one `id` while remaining separate array entries. UI lists each row. |
| Org vs service | User expects one org with subservices | Phase 1 schema is **flat**; no `organizationId`, `parentId`, or nested `services[]`. |

**Dataset snapshot (Aug 2026, after locality filter fixes):** 461 published rows (52 community + 409 FSD). Salvation Army - Porirua still **13 separate listings** (same `fsd-the-salvation-army-porirua` id).

---

## 2. FSD CSV row model (provider vs service)

The DIA FSD export is **service-grain**, not org-grain. Relevant columns (2026 feed):

| Column | Role |
|--------|------|
| `FSD_ID` / `SERVICE_ID` | Stable identifiers for the **service line** (use for unique ids). |
| `PROVIDER_NAME` | Organisation / site name (repeated on every service row). |
| `SERVICE_NAME`, `SERVICE_DETAIL` | What is offered (varies per row). |
| `LEVEL_1_CATEGORY`, `LEVEL_2_CATEGORY` | Taxonomy for category mapping. |
| `PHYSICAL_REGION`, `PHYSICAL_DISTRICT`, `PHYSICAL_ADDRESS`, `POSTAL_ADDRESS` | Geography for Porirua filter. |
| `ORGANISATION_PURPOSE` | Provider-level blurb (repeated). |
| Phones, websites, lat/lng | Usually provider/site level. |

There is **no** `SERVICE_AREA` column in the current CSV (the import rules still list it for forward compatibility if DIA adds it).

**Import flow today:** `fsd-import.mjs` → filter with `isPoriruaRelevant` → `mapFsdRowToService` → one JSON object per CSV row → merge with community map → `services.json`.

**Residual geo risks (monitor):** broad address text mentioning “Porirua” for a national provider; district-only inclusion trusting FSD data quality; one-off bad rows via `data/overrides.json` `hiddenIds`. See [issues](../issues/README.md) for resolved filter bugs.

---

## 3. Current flat schema vs desired org hierarchy

### Phase 1 `services.json` record (published)

See `docs/porirua-directory-phase1-spec.md`. Each entry is one **listing card**: `id`, `name`, `description`, contact, geo, `categories`, `source`, optional `duplicateOf`.

- **No** `organizationId`, `providerFsdId`, `serviceId`, `parentId`, or `children`.
- **Dedupe** (`normalize.mjs` + `merge-services.mjs`): only **community vs FSD** on `dedupeKey(name, lat, lng)` — not FSD-vs-FSD, not org grouping.

### `mapFsdRowToService` behaviour

- **Display name:** `PROVIDER_NAME` (fallback `SERVICE_NAME`).
- **Description:** `SERVICE_DETAIL` → `SERVICE_NAME` → `ORGANISATION_PURPOSE`.
- **Description formatting:** FSD CSV fields often contain CRLF paragraph breaks and line-leading `-` lists (e.g. CAB Porirua). Import normalizes line endings to `\n` without collapsing whitespace; the directory UI renders descriptions via `format-description.mjs` (paragraphs, `<ul>` lists, and single-line ` - ` bullets).
- **Id:** `slugId(PROVIDER_NAME, "fsd-")` — **ignores `FSD_ID` / `SERVICE_ID`**, causing duplicate ids and duplicate UI cards for multi-service providers.

---

## 4. Options: Phase 1 vs Phase 2

### Option A — Phase 1.5 pipeline only (minimal UX change)

**Goal:** Correct cards without nested UI.

| Change | Effort |
|--------|--------|
| Set `id` from `FSD_ID` or `SERVICE_ID` (fallback slug) | **Small** — one line + tests |
| Optionally set `name` to `SERVICE_NAME` when distinct from provider, subtitle provider in UI later | **Small** |
| Collapse duplicate ids at merge (keep richest description / union categories) | **Medium** — merge policy decisions |

**Pros:** Fast; fixes duplicate Salvation Army cards; each card = one service (matches FSD).  
**Cons:** Still many cards per org; no “expand org” UX.

### Option B — Phase 2 schema + import grouping

**Goal:** One org card with subservices in UI.

**Schema sketch (additive):**

```json
{
  "id": "org-fsd-…",
  "name": "The Salvation Army - Porirua",
  "kind": "organization",
  "services": [
    { "id": "fsd-…", "name": "Food bank", "description": "…", "categories": ["food"] }
  ]
}
```

Or flat list with links:

```json
{
  "id": "fsd-<SERVICE_ID>",
  "organizationId": "org-<provider-slug>",
  "parentId": null,
  "serviceName": "…"
}
```

| Work | Estimate |
|------|----------|
| Import: group by `PROVIDER_NAME` + site address (or DIA provider key if available) | **1–2 days** |
| Merge/dedupe rules for org vs service | **0.5–1 day** |
| UI: org detail, subservice list, search/index across subservices | **2–4 days** |
| E2E + spec/docs | **0.5 day** |
| Overrides model (`hiddenIds` / patches at org vs service level) | **0.5 day** |

**Pros:** Matches user mental model; cleaner browse for large NGOs.  
**Cons:** Larger UI and admin surface; Phase 2 admin (Directus) should align on org entity.

### Option C — UI-only grouping (no schema change)

Group rendered cards by normalised `name` + lat/lng in `directory.js`.

| Work | **1–2 days** UI + E2E |
| **Pros:** No pipeline change. |
| **Cons:** Fragile (name variants); search/filter semantics harder; duplicate ids remain in JSON. |

### Recommendation

1. **Next quick win (Phase 1.5):** Unique `id` per FSD row via `SERVICE_ID` / `FSD_ID`; consider display `name` = service title where useful.  
2. **Phase 2:** Org hierarchy in schema + grouped UI when product prioritises NGO browse over flat FSD parity.

Community map rows stay **org-grain** already; merge logic would treat FSD org groups as matching one community pin when name/geo align.

---

## 5. Verification

```bash
cd porirua_directory
npm test
npm run build:data
```

---

## 6. References

- `porirua_directory/scripts/fsd-porirua-rules.mjs` — filter + mapping
- `porirua_directory/scripts/fsd-import.mjs` — CSV → raw JSON
- `porirua_directory/scripts/merge-services.mjs` — community + FSD + overrides
- `docs/porirua-directory-phase1-spec.md` — service schema and inclusion rules
- `docs/issues/README.md` — fixed pipeline bugs (geo filter, etc.)
