# Potential changes and insights

**Date:** 10 August 2026  
**Audience:** Porirua Locality team and developers  
**Status:** Living note — synthesises MVP delivery, recent fixes, and roadmap options (not a signed-off scope change).

Plain language up front; technical detail in subsections where helpful.

---

## Executive summary

**Phase 1 MVP is live and testable** at [https://directory.bsky.nz](https://directory.bsky.nz). People can choose **Find support** or **Connect with community**, search and filter, optionally show a map, save a session **My list**, and read crisis numbers on every page. Data merges **Porirua Community Connections Map** organisations with a **Porirua-filtered slice** of the NZ Family Services Directory (FSD), published as a single `services.json` file.

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

Geographic false positives in the FSD slice have been reduced in recent pipeline work (see [issues](./issues/README.md)); that did **not** fix duplicate org cards from multi-service FSD providers.

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

Current published slice (Aug 2026 rebuild): **461** listings (~52 community + ~409 FSD). Salvation Army Porirua remains **13** listings (same id).

**Stakeholder takeaway:** The directory is trustworthy for “something exists in Porirua” but can feel **repetitive or confusing** for NGOs with many FSD service lines. Fixing that needs a deliberate product choice (many service cards vs one org card), not only a bug fix.

Detailed analysis and options: [plans/fsd-org-subservices-and-geo-filter.md](./plans/fsd-org-subservices-and-geo-filter.md).

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
- **Landing vs browse** — “I would like to…” subnav on landing only; **Find support** / **Connect with community**; **Back** to change path.
- **Find support listing** — Full list by default; single-select need chips; optional **Show map** (not auto-opened).
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

---

## Related documentation

| Document | Use for |
|----------|---------|
| [issues/README.md](./issues/README.md) | Fixed & recurring bugs (e.g. FSD geo false positives) |
| [plans/fsd-org-subservices-and-geo-filter.md](./plans/fsd-org-subservices-and-geo-filter.md) | FSD row model, Phase 1.5 / 2 / UI-only options |
| [porirua-services-directory-requirements.md](./porirua-services-directory-requirements.md) | Product scope, budget, phased delivery, public UX requirements |
| [porirua-directory-phase1-spec.md](./porirua-directory-phase1-spec.md) | Service schema, FSD rules, merge, overrides |
| [MVP-RUNBOOK.md](./MVP-RUNBOOK.md) | Rebuild data, deploy, test |
| [architecture/porirua-directory-architecture.md](./architecture/porirua-directory-architecture.md) | Hosting, data flow, Phase 2 target architecture |
| [README.md](./README.md) | Full docs index |
| [porirua_directory/README.md](../porirua_directory/README.md) | App layout, npm scripts, UI behaviour |

---

*This note does not replace signed requirements. Update it when Phase 1.5 or Phase 2 decisions are made or when major pipeline behaviour changes.*
