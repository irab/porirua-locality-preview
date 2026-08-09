# Porirua Services Directory — Phase 1 technical spec

**Version:** 1.0 (2026-07-31)  
**Scope:** Phase 1 data pipeline (Milestone A) and public UI (Milestones B–D). Phase 2 admin is out of scope here.

**Architecture overview:** [architecture/porirua-directory-architecture.md](./architecture/porirua-directory-architecture.md)

---

## Phase 1 deliverables

| Deliverable | Location |
|-------------|----------|
| FSD Porirua import | `porirua_directory/scripts/fsd-import.mjs` |
| Filter + category rules | `porirua_directory/scripts/fsd-porirua-rules.mjs` |
| Connections + FSD merge | `porirua_directory/scripts/merge-services.mjs` |
| Normalisation / dedupe | `porirua_directory/scripts/lib/normalize.mjs` |
| Org grouping (Option B) | `porirua_directory/scripts/org-grouping.mjs` |
| Published dataset | `porirua_directory/data/services.json` |
| Manual curation | `porirua_directory/data/overrides.json` |
| Public UI | `index.html`, `directory.js`, `config-directory.js`, `directory.css` |
| E2E tests | `e2e/directory.spec.js`, `playwright.config.js` |
| Container | `Dockerfile`, `infra/nginx.conf` |
| Unit tests | `porirua_directory/tests/*.test.mjs` |

**Commands:**

```bash
cd porirua_directory
npm install
npm test
npm run build:data   # import FSD + merge → services.json
```

---

## Service record

Published `services.json` is a **catalog**: flat listings and/or `kind: "organization"` entries with nested `services[]` (Option B).

### Flat listing

| Field | Type | Notes |
|-------|------|--------|
| `id` | string | FSD: `fsd-<FSD_ID>` when present |
| `fsdServiceId`, `serviceName` | string | Optional FSD line metadata |
| `name` | string | Display name (provider) |
| `description` | string | Plain language; FSD values may include `\n` line breaks and `-` lists — import preserves newlines (`normalizeDescriptionText`); public UI renders via `format-description.mjs` |
| `phone` | string | Normalised where possible |
| `url` | string | Website |
| `address` | string | Physical or venue |
| `lat`, `lng` | number \| null | Map pin |
| `categories` | string[] | Need IDs: `food`, `housing`, `money`, `safety`, `support`, `health`, `legal`, `work`, `everyday` |
| `communityFilters` | string[] | `marae_iwi`, `community_groups`, `councils`, `kai_initiatives`, `schools`, `other_community` |
| `orgType` | string | From Connections Map when present |
| `source` | `"community"` \| `"fsd"` | Internal; not shown as jargon on cards |
| `badges` | string[] | Optional public labels; community rows default to `[]` (provenance is `source`, not shown as a card badge) |
| `communityMeta` | object | Optional: theme, themes, initiatives, labels |
| `duplicateOf` | string | Pre-grouping merge only; UI omits |

### Organization (`kind: "organization"`)

| Field | Notes |
|-------|--------|
| `id` | Org card id (favourites, map) |
| `services[]` | Lines with `lineId`, `id`, `title`, `serviceName`, `description`, `categories`, `source` |

Filters use **service-line** grain via `expandServiceLines()` in `directory-data.js`.

Envelope:

```json
{
  "generatedAt": "ISO-8601",
  "counts": {
    "community": 0,
    "fsd": 0,
    "published": 0,
    "serviceLines": 0,
    "organizations": 0,
    "duplicatesHidden": 0
  },
  "services": []
}
```

(`published` = catalog cards, not raw FSD row count.)

---

## FSD inclusion rules

**Authoritative rationale, examples, audit workflow:** [fsd-porirua-filter-rationale.md](./fsd-porirua-filter-rationale.md)

Documented in `fsd-porirua-rules.mjs`:

