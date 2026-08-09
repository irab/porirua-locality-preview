# Organisation / service grouping — UX options

**Date:** 10 August 2026  
**Status:** Design + data analysis; **Option B MVP spike** on branch `feature/org-service-grouping-design` (runtime grouping in `group-services.mjs` + `directory.js`; not yet Phase 2 pipeline schema).  
**Audience:** Porirua Locality product, stakeholders, developers  

**Related:** [Org / subservices deficit](../potential-changes-and-insights.md#org--subservices-deficit-highlight) · [FSD org plan](../plans/fsd-org-subservices-and-geo-filter.md) · Analysis artifact: [`porirua_directory/data/org-clusters-preview.json`](../porirua_directory/data/org-clusters-preview.json) · Script: `porirua_directory/scripts/analyze-org-clusters.mjs`

---

## 1. Problem statement

The NZ Family Services Directory (FSD) export is **one row per service line**. Phase 1 import turns each row into one **listing card** in `services.json`. Large providers therefore appear as **many similar cards** with the same organisation name, often the same phone and address, and sometimes **identical opening paragraphs** in the description.

Users (help-seekers and community connectors) expect **one organisation (or one site)** with **several offerings** underneath — the same mental model as the **Community Connections Map** (one pin, initiatives listed in the sheet).

Today:

- There is no `organizationId`, nested `services[]`, or grouped card in the UI.
- **`id` is slugged from provider name only**, so multiple rows share one `id` while remaining separate array entries — **My list** and deep links cannot distinguish service lines reliably.

Need filters (e.g. **Feeling unsafe**, **Support and counselling**) should **surface the relevant offering** without hiding the org context.

---

## 2. Data analysis summary

**Source:** Published `services.json` (Aug 2026 rebuild): **434** listings (**52** `community`, **382** `fsd`).

**Method:** `node scripts/analyze-org-clusters.mjs` clusters by:

| Signal | Definition |
|--------|------------|
| Normalised org name | Same `name` after trim / whitespace collapse (case-insensitive) |
| Site key | `dedupeKey(name, lat, lng)` — name + coords rounded to 3 decimals |
| Phone / address | Normalised `phone` and `address` included in cluster key |
| Duplicate description | First 200 chars of description (flags repeated boilerplate) |

### Key counts

| Metric | Value |
|--------|------|
| Distinct normalised names with **≥ 2** listings | **76** |
| Listings in those multi-service name groups | **367** (~**85%** of published rows) |
| FSD-only name groups (≥ 2) | **75** |
| Groups sharing one duplicate `id` (≥ 2 rows) | **76** |
| Duplicate-description groups (≥ 2 rows) | **93** |

**Interpretation:** Most FSD volume is multi-row under a stable provider name at one site. Community rows are **org-grain** (52 single-card orgs); the grouping problem is overwhelmingly **FSD-in-support-mode**.

### Examples (stakeholder-facing)

| Pattern | Listings (same normalised name) | Notes |
|---------|----------------------------------|--------|
| Maraeroa Marae Health Clinic | 17 | Same `fsd-maraeroa-marae-health-clinic` id |
| Porirua Whanau Centre | 17 | Same id |
| Work and Income — Porirua Community Link | 16 | Same id |
| **The Salvation Army — Porirua** | **13** | Canonical “many cards” example |
| Family Works Central | 9 | **7 rows** share identical description opener (regional centre text) |
| Te Runanga o Toa Rangatira | 11 | Māori health / social hub pattern |
| Little Shadow | 5 | Same id, repeated description blocks |
| Literacy Aotearoa — Upper Hutt | 6 | FSD site naming; multi-line education |

**Capital & Coast / Te Whatu Ora:** Provider strings vary (**Capital & Coast DHB Rehabilitation Service**, **Child Adolescent Mental Health Services, Capital & Coast DHB**, **Capital Support**). **7** capital-related rows in the slice; **2** rehabilitation rows are **byte-identical** descriptions under the same name — a **name-variant + duplicate-text** pattern that pure name clustering under-counts unless Phase 2 adds a **provider root** (e.g. FSD `FSD_ID` parent or manual org alias table).

### Community vs FSD

| Source | Rows | Grouping today |
|--------|------|----------------|
| `community` | 52 | Already one card per org; initiatives in `communityMeta.initiatives` |
| `fsd` | 382 | Flat cards; merge dedupes **community vs FSD** only, not FSD-vs-FSD |

Name overlap between a community org and an FSD provider name in this snapshot: **0** exact normalised matches (FSD duplicates of community orgs are **hidden at merge**, not shown as extra cards).

---

## 3. Personas

### Help-seeker (Find support)

| Goal | Behaviour | Grouping need |
|------|-----------|---------------|
| Find **specific** help (safety, counselling, food) | Uses **need chips**, search, maybe map | Chip should **highlight** the matching **service line** inside the org, not repeat 13 full cards |
| Compare who to call | **My list**, `tel:` links | Save **org** or **specific service** with clear label on print/list |
| Low patience / stress | Skims titles, crisis footer | Org header + short service titles; avoid scrolling duplicate blurbs |

### Community connector (Connect with community)

| Goal | Behaviour | Grouping need |
|------|-----------|---------------|
| Find **groups**, kai, marae, schools | **Org-type chips**, map density | Prefer **one pin per org** with theme/initiatives (already on community rows) |
| See what’s active locally | Map + website | FSD-heavy map clutter is less central but still visible in “all pins” futures |
| Share with whānau | My list, print | Org-level favourite usually enough; subservices less critical |

---

## 4. UX options (3–4)

### Option A — Collapsed org card (default closed)

**Pattern:** One card per org in results; body shows address, phone, website; **“N services”** chevron collapsed by default. Expand reveals full list.

| Pros | Cons |
|------|------|
| Shortest scroll; familiar accordion | User may miss a service unless filter/search opens it |
| Works on mobile stack | SEO/snippet less granular per service |
| One **Add to list** at org level is simple | Per-service call numbers hidden until expand |

**Filter highlight:** On chip select, auto-**expand** orgs that have a matching subservice; non-matching lines de-emphasised (opacity) inside the org.

---

### Option B — Org header + always-visible service rows (recommended direction)

**Pattern:** Single card shell: **org name**, contact, map pin once. **Service rows** as subcards or `<ul>` lines (title + 1-line detail + optional **Call**). No second full description block per line unless expanded.

| Pros | Cons |
|------|------|
| Matches **Connections Map** “org + initiatives” | Taller cards for 10+ services |
| Filter chip can **glow** matching rows without hiding org | Requires **service-level titles** from FSD (`SERVICE_NAME`) in data |
| My list can offer **org** + “add this service” on row | Layout work in **three-column** (narrow middle column) |

**Filter highlight:** Active need chip adds `.service-row--match` (border/background); optional `scrollIntoView` on first match when results render. Search matches org name **or** any subservice title.

**My list:** Default **add org**; optional row-level control stores `{ orgId, serviceLineId }` in session storage when ids exist.

---

### Option C — Flat cards with “same org” visual merge (UI-only spike)

**Pattern:** Keep one DOM card per FSD row but **visually stack** consecutive rows with the same `id` / normalised name (shared header, reduced padding between “siblings”).

| Pros | Cons |
|------|------|
| ~1–2 day spike; no schema change | **Fragile:** name variants (Capital Coast) don’t stack |
| Search/filter unchanged at data layer | My list still broken for duplicate ids |
| Low risk read-only experiment | Map still **N pins** at same coords |

**Filter highlight:** Highlight entire sibling group if any row matches — weaker than row-level highlight.

---

### Option D — Map-first: one pin per org, popup service list

**Pattern:** Results list may stay flat or grouped; **map** shows **one marker per org** with count badge; popup lists services; **View in directory** scrolls to org card (Option B).

| Pros | Cons |
|------|------|
| Fixes stacked identical pins | Popup long for 17-line orgs |
| Strong for **community connector** map browsing | Desktop three-column map already tight |
| Complements landing **map-first** options | Needs clustering + grouped data for correctness |

**Filter highlight:** Popup greys out non-matching services; pin remains if **any** service matches (or hide pin if none — product choice).

---

## 5. Filter → highlight behaviour (cross-option)

```mermaid
flowchart LR
  subgraph input [User]
    Chip[Need chip]
    Search[Search box]
  end
  subgraph logic [Filter layer]
    Match[Match categories / text per service line]
    Org[Org visible if any line matches]
  end
  subgraph ui [Card UI]
    Header[Org header always shown]
    Rows[Service rows]
    Hi[Highlight matching rows]
  end
  Chip --> Match
  Search --> Match
  Match --> Org
  Org --> Header
  Match --> Hi
  Hi --> Rows
```

| Event | Recommended behaviour (Option B) |
|-------|----------------------------------|
| Select **Support and counselling** | Show org if **any** line has category; highlight those lines |
| Clear chips | Remove highlight; collapse optional accordion |
| Typing in search | Highlight lines matching query; org matches on name |
| **Near me** + chip | Same rules on geo-filtered subset |
| Map pin click | Popup lists lines; matching chip applies same highlight class |

**Accessibility:** Highlight must not rely on colour alone (weight, icon, `aria-current` on row); expand state on `aria-expanded`; live region announces “N organisations, M matching services”.

---

## 6. My list: org vs service

| Approach | Help-seeker | Community connector | Implementation |
|----------|-------------|---------------------|----------------|
| **Org only** | Simple; may lose which counselling line | Usually sufficient | One `favoriteId` = org slug |
| **Service line** | Precise for callbacks | Rare | Requires unique `serviceLineId` (FSD `SERVICE_ID`) |
| **Hybrid (recommended)** | Primary button **Add org**; row **Pin this service** | Org default | Storage: `{ version, items: [{ orgId, serviceLineId? }] }` |

**Migration:** Phase 1 duplicate ids mean toggling favourite on any Salvation Army row may toggle all — grouping + unique ids is a **prerequisite** for service-level favourites.

---

## 7. Layout sketches

### Desktop — three-column (`data-browse-layout="three-column"`)

```mermaid
block-beta
  columns 3
  block:filters
    columns 1
    f["Need chips"]
    s["Search"]
  end
  block:results
    columns 1
    o["Org card\n— header + phone"]
    r1["▸ Counselling row (highlight)"]
    r2["  Food bank row"]
  end
  block:map
    columns 1
    m["Single pin\nbadge 13"]
  end
```

- Filters column unchanged (sticky).
- Results: org cards scroll independently; highlighted row gets left accent bar.
- Map: Option D reduces pin stack; click syncs scroll to org in centre column.

### Mobile — stacked

```mermaid
block-beta
  columns 1
  block:top
    f["Chips (wrap)"]
  end
  block:mid
    o["Org card"]
    r["Service rows\nfull width tap targets"]
  end
  block:bot
    map["Map toggle / half height"]
  end
```

- Prefer **Option B rows** over nested accordions for thumb reach (`min-height` 44px).
- **Call** on row uses `tel:` when line-specific number exists, else org phone.

---

## 8. Phasing

| Phase | Scope | Delivers |
|-------|--------|----------|
| **This PR** | Analysis JSON + design doc + read-only script | Shared stats, UX choice, stakeholder review |
| **MVP spike (optional)** | Option C or client-side group by shared `id` in `directory.js` only | Demo in branch; not shipped without product sign-off |
| **Phase 1.5 pipeline** | Unique `id` per FSD row (`SERVICE_ID`); optional display `serviceName` | Fixes favourites/deep links; still flat UI |
| **Phase 2** | Import grouping (`organizationId`, `services[]` or parallel org records); merge rules; overrides at org/service level; E2E | Option **B + D** production quality |

**Recommendation:** Pursue **Option B (org header + highlighted service rows)** with **Option D** for map pins, implemented on **Phase 2 schema** after **Phase 1.5 unique ids**. Option C is acceptable for a **throwaway usability prototype** only.

**Rationale:**

1. Aligns with community map grain and stakeholder mockups in [potential-changes](../potential-changes-and-insights.md).
2. Need chips map naturally to **service-line categories** — highlight beats hiding duplicate cards.
3. **76** orgs × duplicate ids makes My list and analytics unreliable until ids + grouping land together.
4. UI-only grouping (C) does not fix Capital Coast **name variants** or editor workflow in Directus.

---

## 9. Open questions for user testing

1. Default **expanded** or **collapsed** for orgs with &gt; 5 services?
2. Card title: **org only** vs org + primary matching service when filtered?
3. When community and FSD represent the same org in Phase 2, do FSD lines appear **under** the community card?
4. Map: show pin if **any** service matches filter, or only when org HQ matches **near me**?

---

## 10. Verification

Re-run analysis after each `npm run build:data`:

```bash
cd porirua_directory
node scripts/analyze-org-clusters.mjs
```

Compare `clustering.orgsWithSameNormalizedName2Plus` and top-of-list providers against stakeholder expectations.

---

## 11. Implementation status (branch spike)

| Area | Approach |
|------|----------|
| Grouping | **Runtime** in `porirua_directory/group-services.mjs` (same cluster key as `analyze-org-clusters.mjs`). Tradeoff: no `services[]` in `services.json` yet; rebuild not required for UI experiments. Phase 2 should move grouping to merge + unique `SERVICE_ID` per line. |
| Browse / My list | Option **B** org card (`card--org`) with `service-row` lines; community rows unchanged (single card). |
| Favourites | Org-level `orgId` (shared slug when all lines share one `id`, else `org-…`). |
| Map | One pin per org cluster; compact popup + **View in list** scrolls to `#org-{id}` in `#directory-results` with brief focus ring. |
| Need filter | Matching rows get `.service-row--match` / `.is-highlighted`; others dimmed when a chip is active. |

