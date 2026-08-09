# Porirua Services Directory — Phase 1 MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a testable MVP public directory (dual browse: need help + connect with community; search, map, compact crisis strip) merging Connections Map + Porirua-filtered FSD, deployed at **https://directory.bsky.nz** (Cloudflare `bsky.nz` → blackbox prod nginx).

**Architecture:** Node scripts fetch/normalise FSD CSV and merge with Connections Map (Google Sheet CSV or local fallback) into committed `data/services.json`. Static directory UI (`index.html` + modules) reads that JSON. **nginx** Docker image on **blackbox prod** tenant `porirua-directory` with Ingress host `directory.bsky.nz` (ExternalDNS). **Playwright** validates locally in CI on every PR touching `porirua_directory/`.

**Tech Stack:** Vanilla JS + Leaflet (existing), Node 20+ (`node:test`), csv-parse, Playwright, Docker nginx, ArgoCD manifests in [`~/repos/blackbox`](file:///Users/ira/repos/blackbox) `clusters/prod/tenants/porirua-directory/`.

**Spec:** [docs/porirua-services-directory-requirements.md](../porirua-services-directory-requirements.md) **v1.3** — Phase 1 only (~50 hours). Strategic milestone order: [Cursor MVP plan](file:///Users/ira/.cursor/plans/porirua_directory_mvp_921fcae1.plan.md).

**Progress (2026-08):** Milestone A (data pipeline) complete. Milestones B–E (UI, e2e, Docker/CI, blackbox prod tenant, runbook) in flight — checkboxes below updated as tasks land.

## Global Constraints

- **Budget scope:** Phase 1 MVP only — no Directus, no weekly FSD cron, no Squarespace embed.
- **Data sources:** Connections Map + FSD only; Google Sheet remains editor for community orgs until Phase 2.
- **Public UX:** Plain language; no login; crisis numbers always visible; no internal source jargon on cards.
- **Longevity:** Prefer portable JSON + static site; public MVP on **directory.bsky.nz** (prod tenant + ExternalDNS).
- **Existing site:** Keep current Assembly map in `porirua_connections_map/` (`index.html` / `map.js`) working — directory is a **parallel entry point**, not a breaking change.
- **FSD CSV URL (verified):** `https://catalogue.data.govt.nz/dataset/3e967faa-c44b-4f64-989d-2df574b3adf3/resource/35de6bf8-b254-4025-89f5-da9eb6adf9a0/download/fsd_provider_dia_rpt.csv`

---

## Repository layout

- **`porirua_directory/`** — Phase 1 MVP (this plan). Task steps assume `cd porirua_directory` unless noted.
- **`porirua_connections_map/`** — Assembly Connections Map. Merge pipeline uses the same Google Sheet / `data/organisations.csv` (see `porirua_directory/scripts/config.mjs`).

## File map (MVP)

Paths below are relative to **`porirua_directory/`** except Blackbox and workflow rows.

| Path | Responsibility |
|------|----------------|
| `package.json` | Scripts: `import:fsd`, `merge:services`, `test`, `test:e2e`, `build:data` |
| `scripts/config.mjs` | FSD URL, sheet URL, paths to `../porirua_connections_map/data/` |
| `scripts/fsd-import.mjs` | Download FSD CSV → `data/fsd-porirua.raw.json` |
| `scripts/fsd-porirua-rules.mjs` | Shared filter + category mapping |
| `scripts/merge-services.mjs` | Connections + FSD → `data/services.json` |
| `scripts/lib/normalize.mjs` | Dedup keys, phone/URL cleanup |
| `tests/fsd-import.test.mjs` | Unit tests for filter/mapping |
| `tests/merge-services.test.mjs` | Unit tests for merge/dedup |
| `config-directory.js` | Crisis numbers, need categories, map centre |
| `directory-data.js` | Load `data/services.json` |
| `directory.js` | Categories, search, map, list UI |
| `directory.html` | MVP public page |
| `directory.css` | Styles (reuse palette from `porirua_connections_map/index.html`) |
| `data/services.json` | **Generated** merged publishable dataset |
| `data/fsd-porirua.raw.json` | **Generated** intermediate (optional commit for offline dev) |
| `e2e/directory.spec.js` | Playwright tests |
| `playwright.config.js` | Local + Blackbox base URL via env |
| `Dockerfile` | nginx:alpine, copy static + data |
| `infra/nginx.conf` | SPA/static routing |
| `.github/workflows/directory.yml` | Build image (context `porirua_directory/`), push GHCR, Playwright |
| `~/repos/blackbox/clusters/dev/tenants/porirua-services/*` | K8s Deployment, Service, Ingress |
| `docs/MVP-RUNBOOK.md` | Rebuild data, deploy, test on Blackbox |

---

### Task 1: Node tooling and test harness

**Files:**
- Create: `package.json`
- Create: `tests/fixtures/fsd-sample.csv`
- Create: `tests/fixtures/connections-sample.csv`

**Interfaces:**
- Produces: npm scripts `test` → `node --test tests/**/*.test.mjs`

- [ ] **Step 1: Add `package.json`**

```json
{
  "name": "porirua-locality-preview",
  "private": true,
  "type": "module",
  "engines": { "node": ">=20" },
  "scripts": {
    "test": "node --test tests/**/*.test.mjs",
    "import:fsd": "node scripts/fsd-import.mjs",
    "merge:services": "node scripts/merge-services.mjs",
    "build:data": "npm run import:fsd && npm run merge:services",
    "test:e2e": "playwright test",
    "serve": "python3 -m http.server 5173"
  },
  "devDependencies": {
    "@playwright/test": "^1.52.0"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run: `npm install`  
Expected: `node_modules/` created, lockfile present.

- [ ] **Step 3: Add minimal fixture CSVs** (2–3 rows each) under `tests/fixtures/` mirroring real headers from FSD (`PROVIDER_NAME`, `PHYSICAL_DISTRICT`, `LATITUDE`, `LONGITUDE`, `LEVEL_1_CATEGORY`, `SERVICE_NAME`, `SERVICE_DETAIL`, `PUBLISHED_PHONE_1`) and Connections Map (`name`, `orgType`, `theme`, `lat`, `lng`, …).

- [ ] **Step 4: Smoke test runner**

Run: `npm test`  
Expected: PASS (zero tests yet) or add one placeholder test file `tests/smoke.test.mjs`:

```javascript
import test from "node:test";
import assert from "node:assert/strict";

test("tooling ok", () => {
  assert.equal(1 + 1, 2);
});
```

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json tests/
git commit -m "chore: add node tooling and test harness for services directory MVP"
```

---

### Task 2: Porirua filter rules and FSD import

**Files:**
- Create: `scripts/fsd-porirua-rules.mjs`
- Create: `scripts/fsd-import.mjs`
- Create: `tests/fsd-import.test.mjs`

**Interfaces:**
- Produces: `export function isPoriruaRelevant(row)` → boolean
- Produces: `export function mapFsdRowToService(row)` → service object (see Task 3 shape)
- Produces: CLI writes `data/fsd-porirua.raw.json` array

- [ ] **Step 1: Write failing tests** (`tests/fsd-import.test.mjs`)

```javascript
import test from "node:test";
import assert from "node:assert/strict";
import { isPoriruaRelevant, mapFsdRowToService } from "../scripts/fsd-porirua-rules.mjs";

test("includes Porirua district rows", () => {
  assert.equal(isPoriruaRelevant({ PHYSICAL_DISTRICT: "Porirua" }), true);
});

test("includes Wellington region service area when district empty", () => {
  assert.equal(
    isPoriruaRelevant({ PHYSICAL_REGION: "Wellington", PHYSICAL_DISTRICT: "" }),
    false
  ); // tighten in implementation — document agreed rule in fsd-porirua-rules.mjs
});

test("maps FSD row to service with source fsd", () => {
  const s = mapFsdRowToService({
    FSD_ID: "1",
    PROVIDER_NAME: "Test Provider",
    SERVICE_NAME: "Food bank",
    SERVICE_DETAIL: "Help with food",
    PUBLISHED_PHONE_1: "04 123 4567",
    PHYSICAL_ADDRESS: "1 Main St, Porirua",
    PHYSICAL_DISTRICT: "Porirua",
    LATITUDE: "-41.13",
    LONGITUDE: "174.84",
    LEVEL_1_CATEGORY: "Food",
  });
  assert.equal(s.source, "fsd");
  assert.equal(s.name, "Test Provider");
  assert.ok(s.categories.includes("food"));
});
```

Adjust assertions once filter rules are documented in Step 3.

- [ ] **Step 2: Run tests — expect FAIL**

Run: `npm test`  
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement `scripts/fsd-porirua-rules.mjs`**

Rules (document in file header):
- Include if `PHYSICAL_DISTRICT` matches `/porirua/i`
- Include if `PHYSICAL_ADDRESS` or `POSTAL_ADDRESS` matches `/porirua|titahi|whitby|cannons creek|waitangirua|kenepuru|plimmerton|paekākāriki/i` (expand list in config array)
- Map `LEVEL_1_CATEGORY` / keywords → `categories[]` using table from requirements Appendix B (food, housing, money, safety, support, health, legal, work, everyday)

- [ ] **Step 4: Implement `scripts/fsd-import.mjs`**

- Read CSV from env `FSD_CSV_URL` or default URL from Global Constraints
- Use PapaParse via dynamic import or lightweight `csv-parse` if added — **prefer zero new deps:** parse with Node or reuse `papaparse` from CDN is browser-only; add `csv-parse` devDependency OR hand-roll minimal CSV for MVP
- Write `data/fsd-porirua.raw.json`

- [ ] **Step 5: Run tests — expect PASS**

Run: `npm test`

- [ ] **Step 6: Run import against live CSV (once)**

Run: `npm run import:fsd`  
Expected: `data/fsd-porirua.raw.json` with >0 records; spot-check one Porirua provider.

- [ ] **Step 7: Commit**

```bash
git add scripts/fsd-porirua-rules.mjs scripts/fsd-import.mjs tests/fsd-import.test.mjs data/fsd-porirua.raw.json
git commit -m "feat: import and filter FSD data for Porirua"
```

---

### Task 3: Merge Connections Map + FSD → `services.json`

**Files:**
- Create: `scripts/lib/normalize.mjs`
- Create: `scripts/merge-services.mjs`
- Create: `tests/merge-services.test.mjs`
- Modify: `data-loader.js` — **do not break**; merge script reads CSV independently

**Interfaces:**
- Produces unified service shape:

```javascript
/**
 * @typedef {Object} Service
 * @property {string} id
 * @property {string} name
 * @property {string} description
 * @property {string} phone
 * @property {string} url
 * @property {string} address
 * @property {number|null} lat
 * @property {number|null} lng
 * @property {string[]} categories
 * @property {"community"|"fsd"} source
 * @property {string[]=} badges
 * @property {object=} communityMeta
 * @property {string=} duplicateOf
 */
```

- Consumes: `window.PORIRUA_MAP_CONFIG.googleSheetCsvUrl` same URL as `config.js` for Connections fetch

- [ ] **Step 1: Write failing merge tests**

```javascript
import test from "node:test";
import assert from "node:assert/strict";
import { mergeServices } from "../scripts/merge-services.mjs";

test("community row wins description when duplicate detected", () => {
  const out = mergeServices({
    community: [{
      id: "c1", name: "Wesley Community Action", description: "Local kaupapa",
      source: "community", categories: ["food"], lat: -41.14, lng: 174.84,
    }],
    fsd: [{
      id: "f1", name: "Wesley Community Action", description: "Generic gov text",
      source: "fsd", categories: ["food"], lat: -41.14, lng: 174.84,
    }],
  });
  const published = out.services.filter((s) => !s.duplicateOf);
  assert.equal(published.length, 1);
  assert.equal(published[0].description, "Local kaupapa");
  assert.deepEqual(published[0].badges, ["Community map"]);
});
```

- [ ] **Step 2: Implement `normalize.mjs`** — `dedupeKey(name, lat, lng)`, `normalizePhone`, slug `id`

- [ ] **Step 3: Implement `merge-services.mjs`**

- Load community: fetch Google Sheet CSV URL from `config.js` (read file as text + regex URL, or duplicate URL constant in `scripts/config.mjs`)
- Map community org rows → services with `badges: ["Community map"]`, `communityMeta: { orgType, theme, themes, initiatives, labels }`
- Infer `categories[]` for community from `labels` / `theme` mapping table in `fsd-porirua-rules.mjs` (shared export)
- Merge FSD list; mark `duplicateOf` when dedupeKey matches; prefer community for published fields

- [ ] **Step 4: CLI writes `data/services.json`**

```json
{
  "generatedAt": "ISO-8601",
  "counts": { "community": 0, "fsd": 0, "published": 0, "duplicatesHidden": 0 },
  "services": []
}
```

- [ ] **Step 5: Run tests + build**

Run: `npm test && npm run build:data`

- [ ] **Step 6: Commit**

```bash
git add scripts/ data/services.json tests/merge-services.test.mjs
git commit -m "feat: merge Connections Map and FSD into services.json"
```

---

### Task 4: Directory public UI (MVP)

**Files:**
- Create: `config-directory.js`
- Create: `directory-data.js`
- Create: `directory.js`
- Create: `directory.css`
- Create: `directory.html`
- Modify: `README.md` — link to `/directory.html`

**Interfaces:**
- `window.PORIRUA_DIRECTORY.load()` → `{ services, meta }`
- Categories from `config-directory.js` `needCategories[]`

- [ ] **Step 1: Add `config-directory.js`** with crisis numbers array and `needCategories` (ids + labels from requirements §4.1)

- [ ] **Step 2: Add `directory-data.js`** — fetch `./data/services.json`, filter `!duplicateOf`

- [ ] **Step 3: Build `directory.html` layout**

Order: crisis strip → heading → category chips → search input → map `#directory-map` → results list `#directory-results`

- [ ] **Step 4: Implement `directory.js`**

- Leaflet map (reuse patterns from `map.js`: icons optional — use single marker colour for MVP)
- Filter by active categories + search string (name, description, address)
- Render cards: name, description, phone `tel:`, url, badge if community
- Mobile-first CSS in `directory.css` (copy CSS variables from `porirua_connections_map/index.html`)

- [ ] **Step 5: Manual check**

Run: `npm run serve` → open `http://localhost:5173/directory.html`  
Expected: map pins, category filter works, crisis strip visible.

- [ ] **Step 6: Commit**

```bash
git add directory.html directory.js directory.css directory-data.js config-directory.js README.md
git commit -m "feat: add public services directory MVP page"
```

---

### Task 5: Playwright E2E (local)

**Files:**
- Create: `playwright.config.js`
- Create: `e2e/directory.spec.js`

**Interfaces:**
- `BASE_URL` defaults to `http://127.0.0.1:5173`

- [ ] **Step 1: Add Playwright config**

```javascript
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  use: {
    baseURL: process.env.BASE_URL || "http://127.0.0.1:5173",
  },
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: "python3 -m http.server 5173",
        port: 5173,
        reuseExistingServer: !process.env.CI,
      },
});
```

- [ ] **Step 2: Add `e2e/directory.spec.js`**

```javascript
import { test, expect } from "@playwright/test";

test("crisis strip and categories visible", async ({ page }) => {
  await page.goto("/directory.html");
  await expect(page.getByRole("link", { name: /111/ })).toBeVisible();
  await expect(page.getByText(/What do you need help with/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /Food|kai/i })).toBeVisible();
});

test("search filters results", async ({ page }) => {
  await page.goto("/directory.html");
  await page.getByPlaceholder(/Search/i).fill("Wesley");
  await expect(page.locator("#directory-results")).toContainText(/Wesley/i);
});

test("map loads", async ({ page }) => {
  await page.goto("/directory.html");
  await expect(page.locator(".leaflet-container")).toBeVisible();
});
```

Adjust selectors to match actual markup from Task 4.

- [ ] **Step 3: Install browsers**

Run: `npx playwright install chromium`

- [ ] **Step 4: Run E2E**

Run: `npm run test:e2e`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add playwright.config.js e2e/
git commit -m "test: add Playwright E2E for services directory MVP"
```

---

### Task 6: Docker image (static nginx)

**Files:**
- Create: `Dockerfile`
- Create: `infra/nginx.conf`
- Create: `.dockerignore`

- [ ] **Step 1: `infra/nginx.conf`** — serve `/`, gzip json, cache static assets

- [ ] **Step 2: `Dockerfile`**

```dockerfile
FROM nginx:1.27-alpine
COPY infra/nginx.conf /etc/nginx/conf.d/default.conf
COPY directory.html directory.js directory.css directory-data.js config-directory.js /usr/share/nginx/html/
COPY data/services.json /usr/share/nginx/html/data/services.json
EXPOSE 8080
```

*(Connections Map remains a separate static bundle under `porirua_connections_map/` if Squarespace embed is needed.)*

Adjust COPY list to minimal set for directory-only MVP image.

- [ ] **Step 3: Local Docker smoke**

Run: `docker build -t porirua-directory:local . && docker run --rm -p 8080:8080 porirua-directory:local`  
Open: `http://localhost:8080/directory.html`

- [ ] **Step 4: Commit**

```bash
git add Dockerfile infra/nginx.conf .dockerignore
git commit -m "chore: add nginx Docker image for directory MVP"
```

---

### Task 7: GitHub Actions — build, test, push image

**Files:**
- Create: `.github/workflows/directory.yml`

- [ ] **Step 1: Workflow** — on push to `main` (paths: directory*, scripts/, data/services.json, Dockerfile, e2e/)

Jobs:
1. `unit` — `npm test`
2. `e2e` — `npm run test:e2e` (after `npm run build:data` if services.json not committed)
3. `image` — build-push `ghcr.io/<owner>/porirua-directory:dev` and `:${{ github.sha }}`

Use same GHCR pattern as [coshop-v2/.github/workflows/container-images.yml](file:///Users/ira/repos/coshop-v2/.github/workflows/container-images.yml).

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/directory.yml
git commit -m "ci: test and publish porirua-directory container image"
```

---

### Task 8: Blackbox **prod** tenant (`directory.bsky.nz`)

**Files (in `~/repos/blackbox`):**
- `clusters/prod/tenants/porirua-directory/` — Deployment, Service, Ingress host **`directory.bsky.nz`**, `https-proto` middleware (Flexible SSL pattern from coshop).

**Reference:** [bsky.nz README](file:///Users/ira/repos/blackbox/infra/cloudflare/bsky.nz/README.md), prod `external-dns-bsky`.

- [ ] **Step 1: Deployment** — image `ghcr.io/irab/porirua-directory:latest`, port 8080

- [ ] **Step 2: Ingress** — host `directory.bsky.nz`, path `/`, middleware `prod-porirua-directory-https-proto@kubernetescrd`

- [ ] **Step 3: Push blackbox repo** — ArgoCD ApplicationSet picks up new tenant dir → namespace `prod-porirua-directory`

- [ ] **Step 4: Verify** — `https://directory.bsky.nz` loads after GHCR image exists and DNS propagates

---

### Task 9: Post-deploy smoke (optional)

- [ ] **Optional CI job** — `BASE_URL=https://directory.bsky.nz npm run test:e2e` after image push (no local webServer)

- [ ] **Step 2: Document in `docs/MVP-RUNBOOK.md`**

Sections: Rebuild data, Build image, Argo sync, Test URLs, Feedback collection template for Phase 2.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/directory.yml docs/MVP-RUNBOOK.md
git commit -m "docs: Blackbox test URL and optional CI smoke"
```

---

### Task 10: MVP handoff checklist

- [ ] **Step 1: Update requirements cross-link** — add pointer from requirements doc to this plan (optional one line in §1.1)

- [ ] **Step 2: Soft-launch verification**

| Check | Done |
|-------|------|
| Crisis numbers visible on mobile | |
| Category + search + map work | |
| Community badge on local orgs | |
| Sheet edit → rebuild → redeploy documented | |
| Shareable Tailscale URL for testers | |

- [ ] **Step 3: Commit**

```bash
git commit -m "docs: MVP handoff checklist complete" --allow-empty
```

---

## Phase 2 pointer (out of scope for this plan)

After feedback: Directus admin, weekly FSD GitHub Action, Squarespace embed, prod Blackbox tenant — separate plan `2026-XX-XX-porirua-services-directory-phase2.md`.

---

## Spec coverage self-review

| Requirement (Phase 1) | Task |
|----------------------|------|
| Standalone public website | 4, 6, 7, 8 |
| Categories + search + map + crisis | 4, 5 |
| Merged Connections + FSD | 2, 3 |
| Service cards + community badge | 3, 4 |
| Google Sheet for Connections | 3 (fetch URL from config) |
| One-time FSD import | 2 |
| Merged single data file | 3 |
| Basic duplicate flagging | 3 |
| Blackbox for testing | 8, 9 |
| No admin / no weekly sync / no embed | Deferred explicitly |

## Placeholder scan

No TBD tasks — filter rules live in `fsd-porirua-rules.mjs` with documented district/suburb list; adjust after stakeholder sign-off in Task 2 Step 3.

---

## Execution handoff

**Plan complete and saved to `docs/superpowers/plans/2026-07-30-porirua-services-directory-mvp.md`.**

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks  
2. **Inline Execution** — implement task-by-task in this session with checkpoints  

**Which approach?**
