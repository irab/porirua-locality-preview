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
| Weekly FSD collapse / diff / runner (Phase 2) | `porirua_directory/scripts/fsd-sync-collapse.mjs`, `fsd-sync-diff.mjs`, `fsd-sync-run.mjs` |
| Connections + FSD merge | `porirua_directory/scripts/merge-services.mjs` |
| Normalisation / dedupe | `porirua_directory/scripts/lib/normalize.mjs` |
| Org grouping (Option B) | `porirua_directory/scripts/org-grouping.mjs` |
| Catalog row mapping (Phase 2) | `porirua_directory/scripts/catalog-rows.mjs`, `catalog-envelope.mjs` |
| Catalog schema / bootstrap / publish | `porirua_directory/scripts/db-schema.sql`, `db-import-from-json.mjs`, `publish-catalog.mjs` |
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
| `id` | string | FSD: `fsd-<SERVICE_ID>` when present, else `fsd-<FSD_ID>` |
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

(`published` = catalog cards, not raw FSD row count. `community` / `fsd` / `duplicatesHidden` are merge **input** sizes.)

### Catalog row mapping (Phase 2)

Pure functions — no database. `catalogToRows(envelope, overrides)` decomposes the published catalog into `organizations`, `services`, and `overrides` rows; `buildCatalogEnvelope({ organizations, services })` rebuilds the Option B envelope. A committed-catalog round-trip is lossless except `generatedAt` (`tests/catalog-roundtrip.test.mjs`).

**Grain is stored, not inferred.** `render_grain` is `'flat'` or `'organization'` copied from the existing entry (`kind`). Line count must not decide this. Re-running `applyOrgGrouping()` on read would change public ids and break saved My list entries.

**Two FSD id columns** on each service row: `fsd_service_id` (CSV `SERVICE_ID`, the weekly-sync diff key) and `fsd_legacy_id` (CSV `FSD_ID`, emitted as `fsdServiceId`).

**Unique `public_id` at bootstrap.** The committed JSON has two colliding card ids (`org-te-waka-whaiora-trust`, `community-te-wahi-tiaki-tatou`). `db-import-from-json.mjs` keeps the winner's bare id (most service lines, then lowest `line_id`, then `cluster_key`) and suffixes the other with `-<first 4 hex of sha256(cluster_key)>`. That is an id-uniqueness step only — editors merge duplicates later. `public_id` is `NOT NULL UNIQUE` in Postgres.

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
| (name, labels, or initiatives: kai, food, pātaka kai) | add `kai_initiatives` |
| Other | `other_community` |

---

## Dedupe

- **Key:** normalised name + rounded lat/lng (see `normalize.mjs`).
- **On collision:** keep **community** row as published; FSD row gets `duplicateOf` pointing at community `id`.
- **Description:** prefer community text when merging fields on the surviving row.
- **FSD multi-service providers:** one import row per CSV line; **`merge-services.mjs`** runs **`applyOrgGrouping()`** (cluster key = name + phone + address + geo). ≥2 lines → organization; import add/remove updates lines on rebuild. Unique **`id`** per line from **`SERVICE_ID`** (preferred) or **`FSD_ID`**. Community ↔ FSD: exact normalised name + geo/phone/address tie-break ([design doc](./design/org-service-grouping-options.md)).

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
- **Find support:** full listing by default (no chips selected); multi-select union category chips (tap to add, tap again to remove that topic); org cards show matching service rows when chips are on, with **See other services** to reveal hidden sibling lines on that card; opening a service row shows that line’s category labels; map shown when results have coordinates.
- Urgent help numbers: compact **sticky footer** labelled **Urgent help** on every page (landing, browse, About).
- Schools filter: available, **off by default** on community browse.

---

## Phase 2 pointer

