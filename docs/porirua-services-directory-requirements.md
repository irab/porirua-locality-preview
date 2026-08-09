# Porirua Services Directory — Requirements

**Version:** 1.11 (draft)  
**Date:** 31 July 2026  
**Prepared for:** Porirua Locality / Te Wāhi Tiaki Tātou  
**Timeline:** ~5–6 weeks total (MVP first, then iteration)  
**Budget:** **Phase 1 (MVP):** ~50 hours / NZ$5,000 · **Phase 2:** ~50 hours / NZ$5,000 · **Total:** ~100 hours / NZ$10,000

---

## 1. Purpose

Build a simple, trustworthy online directory so people in Porirua can **find help**, **connect with community groups**, and **find local organisations** (marae, councils, Pātaka Kai, services, and similar) — not only urgent crisis help.

**Phase 1 public URL (MVP testing):** [https://directory.bsky.nz](https://directory.bsky.nz) (hosted via Cloudflare + blackbox; see [architecture doc](./architecture/porirua-directory-architecture.md)).

The directory will bring together information that currently lives in two places:

- The **Porirua Community Connections Map** (local groups and services the community already knows and trusts)
- The **New Zealand Family Services Directory** (the government’s national register of social services, filtered to Porirua)

The result should feel easy to use on a phone, use plain language, and stay accurate over **at least three years** with modest ongoing effort from the Porirua Locality team.

Delivery is **two phases**: a testable **MVP at half the budget** goes live first; the second half funds changes based on real user feedback and completes the admin and automation layer.

**Design references:** See [Human Services Directory Examples](human-services-directory-examples-overview.md) and the [presentable slide deck](slides/human-services-directory-examples.html) for comparable directories (Ask Izzy, 211, Family Services Directory, Kore Hiakai, ORServices, etc.).

### Repository layout (this monorepo)

| Folder | Role |
|--------|------|
| [`porirua_connections_map/`](../porirua_connections_map/) | Existing **Community Connections Map** (Leaflet, Squarespace snippet, `data/organisations.csv`, Google Sheet) |
| [`porirua_directory/`](../porirua_directory/) | **Services directory** MVP — public find-help UI, FSD import, merged `data/services.json` |
| [`docs/`](./) | Requirements, examples research, slides, and developer plans (this document) |

Implementation detail for Phase 1: [Phase 1 spec](./porirua-directory-phase1-spec.md) · [Architecture](./architecture/porirua-directory-architecture.md) · [MVP plan](./superpowers/plans/2026-07-30-porirua-services-directory-mvp.md). Map-specific editing: [Connections Map README](../porirua_connections_map/README.md).

---

## 1.1 Phased delivery (MVP first)

| Phase | Budget | Goal |
|-------|--------|------|
| **Phase 1 — MVP** | ~50 hrs / NZ$5,000 | Get a working directory into people’s hands for testing |
| **Phase 2 — Iteration** | ~50 hrs / NZ$5,000 | Modify based on feedback; add admin, automation, and polish |

**Why split?** Real users (help-seekers and the Porirua Locality team) should shape categories, layout, and content before we invest in the full editing and sync infrastructure.

### Phase 1 — MVP (in scope)

What people can test:

- **Standalone public website** — shareable URL, mobile-friendly
- **Need-based categories** + **search** + **map** + **crisis numbers**
- **Merged service listings** from Connections Map + Family Services Directory (Porirua-filtered)
- **Service cards** — name, description, phone, address, website where available

How data is managed in MVP (simplified):

- Connections Map continues via the **existing Google Sheet** (team already knows this)
- FSD imported via a **one-time script** (Porirua slice); re-run manually if needed before Phase 2 automation
- Merged dataset published as a **single data file** the public site reads
- Basic duplicate flagging at merge time (manual tidy-up acceptable for MVP)

**MVP timeline:** ~2–3 weeks to soft launch.

### Phase 2 — Iteration (after testing)

Driven by MVP feedback, plus planned infrastructure:

- **Admin website** for review, edit, publish/hide
- **Weekly automated FSD sync** + review queue
- **Duplicate linking** in admin
- **Squarespace embed** on Porirua Locality site
- UX and content changes from testing (categories, labels, crisis strip, map behaviour)
- Editor guide, backups, and longevity hardening

**Phase 2 timeline:** ~2–3 weeks after MVP feedback is collected.

### Deferred from MVP (confirmed for Phase 2 unless testing says otherwise)

- Password-protected admin area (Directus)
- Automatic weekly FSD refresh
- Squarespace embed
- Formal duplicate-management UI
- Full editor and technical runbooks

---

## 2. Who it is for

### Primary users (public)

Three overlapping groups use the same directory:

| Group | Need |
|-------|------|
| **Immediate help** | Support for themselves or someone they know (food, housing, safety, health, etc.) |
| **Community connection** | Contact or connect with community groups and local kaupapa |
| **Civic & community places** | Marae, councils, Pātaka Kai, libraries, and organisations the community trusts |

They may be stressed, on mobile data, or unfamiliar with service names. The directory must **not require login** or **collect personal details** to search.

### Secondary users (behind the scenes)

Porirua Locality team members who keep listings accurate — reviewing imported data, fixing mistakes, and (Phase 2) publishing or hiding services. MVP: Google Sheet + manual merge overrides; Phase 2: admin UI (see §6).

Community workers may share the link; the directory is **not** a referral or case-management system.

---

## 3. What success looks like

| Goal | How we will know |
|------|------------------|
| People find help quickly | Clear categories (“I need food”), search, and a map of nearby services |
| Information is trustworthy | MVP: curated merge of Connections Map + reviewed FSD slice; Phase 2: publish/hide workflow |
| Local context is preserved | Community Connections Map organisations keep their local story and kaupapa where relevant |
| Real-world validation | MVP live within ~50 hrs; feedback collected before Phase 2 build |
| Low ongoing effort | Phase 2: government directory data refreshes automatically; team ~1–2 hrs/month on review |
| Long-lasting | Phase 2: stable tools, exportable data, documented handover |
| Fits the budget | MVP ≤ NZ$5k; total project ≤ NZ$10k |

---

## 4. What the public will see

*Sections 4.1–4.2 describe the **full target experience**. Phase 1 MVP delivers the core of this; Phase 2 adds embed and refinements from testing.*

### 4.1 Landing experience

When someone opens the directory they should be able to:

1. **Site navigation** — Porirua Locality (Te Wāhi Tiaki Tātou) logo; **Your Porirua Directory** as a **centered, prominent** title in the top bar (logo left, **My list** and **About** right); subnav on **landing only** for **I would like to…** and **Find support** / **Connect with community** (hidden in browse).
2. **Choose a path** — from the subnav on landing; filters and results appear after a path is chosen; **Back** returns to landing (only way to change path).
3. **Emergency and crisis numbers** — compact sticky footer on every page (landing, browse, and About).
4. **Support categories** (Find support path) — plain language, for example:
   - Food / kai
   - Housing / a place to stay
   - Money help / budgeting
   - Feeling unsafe / family violence support
   - Support and counselling
   - Health
   - Legal advice
   - Work and learning
   - Everyday needs (clothes, showers, transport, etc.)
5. **Search** — in browse, tap the **search icon** beside **Back**; the field expands to type what you need (sidebar keyword box removed). Results filter to Porirua-relevant services.
6. **Browse layout (desktop)** — **filters left**, **results centre**, **map right** (three-column from tablet-wide breakpoints up). On narrow screens: filters, then results, then map. **Show map** is on by default in browse so the side map appears when listings have coordinates; users can turn it off. Legacy **map above results** remains available via `?layout=top` for comparison. Tap a marker for details.
7. **List of results** — on **Find support**, the full listing shows by default with **no category chips selected**; tap one chip to filter to that topic only (tap again to show all); search narrows further.
8. **My list** — **Add to your list** on each listing; saved **places and organisations** for this visit only (plain-language note that nothing is stored online); **Remove** on saved items; optional **Print list**.

People can start from a **need** (e.g. food / kai) or from **search**. They should not need to know which list a service came from.

### 4.2 Service listing (each result)

Each service should show, where available:

- Name
- Short description (plain language)
- Address or suburb
- Phone number — compact **Call** button (bottom-right on the card; label **Call** only, `tel:` link) on each result and **My list** card when a number is listed
- Website link
- Opening hours (if known)

Do **not** show source/provenance labels (e.g. which database or map a row came from) or internal IDs on cards. Connections Map entries are distinguished in data by `source: community` only, not a public badge.

Do **not** show internal labels like “government record” or database IDs.

### 4.3 Where it will live

| | Phase 1 (MVP) | Phase 2 |
|--|---------------|---------|
| **Standalone website** | Yes — **https://directory.bsky.nz** | Yes — production URL |
| **Squarespace embed** | No — link out from Porirua Locality instead | Yes — lighter embed on existing site |

Both phases use the same underlying data once Phase 2 is complete.

---

## 5. Data sources

| Source | What it provides | How it stays current |
|--------|------------------|----------------------|
| **Porirua Community Connections Map** | Local organisations, kaupapa, initiatives, Assembly themes | Edited by Porirua Locality team in the admin area (initial import from existing spreadsheet / Google Sheet) |
| **NZ Family Services Directory (FSD)** | Broad national coverage of social services | **MVP:** one-time import, Porirua-filtered, manually reviewed before publish · **Phase 2:** automatic weekly import + review queue |

Additional local lists may be added in future phases if a stable, maintainable source becomes available.

### Porirua scope

Only services relevant to **people in Porirua** appear in the public directory. **Agreed rules (MVP):** documented in [fsd-porirua-filter-rationale.md](./fsd-porirua-filter-rationale.md) with machine-readable **`reasonCode`** audit on each import (`data/fsd-porirua-excluded.json`; see [MVP-RUNBOOK.md](./MVP-RUNBOOK.md)). Human review before publish uses that file plus spot-checks on `data/services.json`.

### Duplicate services

The same organisation may appear in both sources (e.g. Wesley Community Action in the Connections Map and the Family Services Directory). The system should:

- Detect likely duplicates automatically
- Let admins **link or hide** duplicates rather than show the same service twice
- Prefer the **richest local description** when merging (usually from the Connections Map)

---

## 6. Admin area (for the Porirua Locality team)

**Phase 2.** Not part of the MVP — in Phase 1 the team continues editing Connections Map orgs via the **Google Sheet**, and FSD updates are handled by re-running the import script.

A password-protected **admin website** (not public) where authorised team members can:

| Task | Description |
|------|-------------|
| **View all services** | Search and filter the full list |
| **Review new imports** | See services flagged after a government directory sync; approve, edit, or hide |
| **Edit a service** | Fix name, description, phone, address, map pin, categories |
| **Publish or hide** | Control what appears on the public site |
| **Handle duplicates** | Mark one record as primary; hide or link others |
| **Sync national data** | Trigger “sync now” in addition to the automatic weekly run |
| **Edit Connections Map entries** | Update local organisations, themes, and initiatives |

The admin area replaces long-term reliance on disconnected spreadsheets, though exports and backups remain available.

---

## 7. Maintenance and longevity

### Ongoing effort

| Activity | Phase | Who | How often |
|----------|-------|-----|-----------|
| Connections Map edits | MVP + ongoing | Porirua Locality team | Via Google Sheet (MVP); admin UI (Phase 2) |
| FSD refresh | Phase 2 | System | Weekly (automated) |
| FSD re-import | MVP only | Developer / team | Manual script run as needed |
| Review flagged changes | Phase 2 | Porirua Locality team | ~1–2 hours per month |
| System backups | Phase 2 | Hosting | Daily (automated) |
| Gather MVP feedback | Between phases | Porirua Locality team | 1–2 weeks after MVP launch |

**Target:** after Phase 2, the directory remains useful for **at least three years** without a major rebuild.

### Built to last

- **Your data is yours** — stored in a standard database that can be exported at any time (CSV/JSON).
- **No dependency on short-lived startups** — see Appendix A for technical choices.
- **Simple public site** — static pages that call a read-only data feed; minimal server maintenance.
- **Documented handover** — short guide for editors plus a technical runbook for hosting and backups.

---

## 8. Timeline

### Phase 1 — MVP (~2–3 weeks, ~50 hours)

| Week | Focus | Deliverables |
|------|-------|--------------|
| **1** | Data + public shell | Porirua FSD filter rules; import Connections Map + FSD; merged dataset; categories + crisis strip |
| **2** | Public directory | Search, map, service cards; mobile testing; standalone URL live |
| **3** (buffer) | Soft launch | Fix gaps; brief handover; **start user testing** |

### Between phases (~1–2 weeks, not in budget)

Collect feedback from help-seekers, Porirua Locality team, and community workers. Prioritise changes for Phase 2.

### Phase 2 — Iteration (~2–3 weeks, ~50 hours)

| Week | Focus | Deliverables |
|------|-------|--------------|
| **1** | Feedback + admin | Implement priority UX/content changes; database + admin setup; review/publish workflow |
| **2** | Automation + embed | Weekly FSD sync; duplicate handling; Squarespace embed |
| **3** (buffer) | Handover | Editor guide; backups; production launch |

**Total elapsed:** roughly 5–8 weeks including the feedback window.

---

## 9. Budget

| Phase | Hours | Cost |
|-------|-------|------|
| **Phase 1 — MVP** (testable public directory) | ~50 | **NZ$5,000** |
| **Phase 2 — Iteration** (feedback + admin + automation) | ~50 | **NZ$5,000** |
| **Total** | ~100 | **NZ$10,000** |

**Ongoing hosting (from Phase 2):** ~NZ$25–60 per month (database + admin server + free static hosting). MVP can run on free static hosting with a merged data file — minimal cost.

### Phase 1 — MVP includes

Public directory (categories, search, map, crisis strip), merged Connections Map + FSD data, standalone deployment, basic testing, soft launch.

### Phase 2 — Iteration includes

Changes from user testing, admin area, automated weekly FSD sync, Squarespace embed, duplicate workflow, documentation, and production handover.

### Not included in either phase

- Phone helpline or human navigator
- Referral tracking (“did the person get help?”)
- Provider self-service login to edit their own listing
- Installable phone app (PWA)
- Usage analytics dashboard
- Te Reo category labels (can be added later)
- Additional third-party data sources beyond Connections Map and FSD

---

## 10. Out of scope

### Entire project

- User accounts for the public
- Collecting personal information from help-seekers
- Sending referrals to providers through the app
- Replacing 111 or national crisis helplines
- National coverage outside Porirua
- Real-time availability (e.g. “bed free tonight”)
- Integrating referral-only tools that are not public directories (e.g. Police internal apps)

### Phase 1 MVP specifically

- Admin website (Directus or equivalent)
- Automatic weekly FSD sync
- Squarespace embed
- Formal duplicate-management UI
- Full editor and technical runbooks

---

## 11. Assumptions and dependencies

| Item | Assumption |
|------|------------|
| Porirua Locality team | 1–5 people with admin login; ~1–2 hrs/month for review |
| FSD open data | Continues to be published on [data.govt.nz](https://catalogue.data.govt.nz/dataset/family-services-directory) |
| Connections Map | Existing Google Sheet / CSV in `porirua_connections_map/` remains the starting point for local organisations |
| Squarespace | Porirua Locality site retains Code block capability for embed |
| Branding | Reuse Porirua Locality colours and fonts where practical |
| Content | Team provides crisis numbers list and final category labels in plain language |
| MVP feedback | Porirua Locality team recruits testers and captures feedback between phases |

---

## 12. Approval

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Project sponsor | | | |
| Porirua Locality lead | | | |

---

# Appendices

## Appendix A — Technical approach (for implementers)

### Architecture summary

**Phase 1 (MVP):** static site + `services.json` at **https://directory.bsky.nz** (Cloudflare `bsky.nz` → blackbox nginx). No admin database. See [architecture/porirua-directory-architecture.md](./architecture/porirua-directory-architecture.md).

**Phase 2 (target):**

```
┌─────────────────────────────────────────────────────────┐
│  Public site (static HTML/JS + map)                     │
│  Hosted: directory.bsky.nz (blackbox)                   │
└──────────────────────────┬──────────────────────────────┘
                           │ read published services.json
┌──────────────────────────▼──────────────────────────────┐
│  PostgreSQL (managed) — Phase 2 canonical store          │
└────────────▲─────────────────────────────▲──────────────┘
             │                             │
┌────────────┴────────────┐    ┌───────────┴───────────────┐
│  Directus (self-hosted) │    │  GitHub Actions (cron)    │
│  Admin UI + REST/GraphQL│    │  Weekly FSD import script │
└─────────────────────────┘    └───────────────────────────┘
```

**Phase 2 alternative (under evaluation):** Cloudflare **D1** + **Workers** instead of Postgres/Directus for admin — requires custom admin UI; good fit for `bsky.nz` stack. Directus remains the default for **non-technical editors** who only update field content (not schema).

### Component choices and rationale

| Component | Phase 1 | Phase 2 (default) |
|-----------|---------|-------------------|
| Public site | Vanilla JS + Leaflet on blackbox | Same |
| Published data | `services.json` in repo/image | Export from admin DB |
| Public hosting | directory.bsky.nz via Cloudflare + blackbox | Same |
| Database | None | PostgreSQL |
| Admin UI | Google Sheet + overrides | Directus (self-hosted) |
| FSD import | Manual `npm run build:data` | Weekly GitHub Actions + review queue |

| Component | Choice | Why |
|-----------|--------|-----|
| Database | PostgreSQL (managed) | Industry standard; portable; Directus-native |
| Admin UI | Directus (self-hosted, open source) | Built-in UI for editors; REST/GraphQL API; roles hide schema design |
| Public frontend | Evolve existing vanilla JS + Leaflet map | Already built; minimal dependency churn |
| Map tiles | OpenStreetMap via Leaflet | Open, free, stable |
| FSD import | Node script in repo + GitHub Actions (Phase 2) | Version-controlled |
| Admin hosting | Small VPS or blackbox (Docker) | Directus + Postgres; ~NZ$10–20/mo |

**Explicitly avoided:** Firebase, Retool, Airtable-as-database, Supabase-specific lock-in, serverless-only backends tied to one vendor.

**Alternative considered:** [ORServices](https://github.com/sarapis/orservices) — free ready-made directory package (public site + admin in one). Not selected for v1; see examples deck for comparison.

### Data model (simplified)

Each **service** record includes:

- Identity: name, description, phone, email, website, address, map coordinates
- Categories: mapped to public need categories (food, housing, etc.)
- Status: draft | published | hidden
- Sources: which import contributed (Connections Map or FSD)
- Community metadata (optional): Assembly themes, org type, initiatives — for Connections Map entries
- Duplicate handling: link to primary record if merged

Records should be exportable in standard formats (CSV/JSON) so data can move if tools change.

### FSD sync behaviour

**MVP (manual):** `npm run import:fsd` / `build:data` applies Porirua geo rules, writes included slice and **`fsd-porirua-excluded.json`** for audit; team reviews excluded reason codes before committing `services.json`. Rationale: [fsd-porirua-filter-rationale.md](./fsd-porirua-filter-rationale.md).

**Phase 2 (target):**

1. Weekly cron fetches Family Services Directory CSV from data.govt.nz.
2. Filter to Wellington region / Porirua-relevant rules.
3. Compare with existing records (name + address fuzzy match).
4. New or changed rows → **review queue** (not auto-published).
5. Unchanged published rows → left as-is.
6. Admin can trigger manual sync.

### Security

- Admin: password login; HTTPS only; small set of authorised users.
- Public API: read-only; published services only.
- No personal data stored about help-seekers.
- Daily automated database backups.

### Exit strategies

| If… | Then… |
|-----|-------|
| Directus is discontinued | Export Postgres; use pgAdmin or build simpler admin |
| GitHub Actions unavailable | Run same import script on any cron server |
| Static host changes | Move HTML/JS files to any web host |
| FSD format changes | Update import script only |

---

## Appendix B — Public need categories (draft)

Map Family Services Directory service types into these plain-language categories:

| Category ID | Public label | Example services |
|-------------|--------------|------------------|
| food | Food / kai | Food banks, social supermarkets, community meals |
| housing | Housing / a place to stay | Emergency housing, tenancy advice, transitional housing |
| money | Money help | Budgeting, benefits advice, hardship grants |
| safety | Feeling unsafe | Family violence support, refuge, safety planning |
| support | Support and counselling | Mental health, addiction, grief, relationships |
| health | Health | GPs, clinics, community health, sexual health |
| legal | Legal advice | Community law, fines, tenancy disputes |
| work | Work and learning | Employment help, training, driver licensing |
| everyday | Everyday needs | Clothing, showers, transport, older person support |

Final labels to be confirmed with Porirua Locality team (including Te Reo options in a future phase).

---

## Appendix C — Hour breakdown

### Phase 1 — MVP (~50 hours)

| Work package | Hours |
|--------------|-------|
| Discovery, Porirua filter rules, merged data model | 4 |
| FSD one-time import + Porirua filter | 8 |
| Merge Connections Map + FSD → published dataset | 6 |
| Public app: categories, search, map, crisis strip | 22 |
| Deploy standalone URL + MVP testing | 4 |
| Soft-launch handover + feedback plan | 2 |
| Contingency | 4 |
| **Phase 1 total** | **50** |

### Phase 2 — Iteration (~50 hours)

| Work package | Hours |
|--------------|-------|
| Synthesise user feedback + priority UX/content changes | 6 |
| Database setup, schema, backups | 10 |
| Admin setup (Directus) + review/publish workflow | 14 |
| FSD weekly automation + review queue | 10 |
| Squarespace embed | 4 |
| Duplicate handling in admin | 4 |
| Editor + technical documentation, production launch | 2 |
| **Phase 2 total** | **50** |

| | Hours |
|--|-------|
| **Grand total** | **100** |

---

## Appendix D — Comparison with Ask Izzy (context)

[Ask Izzy](https://www.askizzy.org.au/) is Australia’s mobile service finder — a useful reference, but a different scale:

| | Ask Izzy | Porirua Services Directory (this project) |
|--|----------|-------------------------------------------|
| Coverage | National (~450k services) | Porirua-local |
| Data team | 15+ full-time updaters | Porirua Locality + weekly FSD sync |
| Budget | Multi-year, multi-partner | ~NZ$10k total (NZ$5k MVP + NZ$5k iteration) |
| Strength | Breadth, zero-data telco deals | Local trust, community kaupapa, Connections Map |

This project adopts Ask Izzy’s **plain-language categories and mobile-first layout**, not its national infrastructure.

For a wider survey of comparable directories and toolkits, see [Human Services Directory Examples](human-services-directory-examples-overview.md).

---

## Appendix E — Related links

- [Porirua Community Connections Map](https://www.porirualocality.co.nz/poriruacommunityconnectionsmap)
- [Family Services Directory](https://www.familyservices.govt.nz/directory/)
- [FSD open data (data.govt.nz)](https://catalogue.data.govt.nz/dataset/family-services-directory)
- [Ask Izzy](https://www.askizzy.org.au/)
- [ORServices (free directory toolkit)](https://github.com/sarapis/orservices)
- [Documentation index (this repo)](README.md)
- [Connections Map source](../porirua_connections_map/README.md)
- [Services directory app](../porirua_directory/README.md)
- [Examples overview (this repo)](human-services-directory-examples-overview.md)
- [Examples slide deck (this repo)](slides/human-services-directory-examples.html)
- [MVP implementation plan](./superpowers/plans/2026-07-30-porirua-services-directory-mvp.md)

---

*Changes in v1.11: compact **Call** button (bottom-right on card; label **Call** only) on browse and **My list** cards when `phone` is present.*

*Changes in v1.10: **Three-column browse** is the production default (filters | results | sticky map on desktop); **Show map** on by default in browse; `?layout=top` restores map-above-results; **Your Porirua Directory** title **centered** in the top bar with larger Recoleta sizing (stacked title row on very narrow screens).*

*Changes in v1.9: FSD Porirua geo filter **documented and auditable** — [fsd-porirua-filter-rationale.md](./fsd-porirua-filter-rationale.md), excluded-row audit file on import, runbook review steps (address-context fixes Aug 2026).*

*Changes in v1.8: **My list** — session-only favourites; **Remove** + **Print list**; copy covers organisations and services; plain-language privacy note.*

*Changes in v1.7: Removed public *Community map* card badge; Connections Map provenance stays internal (`source: community`).*

*Changes in v1.6: Condensed nav — **Your Porirua Directory** in top bar; path buttons in subnav; **Find support** shows all listings with no chips selected; single-select category filter.*

*Changes in v1.5: Sticky crisis footer on all pages; map via optional **Show map** checkbox (not auto-shown).*

*Changes in v1.4: Landing vs browse UX; **Find support** / **Connect with community** copy; crisis strip on support path only; collapsible map (shown only when results have locations); left-hand filters; top nav with logo and About; Back to landing.*

*Changes in v1.3: Three public audiences; directory.bsky.nz hosting; Phase 1 architecture docs; Phase 2 D1 alternative noted alongside Directus.*

*Changes in v1.2: Two-phase delivery — MVP at 50% budget (~50 hrs / NZ$5k) for user testing, then Phase 2 iteration (~50 hrs / NZ$5k) for admin, automation, and feedback-driven changes.*

*Changes in v1.1: Two data sources only (Connections Map + FSD). Removed AWHI spreadsheet and non-directory references. Added link to examples deck.*
