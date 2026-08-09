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

Public listings (after merge, excluding rows with `duplicateOf` set):

| Field | Type | Notes |
|-------|------|--------|
| `id` | string | Stable slug |
| `name` | string | Display name |
| `description` | string | Plain language |
| `phone` | string | Normalised where possible |
| `url` | string | Website |
| `address` | string | Physical or venue |
| `lat`, `lng` | number \| null | Map pin |
| `categories` | string[] | Need IDs: `food`, `housing`, `money`, `safety`, `support`, `health`, `legal`, `work`, `everyday` |
| `communityFilters` | string[] | `marae_iwi`, `community_groups`, `councils`, `kai_initiatives`, `schools`, `other_community` |
| `orgType` | string | From Connections Map when present |
| `source` | `"community"` \| `"fsd"` | Internal; not shown as jargon on cards |
| `badges` | string[] | e.g. `Community map` |
| `communityMeta` | object | Optional: theme, themes, initiatives, labels |
| `duplicateOf` | string | If set, row is duplicate; public UI omits |

Envelope written to `services.json`:

```json
{
  "generatedAt": "ISO-8601",
  "counts": {
    "community": 0,
    "fsd": 0,
    "published": 0,
    "duplicatesHidden": 0
  },
  "services": []
}
```

---

## FSD inclusion rules

Documented in `fsd-porirua-rules.mjs`:

1. **District:** `PHYSICAL_DISTRICT` matches `/porirua/i`.
2. **Suburb / address:** `PHYSICAL_ADDRESS`, `POSTAL_ADDRESS`, or related fields match agreed locality tokens (Titahi Bay, Whitby, Cannons Creek, Waitangirua, Kenepuru, Plimmerton, Paekākāriki, Rānui, Elsdon, etc.).
3. **Exclude:** Wellington-region-only rows with no Porirua signal.
4. **Categories:** Map FSD `LEVEL_1_CATEGORY` and keywords to need `categories[]`.

No automated public/private business filter — team curates via overrides.

---

## Connections Map merge

- **Source:** `GOOGLE_SHEET_CSV_URL` from `scripts/config.mjs`, fallback `porirua_connections_map/data/organisations.csv`.
- **Mapping:** CSV columns `name`, `orgType`, `theme`, `themes`, `labels`, `lat`, `lng`, `url`, `description`, `initiatives`, `address`, `venue`.
- **Defaults:** `source: community`, `badges: ["Community map"]`, `communityFilters` from `orgType` table.
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
- Dual browse: need help vs connect with community (or unified chips if time-boxed).
- Crisis strip: compact; stronger on help path.
- Schools filter: available, **off by default** on community browse.

---

## Phase 2 pointer

Admin workflows (review queue, publish/hide, weekly FSD) — see requirements §6 and architecture Phase 2 section. **Directus** recommended for non-technical editors updating field content only; **D1** optional if building custom admin on Cloudflare.