Schema, bootstrap, and snapshot publish live in `porirua_directory/scripts/` (`db-schema.sql`, `db-import-from-json.mjs`, `publish-catalog.mjs`). Admin workflows (review queue, publish/hide, weekly FSD) — see requirements §6 and [architecture Phase 2](./architecture/porirua-directory-architecture.md#phase-2--catalog-store-in-repo-now). **Directus** is the editor UI; **D1** is an exit only.

### Weekly FSD sync — collapse, diff, and runner

The feed repeats `SERVICE_ID` across category rows. `importFsdFromCsv` does not de-duplicate; a first-row-wins weekly diff would flap when only CSV order moved. Pure helpers in `porirua_directory/scripts/` specify the contract; `fsd-sync-run.mjs` wires them to Postgres. `buildFsdImportReport`, `fsd-porirua-rules.mjs`, and `fsd-geocode-qa.mjs` stay the source of truth for filtering and geocode QA.

**`collapseFsdRows(mappedRows)`** (`fsd-sync-collapse.mjs`) groups already-mapped rows by **`SERVICE_ID`**. Mapped input must carry `SERVICE_ID` and `FSD_ID` as separate fields. Output repeats that split as **`fsd_service_id`** (the only diff key; database `fsd_service_id`) and **`fsd_legacy_id`** (DIA `FSD_ID`, still emitted on the public payload as `fsdServiceId`). Do not treat `fsdServiceId` as the catalog identity — `mapFsdRowToService` sets it from `FSD_ID`. Winner per group:

1. Most non-empty fingerprint fields (`name`, `serviceName`, `description`, `phone`, `url`, `address`, `lat`, `lng`, `categories`)
2. Then a non-null, in-bounds geocode per `fsd-geocode-qa.mjs`
3. Then lowest `FSD_ID`, then original CSV order

`categories` are unioned across the group (same idea as `buildOrganizationRecord`). The result carries `sourceRowCount` and `discardedFsdIds`.

**`diffFsdCatalog(collapsed, dbRows)`** (`fsd-sync-diff.mjs`) keys database rows on `fsd_service_id` = **`SERVICE_ID`**. Unmatched incoming rows are `new` with `proposed.match_confidence='low'` (no fuzzy name/address match). Fingerprint compare is against **`raw_import`** (last accepted snapshot), normalised via `scripts/lib/normalize.mjs` — editor edits to live fields do not re-queue. Kinds: `new`, `changed`, `removed`, `unchanged`, `geocode_flag`.

Locks: `status='hidden'` or an open `overrides` hide/patch keeps incoming values in `proposed` and never auto-publishes (`proposed.blocked_by_hidden` on hide). Removals never auto-hide. Missing `raw_import` is `changed` with `proposed.missing_raw_import`. `isIncludedCountBelowSanityThreshold` is true only when this week's included count is **strictly below** 75% of the last successful run (the runner aborts and writes zero removals). Open override rows use schema `action` (`hide` | `patch` | `community_owned`) and lock every key on `patch` jsonb — not a `type`/`field` pair. An open `community_owned` override skips `removed` for that `SERVICE_ID` and, when the id returns, queues `changed` with `proposed.fsd_returned`. Pending Review items can carry `proposed.deferred_at` (**Needs confirmation**); a later sync with a different proposal fingerprint clears the mark. `editor_undo` holds the last Review decision so Undo can restore the queue row, live columns, and overrides. `catalog_publish_events` records who published or undid a snapshot (actor, time, version); Undo publish rolls back only the public pointer and must purge the edge cache.

The runner keeps **one pending** `review_queue_items` row per entity+kind (refresh `proposed` in place). A `changed` item does **not** write `services.status` — that column is only whether the listing is on the public site, and the queue row is the only workflow record. New FSD inserts still start as `pending_review` so they stay off the site until approved. Overloading status with review state unpublished 19 live rows on directory-dev (8 Sep 2026); production was the Phase 1 static site and was not affected. That status write is now forbidden. `approveReviewItem` refreshes `raw_import` and live columns but does not republish a `hidden` row. Reject of `kind=new` hides the row and writes the same hide override removals use, so the next sync cannot treat it as new again; it never writes `published`. Reject of any other kind restores live columns from `raw_import` and leaves `status` as it is.

**`status` writes (services / organizations).** `status` answers only “is this on the public site”. Workflow lives on `review_queue_items`. Every writer:

| Writer | What it writes | Legitimate? |
|--------|----------------|-------------|
| `fsd-sync-run` `insertNewService` | service `pending_review` | Yes — unreviewed FSD is off the site |
| `fsd-sync-run` `findOrCreateOrganization` | org `draft` when no cluster match | Yes — org stays off the site until a line is approved |
| `fsd-sync-run` `kind=changed` | nothing | Yes — must not touch status |
| `approveReviewItem` | `published` unless already `hidden`; draft org → `published` | Yes — accept puts it on the site; a hide stays off |
| `approveReviewItem` / `hideReviewItem` on `removed` | service `hidden` + hide override | Yes — take it off the site |
| `rejectReviewItem` on `new` | service `hidden` + hide override | Yes — “Don't add this” |
| `rejectReviewItem` on other kinds | does not write status | Yes |
| `keepAsCommunityReviewItem` | `pending_review` → `published` | Yes — keep it on the site |
| `listings` create | community org/service `published` | Yes — editor-created listings are on the site (public after Publish) |
| `listings` archive / restore | `hidden` / `published` (+ hide override) | Yes — Listings take-off / put-back |
| `db-import-from-json` bootstrap | copies envelope `status` | Yes — seed the catalog as committed |
| `catalog-rows` | maps JSON lines to `published` | Yes — Phase 1 envelope is the public set |
| Sidecar / Directus flows | no SQL of their own; they call the functions above | Yes |
| Directus bootstrap | `directus_users.status=active` only | Yes — not a catalog status | A `geocode_flag` already accepted or rejected for the same code is not raised again. Editors work in the **Directory module**, not the raw queue collection. **`approveReviewItem`** archives `kind=removed` via the hide path (`status=hidden` + hide override) and does not republish `proposed.after`. Keep-yours (`keepCurationReviewItem`) refreshes `raw_import` and leaves live columns alone. Community creates (`scripts/listings.mjs`) insert `status=published` and never write queue rows. Create-time name matching is `scripts/lib/name-match.mjs` (NFD fold plus distinctive token overlap; the warning is the only create-time guard). Do not change `normalizedOrgName` / `orgClusterKey` here. The weekly runner uses the **three-way lock rule** (`shouldQueueDiffItemThreeWay`): a locked field queues only when incoming FSD is neither the editor’s open patch nor last-seen `raw_import`. Live-dev dry-run (8 Sep 2026) newly queued **1** item (FSD 2964 address/lat/lng) over 162 FSD services. Queued `changed` rows also carry `reviewable_fields` so the editor can show “You set this earlier” on curated fields. The runner writes **`proposed.before`** from live listing columns at queue time so the item stays auditable if the row later changes; Review still shows the live listing as the left-hand side. `kind=new` does not store a before snapshot.