1. **District:** `PHYSICAL_DISTRICT` matches `/porirua/i`, unless `PHYSICAL_ADDRESS` names another city/town and does not include Porirua (guards bad FSD metadata, e.g. district Porirua City with a Palmerston North street address).
2. **Suburb / address:** `PHYSICAL_ADDRESS`, `POSTAL_ADDRESS`, or `SERVICE_AREA` (if present) match agreed locality tokens (Titahi Bay, Whitby, Cannons Creek, Waitangirua, Kenepuru, Plimmerton, Paekākāriki, Rānui, Elsdon, etc.). Token definitions live in `PORIRUA_LOCALITY_PATTERN` in `fsd-porirua-rules.mjs`.
3. **Address context:** For `PHYSICAL_ADDRESS` and `POSTAL_ADDRESS`, a locality-token match is ignored when the same line also names a non-Porirua city/town (e.g. `Whitby Street, Dunedin`; `Ranui, Auckland`; `Ranui Avenue, Kerikeri`) unless the line also contains Porirua. See `NON_PORIRUA_ADDRESS_LOCALITY_PATTERN` and `isPoriruaAddressContext` in `fsd-porirua-rules.mjs`.
4. **Postal vs physical:** A `POSTAL_ADDRESS` suburb-token match (e.g. `Ranui, 0612` without “Porirua” on that line) is ignored when `PHYSICAL_REGION`, `PHYSICAL_DISTRICT`, or `PHYSICAL_ADDRESS` indicates the provider is outside Porirua (e.g. Auckland / Waitakere / Henderson–Massey with `326 Don Buck Road, Massey, Waitakere`). See `physicalLocationOutsidePorirua` in `fsd-porirua-rules.mjs`.
5. **Exclude:** Wellington-region-only rows with no Porirua signal.
6. **Categories:** Map FSD `LEVEL_1_CATEGORY` and keywords to need `categories[]`.

No automated public/private business filter — team curates via overrides.

**Import audit:** `npm run import:fsd` writes `data/fsd-porirua-excluded.json` (gitignored) with `reasonCode` per rejected row — see filter rationale doc and MVP runbook.

---

## Connections Map merge

- **Source:** `GOOGLE_SHEET_CSV_URL` from `scripts/config.mjs`, fallback `porirua_connections_map/data/organisations.csv`.
- **Mapping:** CSV columns `name`, `orgType`, `theme`, `themes`, `labels`, `lat`, `lng`, `url`, `description`, `initiatives`, `address`, `venue`.
- **Defaults:** `source: community`, `badges: []`, `communityFilters` from `orgType` table.
- **Categories:** Infer from `labels` (e.g. kai → `food`); do not map Assembly `theme` to need categories.

### orgType → communityFilters

| orgType (contains) | communityFilters |
|--------------------|------------------|
| Iwi & Marae | `marae_iwi` |
| Community Group, Kaupapa Group | `community_groups` |
| Council / Government | `councils` |
| School / Kura | `schools` |
| (labels: kai, pātaka, food) | add `kai_initiatives` |
| Other | `other_community` |

---

## Dedupe

- **Key:** normalised name + rounded lat/lng (see `normalize.mjs`).
- **On collision:** keep **community** row as published; FSD row gets `duplicateOf` pointing at community `id`.
- **Description:** prefer community text when merging fields on the surviving row.
- **FSD multi-service providers:** one import row per CSV line; **`merge-services.mjs`** runs **`applyOrgGrouping()`** (cluster key = name + phone + address + geo). ≥2 lines → organization; import add/remove updates lines on rebuild. Unique **`id`** per line from `FSD_ID` / `SERVICE_ID`. Community ↔ FSD: exact normalised name + geo/phone/address tie-break ([design doc](./design/org-service-grouping-options.md)).

---

## overrides.json

```json
{
  "hiddenIds": ["fsd-abc123"],
  "patches": {
    "fsd-xyz": { "description": "Corrected text" }
  }
}
```

Applied at merge time. `hiddenIds` removes rows from published output entirely.

---

## Phase 1 UI (Milestone B — not in this doc’s implementation scope)

- URL: `https://directory.bsky.nz`
- Dual browse: **Find support** vs **Connect with community** (landing subnav only; **Back** from browse).
- **Find support:** full listing by default (no chips selected); single-select category chips; optional **Show map** (sidebar checkbox; map only when enabled and results have coordinates).
- Crisis numbers: compact **sticky footer** on every page (landing, browse, About).
- Schools filter: available, **off by default** on community browse.

---

## Phase 2 pointer

Admin workflows (review queue, publish/hide, weekly FSD) — see requirements §6 and architecture Phase 2 section. **Directus** recommended for non-technical editors updating field content only; **D1** optional if building custom admin on Cloudflare.
