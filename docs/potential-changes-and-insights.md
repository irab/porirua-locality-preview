# Potential changes and insights

**Date:** 10 August 2026  
**Audience:** Porirua Locality team and developers  
**Status:** Living note — synthesises MVP delivery, recent fixes, and roadmap options (not a signed-off scope change).

Plain language up front; technical detail in subsections where helpful.

**Stakeholder walkthrough:** Interactive Reveal.js deck with live local embeds — [slides/directory-mvp-walkthrough.html](./slides/directory-mvp-walkthrough.html) (serve from repo root; see [slides/README.md](./slides/README.md)).

---

## Executive summary

**Phase 1 MVP is live and testable** at [https://directory.bsky.nz](https://directory.bsky.nz). People can choose **Find support** or **Connect with community**, search and filter, optionally show a map, save a session **My list** (a short notepad of organisations to revisit or call through), and read crisis numbers on every page. Data merges **Porirua Community Connections Map** organisations with a **Porirua-filtered slice** of the NZ Family Services Directory (FSD), published as a single `services.json` file.

**What works well**

- Dual browse paths aligned with how people think about help vs community connection.
- Plain-language need categories, mobile-friendly layout, sticky crisis footer.
- Community map rows keep local kaupapa; merge prefers community text when the same org appears in FSD.
- Manual curation via `overrides.json` (hide or patch rows) without rebuilding from scratch every time.

**Known gaps (expected for Phase 1)**

- **No admin UI** — Connections Map still edited in Google Sheet; FSD refreshed by re-running `npm run build:data`.
- **FSD is service-grain; the UI is flat** — large NGOs appear as many similar cards (see next section).
- **Dedupe is community-vs-FSD only** — not FSD-vs-FSD and not org grouping.
- **Accessibility not yet a first-class deliverable** — the public UI includes intentional basics (skip link, landmarks, plain language, crisis footer), but there has been **no formal WCAG audit, remediation pass, or assistive-technology test programme**. See [Accessibility (target)](#accessibility-target) below.
- **Phase 2 items deferred** — weekly FSD automation, Directus, Squarespace embed, formal duplicate workflow (see [requirements](./porirua-services-directory-requirements.md)).

Geographic false positives in the FSD slice have been reduced in recent pipeline work (see [issues](./issues/README.md)); that did **not** fix duplicate org cards from multi-service FSD providers. After each FSD refresh, use the **import audit workflow** in [MVP-RUNBOOK.md](./MVP-RUNBOOK.md) and [fsd-porirua-filter-rationale.md](./fsd-porirua-filter-rationale.md) to review `data/fsd-porirua-excluded.json` reason codes before publishing.

---

## Org / subservices deficit (highlight)

This is the largest **product vs data model** mismatch surfaced in MVP testing and data review.

### What users expect

One **organisation** (or one site) with a **list of things they offer** — e.g. food bank, budgeting, counselling — similar to how the **Community Connections Map** already works (one pin per org, initiatives listed in the sheet).

### What FSD provides

The DIA export is **one CSV row per service line**, not per organisation. Columns such as `PROVIDER_NAME`, `SERVICE_NAME`, and `SERVICE_DETAIL` repeat provider-level text on every row. Stable per-service identifiers exist (`FSD_ID`, `SERVICE_ID`) but Phase 1 import does not use them for public `id`.

### What Phase 1 stores and shows

Each filtered FSD row becomes one **listing card** in `services.json`. There is no `organizationId`, `parentId`, or nested `services[]`. Card **name** is usually `PROVIDER_NAME`. **Id** is slugged from provider name only (`slugId(PROVIDER_NAME, "fsd-")`), so many rows share the **same id** while still being separate array entries — the UI lists every row.

Dedupe at merge time only links **community** rows to **FSD** rows on name + map coordinates. It does **not** collapse multiple FSD rows for the same provider.

### Examples in the current dataset

| Provider / pattern | What people see | Why |
|--------------------|-----------------|-----|
| **The Salvation Army — Porirua** | ~13 separate cards, often similar titles | 13 FSD service rows; one shared id `fsd-the-salvation-army-porirua` |
| **Little Shadow** | Multiple cards with the same org name | Several service rows; same provider slug id |
| **Literacy Aotearoa** (e.g. Upper Hutt naming in FSD) | Multiple cards per site/name variant | Service-grain rows; provider-based ids |
| **Family Works Central** (and related FSD names) | Many cards; long duplicated descriptions | Multiple service lines; regional centre text repeated |
| **Presbyterian Support / Family Works** (community side) | Often **one** community card with rich local copy | Connections Map is **org-grain** — aligns with mental model |

Current published slice (Aug 2026 rebuild, after [address-context filter](./issues/fixed-fsd-locality-address-context-filter.md)): **434** listings (~52 community + ~382 FSD). Salvation Army Porirua remains **13** listings (same id).

**Stakeholder takeaway:** The directory is trustworthy for “something exists in Porirua” but can feel **repetitive or confusing** for NGOs with many FSD service lines. Fixing that needs a deliberate product choice (many service cards vs one org card), not only a bug fix.

Detailed analysis and options: [plans/fsd-org-subservices-and-geo-filter.md](./plans/fsd-org-subservices-and-geo-filter.md).

**UX design options (Aug 2026):** Dataset clustering (**76** provider names with ≥2 listings; **367** rows), four layout patterns (collapsed org card, org header + highlighted service rows, UI-only merge, one map pin per org), filter/My list behaviour, and desktop/mobile sketches — [design/org-service-grouping-options.md](./design/org-service-grouping-options.md). Recommended product direction: **org header + service rows** with map pin grouping. Option B grouping is in the directory UI. **Shipped (13 Aug 2026):** with need chips on, org cards still show only matching service rows; **See other services** reveals hidden sibling lines on that card (omitted when nothing is hidden), and **category labels appear when a service row is opened** — [design note §12](./design/org-service-grouping-options.md#12-proposed-ux-see-other-services-and-labels-on-expand).

---

## Accessibility (target)

**Why this matters:** The directory is for people under stress — including users with **significant disabilities** who rely on **screen readers**, **keyboard-only** navigation, **voice control**, **high contrast**, or **large touch targets**. Porirua Locality should aim for an **extremely high accessibility rating** in practice (trusted by disabled users and advocates), not merely “we tried.”

**Phase 1 status (gap, not a claim):** MVP shipped with some helpful patterns (e.g. skip link, labelled nav groups, `aria-live` on results, descriptive favourite buttons, sticky crisis numbers, print-friendly My list). Phase 1 did **not** include a signed accessibility acceptance criterion, automated axe/Playwright a11y gates, or structured testing with assistive technology. **We do not claim WCAG 2.2 Level AA (or any legal “compliance”) today.**

**Suggested target (product + engineering):**

| Horizon | Goal |
|--------|------|
| **Phase 1.5** | **WCAG 2.2 Level AA as baseline** for all public pages (`index.html`, `about.html`): fix critical/serious issues from audit; add lightweight regression smokes (landmarks, skip link, focusable controls); document known map limitations. |
| **Phase 2** | **AA everywhere users transact**; **AAA where feasible** (contrast, plain language, touch targets, motion); optional **map alternative** (list-first, “open in maps” links per pin); periodic **manual AT passes** (NVDA/VoiceOver, keyboard-only). |
| **Ongoing** | Accessibility notes in requirements/changelog when behaviour changes; no release that regresses focus order or screen reader names for core flows (landing → browse → card → My list → print). |

**Scope priorities (align with MVP flows):**

1. **Landing / browse / My list** — correct headings, view announcements, filter and search state for screen readers, no duplicate or stale `aria-current`.
2. **Crisis footer** — always reachable, readable, and operable (including when content is fixed to the viewport).
3. **Map (Leaflet)** — treat as **enhancement**: never the only way to get location; document keyboard and AT gaps; consider list-first or external map links in Phase 2.
4. **Print My list** — keep a usable printed record (contact details visible; chrome hidden).

**Stakeholder framing:** Accessibility is a **quality bar for a public community resource**, comparable in importance to accurate data. Budget Phase 1.5/2 work explicitly — not as polish after launch.

*First structured code audit: August 2026 (agent-assisted review of `porirua_directory` public UI). Findings live in team notes / PR discussion until a dedicated a11y doc is added.*

---

## Recommended phases

### Phase 1.5 — Pipeline quick win (not started in code)

**Goal:** One card per FSD **service line**, with stable ids — minimal UX change.

| Change | Effect |
|--------|--------|
| Set public `id` from `SERVICE_ID` or `FSD_ID` (slug fallback) | Stops duplicate ids; overrides and favourites target one row |
| Optionally set display `name` to `SERVICE_NAME` when it adds clarity; keep provider visible in UI later | Cards read as “what” not only “who” |
| Optional merge policy to collapse accidental duplicate ids | Needs rules (richest description, union categories) |

**Pros:** Small effort; matches FSD semantics; fixes duplicate-id bugs.  
**Cons:** Still **many cards per large org**; no “expand organisation” browse pattern.

### Phase 2 — Org grouping + admin alignment

**Goal:** One **organisation card** with **subservices** (or linked child records), aligned with Connections Map grain and Phase 2 admin (Directus).

Sketch: org record with `kind: "organization"` and `services[]`, or flat list with `organizationId` / `serviceName` on each service row. Work spans import grouping (by provider + site), merge/dedupe rules, UI (org detail, search across subservices), overrides at org vs service level, and E2E/spec updates — on the order of **~1–2 weeks** depending on UX depth (see plan doc estimates).

**Pros:** Matches user mental model; cleaner browse for large NGOs; easier for editors to curate one org.  
**Cons:** Larger schema and UI surface; admin should treat **org** as a first-class entity.

### Why UI-only grouping is weak (Option C)

Grouping cards in the browser by normalised `name` + lat/lng **without** schema changes is possible (~1–2 days) but **fragile**: provider name variants, search/filter semantics, favourites/My list, and duplicate ids in JSON all stay inconsistent. Prefer **Phase 1.5 ids first**, then **Phase 2** if product prioritises NGO browse over flat FSD parity.

**Recommendation (from technical review):**

1. **Next:** Phase 1.5 (`SERVICE_ID`-based ids, optional service titles).  
2. **When prioritised:** Phase 2 org hierarchy + grouped UI.

Fixed pipeline bugs are tracked in [issues/README.md](./issues/README.md).

---

## Fixes and insights already delivered

These came from MVP feedback, data review, and requirements iterations (see requirements changelog v1.4–v1.8).

### Data pipeline

- **Description formatting** — Import preserves FSD newlines (`normalizeDescriptionText`); UI uses `format-description.mjs` for paragraphs, `-` list lines, and inline bullet patterns. Roughly **six in ten** FSD descriptions are multiline in the current slice (~57% cited at time of plan write; exact share shifts slightly after each `build:data`).

### Public UX and copy

- **Community map badge removed** — Provenance stays internal (`source: community`); no “Community map” label on cards (requirements v1.7).
- **My list** — Session-only favourites (`sessionStorage`); **Add to your list** / **Remove**; **Print list**; plain-language note that nothing is stored on a server (v1.8).

**Why My list (product insight):** Browsing support or community listings means working through **many options at once** — different organisations, phone numbers, and types of help. It is easy to lose track of what looked promising. **Add to your list** is a lightweight **notepad for this visit**: tap to save places and organisations you might call back, compare, or walk through with someone else (e.g. working through a shortlist of groups by phone). Nothing is stored on a server — it is intentionally **session-only** so the feature stays simple and private while people are under stress or supporting whānau. **Print list** supports the same workflow on paper. Stakeholder testing should ask whether this helps front-line and help-seeking journeys, or whether a saved list across visits would ever be wanted (that would be a different, Phase 2 privacy and auth conversation).
- **Landing vs browse** — “I would like to…” subnav on landing only; **Find support** / **Connect with community**; **Back** to change path.
- **Find support listing** — Full list by default; multi-select union need chips (tap to add, tap again to remove that topic; no chips = all listings); map shown when results have coordinates; on stacked browse, map compacts via scroll chrome only (always visible on desktop three-column).
- **Site chrome** — Porirua Locality logo, **Your Porirua Directory** title, **About** page, sticky crisis footer on all pages.
- **Plain language** — User-facing copy aimed at stressed mobile users; no database jargon or internal ids on cards.

### Merge behaviour (unchanged but important)

- Community row wins on dedupe key (name + rounded lat/lng); FSD duplicate hidden via `duplicateOf`.
- **`overrides.json`** — `hiddenIds` and field `patches` for one-off bad FSD rows without code changes.

---

## Other deferred items

| Item | Phase | Notes |
|------|-------|--------|
| Password-protected **admin** (Directus recommended) | 2 | MVP: Sheet + overrides |
| **Weekly automated FSD** sync + review queue | 2 | MVP: manual `npm run build:data` |
| **Squarespace embed** on porirualocality.co.nz | 2 | MVP: link out to directory.bsky.nz |
| **Duplicate linking UI** in admin | 2 | MVP: merge-time flag only |
| Full **editor guide** and production runbooks | 2 | MVP runbook covers rebuild/deploy |
| **Phase 1.5** (`SERVICE_ID` ids, service titles) | 1.5 | **Proposed; not implemented** in import yet |
| **Phase 2 org grouping** | 2 | Proposed schema + UI |
| **Formal WCAG 2.2 AA pass + AT testing** | 1.5–2 | Baseline target; see [Accessibility (target)](#accessibility-target) |
| Te Reo category labels, PWA, analytics, provider self-service | Out of scope | See requirements §9–10 |

Building a **second admin UI** only for overrides (duplicate of Phase 2 Directus) is intentionally avoided — overrides stay file-based until admin exists.

---

## Open questions for stakeholders

Use these in feedback sessions before committing Phase 1.5 or Phase 2 scope.

1. **One card per service vs one org with a list** — For Salvation Army–scale providers, should help-seekers see many specific services or one org entry with expandable offerings?
2. **Card title** — Prefer **organisation name**, **service name**, or both (title + subtitle)?
3. **National or regional FSD rows** — Should rows that mention Porirua in address text but are clearly another region’s centre be **hidden by default** (stricter filter) or kept with manual `hiddenIds`?
4. **Literacy / multi-site names in FSD** — Accept FSD naming as-is, patch in overrides, or wait for org grouping?
5. **Editor workflow** — Is Google Sheet + occasional developer merge acceptable until Directus, or is manual hide/patch via `overrides.json` enough for the next months?
6. **Community vs FSD duplication** — When community and FSD both list the same org, is hiding the FSD row (current behaviour) always right, or should some FSD **service lines** remain visible under the community org in Phase 2?
7. **Search** — Should search match **subservice names** only after Phase 2, or is provider-name search enough for Phase 1.5?
8. **Landing map-first** — If the home page becomes an all-listings map, should popup → browse **clear filters** (recommended) or **preserve map/chip context**? See [Landing map-first (design options)](#landing-map-first-design-options).

---

## Layout experiments (demo)

**Purpose:** Document browse layout behaviour and keep **near-me** and **legacy top-map** experiments behind `?demo=1` where useful. **Production default** (no query params) is **three-column on desktop**: filters left, cards centre, sticky map right when listings have coordinates (map always visible on desktop; no toggle).

### Layout names

| Name | Query value | Behaviour |
|------|-------------|-----------|
| **Three column (default)** | omitted, or `layout=three-column` | Map **expanded by default** when entering browse: **filters left**, **cards centre**, **sticky map right** on large desktops (≥1024px). Result count sits above the cards (centre only); map top aligns with the **first card**. Need chips refit the map to filtered markers (brand purple/crimson pins). **No manual map toggle.** Below 1024px the layout stacks; map compacts via **scroll chrome** when scrolling into results. |
| **Top map (legacy)** | `layout=top` or `layout=default` | Map sits **above** the result cards in the main column (sidebar filters on the left from tablet width up). Map hidden only when there are no mappable results or scroll chrome collapses it on narrow viewports. |

### How to open demos

- **Layout picker + near-me button:** add **`?demo=1`** (e.g. `index.html?demo=1#support`). The sidebar shows **Demo layout** and **Find support near me**; without `demo=1` those controls stay hidden. The picker can switch back to **map on top** for stakeholder comparison (`?layout=top` is written to the URL).
- **Legacy top map only:** `?layout=top` (works with or without `demo=1`). Alternate: hash fragment `layout=` e.g. `#support&layout=top`.
- **Combined example:** `https://directory.bsky.nz/index.html?demo=1#support` (three-column default) or `?demo=1&layout=top#support` for top-map experiment.

Implementation lives in `porirua_directory/` (`directory.js`, `directory.css`); no pipeline or schema changes.

### Feasibility

- **Production default:** Layout is CSS grid + DOM order; E2E smokes the main support path with `data-browse-layout="three-column"` at default Playwright viewport (1280px).
- **Three-column** reuses the same Leaflet instance on all breakpoints. Filter changes call **`fitBounds`** on the mappable subset (except near-me mode); **`invalidateSize`** runs once after expand transitions (not during scroll-collapse) to avoid map jitter. Marker styling uses brand **`#60164c` / `#ce2026`**. E2E covers need-chip filtering on the default layout, desktop three-column without scroll collapse, stacked mobile map visibility, and **`?layout=top`** without a map toggle.
- **Near-me** filters the **already filtered** browse list to rows with coordinates within **15 km** (haversine), centres the map, and highlights nearby markers. No server round-trip. The control is a **toggle**: pressed state (`aria-pressed`, `.is-on` on the button), label **Near me: on — tap to turn off**, status line states the **15 km** radius, and a dashed circle on the map shows the search area. The map stays visible when near-me is on even if nothing is in radius (common if GPS is far from Porirua). Empty copy distinguishes **no listings in radius** from **location blocked / unavailable**. Low-accuracy GPS (&gt;5 km reported) adds a warning in the status line. Turning near-me off restores the full filtered list.

### Privacy (GPS consent)

- **Find support near me** uses the browser **`navigator.geolocation`** API once per click; the browser shows the standard permission prompt.
- Coordinates are kept **in memory for the session tab only** (not sent to Porirua Locality servers, not written to `sessionStorage`). Clearing browse / **Back** or toggling **Near me** off clears near-me state.
- Copy should continue to state that location is optional and list-first browse remains fully usable if permission is denied.

### Mobile behaviour

| Layout | Narrow screens |
|--------|----------------|
| **Top map (`layout=top`)** | Stack: **filters → map (when shown) → results**. |
| **Three column (default)** | Stack: **filters → map (when shown) → results** so the map is usable without scrolling past all cards. |

Below the three-column desktop breakpoint (1024px), the “three column” demo behaves as a single column stack — not a side-by-side map.

**Scroll chrome (shipped):** On **stacked / one-column** browse (below the 1024px three-column breakpoint), scrolling **down** into the listing sets `data-browse-chrome="collapsed"` and `data-browse-map="collapsed"` — filter chips and the map block animate closed while **← Back**, **Search**, and a **Filters** expand control stay in the sticky panel. On **desktop three-column** (≥1024px), scroll does **not** collapse filters or the side map; resizing into that breakpoint clears collapsed state. Tapping **Filters** reopens chips only (the map stays compact while you are mid-list, so it cannot jump over the search bar). Scrolling **up** to the true top expands the map again under the filters. There is **no Hide/Show map toggle**. A short lock after each toggle ignores layout-induced scroll jumps (document height change / scroll anchoring) so collapse cannot immediately re-expand and flicker; `overflow-anchor: none` on the browse document disables the browser compensating those height changes. Hysteresis on scroll delta still applies after the lock. Motion uses **`grid-template-rows: 1fr` → `0fr`** with **opacity** on inner wrappers (not `max-height` or parallel `transform`), aligned with compositor-friendly UI motion guidance (e.g. animations.dev / web.dev). **`prefers-reduced-motion`** snaps grid rows without transitions. Leaflet **`invalidateSize`** runs after **`grid-template-rows`** transition ends on **expand** only (pending resizes are cleared on collapse) to avoid map jitter. Collapsed chrome tightens sticky-toolbar spacing and stack **gap** so the compact bar sits flush without a dead band under **Back** / **Search** / **Filters**. Sticky panel stacking uses z-index and background shadow so scrolling cards stay visually beneath the filter column (see e2e “masks scrolling result cards”). `--site-topnav-sticky-height` is set from the live header height (ResizeObserver) so the panel sits flush under the nav on every breakpoint — the CSS rem fallbacks are first-paint only. The map block is an isolated stacking context (`z-index: 0`) so Leaflet panes cannot paint over the sticky search bar.

### Phase 1.5 vs Phase 2

| Horizon | Recommendation |
|---------|----------------|
| **Phase 1.5** | Three-column is **live by default** on desktop; use **`?demo=1`** for near-me trials and the layout picker when comparing top-map. Optional: persist last layout in `sessionStorage` for demo sessions only. |
| **Phase 2** | Product decision whether **near-me** becomes a first-class entry (landing CTA, analytics, privacy policy line). Consider **list-first** legal/consent pattern and map as enhancement (aligns with [Accessibility (target)](#accessibility-target)). |

**Limitations today:** Near-me does not geocode addresses without lat/lng in `services.json`; FSD rows missing coordinates never appear in the radius filter. Geolocation accuracy varies by device; 15 km is a demo radius, not a service guarantee. `layout=top` and `layout=default` are intentionally identical aliases.

---

## Landing map-first (design options)

**Status:** Product brainstorm — not scoped or implemented (August 2026).

### Vision (stakeholder sketch)

Make the **front page a map of every listing** that has coordinates in `services.json` (~400+ pins today, mix of community and FSD). **Tap a pin** → **Leaflet popup** in the spirit of the [Community Connections Map embed](../porirua_connections_map/) (type/theme pills, short description, location, website). Popup actions such as **Show me more** or **Take me to** move the person into **full browse** (list + filters + optional sticky map), rather than leaving them on map-only.

**Tension:** Today, **Find support** and **Connect with community** are **mutually exclusive browse modes** (`directory.js` `setMode` + `filterServices`: support = FSD + categorised rows; community = Connections Map grain with org-type chips). If someone explores the map through a **community** lens (e.g. climate / Assembly theme) and deep-links into browse with those filters **locked**, they may never see the large **FSD-only** slice — even though those services share the same map.

**Current baseline (for comparison):** Landing is **path-first**, not map-first: header subnav **I would like to…** with **Find support** / **Connect with community**; `#view-landing` is empty; no map until browse and (on desktop) **Show map** / three-column default. Map popups in browse are minimal (name ± distance). Connections Map popups are richer (org type, themes, initiatives, labels, **Visit website**).

### Design approaches

| # | Approach | What the user sees | Pros | Cons |
|---|----------|-------------------|------|------|
| **A** | **Map-all landing, browse-all on “View in directory”** | Home = full-screen (or hero) map, all mappable listings. Popup → **View in directory** opens browse with **that listing highlighted/ scrolled** but **no need/org-type chips pre-selected**; mode (`support` vs `community`) inferred from row (`source` / `communityFilters`) only for sidebar context, not as a hidden filter. Header keeps **Find support** / **Connect with community** as explicit second entries. | Simple mental model (“map = everything here”); avoids trapping help-seekers in a community-only subset; reuses one dataset. | Loses “map as filtered preview of my path”; two ways to enter browse may feel redundant; mode inference wrong for edge rows (community org with FSD categories, schools). |
| **B** | **Map-all landing, browse **with** context (filtered handoff)** | Popup → **Take me to** opens browse in the **matching path** and **applies** the most relevant chip (e.g. org type, primary need category, or map legend filter the user had on). | Feels personalised; mirrors Connections Map “filter then click org”. | **Highest risk** for missing FSD: community filters exclude pure FSD rows; need chips hide non-matching support lines; user may not know another 300+ listings exist. |
| **C** | **Hybrid: map + retained dual entry (no single map-only trap)** | Landing = **split**: map occupies main area **and** subnav path buttons stay prominent (current pattern elevated, not replaced). Optional light map legend (Support / Community / Both) filters **pins only** on landing; entering browse **clears** landing legend unless user opts in. Popup CTAs: **More about this place** (focused browse, filters off) vs **Browse all [support \| community]** (mode + empty chips). | Respects existing “I would like to…” UX; makes FSD vs community explicit; good for accessibility (path buttons remain primary for screen-reader / no-map users). | Busier first screen; map legend adds state to explain; still two concepts (explore vs choose path). |
| **D** | **Map-first with discovery prompts (recommended variant of A/C)** | Same as **A** or **C**, plus **non-blocking discovery**: when browse opens from a **community** pin or with community mode, show a **sticky dismissible banner** — e.g. *“Also browse all support services in Porirua”* → `#support` with chips cleared; symmetric optional banner on support browse for community groups. Popup primary CTA: **View in directory** (focused row, **filters off**); secondary: **Browse all on map** (return to landing map). | Balances exploration with FSD visibility; low commitment (dismissible); testable in usability sessions. | Extra copy and UI chrome; banner fatigue if overused; needs analytics to see if anyone clicks through. |

### Default recommendation (for stakeholder review)

**Prefer D built on A:**

1. **Landing:** Map of **all** mappable listings (support + community), with **Find support** / **Connect with community** still in the header subnav for people who want path-first entry (aligns with [Accessibility (target)](#accessibility-target) — map never the only path).
2. **Popup:** Connections Map–style summary (type, categories/themes, address, truncated description, website). Primary: **View in directory** → browse in the **appropriate mode** for that row, **scroll/focus that card**, **no category/org-type lock**. Secondary: **Open website** where relevant.
3. **Discovery:** If the person entered from a community context or is in **Connect with community** browse, show sticky **Also browse all support services** (link to `#support`, filters cleared). Optional inverse for community-curious support browsers.
4. **Do not** default popup handoff to **B** (pre-filtered browse) unless product explicitly prioritises “filtered journey” over FSD discovery — document that trade-off in requirements if chosen.

**Open product checks:** Should schools appear on the all-pins map or only under community path? Should duplicate ids (same org, many FSD lines) cluster or show multiple pins? Popup **Show me more** vs **Take me to** naming — user-test with stressed mobile users.

### Technical reuse (implementation sketch)

| Piece | Reuse today | Notes |
|-------|-------------|--------|
| **Data** | Same `services.json` + `loadServices` | Landing map = `mappableServices(services)` with a **landing** filter (all coords), not `filterServices` until browse. |
| **Leaflet** | `ensureMap()`, tile layer, `SERVICE_MARKER_STYLE`, `fitBounds` | Either **move** `#directory-map` into `#view-landing` for map-first or **second lazy map** on landing (avoid double init cost — prefer one map DOM moved between views). |
| **Popups** | Browse uses minimal `bindPopup`; Connections Map has rich inline HTML in `porirua_connections_map/map.js` / embed snippet | Extract or mirror a **`buildServicePopup(service)`** (esc + categories/community chips + formatted description snippet); wire **View in directory** as `setMode(...)` + `history`/`hash` + scroll to `#card-{id}`. |
| **Routing** | `parseHash` / `setMode` / `setView` | Extend hash or query for `?service=id` focus; landing view toggles `data-view="landing-map"` vs current empty landing. |
| **Mobile** | Browse already stacks filters → map → cards | Map-first landing likely **full-width map** with bottom sheet or popup; keep **path subnav** reachable without scrolling past map; respect `scrollWheelZoom: false` pattern. |
| **E2E** | Landing tests expect **no map** today | Map-first would need new smokes behind a flag (e.g. `?landing=map`) or updated default expectations after product sign-off. |

**Spike note:** A credible `?landing=map` prototype is **more than ~50 lines** (landing markup, CSS, landing map lifecycle, rich popups, handoff to browse). **No code spike** in repo until stakeholders pick an option; use this section for review.

---

## UX inspiration from directory examples (click-minimisation)

**Date:** 10 August 2026  
**Audience:** Stakeholders and developers (design analysis only — not signed scope)  
**Sources:** [Human Services Directory Examples deck](./slides/human-services-directory-examples.html) and [overview](./human-services-directory-examples-overview.md); live **Your Porirua Directory** behaviour (`porirua_directory/`); gaps elsewhere in this note (org/subservices, accessibility, landing map-first).

**Two jobs the product must do well**

| Person | Goal | Success looks like |
|--------|------|-------------------|
| **Under stress** | “I need food / safety / someone to talk to — **call now**” | Few taps from open site to **`tel:`** dialling; crisis numbers never buried |
| **Community-minded** | “Find a **group** (climate, kai, marae, school hub…)” | See **clusters** of orgs and themes, not 13 identical NGO cards |

Phase 1 already aligns with Ask Izzy–style **plain need chips**, dual paths (**Find support** / **Connect with community**), **`tel:` links on cards**, rich **map popups** (community rows), sticky **crisis footer**, and **search-as-you-type** once search is open. The friction is mostly **extra taps before the right row is visible**, **phone below long text**, and **flat FSD cards** instead of org/community clusters.

### Patterns from other directories → Porirua

| Example | Pattern that works | Applies to Porirua? | Suggested improvement |
|---------|-------------------|----------------------|------------------------|
| **Ask Izzy** | Home = “What do you need?” **category tiles**; results tuned for **mobile** and crisis language | **Yes** — we already use need chips on **Find support** | Add **landing shortcuts** (e.g. Food, Housing, Feeling unsafe) that jump straight to `#support` + chip selected; consider **category landing** copy (“Food in Porirua”) above results |
| **211** | **Dial first** — human help for compound needs; web is secondary | **Partly** — no call centre in budget | Keep **1737 / 111 / Refuge** in sticky footer; optional **“Need help choosing?”** line pointing to local front-line numbers (not a 211 clone) |
| **NZ Family Services Directory** | Keyword + region + category; **official** listings | **Data only** for us — not UX model | Don’t copy FSD browse; use FSD as **feed** behind Porirua filters; surface **provider + service** clearly when org grouping lands (Phase 2) |
| **Sorted UK** | **One action** (postcode) → all local hardship schemes | **Adapt** — Porirua is one city | **Suburb or “near me”** as optional second tap after path (demo **Near me** exists behind `?demo=1`); default list stays **all Porirua** so nobody is locked out |
| **Kore Hiakai / Connections Map** | **Map + type filters**; community **trust** and dignity language | **Yes** — community path + map popups mirror this | **Landing map-first (option D)** with theme/org-type **legend on pins**; popup **Call** + **View in directory**; handoff without hiding FSD (see [Landing map-first](#landing-map-first-design-options)) |
| **Homeless England** | **Deep filters** within one domain (housing/homelessness) | **Later** — specialist slice | If stakeholders want a **housing-focused view**, reuse need chip **Housing** + curated banner — not a separate product |
| **ORServices** | **Call / email / website** actions on records; export filtered lists | **Yes** for action buttons | **Primary “Call” button** on card and popup (not only a text link); **Print list** already supports referral-style shortlists |

**Porirua MVP today (honest click budget)**

| Flow step | Find support → call | Connect with community → group |
|-----------|---------------------|--------------------------------|
| Path choice | **Find support** (header) | **Connect with community** |
| Narrow results | Optional **need chip**; full list if none | Optional **org-type chip** (e.g. Community groups) |
| Search | **Search icon** → field → type (live filter) | Same |
| Map | Desktop: map often **on** (three-column); tap pin → popup → **phone link** | Same; popups richer for community rows |
| Call | **Call** button on card (when `phone` exists) or tap phone on popup | Usually **website** first; phone when present |
| Crisis | **Always** visible footer (`tel:`) | Same |

**Gap vs “2 taps to call”:** Minimum is often **path (1) + chip or scroll (1) + phone (1) = 3+**; search adds **open search (1)** first. Duplicate **Salvation Army–style** cards increase scrolling before the right **Call**.

### Prioritised recommendations

**Quick wins (Phase 1 polish — no schema change)**

| Priority | Change | Why |
|----------|--------|-----|
| **P0** | **Prominent Call button** on every card and map popup when `phone` exists (large touch target, above the fold on mobile) | Matches 211/ORServices “action first”; `tel:` already works — this is layout and hierarchy. **Shipped (Aug 2026):** compact **Call** link (bottom-right on card, `tel:` with normalized number; label is “Call” only) on browse and My list when `phone` is set; map popup still uses inline phone link only. |
| **P0** | **Need shortcuts on landing** (3–6 tiles under “I would like to…”) → `#support` + chip pre-selected | Ask Izzy entry pattern; saves one browse step for food/housing/safety |
| **P1** | **Community shortcuts on landing** (e.g. Community groups, Food / Pātaka Kai, Marae) → `#community` + chip | Same for “find a group” journeys |
| **P1** | **Search visible on browse** (or open by default on mobile support path) | Removes expand-search tap; search-as-you-type already implemented |
| **P1** | **Pin popup: Call as primary**, Website secondary; optional **Add to list** in popup | One-tap call from map without scrolling cards |
| **P2** | **“Recently viewed” or session strip** (last 3 cards opened) | Low-cost recall when comparing options (session-only, like My list) |
| **P2** | **Sort/filter: “With phone number”** on support browse | Helps stressed users skip rows they cannot act on immediately |

**Phase 1.5 (pipeline + light UX)**

| Priority | Change | Why |
|----------|--------|-----|
| **P1** | **Stable per-service ids** + clearer card titles (`SERVICE_NAME` where helpful) | Less duplicate-looking cards; favourites/overrides target one row ([Phase 1.5](#phase-15--pipeline-quick-win-not-started-in-code)) |
| **P2** | **Near me** as productised control (not only `?demo=1`) with clear privacy copy | Sorted UK–style “what’s close” without postcode infrastructure |
| **P2** | **Category landing headings** (“Food / kai in Porirua — N places”) | Orientation after shortcut or chip |

**Phase 2 (structure + discovery)**

| Priority | Change | Why |
|----------|--------|-----|
| **P0** | **One org card, many subservices** (expand / accordion) | Fixes NGO **cluster** problem; community map grain ([Org / subservices deficit](#org--subservices-deficit-highlight)) |
| **P1** | **Map pin clustering** (or one pin per org with count badge) | “Find groups” on map — see **density** of community orgs, not stacked identical pins |
| **P1** | **Landing map-first (option D)** — all pins, rich popup, **View in directory** without filter lock | Kore Hiakai + Connections Map exploration; discovery banner for FSD ([Landing map-first](#landing-map-first-design-options)) |
| **P2** | Search matches **subservice names** and org aliases | Homeless England–depth without separate silos |
| **P2** | **Themed community views** (e.g. climate / Assembly themes from sheet) as first-class chips or legend | Directly supports “climate group” intent |

**Explicit user flows (target vs today)**

**A — Stressed user: food + phone in ~2 taps (target)**

1. **Tap “Food / kai”** on landing (shortcut) → browse opens, chip on, list filtered.  
2. **Tap “Call”** on the first suitable card (or map pin popup **Call**).

*Today:* Replace step 1 with **Find support** → **Food chip** (2 taps before list narrows); step 2 often requires **scroll past description** to phone link. Crisis path is faster: **footer 1737** = **1 tap** from any page (keep emphasising in testing).

**B — Stressed user: “I don’t know the word” (target)**

1. **Find support** (or default landing path).  
2. **Open search / type** “food bank” (search already filters as you type).  
3. **Call**.

*Today:* Add **one tap** if search stays collapsed — recommend visible search on support browse.

**C — Find a climate / community group (target)**

1. **Connect with community** (or landing **Community groups** shortcut).  
2. Optional **theme chip** or map **legend** (Phase 2 / sheet themes).  
3. **Tap org** on map or card → **website** or **Call**; **Add to list** to compare.

*Today:* **Community groups** chip + scroll/map; **no theme filter** for “climate” unless search hits description; duplicate FSD rows do not affect community path but **map-first handoff** must not trap users in community-only subset (prefer option **D**).

**D — Referral worker: shortlist to print (already strong)**

1. Filter/browse → **Add to your list** on several cards.  
2. **My list** → **Print list**.

Aligns with ORServices “export filtered list”; keep print styles and phones on printed rows.

### Tie-in: landing map-first brainstorm

If stakeholders adopt **map-first landing (option D)**:

- **Click-minimisation for community:** pan map → tap pin → **Call / Website** in popup (2–3 taps) without opening full browse.  
- **Click-minimisation for support:** same popup **Call**; primary **View in directory** should open browse with **filters cleared** and card focused so FSD-only services stay discoverable.  
- **Clusters:** multiple FSD rows at one address may need **marker clustering** or org grouping before map-first feels trustworthy.  
- **Accessibility:** path buttons (**Find support** / **Connect with community**) stay primary; map is **enhancement** ([Accessibility (target)](#accessibility-target)).

### Wireframe notes (prose only)

1. **Landing with shortcuts:** Header unchanged (“I would like to…”). Below it, a **grid of large tappable tiles** (Food, Housing, Feeling unsafe, Community groups, Pātaka Kai). Each tile jumps into browse with the right path + chip. Footer crisis strip unchanged.

2. **Support card — action first:** Card title row unchanged; immediately under title, a **full-width “Call 04…” button** (plum/crimson); description collapses to **“Read more”** on mobile so the button stays above the fold.

3. **Map popup — dual primary:** Popup title + one line of type/themes; **row of two buttons**: **[ Call ]** and **[ More in list ]**; tertiary “Visit website”. Matches Connections Map richness without forcing browse.

4. **Browse sidebar — search always on:** Replace icon-only search with a **visible field** under Back; chips below; result count unchanged. Optional compact **“Has phone”** toggle under chips.

5. **Phase 2 org card:** Single **Salvation Army Porirua** header; chevron **“12 services”** expands inline list of service lines each with its own **Call** if numbers differ; map shows **one pin** with badge “12”.

### Stakeholder questions (UX)

1. Should **landing shortcuts** replace empty `#view-landing` before map-first, or only accompany map-first (hybrid **C/D**)?  
2. Is **“Call” as a button** acceptable on every listing that has a number (including after-hours mobiles)?  
3. For **community themes** (climate, Assembly pillars), prefer **search**, **map legend**, or **new chips**?  
4. What is the **maximum acceptable tap count** to dial from cold start in usability tests (2 vs 3)?

---

## Related documentation

| Document | Use for |
|----------|---------|
| [issues/README.md](./issues/README.md) | Fixed & recurring bugs (e.g. FSD geo false positives) |
| [plans/fsd-org-subservices-and-geo-filter.md](./plans/fsd-org-subservices-and-geo-filter.md) | FSD row model, Phase 1.5 / 2 / UI-only options |
| [porirua-services-directory-requirements.md](./porirua-services-directory-requirements.md) | Product scope, budget, phased delivery, public UX requirements |
| [porirua-directory-phase1-spec.md](./porirua-directory-phase1-spec.md) | Service schema, FSD rules, merge, overrides |
| [fsd-porirua-filter-rationale.md](./fsd-porirua-filter-rationale.md) | FSD geo filter rationale, exclusion audit |
| [MVP-RUNBOOK.md](./MVP-RUNBOOK.md) | Rebuild data, deploy, test |
| [architecture/porirua-directory-architecture.md](./architecture/porirua-directory-architecture.md) | Hosting, data flow, Phase 2 target architecture |
| [README.md](./README.md) | Full docs index |
| [porirua_directory/README.md](../porirua_directory/README.md) | App layout, npm scripts, UI behaviour |
| [human-services-directory-examples-overview.md](./human-services-directory-examples-overview.md) | Reference directories (Ask Izzy, 211, FSD, ORServices, …) |

---

*This note does not replace signed requirements. Update it when Phase 1.5 or Phase 2 decisions are made or when major pipeline behaviour changes.*
