# Porirua Services Directory — MVP runbook

**Public URL:** [https://directory.bsky.nz](https://directory.bsky.nz)  
**Architecture:** [architecture/porirua-directory-architecture.md](./architecture/porirua-directory-architecture.md)

---

## Phase 1 — refresh published data

From repo root:

```bash
cd porirua_directory
npm install
npm run build:data
```

This runs:

1. `import:fsd` — downloads FSD CSV → `data/fsd-porirua.raw.json`, **`data/fsd-porirua-excluded.json`** (geo filter audit), and **`data/fsd-porirua-geocode-flags.json`** (suspicious coordinates on included rows)
2. `merge:services` — Connections Map + FSD + overrides → `data/services.json`

**Editors (community orgs):** update the [Connections Map Google Sheet](https://docs.google.com/spreadsheets/d/1xKFgoYtjND3mfgojyddnq2zyKkxH7NXNGejDzFKQP7I/edit) (same as `porirua_connections_map`).

**Hide FSD rows:** add ids to `porirua_directory/data/overrides.json` → re-run `npm run merge:services`.

The public UI reads **`GET /api/catalog`** first (live snapshot; the API re-checks which snapshot is current on a 30-second TTL, so a publish reaches the site within about a minute with no restart). **`data/services.json`** is a **point-in-time copy** still shipped in the nginx image so the site stays up when Postgres is down. It is **not** the live catalog: it only changes when the image is rebuilt (nightly). Commit it when you intend to refresh that baked fallback, not as a substitute for publishing through the catalog API.

---

## FSD import audit (after each CSV drop)

Full rule rationale: [fsd-porirua-filter-rationale.md](./fsd-porirua-filter-rationale.md)

1. **Rebuild** (from `porirua_directory`):

   ```bash
   npm run build:data
   ```

   Or only re-import FSD:

   ```bash
   npm run import:fsd
   ```

2. **Inspect counts** in the console (`includedCount` / `excludedCount`) and open **`data/fsd-porirua-excluded.json`**:
   - Top level: `generatedAt`, `fsdCsvUrl`, `totalCsvRows`, `includedCount`, `excludedCount`, `excluded[]`.
   - Each excluded row: `reasonCode`, `reasonDetail`, optional `matchedField`, `SERVICE_ID` / `FSD_ID`, provider/service names, address fields.

3. **Spot-check by reason code** (examples):
   - `DISTRICT_CONTRADICTS_PHYSICAL` — confirm bad FSD district metadata; do **not** add to directory unless override + stakeholder sign-off.
   - `ADDRESS_NON_PORIRUA_CITY` — expected for homonym suburbs/streets; if a **legitimate Porirua** row appears here, check whether “Porirua” is missing from the CSV line → fix in FSD upstream or adjust rules/tests.
   - `POSTAL_TOKEN_PHYSICAL_OUTSIDE` — West Auckland / similar; verify physical vs postal columns.
   - `NO_PORIRUA_SIGNAL` — national/Wellington rows; only revisit if you intentionally broaden Porirua scope.

4. **Sanity-check included slice** in `data/fsd-porirua.raw.json` or `data/services.json` (FSD rows only):

   ```bash
   rg -i 'Christchurch|Palmerston North|Ranui, Auckland|Whitby Street' data/services.json
   # expect no matches after Aug 2026 filter set
   ```

5. **If rules change:** edit `scripts/fsd-porirua-rules.mjs`, add cases to `tests/fsd-import.test.mjs`, update [fsd-porirua-filter-rationale.md](./fsd-porirua-filter-rationale.md) changelog, run `npm test` and `npm run build:data`. For bug-driven fixes, add `docs/issues/fixed-*.md` and index in [issues/README.md](./issues/README.md).

Both `fsd-porirua.raw.json` and `fsd-porirua-excluded.json` are **gitignored** (regenerated each import). Archive copies when comparing two DIA releases (e.g. attach to a PR or ticket).

---

## FSD geocode QA (included rows)

Rationale and reason codes: [fsd-porirua-filter-rationale.md](./fsd-porirua-filter-rationale.md) § Geocode QA.

Lat/lng on FSD services come from DIA **`LATITUDE` / `LONGITUDE`** columns (passed through in import; no geocoder in-repo). Geo **inclusion** rules do not validate coordinates.

1. After `npm run import:fsd` or `npm run build:data`, check console output for **`geocodeFlagCount`**.
2. Open **`data/fsd-porirua-geocode-flags.json`** — each entry is an **included** row that still publishes unless you override or hide it.
3. **Review** (data editor; stakeholder sign-off for corrected public pins):
   - `GEOCODE_IN_MARINE_BBOX` — often bad FSD geocode in Cook Strait / Kapiti offshore box (example: Ora Toa respiratory group, `FSD_ID` 4690).
   - `GEOCODE_OUTSIDE_PORIRUA_BOUNDS` — pin outside the Porirua map slice box (Wellington CBD, Hutt, etc.) — confirm whether the service is truly Porirua-relevant before moving coords.
4. **Fix in repo:** add `patches` in `data/overrides.json` with corrected `lat`, `lng`, and optional `address`, then `npm run merge:services` (or full `build:data`). Re-check the pin in local preview (`npm run serve`).
5. **Fix upstream:** report bad coordinates to DIA FSD when address metadata is also wrong.
6. **Developer:** if bounds are too tight/loose, edit `scripts/fsd-geocode-qa.mjs` and extend `tests/fsd-geocode-qa.test.mjs`.

`fsd-porirua-geocode-flags.json` is **gitignored** like the other import audits.

---

## Local preview

```bash
cd porirua_directory
npm run serve
# http://localhost:5173/index.html  (directory.html redirects here)
```

---

## Tests

```bash
cd porirua_directory
npm test
npm run test:e2e
```

`npm test` runs pure unit files in parallel, then the Directus-dependent files one at a time (`--test-concurrency=1`). Those files share one Directus and one Postgres and call `bootstrapDirectus()`, so a single parallel glob races them. Database-backed catalog tests (`tests/db-*.test.mjs`) **skip** when Postgres is not reachable, so CI and laptops without Docker stay green. Local Directus is compose project `porirua-directus`; `npm run directus:down` includes `-v`.

### Phase 2 catalog database (local)

Disposable Postgres for the integration suite and for trying bootstrap/publish:

```bash
cd porirua_directory
npm run db:test:up          # docker compose -f docker-compose.test.yml up -d --wait
export DATABASE_URL=postgres://porirua:porirua@127.0.0.1:54329/porirua_test
npm run test:db             # schema, bootstrap, publish, rollback
npm run db:import           # load data/services.json + data/overrides.json
npm run catalog:publish     # insert catalog_snapshots and flip is_current
npm run catalog:publish -- --rollback 1
npm run db:test:down
```

The import CLI applies `scripts/db-schema.sql` when the tables are missing. A second `db:import` is idempotent (same ids and row counts). `raw_import` is written for every FSD line.

Publish never includes `draft`, `hidden`, `pending_review`, or merged-away organizations. Exactly one snapshot has `is_current`. Rollback points that flag at an earlier `version`.

The public site still reads `data/services.json` until the UI task wires `/api/catalog`. These commands do not deploy anything.

Publish and rollback also purge the public catalog URL (`https://directory.bsky.nz/api/catalog` by default). Locally, set `CATALOG_SKIP_PURGE=1` or pass a stub `purge` function. In an environment that should actually drop the Cloudflare shared cache, set `CLOUDFLARE_ZONE_ID` and `CLOUDFLARE_API_TOKEN`. A failed purge is a failed publish — the previous `is_current` snapshot is restored. Never set `CATALOG_SKIP_PURGE` on a tenant.

### Weekly FSD sync (Phase 2 runner)

`npm run sync:fsd` fetches the national CSV, applies the same Porirua filter and geocode QA as `import:fsd` (`buildFsdImportReport`), attaches `SERVICE_ID` / `FSD_ID` from the CSV, collapses duplicate SERVICE_ID groups, and diffs against `services.raw_import`. It writes **one** `import_runs` row and `review_queue_items` for new, changed, removed, and geocode-flag rows. It **never** creates a `catalog_snapshots` row or changes the live catalog. A later run refreshes an existing **pending** item for the same entity and kind instead of stacking another row. A `geocode_flag` that an editor already accepted or rejected (same flag code) is not raised again.

```bash
cd porirua_directory
export DATABASE_URL=postgres://…   # catalog Postgres
npm run sync:fsd                   # node scripts/fsd-sync-run.mjs
```

Worker image: `Dockerfile.sync` (Node; installs `csv-parse` even though it is a devDependency). The CronJob manifest lives in the blackbox tenant.

**Sanity abort:** if this week's `includedCount` is strictly below 75% of the last successful FSD run, the job finishes `import_runs.status='failed'`, writes **zero** removal queue rows, and raises an alert (`stats.alert`, `error_message`). A missing or zero baseline does not trip the guard.

**Locks:** `status=hidden` and open `overrides` rows (`action=hide|patch`, locked fields = keys on `patch`) stay on the published columns. The curated Ngāti Toa Street patch on `fsd-2964` must not be proposed for reversion.

**Approval:** `scripts/approve-review.mjs` exporting **`approveReviewItem`** is the single implementation (Directus imports the same module; `npm run review:approve -- --approve <queueItemId>` calls it). It applies `proposed.after`, sets `published`, promotes a draft organisation, and **refreshes `raw_import`**: overlay keys present in the payload onto the previous baseline, then fill missing fingerprint keys (`serviceName`, `url`, `address`, `description`, `phone`, `name`, `lat`, `lng`, `categories`, `fsd_service_id`, `fsd_legacy_id`). An absent key never overwrites a known url or category list. Both `service_name` / `serviceName` and `title` spellings write the live columns. Reject clears `pending_review` and restores modified columns from `raw_import`; it never promotes a `hidden` row to `published`. Approve does **not** record who approved — `review_queue_items` has no actor column yet (handover gap). Then `npm run catalog:publish` materialises a new snapshot. Draft organisations created for unmatched SERVICE_IDs stay out of snapshots until that approval. New SERVICE_IDs seed `raw_import` on insert so the following week is `unchanged`, not `missing_raw_import`.

**Expected first run** (bootstrapped catalog vs current feed): 162 collapsed SERVICE_IDs; most lines unchanged; about 17 category enrichments (collapse unions categories the Phase 1 pipeline drops); `fsd-2964` locked; plus standalone geocode-flag items. If every line is `changed`, SERVICE_ID matching is broken.

Isolated runner tests use a **separate** compose project so they do not share port 54329 with other worktrees:

```bash
npm run db:sync-test:up    # host port 54339, project weekly-fsd-sync-l2yyxlzr
npm run test:sync
npm run db:sync-test:down
```

---

## Phase 2 — catalog API (local)

Same-origin public read service. It returns the current `catalog_snapshots` envelope unchanged (shape-identical to `data/services.json`, except bootstrap may disambiguate `org-te-waka-whaiora-trust` and `community-te-wahi-tiaki-tatou`).

```bash
cd porirua_directory
npm run db:test:up
export DATABASE_URL=postgres://porirua:porirua@127.0.0.1:54329/porirua_test
npm run db:import
npm run catalog:publish
npm run start:api
# GET http://127.0.0.1:3000/api/catalog
# GET http://127.0.0.1:3000/api/catalog?version=1
# GET http://127.0.0.1:3000/api/health
```

`ETag` is the snapshot version. Send `If-None-Match` for a 304. Envelope bodies are cached in process by version and are never re-fetched (snapshots are immutable). The API re-checks only `SELECT version FROM catalog_snapshots WHERE is_current` on a short TTL (default 30 seconds, override with `CATALOG_CURRENT_TTL_MS` in `config.mjs` / the environment — use a small value in dev). After that TTL a new publish is served without restarting the process. If Postgres is briefly unreachable, the last known pointer and envelope stay in service. With an empty cache and no database it returns `503` `{ "error": "catalog unavailable" }` — never a stack trace.

`Dockerfile` stays nginx-only. `Dockerfile.api` is the Node image (`ghcr.io/irab/porirua-directory-api`). Do not add Node to the static image.

---

## Phase 2 — Directus editor workspace (local)

Do **not** start `docker-compose.test.yml` (host port 54329) from this worktree if another Phase 2 task is also running — that compose file is shared and will collide or truncate tables. Use the Directus compose project and port **54341**:

```bash
cd porirua_directory
npm run directus:up
export DATABASE_URL=postgres://porirua:porirua@127.0.0.1:54341/porirua_directus
npm run db:import            # optional: load committed services.json
npm run directus:bootstrap   # collections, Editor role, presets, Flows, snapshot
```

Open **http://127.0.0.1:18055**

| Account | Email | Password |
|---------|--------|----------|
| Administrator | `admin@example.com` | `admin-local` |
| Editor | `editor@example.com` | `editor-local` |

Configuration is in git, not clicked-in state:

| Path | What it is |
|------|------------|
| `porirua_directory/directus/snapshot.yaml` | Collections, fields, Interfaces, relations, plus roles / permissions / presets exported with the running instance |
| `porirua_directory/directus/flows/` | Sticky curation, Publish directory, Roll back, review actions, failure notification |
| `porirua_directory/directus/operations/` | Sidecar the Flows POST to (sticky, approve, hide, reject, publish, rollback, alias). Can publish, approve, and rewrite `raw_import`. **Cluster-internal only — no Ingress.** Local compose binds host `18790` for tests. Approve/hide/reject import `scripts/approve-review.mjs`. |
| `porirua_directory/scripts/directus/bootstrap.mjs` | Applies the workspace to a fresh Directus |

### Editor daily path

1. Sign in as **Editor**.
2. Open **Organizations**. Status is the prominent field. Internals (`cluster_key`, merge fields, timestamps) are hidden. `public_id` and `render_grain` are visible but **not writable** — they decide the public URL and whether a provider is an org card or a flat listing. Changing grain is an **Admin** action (it must write a `public_id_aliases` row; 44 of 76 org cards have only one line). Related **service lines** are on the organisation record (read-only). Open a line to edit it; do not re-parent from the organisation form.
3. Edit ordinary fields (address, phone, description). On an FSD-sourced record, saving triggers **Sticky curation on save**, which upserts one `overrides` row `{target_type, target_id, action: "patch", patch}` and merges keys into that row. You never type patch JSON.
4. Open **Review queue** in the sidebar (`review_queue_items`, preset filtered to pending). The list shows kind, the related listing, and a `change_summary` of what actually moved — not the raw `proposed` JSON. **Approve**, **Hide**, and **Reject** work from the list (tick many rows) and from the item. The sidecar loops every selected id, does not undo earlier successes when a later row fails, and reports succeeded/failed counts (a mixed batch is a 409, not a silent first-row success). **Edit-and-approve** is item-only — it carries one payload and cannot mean anything across a multi-row selection. Those Flows call the shared `approveReviewItem` in `scripts/approve-review.mjs` — apply `proposed.after`, set status, **refresh `raw_import`**, promote a draft organisation, mark the queue item accepted. Skipping the `raw_import` refresh would re-queue the same change every week. Do not click a `pending_review` collection — that view is SQL-only and 403s in Directus.
5. Status changes stay in Postgres. They do **not** go public until you publish.

### Publish

1. Open **Catalog snapshots** (the collection, not a past version's detail page).
2. Run the **Publish directory** Flow from the collection. It shows a preflight of counts against the live snapshot and warns if published count moves by 15% or more (confirm to continue). The Editor role must be able to `GET /flows` (`directus_flows` read) or those buttons do not render.
3. `publish-catalog.mjs` writes a new `is_current` snapshot, purges the edge, then reports the version that went live.

### Roll back

1. Open **Catalog snapshots** and open the **one** version to restore (item action — not a list multi-select).
2. Run the **Roll back** Flow. It points `is_current` at that version and purges the edge the same way as publish. The sidecar **400s** if more than one key is sent. No developer required.

`npm run test:directus` covers permission boundaries, sticky override shape (read back from Postgres), Approve `raw_import` refresh, and cache invalidation. Live Cloudflare purge is not exercised in this environment.

---

## Deploy

### Dev (Phase 2 stack)

Public: [https://directory-dev.bsky.nz](https://directory-dev.bsky.nz)  
Admin: [https://admin-directory-dev.bsky.nz](https://admin-directory-dev.bsky.nz)  
Manifests: blackbox `clusters/dev/tenants/porirua-directory/` (ApplicationSet git-scans `tenants/*`).

1. From a branch, build the four images without changing what `main` pushes today:

   ```bash
   gh workflow run directory.yml --ref <branch>
   ```

   That job tags `ghcr.io/irab/porirua-directory`, `-api`, `-sync`, and `-operations` with the git SHA. Pin every container in the tenant to that SHA (not `:dev` or `:latest`).
2. Push the tenant directory to blackbox `main`. After the first sync creates `dev-porirua-directory`, copy `ghcr-io` from `dev-polis`. SealedSecrets cannot unseal until that namespace exists.
3. Catalog-bootstrap Job: `db-import-from-json.mjs` from committed `data/services.json` + `data/overrides.json`, then the first `catalog:publish` (real Cloudflare purge — do not set `CATALOG_SKIP_PURGE`). Expect two colliding public ids to become `org-te-waka-whaiora-trust-342f` and `community-te-wahi-tiaki-tatou-ea82`.
4. Directus-bootstrap Job (Argo wave 3, before Ingress) applies `directus/snapshot.yaml`, Flows, Editor role, and the pending-review view. Do not put that hook after the Ingress wave — Traefik never writes Ingress ADDRESS, and Argo will sit on “waiting for healthy Ingress”. The Job image must be able to finish without writing the committed snapshot (it exports to `DIRECTUS_SNAPSHOT_OUT` or `/tmp` when `/app/directus` is read-only).
5. Public routing: `/api` must be its **own** Ingress with a higher Traefik `router.priority` than `/`. A shared priority on one Ingress lets nginx answer `/api/catalog` with HTML.
6. Weekly FSD CronJob is **suspended** in dev. The Job waits for Postgres (busybox init, same as catalog-bootstrap) before connecting. Prove it with a one-off Job from the CronJob; it must write `review_queue_items` and must not publish.

`CATALOG_CURRENT_TTL_MS=5000` in dev so a publish is visible without waiting 30s. Publishing does not require rolling the API pod.

### Production (Phase 1, unchanged)

Production remains the nginx pin at [https://directory.bsky.nz](https://directory.bsky.nz) until a **separate, gated** prod-tenant task. Do not copy this database or these SealedSecrets toward prod.

1. Push to `main` with an updated baked `data/services.json` only when you intend to refresh the offline fallback — workflow still builds only the nginx image. Dev’s four SHA-tagged images come from `workflow_dispatch`, not from a `main` push.
2. ArgoCD syncs `clusters/prod/tenants/porirua-directory/`.
3. ExternalDNS upserts `directory.bsky.nz` when the Ingress is healthy (see [blackbox bsky.nz README](file:///Users/ira/repos/blackbox/infra/cloudflare/bsky.nz/README.md)).
4. Verify headings **Recoleta**, body **Aktiv Grotesk** (Adobe Typekit kit `xcy1epi`). If body font falls back to Poppins/system sans, add the hostname to the kit’s allowed domains.
   - **Smoke:** landing **Find support** / **Connect with community** switch to browse; **Urgent help** footer shows numbers. If buttons do nothing, check browser devtools for module MIME errors — static nginx must serve `*.mjs` as `application/javascript` (see `porirua_directory/infra/nginx.conf`).

---

## Stakeholder feedback (between Phase 1 and 2)

Use this checklist when testing the MVP with help-seekers and the Porirua Locality team:

| Topic | Question |
|-------|----------|
| Browse entry | Is **Find support** vs **Connect with community** clear on landing (**I would like to…**)? |
| Need categories | Are the nine support categories the right plain-language set? |
| Community filters | Can people find marae, councils, and kai initiatives without schools crowding the view? |
| Urgent help footer | Sticky bar labelled **Urgent help** readable on mobile; links work from landing, browse, and About? |
| Browse layout | **Back** to change path (subnav hidden); filters left, optional map, results — quick on a phone? |
| Search & map | Can people find a known service (name or suburb) on a phone? |
| Trust | Do community org descriptions and org-type chips feel local and accurate? |
| Gaps | What services or org types are missing from the merged list? |

Capture notes for Phase 2 priorities (admin UI, weekly FSD sync, Squarespace embed, **D1 + Workers vs Directus** spike).
