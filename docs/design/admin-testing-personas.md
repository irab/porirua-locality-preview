# Admin testing personas and jobs to be done

**Audience:** Porirua Locality team testers, Coshop reviewers, and anyone walking the editor / build path  
**Status:** Directory module in Data Studio is the editor. The Connections Map Google Sheet is retired for directory listings.  
**Related:** [Editor one-pager](./editor-guide.md) · [Ana’s journey](./persona-journey-ana-support.html) · [Sam’s journey](./persona-journey-sam-community.html) · [MVP runbook](../MVP-RUNBOOK.md) · [Architecture](../architecture/porirua-directory-architecture.md)

Use this document to **review the public design**, the **Directory module**, and the **build system**. It complements Ana and Sam, who cover public help-seeker and community-connector visits.

Community listings are edited in **Data Studio → Directory** (Review and Listings tabs). The public site updates only after **Publish**. FSD weekly changes land on the Review tab — Moana never writes those queue rows herself.

---

## How to use this kit

1. Pick a **persona** and a **session length** from [Suggested sessions](#suggested-sessions).
2. Run each **job** as that person would: follow the steps, then mark **Pass / Fail / N/A**.
3. Record notes in [Review log](#review-log). Flag Phase 2 ideas separately from Phase 1 defects.
4. Local preview: `cd porirua_directory && npm run serve` → [http://localhost:5173/index.html](http://localhost:5173/index.html). Production smoke uses [https://directory.bsky.nz](https://directory.bsky.nz).

**Pass** means the job works *today* on the public site or in the Directory module. A missing merge UI is not a fail for P-02 — the create-time warning must still work.

---

## Personas

Public journeys stay with Ana (Find support) and Sam (Connect with community). These six people test **behind the scenes** and **on behalf of the organisation**.

### Moana — Community listings editor

| | |
|--|--|
| **Who** | Porirua Locality team member who already maintains the Connections Map sheet. Comfortable with Google Sheets, not with git or Node. |
| **Goal** | Keep local organisations accurate so community cards stay trustworthy. |
| **Does not** | Run Kubernetes, change filter rules, or invent new public Help-type chips. |
| **Tools** | Data Studio → **Directory** (Review and Listings). Address / Phone / Website / Help types — never JSON. |
| **Success** | A listing change shows on the public card after she clicks **Publish**, without asking Jordan or opening a spreadsheet. |

### Tāne — FSD data steward

| | |
|--|--|
| **Who** | Someone who reviews the government Family Services Directory slice after an import. Can open JSON and search `services.json`. |
| **Goal** | Only Porirua-relevant FSD rows publish; bad pins and out-of-city rows do not slip through. |
| **Does not** | Redesign the public UI or change brand tokens. |
| **Tools** | `npm run build:data`; `data/fsd-porirua-excluded.json`; `data/fsd-porirua-geocode-flags.json`; `data/overrides.json`. |
| **Success** | Exclusion reasons make sense; flagged pins are reviewed; hide/patch is documented and reversible. |

### Aroha — Locality lead / design reviewer

| | |
|--|--|
| **Who** | Product owner for Your Porirua Directory. Walks public journeys and decides Phase 2 priorities. |
| **Goal** | Confirm the site feels like Porirua Locality, is usable on a phone, and does not leak internal jargon. |
| **Does not** | Run the merge scripts unaided (can pair with Jordan). |
| **Tools** | Live or local site; Ana and Sam posters; this kit; [potential-changes](../potential-changes-and-insights.md). |
| **Success** | Landing paths, chips, grouping, crisis footer, and privacy copy hold up in a stakeholder walkthrough. |

### Priya — Frontline connector

| | |
|--|--|
| **Who** | Community worker or navigator who uses the directory **with or for** someone else. Not a public first-time visitor (that is Ana / Sam). |
| **Goal** | Find a few places quickly, save or print a list, and share it without creating an account. |
| **Does not** | Edit the sheet or overrides. |
| **Tools** | Phone and desktop; My list; print / share. |
| **Success** | Can help a whānau in one visit; list stays on the device; crisis numbers stay visible. |

### Jordan — Build and deploy operator

| | |
|--|--|
| **Who** | Developer or technical operator (Coshop or Locality with repo access). Owns the pipeline and the runbook. |
| **Goal** | Rebuild data, prove tests, preview locally, and know the deploy path without guessing. |
| **Does not** | Decide category wording (Aroha) or sign off FSD geography (Tāne). |
| **Tools** | `porirua_directory` npm scripts, Playwright, [MVP runbook](../MVP-RUNBOOK.md), CI (`.github/workflows/directory.yml`). |
| **Success** | A clean `npm test` / `build:data` / `serve` loop; deploy smoke checklist is current; docs match the scripts. |

### Kahu — Directory editor (readiness walk)

| | |
|--|--|
| **Who** | The person who reviews the weekly FSD queue, publishes, and watches for duplicate organisation cards. |
| **Goal** | Finish the weekly review in about 1–2 hours, and keep one public card per organisation. |
| **Does not** | Merge duplicates in this kit — that is a follow-on tool. Create-time name warnings are in scope. |
| **Tools** | Data Studio → Directory; [editor one-pager](./editor-guide.md). |
| **Success** | P-01–P-03 pass against the module, not against a spreadsheet stand-in. |

---

## Jobs to be done

Each job is written as *When … I want to … so I can …*. Steps assume `cd porirua_directory` unless noted.

### Design review

#### D-01 — Walk Ana’s support journey

**Persona:** Aroha (pair Priya)  
**When** a stressed parent needs kai, counselling, and a way back to work, **I want to** follow [Ana’s six steps](./persona-journey-ana-support.html) on the live site, **so I can** confirm Find support matches the story we show stakeholders.

| Step | Check | Result |
|------|--------|--------|
| 1 | Landing: no login; **Find support** and **Connect with community** are the two paths | |
| 2 | **Find support** opens browse with **no** need chips selected and a full support list | |
| 3 | **Food / kai** then **Support and counselling** narrow the list (OR across selected chips) | |
| 4 | **Add to your list** states the list stays on this device | |
| 5 | Search for `training` finds listings the chips do not name | |
| 6 | **My list** can be printed; closing the tab clears the list | |

**Pass if:** Ana can finish without knowing what FSD or “community source” means. Cards do not show database IDs or “government record”.

#### D-02 — Walk Sam’s community journey

**Persona:** Aroha  
**When** someone new to Porirua wants local climate or environment groups, **I want to** follow [Sam’s six steps](./persona-journey-sam-community.html), **so I can** confirm Connect with community is not a second copy of Find support.

| Step | Check | Result |
|------|--------|--------|
| 1 | **Connect with community** uses **org-type** chips (not the nine need chips) | |
| 2 | **Community groups** + map show local orgs; schools do not crowd the first screen unless that chip is on | |
| 3 | Search for `climate` or `environment` finds groups chips do not name | |
| 4 | Add / print list works the same as Ana’s visit | |

**Pass if:** Community cards feel local (kaupapa / description), and path **Back** returns to landing to change path.

#### D-03 — Help someone else in one visit

**Persona:** Priya  
**When** a whānau asks me for housing and food today, **I want to** find two or three places, save them, and leave a printed or shared list, **so I can** hand something useful over without creating an account for them.

| Step | Check | Result |
|------|--------|--------|
| 1 | Phone-width (or real phone): **Housing / a place to stay** + **Food / kai** | |
| 2 | At least one card has a working **Call** / `tel:` number | |
| 3 | **Urgent help** footer (111, 105, 1737, Women's Refuge) stays reachable on landing, browse, About, and My list (on a phone in browse / My list, expand the **Urgent help** control if the numbers are collapsed) | |
| 4 | **Share list** or copy-link works; opening the link adds those places (anyone with the link can see them) | |

**Pass if:** Priya can finish on a phone in a few minutes. Fail if the footer covers the last card or Call is missing when a number exists.

#### D-04 — Brand and chrome match Locality

**Persona:** Aroha  
**When** I put the directory next to [porirualocality.co.nz](https://www.porirualocality.co.nz/), **I want to** see the same family of type and colour, **so I can** trust this is our site, not a generic prototype.

| Step | Check | Result |
|------|--------|--------|
| 1 | Headings use **Recoleta**; body uses **Aktiv Grotesk** (Typekit `xcy1epi`). If body falls back to Poppins/system, fonts are a defect on that host | |
| 2 | Logo links to the Locality site; title is **Your Porirua Directory** | |
| 3 | **About** explains the two paths in plain language | |
| 4 | No public “FSD”, “CSV”, or source-database badges on cards | |

**Pass if:** Brand holds on local serve **and** on directory.bsky.nz (Adobe kit must allow the production host).

#### D-05 — Large FSD providers read as one organisation

**Persona:** Aroha (see [org grouping](./org-service-grouping-options.md))  
**When** I search **Salvation Army** or open a 10+ line FSD provider, **I want to** see one org card with service rows, **so I can** find the relevant offering without thirteen duplicate cards.

| Step | Check | Result |
|------|--------|--------|
| 1 | One card, one map pin for that org | |
| 2 | With **no** chip: service rows show; category pills stay off until a row is opened | |
| 3 | With a need chip: only matching rows show, with highlighted pills; **See other services** reveals siblings when any exist | |
| 4 | Need + search both apply to the **same** service line (siblings are not pulled in by the chip alone) | |

**Pass if:** Grouping matches Option B. Fail if duplicate full cards return for the same provider name at one site.

#### D-06 — Keyboard, contrast, and reduced motion

**Persona:** Aroha / Priya  
**When** a tester cannot use a mouse or wants less motion, **I want to** reach paths, chips, cards, and crisis links from the keyboard, **so I can** stand behind a high accessibility bar.

| Step | Check | Result |
|------|--------|--------|
| 1 | Tab order: logo, title, My list, About, path cards, then browse controls | |
| 2 | Chips and **Add to your list** have visible focus and a clear selected state | |
| 3 | `prefers-reduced-motion`: filter/map collapse does not rely on large motion | |
| 4 | Crisis links are real `tel:` targets with accessible names | |

**Pass if:** A keyboard-only pass can choose a path, filter, open a card, and call. Automated e2e is Chromium only — this job is **manual**.

---

### Editor and data

#### E-01 — A listing change becomes a public card

**Persona:** Moana  
**When** a community org changes phone, address, or description, **I want to** update it in Directory and Publish, **so I can** keep one editor for local groups.

| Step | Check | Result |
|------|--------|--------|
| 1 | Sign in lands on **Directory**. Listings: type to find the organisation (A–Z). Click a row to select it, **Edit** to change it, or **Add** a new community organisation / a service line on the selected one | |
| 2 | Edit Address, Phone, Website, Help types. Search an address then drag the pin — no latitude numbers. Leaving Name on a new listing warns if a near-name already exists (including archived). Open the existing one, or Create anyway | |
| 3 | Save. The row is published in the database. **No** review-queue item appears for this create or edit | |
| 4 | The unpublished-changes banner shows. **Publish**. Search the org on the public site: name, description, phone, website, pin, and org-type chip match what she typed | |

**Pass if:** Moana finishes without Jordan, git, or the Google Sheet.  
**Fail if:** Add writes a review-queue row she must Accept, or if save publishes the public site by itself.

#### E-02 — Review FSD exclusions after an import

**Persona:** Tāne  
**When** DIA publishes a new FSD CSV, **I want to** see why rows were dropped, **so I can** defend the Porirua slice to stakeholders.

| Step | Check | Result |
|------|--------|--------|
| 1 | `npm run import:fsd` (or `build:data`); note console `includedCount` / `excludedCount` | |
| 2 | Open `data/fsd-porirua-excluded.json` — each row has `reasonCode` and `reasonDetail` | |
| 3 | Spot-check `DISTRICT_CONTRADICTS_PHYSICAL`, `ADDRESS_NON_PORIRUA_CITY`, `NO_PORIRUA_SIGNAL` | |
| 4 | `rg -i 'Christchurch\|Palmerston North\|Ranui, Auckland\|Whitby Street' data/services.json` — expect no hits after the Aug 2026 filter set | |

**Pass if:** Audit file is readable without reading the rule source. Fail if a known out-of-city row is published. Rationale: [fsd-porirua-filter-rationale.md](../fsd-porirua-filter-rationale.md).

#### E-03 — Review flagged map pins

**Persona:** Tāne  
**When** an included FSD row has suspicious coordinates, **I want to** see it in the geocode QA file, **so I can** patch the pin or hide the row before the public map is wrong.

| Step | Check | Result |
|------|--------|--------|
| 1 | After import, note `geocodeFlagCount`; open `data/fsd-porirua-geocode-flags.json` | |
| 2 | For one `GEOCODE_IN_MARINE_BBOX` or `GEOCODE_OUTSIDE_PORIRUA_BOUNDS` flag, confirm the pin on local preview | |
| 3 | Known example: Ora Toa respiratory / `FSD_ID` 4690 — marine-box class of error | |
| 4 | If correcting: add `patches` in `data/overrides.json` (`lat`, `lng`, optional `address`) → `npm run merge:services` → pin moves | |

**Pass if:** Flags do not silently publish as “fine”. Existing patch `fsd-2964` (22 Ngāti Toa Street) is a worked example.

#### E-04 — Hide a listing that should not be public

**Persona:** Tāne (Aroha signs off)  
**When** a published FSD row is wrong or harmful to show, **I want to** hide it in overrides without waiting for the next DIA drop, **so I can** take it off the public list this rebuild.

| Step | Check | Result |
|------|--------|--------|
| 1 | Note the listing `id` (FSD: `fsd-<SERVICE_ID>` or `fsd-<FSD_ID>`) | |
| 2 | Add that id to `overrides.json` → `hiddenIds` | |
| 3 | `npm run merge:services` — id gone from `data/services.json` and from local browse | |
| 4 | Revert the hide if this was only a drill (do not leave test hides in a publish commit) | |

**Pass if:** Hide is file-based, reviewed in git, and does not require editing generated JSON by hand.

---

### Build system

#### B-01 — Rebuild the published dataset

**Persona:** Jordan  
**When** the sheet or FSD feed has changed, **I want to** run one documented command, **so I can** regenerate `services.json` without remembering script order.

| Step | Check | Result |
|------|--------|--------|
| 1 | `npm install` then `npm run build:data` | |
| 2 | Console shows import + merge; `data/services.json` has `generatedAt` and `counts` | |
| 3 | `fsd-porirua.raw.json`, `fsd-porirua-excluded.json`, and `fsd-porirua-geocode-flags.json` are gitignored | |
| 4 | Runbook and `porirua_directory/README.md` still describe this command | |

**Pass if:** A new operator can rebuild from the runbook alone.

#### B-02 — Automated tests still describe the pipeline

**Persona:** Jordan  
**When** I change import, merge, or UI flow, **I want to** run the same checks CI runs, **so I can** catch filter and browse regressions before deploy.

| Step | Check | Result |
|------|--------|--------|
| 1 | `npm test` (import, merge, geocode QA, grouping) | |
| 2 | `npm run test:e2e` (Playwright / Chromium) | |
| 3 | After a **rule** change: tests + [phase1 spec](../porirua-directory-phase1-spec.md) and/or [filter rationale](../fsd-porirua-filter-rationale.md) updated in the same change set | |
| 4 | After a **UI** change: e2e covers the new path or the gap is listed | |

**Pass if:** Commands in [AGENTS.md](../../AGENTS.md) match `package.json`. Fail if docs say to run a script that no longer exists.

#### B-03 — Local preview matches production behaviour

**Persona:** Jordan (Aroha may sit in)  
**When** I serve the static app locally, **I want to** exercise landing → browse → My list → About, **so I can** see the same chrome testers will see on directory.bsky.nz.

| Step | Check | Result |
|------|--------|--------|
| 1 | `npm run serve` — `/index.html` loads; `directory.html` redirects here | |
| 2 | Modules load (`*.mjs` as JavaScript). If buttons do nothing, check MIME — production nginx must serve `application/javascript` ([`infra/nginx.conf`](../../porirua_directory/infra/nginx.conf)) | |
| 3 | Desktop ≥1024px: filters left, results centre, map right (sticky) | |
| 4 | Narrow viewport: scroll down collapses chips/map; **Show filters** reopens chips; scroll to true top restores map | |

**Pass if:** Layout and path switch work without the production host. Optional: `?layout=top` and `?demo=1` still behave as documented in [potential-changes](../potential-changes-and-insights.md#layout-experiments-demo).

#### B-04 — Deploy smoke (read the path, do not ship unless asked)

**Persona:** Jordan  
**When** `services.json` is ready to publish, **I want to** follow the runbook deploy list, **so I can** verify the live site without inventing steps.

| Step | Check | Result |
|------|--------|--------|
| 1 | Runbook still says: commit `data/services.json` → push `main` → GHCR image → ArgoCD tenant `porirua-directory` → `directory.bsky.nz` | |
| 2 | Live smoke (only if you have access and a reason): path cards work; **Urgent help** shows; fonts load | |
| 3 | This job does **not** edit `clusters/prod/**` or promote to production unless the user explicitly asked in the same turn | |

**Pass if:** The written path is complete. Do not treat “read the runbook” as authorisation to deploy.

#### B-05 — Design tokens survive the build

**Persona:** Jordan + Aroha  
**When** we containerise the static site, **I want to** keep Recoleta, Typekit, and CSS variables, **so I can** avoid a “works on localhost, generic on prod” split.

| Step | Check | Result |
|------|--------|--------|
| 1 | `directory.css` custom properties (`--ink`, `--accent`, `--bg`, …) still drive chrome | |
| 2 | Dockerfile copies CSS, HTML, modules, and `data/services.json` | |
| 3 | Production Typekit kit allows **directory.bsky.nz** | |

**Pass if:** Brand job D-04 still passes after an image build, not only on `npm run serve`.

---

### Directory editor walk

These jobs **pass** when Kahu can do them in the Directory module. They **fail** if she still needs the sheet, a Flow bookmark, or raw collections.

#### P-01 — Review queue (~1–2 hours/month)

**Persona:** Kahu  
**When** a weekly FSD sync arrives, **I want to** accept government updates, keep my ticks, or take a dropped service off the site, **so I can** finish in about 1–2 hours.

| What she sees | Primary actions |
|---------------|-----------------|
| Details changed | Accept, Keep yours (when she already set that field), Accept and edit, Reject |
| New service | Accept, Reject |
| Gone from the government list | **Take it off the site** (archives; not labelled Accept) |
| Check the pin | The pin is fine, I'll move the pin, Needs confirmation |

Each card shows a field-by-field change (`Phone: 04 237 7749 → 04 237 9608`) or the map for a pin check. No raw `changed` / `new` / `geocode_flag` labels.

**Pass if:** the queue is FSD-only; she can see what will change before she acts; a removed row’s primary button is “Take it off the site”; that action hides the service and writes the hide override so next week’s sync does not resurrect it.  
**Fail if:** Accept on a removed row republishes the dropped service, or the card has no before-and-after.

#### P-02 — One public card (create-time check)

**Persona:** Kahu  
**When** the same organisation is already in the directory, **I want to** be warned before I add it again, **so I can** avoid a second card.

Create-time near-name check must flag the known live pairs (Whānau/Whanau, Rūnanga/Runanga, Te Waka Whaiora, Te Wāhi Tiaki Tātou), including archived and merged-away names, and typed fragments such as **Whanau** or **Porirua Whanau**. Full merge UI is a follow-on task — see [open-duplicate-org-cards](../issues/open-duplicate-org-cards.md).

**Pass if:** leaving the Name field shows Open the existing one (primary) and Create anyway (secondary).  
**Fail if:** the check is Vue-only, skips hidden rows, misses Whānau/Whanau or Rūnanga/Runanga, or ignores a distinctive partial such as **Whanau**.

#### P-03 — Editor guide vs runbook

**Persona:** Kahu + Moana  
**When** handover happens, **I want to** know which document is for editors and which is for operators, **so I can** avoid teaching the whole repo to every Locality staff member.

**Pass if:** [editor-guide.md](./editor-guide.md) covers Review, Listings, the name warning, Publish, and “Take it off the site”; [MVP runbook](../MVP-RUNBOOK.md) stays the operator path.

---

## Suggested sessions

| Session | Length | Personas | Jobs |
|---------|--------|----------|------|
| **Design walkthrough** | 45 min | Aroha, Priya | D-01, D-02, D-03, D-04 |
| **Grouping and access** | 30 min | Aroha | D-05, D-06 |
| **Editor / data** | 60 min | Moana, Tāne, Jordan | E-01, E-02, E-03, E-04 |
| **Build system** | 45 min | Jordan | B-01, B-02, B-03, B-05 |
| **Deploy path (read-only)** | 15 min | Jordan | B-04 |
| **Directory editor** | 20 min | Kahu, Aroha | P-01, P-02, P-03 |

A half-day review can run **design → editor → build → Phase 2** in that order. Capture Phase 2 ideas in [potential-changes](../potential-changes-and-insights.md); file Phase 1 defects under [docs/issues](../issues/README.md) when they are recurring bugs.

---

## Review log

Copy for each session.

| Field | Notes |
|-------|--------|
| Date | |
| Reviewer(s) | |
| Environment | local `npm run serve` / directory.bsky.nz / other |
| Jobs run | e.g. D-01, D-05, B-02 |
| Pass / fail | |
| Phase 1 defects | |
| Phase 2 ideas | |
| Follow-up owner | |

---

## Out of scope for this kit

- Building a second editor outside Data Studio
- Provider self-service login
- Referral or case-management tracking
- Replacing Ana and Sam as the public stories
- Production deploys without an explicit same-turn request
