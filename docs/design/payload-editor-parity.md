# Payload editor — contract pack

**Status:** Inventory for the Payload Directory admin (dev only).  
**Audience:** Scaffold, Listings, Review, Publish/undo, Dev-deploy, and E2E children.  
**Authority:** [editor-interface-design.md](./editor-interface-design.md) (accepted 8 Sep 2026) wins over the live Vue when they disagree. [editor-guide.md](./editor-guide.md) is the editor-facing one-pager of that design.  
**Do not:** implement Payload in this document; touch `clusters/prod/**`; fork a second catalog.

Base: `origin/feature/editor-module-review-ota` at `6af79c9` (decisions + [deployment snapshot](../architecture/porirua-directory-deployment.md) are in-tree). Public finder, Postgres, catalog API, and FSD stay as they are. Payload is a new editor surface + auth that must call the **same write path**.

---

## Decisions (in-tree)

Index: [docs/decisions/README.md](../decisions/README.md). Cite these by path.

| Record | Decision (one line) | Payload must honour |
|--------|---------------------|---------------------|
| [docs/decisions/003-immutable-snapshots-ttl-pointer.md](../decisions/003-immutable-snapshots-ttl-pointer.md) | Immutable `catalog_snapshots` + TTL pointer | Publish flips `is_current`; do not rebuild the envelope on each public request |
| [docs/decisions/004-cloudflare-purge-on-publish.md](../decisions/004-cloudflare-purge-on-publish.md) | Cloudflare purge on publish / rollback / undo-publish | Stay on the existing purge path; never set `CATALOG_SKIP_PURGE` on a tenant |
| [docs/decisions/007-operations-sidecar-networkpolicy.md](../decisions/007-operations-sidecar-networkpolicy.md) | Sidecar is unauthenticated; NetworkPolicy is the boundary | Port an authorizing proxy **before** widening the policy (see [Auth gate](#auth-gate)) |
| [docs/decisions/008-custom-directus-module.md](../decisions/008-custom-directus-module.md) | Custom Directory module, not stock Content | First login lands on Directory-shaped home, not collections |
| [docs/decisions/009-google-sheet-retired-for-directory.md](../decisions/009-google-sheet-retired-for-directory.md) | Sheet retired for the directory | Do not write directory listings back to the Connections Map sheet |
| [docs/decisions/010-archive-create-through-name-check.md](../decisions/010-archive-create-through-name-check.md) | Archive not delete; creates skip Review; near-name warn | Listings create never inserts `review_queue_items` |
| [docs/decisions/013-status-write-rules.md](../decisions/013-status-write-rules.md) | Status-write rules (changed stays published; approve respects hide; reject-new hides) | Call `approve-review.mjs`; do not invent status flips |
| [docs/decisions/018-undo-publish-version-guard.md](../decisions/018-undo-publish-version-guard.md) | Undo publish is version-checked | `POST /undo-publish` with `expectedVersion`; 24h or next publish |
| [docs/decisions/019-three-way-lock-sticky-curation.md](../decisions/019-three-way-lock-sticky-curation.md) | Three-way lock / sticky curation | Diff vs `raw_import`; save upserts `overrides` patch rows |
| [docs/decisions/022-review-inbox-on-queue-table.md](../decisions/022-review-inbox-on-queue-table.md) | Inbox is `review_queue_items`, not the `pending_review` view | Do not query or expose that view |

---

## Auth gate

This is the load-bearing security fact. No later child owns it unless they read this section.

### Layer 1 — the only application auth

`porirua_directory/directus/extensions/directory-editor/src/endpoint/index.js` is the **only** authentication in front of the sidecar.

- Asserts a logged-in Directus session, then **Editor or Administrator** (`isEditorOrAdmin` in `endpoint/authorize.js`, same predicate as `editor-core/authorize.mjs`).
- Applies to **every method** except the local `GET /health` (that one is unauthenticated and does not proxy).
- Proxies to `OPERATIONS_URL` and, on mutating requests, **injects `createdBy` and `user` from `req.accountability.user`**. The sidecar trusts those fields.
- Viewers and any other role get **403**. There is no live **Reviewer** role in Directus. Scaffold may add Admin / Editor / Reviewer in Payload; map them so only Editor-equivalent (and Admin) may call the proxy. Do not give Reviewer a weaker sidecar path unless a later decision says so — the live contract is one gate for every route.

### Layer 2 — the sidecar has zero auth

`porirua_directory/directus/operations/server.mjs` header: *“Can publish, approve, and rewrite raw_import. Deploy cluster-internal only.”*

Anyone who can open `operations:8790` can publish the catalog, hide listings, approve FSD rows, and rewrite `raw_import`. That is the design in [docs/decisions/007-operations-sidecar-networkpolicy.md](../decisions/007-operations-sidecar-networkpolicy.md), not a gap to paper over.

### Layer 3 — NetworkPolicy

Blackbox `clusters/dev/tenants/porirua-directory/networkpolicy-operations.yaml`: policy **`operations-from-directus-only`** admits ingress to `:8790` only from pods labelled `app: directus`. Operations is also patched **out of** the tenant-wide same-namespace and Traefik allow lists (ADR 007).

### What Payload must do

Port an **equivalent authorizing proxy** (Payload session → Editor/Admin check → inject actor → proxy the routes below) **before** that NetworkPolicy is widened to admit `app: payload`.

If the policy is widened first, the catalog becomes publishable by **anything that can reach the pod**. ADR 007’s revisit rule: add a shared secret **before** widening — do not “just allow” the new caller. Do not let the browser call the sidecar. Do not give the sidecar an Ingress.

### Proxied routes (enumerate)

The endpoint registers **20** sidecar proxies (6 GET + 14 POST). Briefs that said “19” were off by one — count the table, not the brief. Plus local `GET /health` (not proxied).

| Method | Path | Script / function | Editor job |
|--------|------|-------------------|------------|
| GET | `/listings/name-matches` | `listings.nameMatches` → `lib/name-match.mjs` | Near-name check ([010](../decisions/010-archive-create-through-name-check.md)) |
| GET | `/listings` | `listings.listListings` | Listings search source |
| GET | `/listings/:id` | `listings.getListing` | Listing detail |
| GET | `/queue` | `listings.listQueueItems` + `editor-core/queue-dto.mjs` | Review inbox + recently finished |
| GET | `/publish-status` | `listings.publishStatus` | Status band |
| GET | `/geocode` | `operations.geocodeAddress` (Nominatim) | Address lookup |
| POST | `/listings` | `listings.createListing` | Add organisation / add service line |
| POST | `/listings/update` | `listings.updateListing` + sticky curation | Edit + “You set this earlier” |
| POST | `/listings/archive` | `listings.archiveListing` | Archive line / optionally org |
| POST | `/listings/restore` | `listings.restoreListing` | Put back on the site |
| POST | `/approve` | `approve-review.approveReviewItem` (bulk `keys`) | Accept / The pin is fine |
| POST | `/keep-curation` | `approve-review.keepCurationReviewItem` | Keep yours |
| POST | `/hide` | `approve-review.hideReviewItem` (bulk) | Take it off the site |
| POST | `/reject` | `approve-review.rejectReviewItem` (bulk) | Reject |
| POST | `/edit-and-approve` | `approve-review.editAndApproveReviewItem` (single) | Accept and edit / I’ll move the pin |
| POST | `/defer` | `review-actions.deferQueueItem` | Needs confirmation |
| POST | `/keep-community` | `review-actions.keepAsCommunityReviewItem` | Keep it as a community listing |
| POST | `/review-undo` | `review-actions.undoReviewDecision` | Toast Undo (Review write) |
| POST | `/publish` | `publish-catalog.publishCatalog` + purge | Publish immediately |
| POST | `/undo-publish` | `undo-publish.undoPublish` + purge | Undo last publish ([018](../decisions/018-undo-publish-version-guard.md)) |

Bulk routes (`/approve`, `/hide`, `/reject`) loop `body.keys` and put `undoId` on the last success. `/edit-and-approve`, `/keep-curation`, `/defer`, `/keep-community` are **single-item** and 400 if more than one key arrives.

### Sidecar routes the module does **not** proxy

Still on the sidecar, leftover from Flows. **Do not** expose them from Payload without the same Editor/Admin gate, and do not use them for the accepted jobs:

| Path | Why it exists | Payload |
|------|---------------|---------|
| `GET /health` | Liveness | Fine for kube probes; no secrets |
| `POST /sticky-curation` | Old Flow wrapper around `upsertStickyOverride` | Prefer `/listings/update` |
| `POST /rollback` | Admin-only historical snapshot pick | Out of scope — editors use `/undo-publish` |
| `POST /public-id-alias` | Admin grain / public id | Stay Admin-only; not a Directory job |

---

## Shared code reuse limits

Prefer `editor-core/`, `scripts/listings.mjs`, `review-actions.mjs`, `approve-review.mjs`, `publish-catalog.mjs`, `undo-publish.mjs`, `fsd-sync-*.mjs`. Two packaging facts block a naive import:

### 1. `editor-core/client.mjs` hardcodes `/directory-editor`

```js
return `/directory-editor${suffix}`;
```

The Vue module duplicates that in `directory-api.js` (`url: /directory-editor${path}`). Payload’s proxy will not be a Directus endpoint at that path. **Make the base configurable** (constructor / env, default `/directory-editor` so Directus keeps working). Do not copy the fetch helper a third time with a new hardcoded path.

### 2. The Directus image cannot import `editor-core`

`Dockerfile.directus` builds only `directus/extensions/directory-editor/`. Comments in the extension say so:

- `module/copy.js`: *“Keep aligned with editor-core/queue-dto.mjs — the image build cannot import that file.”*
- `module/form-highlight.js`: same for `editor-core/form-highlight.mjs`.
- `endpoint/authorize.js` is a second copy of `editor-core/authorize.mjs`.

`Dockerfile.operations` and `Dockerfile.sync` **do** `COPY editor-core`, which is why the sidecar can import those modules.

**Do not make Payload a third copy of the copy dictionary.** Fix packaging instead:

1. Payload lives in this repo (e.g. `porirua_directory/payload/`) and can import `../editor-core/*.mjs` at build time — use that for labels, DTOs, form highlight, undo-publish availability, and authorize.
2. Optionally teach `Dockerfile.directus` to copy `editor-core` so the Vue duplicates can die later. Not required for Payload.
3. Keep `queue-dto.mjs` as the source of truth for kind labels, diffs, and toast sentences. `copy.js` is already the stale twin.

Help-type and community-group chips are **also** hardcoded in `module.vue` (`HELP_TYPES` / `COMMUNITY_GROUPS`). The write path uses `config-directory.js` via `listings.mjs`. Payload must use the same closed lists as `listings.mjs`, not a fourth chip list.

---

## Design §15 — sidecar already implements the “when building this design” column

[editor-interface-design.md](./editor-interface-design.md) §15 listed work the sidecar did not have when the design was written. **On this branch the sidecar already has it.** Payload can build straight to the accepted design rather than to the current Vue.

| §15 need | Today on `operations/server.mjs` + scripts | Confirmed fields / behaviour |
|----------|--------------------------------------------|------------------------------|
| Status band integer | `GET /publish-status` | `unpublished`, **`unpublishedCount`**, **`unpublishedNames`**, `currentVersion`, `previousVersion`, `publishedAt`, **`canUndoPublish`**, **`undoPublishVersion`**, `nextCounts` |
| Defer | `POST /defer` | `proposed.deferred_at` + `deferred_fingerprint`; weekly refresh in `fsd-sync-run.mjs` (`withDeferRefresh`) |
| Keep as community | `POST /keep-community` | `overrides.action = community_owned`; diff skips `removed` (`fsd-sync-diff.mjs`); reappearance is `changed` + `fsd_returned` |
| Review undo | `POST /review-undo` | Snapshot in `editor_undo`; restores live columns, overrides, `raw_import`, queue row |
| Undo publish | `POST /undo-publish` | `expectedVersion` guard ([018](../decisions/018-undo-publish-version-guard.md)); `canUndoPublish` from last `catalog_publish_events` row + 24h; purge on rollback |
| Landing | Directus-only | Bootstrap `last_page` + write clamp. Payload must land on Directory home by its own mechanism — do not add a Directus `users.read` hook |
| Queue evidence | Runner | `proposed.before` at queue time; Review DTO still prefers live columns when present |

Because those routes exist, Listings / Review / Publish children should implement the **accepted jobs and copy**, not recreate Vue-only shortcuts.

---

## Roles and landing

| Live Directus | Meaning |
|---------------|---------|
| Administrator | Full Data Studio + Directory; proxy allows |
| Editor | Directory only (raw collections hidden); proxy allows; lands on `/directory` |
| Viewer (if present) | **403** on `/directory-editor` |
| Reviewer | **Does not exist** live |

Payload: Admin / Editor / Reviewer as the scaffold brief asks. Viewers 403. Editors must never need stock collection browsers. First login lands on a Directory-shaped home (Review / Listings / status band), not Payload’s default collection list. Landing mechanism is Payload’s problem; the **outcome** is the accepted design §13.

---

## Review actions

Inbox: `GET /queue` → `review_queue_items` ([022](../decisions/022-review-inbox-on-queue-table.md)). Community creates never appear. Kinds and buttons:

| Kind (internal) | She sees | Buttons (accepted design) | Route | Script |
|-----------------|----------|---------------------------|-------|--------|
| `changed` | **Details changed** or a field summary (**Phone and address changed**) | **Accept** · **Keep yours** (only if she curated that field) · **Accept and edit** · **Reject** · **Needs confirmation** | `/approve` · `/keep-curation` · `/edit-and-approve` · `/reject` · `/defer` | `approveReviewItem` · `keepCurationReviewItem` · `editAndApproveReviewItem` · `rejectReviewItem` · `deferQueueItem` |
| `new` | **New service** | **Accept** · **Reject** · **Needs confirmation** | `/approve` · `/reject` · `/defer` | same |
| `removed` | **Gone from the government list** | **Take it off the site** · **Keep it as a community listing** — **equal weight, no visual hierarchy, no keyboard default** · **Needs confirmation** | `/hide` · `/keep-community` · `/defer` | `hideReviewItem` · `keepAsCommunityReviewItem` · `deferQueueItem` |
| `geocode_flag` | **Check the map pin** | **The pin is fine** · **I’ll move the pin** · **Needs confirmation**. No Reject / Skip | `/approve` · `/edit-and-approve` · `/defer` | `approveReviewItem` · `editAndApproveReviewItem` · `deferQueueItem` |

After every decision: toast with **Undo** (`POST /review-undo` + `undoId`), then the next **active** item opens. Do **not** auto-open a Needs confirmation item. When only deferred remain, show the finish state; **Keep reviewing later** opens that tab.

| Toast / badge (copy dictionary) | Internal |
|---------------------------------|----------|
| **Needs confirmation** | `POST /defer`; `proposed.deferred_at` + fingerprint; stays `pending` |
| **You set this earlier** | `proposed.locked_fields` ∩ drifted fields |
| **This update changed since you set it aside.** | `proposed.changed_since_deferred` after weekly refresh |
| **The government listed this again** | `proposed.fsd_returned` |
| **Recently finished** / **Open listing** | Closed rows; `proposed.editor_decision`; from `GET /queue` `recent` |

Reject of `new` hides the row ([013](../decisions/013-status-write-rules.md)). Reject of `changed` restores from `raw_import` and does not write `status`. Accept of `removed` is not used — take-off is `/hide`. `approveReviewItem` still archives if kind is `removed` (legacy); the UI must call `/hide` / `/keep-community` instead.

Keep-yours refreshes `raw_import` and leaves live columns + the sticky patch. Accept / Accept-and-edit apply after-values, write the patch, refresh `raw_import`, close the item. Keep-as-community writes `overrides.action = community_owned`, keeps `fsd_service_id`, does not retag `source`.

---

## Listings actions

| Button (she sees) | Internal | Route | Script | Must not |
|-------------------|----------|-------|--------|----------|
| **Find an organisation** | Search-as-you-type, NFD fold | Client filter on `GET /listings` | `foldSearch` in editor-core / copy.js | Treat the table as the edit surface |
| **Add organisation** | `kind` omitted or `organization` | `POST /listings` | `createListing` | Insert `review_queue_items`; publish |
| **Add a service line** | `kind: "serviceLine"` + `organizationId` | `POST /listings` | `createListing` | same |
| **Edit** | Shared form | `POST /listings/update` | `updateListing` + `upsertStickyOverride` | Enqueue Review |
| **Archive this service line** | Hide line; optional org | `POST /listings/archive` `{ serviceId, alsoArchiveOrganization }` | `archiveListing` | Hard delete |
| **Put it back on the site** | Restore | `POST /listings/restore` `{ serviceId }` | `restoreListing` | Publish by itself |
| **Show listings that are not on the site** | Client filter | `GET /listings` includes hidden | — | Use “off the site” as the adjective |
| **Open the existing one** | Duplicate warning primary | `GET /listings/:id` | — | Block create with no escape |
| **Create anyway** | `confirmCreateAnyway: true` | `POST /listings` | 409 unless this flag | Skip archived / merged names |

Name check: `GET /listings/name-matches?name=` (and `organizationId` for a line). Matcher is `scripts/lib/name-match.mjs` (NFD fold + distinctive token overlap). Warn, do not block. Archived and merged names are included. Do not change `normalizedOrgName` / clustering here.

Save writes `status=published` on the row. The public site still serves the last snapshot until **Publish**. Fail the job if Save writes a Review row or Save publishes.

---

## Publish, undo, status band

Always visible on Directory.

| She sees | Behaviour | Source |
|----------|-----------|--------|
| **N changes to review** / **Nothing to review** | Opens Review (first active item). Subdued and not clickable when zero | `GET /queue` active count. Use `unpublishedCount` from the server — do not invent the integer in the browser |
| **N unpublished** / **All published** | **Publishes immediately** (no confirmation dialog) | `GET /publish-status` → `unpublishedCount`, `unpublishedNames` |
| **Undo last publish** | On the band while `canUndoPublish` | Server window: until next publish or 24h, not a client timer |
| After Publish toast | **Published. The public site is up to date.** + **Undo publish** (~20s) | Then the band action remains |
| After Undo toast | **Publish undone. Those changes are unpublished again.** | Live rows / queue / overrides are **not** rewound |
| Finish | **You’ve reviewed everything. Put N changes on the public site.** **Publish now** | Immediate publish |
| Finish with deferrals | **You’ve decided the ones you can. N need confirmation.** **Publish now** · **Keep reviewing later** | |

`POST /publish` calls `publishCatalog` (new snapshot, flip `is_current`, Cloudflare purge). A failed purge is a failed publish ([004](../decisions/004-cloudflare-purge-on-publish.md)). It also `DELETE FROM editor_undo` — Review-decision undo is gone after Publish.

`POST /undo-publish` must send the version this tab believes is current (`expectedVersion` / `undoPublishVersion` / `currentVersion`). If someone else has published, the server refuses: **Someone else has published since. Your undo would remove their changes too.** First-ever publish (no previous snapshot) has no undo.

**Sidecar leftover vs design:** `/publish` still 409s on a ≥15% published-count delta unless `confirmLargeDelta: true` (`catalogCountPreflight`). That is a server-side guard against a bad bulk import, not the confirmation step decision #4 removed. Payload does **not** reintroduce a general “are you sure?” dialog and does **not** blanket-set `confirmLargeDelta`. A 409 is an error state on the status band that names the delta and offers **Publish this large change** for that one request.

**One publisher.** `CATALOG_PUBLISHER` is `payload` or `directus` (default `payload`). Both authorizing proxies refuse `POST /publish` and `POST /undo-publish` when they are not that host. directory-dev publishes from Payload on `admin-payload-directory-dev.bsky.nz`. Directus is retired there.

---

## What Payload must call vs may reimplement

| Must call (same write path) | May reimplement (UI only) | Must not |
|-----------------------------|---------------------------|----------|
| All 20 proxied routes through an authorizing proxy | Vue layout, Directus `v-button`, Leaflet chrome | A second `organizations` / `services` model |
| `scripts/listings.mjs` via sidecar | Search/filter in the browser on `GET /listings` | Dual-write Directus + Payload to one catalog |
| `review-actions.mjs` / `approve-review.mjs` | Card expand, focus order, toast chrome | Inbox as `pending_review` view |
| `publish-catalog.mjs` / `undo-publish.mjs` | Status-band pixels | Client-side 24h undo timer as source of truth |
| `editor-core` DTO + copy + highlight + authorize | Payload admin components | Third copy of `copy.js` |
| `lib/name-match.mjs` via `/listings/name-matches` | Duplicate-warning markup | Changing `normalizedOrgName` |
| Existing Cloudflare purge inside publish/undo | — | `CATALOG_SKIP_PURGE` on the tenant |
| Weekly FSD runner (`fsd-sync-run.mjs`) as-is | — | Auto-publish from FSD; unsuspend the CronJob unless already agreed |

---

## What must stay

| Piece | Why |
|-------|-----|
| Postgres + `db-schema.sql` | Canonical store. Tables: `organizations`, `services`, `overrides`, `review_queue_items`, `catalog_snapshots`, `import_runs`, `public_id_aliases`, `catalog_publish_events`, `editor_undo` |
| Catalog API `GET /api/catalog` | Public read of `is_current` envelope. Do not flip it off Directus-published snapshots in the deploy child |
| FSD queue + weekly runner | Government inbox only; `suspend: true` in dev today |
| Three-way lock ([019](../decisions/019-three-way-lock-sticky-curation.md)) | `raw_import` + open `patch` overrides; Ora Toa (`fsd-2964`) is the live case |
| Hide lock | Open `overrides.action = hide` |
| Community-owned lock | Open `overrides.action = community_owned` |
| Name-check ([010](../decisions/010-archive-create-through-name-check.md)) | Warn on near duplicates including archived |
| Operations sidecar ClusterIP `:8790` | One write path |
| Baked `data/services.json` fallback | Public site stays up if the API is down |
| Separate admin host | No help-seeker accounts |

---

## Recommended dev-only side-by-side host

| Host | Role (this chain) |
|------|-------------------|
| https://directory-dev.bsky.nz | Public site + `/api/catalog` |
| https://admin-directory-dev.bsky.nz | Retired Directus hostname — **redirects** to Payload. Do not scale Directus back up |
| **https://admin-payload-directory-dev.bsky.nz** | Payload Directory admin and publisher — **dev only**. Do not touch prod manifests or choose a production admin hostname here |

Namespace: `dev-porirua-directory`. Manifests: blackbox `clusters/dev/tenants/porirua-directory/`. Image pin style: immutable SHA, never a floating `:dev`.

NetworkPolicy: Payload may reach operations **only after** its authorizing proxy exists, by adding `app: payload` to the same ingress rule that today allows `app: directus`. Sidecar stays ClusterIP. Until then, local compose can point Payload at the existing proxy or at a Payload-side proxy that talks to `OPERATIONS_URL`.

---

## Design vs live Vue — follow the design

The Vue on this branch already implements most of the accepted jobs (status band, Needs confirmation tab, keep-as-community, Accept and edit, verification bar, listing detail, archive dialog, undo publish, recently finished). Section 2 of the design doc still describes an older sketch; treat that table as history.

Payload still follows the **accepted design** where Vue and design disagree:

| Topic | Accepted design | Live Vue on this branch | Payload |
|-------|-----------------|-------------------------|---------|
| After a Review decision, focus | Heading **button** of the newly open card; Enter toggles, does not Accept. Undo is Shift+Tab from that heading | `focusWorkPanel()` — finish heading, empty-needs hint, or the tab panel. Review Undo is not focused (`focusUndo` is only used after Publish) | Design |
| Auto-open Needs confirmation | Do **not** auto-open a deferred item | `nextItemAfterAction` on the Needs tab returns `deferredQueue[0]`; first deferred also opens on land | Design |
| Publish confirmation | None. Immediate | Immediate, but sidecar may 409 on a large count delta without `confirmLargeDelta` | Design (no dialog). See publish note above |
| Accessibility §14 | Address saveable without a pin; labelled buttons; toast `role="status"` | Partial (toast role, some labels). Design says the sketch had none of this | Design |
| Removal actions | Equal weight, **no keyboard default** | Both `secondary` + `equal` class — good. First button in the action row can still take implicit default | Design (neither is default) |
| Copy source | One dictionary | `copy.js` subset of `queue-dto.mjs`; leftover “Skip this pin check” strings still exist but the pin card hides Reject | Import `editor-core`, not Vue leftovers |
| Landing | Directory, not Content | Directus `last_page` + write clamp | Same **outcome**, Payload mechanism |

Fail the jobs if: Save writes a Review row; Save publishes; a removal’s only primary action takes a live service off the site; Ora Toa has no before-and-after / no “You set this earlier”; the name warning is UI-only or skips archived names.

---

## Child checklist

| Child | Read first | Do |
|-------|------------|-----|
| Scaffold | Auth gate + reuse limits + host name | Payload 3, roles, Directory home stub, configurable editor-core client base, **authorizing proxy before any NetworkPolicy change** |
| Listings | Listings table + [010](../decisions/010-archive-create-through-name-check.md) | Call listings routes; name-check; no Review enqueue |
| Review | Review table + [019](../decisions/019-three-way-lock-sticky-curation.md) / [022](../decisions/022-review-inbox-on-queue-table.md) | Government queue only; equal removal actions; defer / keep-community / review-undo |
| Publish / undo | Status band + [003](../decisions/003-immutable-snapshots-ttl-pointer.md) / [004](../decisions/004-cloudflare-purge-on-publish.md) / [018](../decisions/018-undo-publish-version-guard.md) | `publishStatus` fields; version guard; `CATALOG_PUBLISHER` kill-switch (directory-dev is Payload) |
| Dev deploy | Auth gate + host | `admin-payload-directory-dev.bsky.nz`; widen policy only after the proxy exists |
| E2E / docs | This file + editor-guide | Editor: login → Directory home → Listings → one Review decision if fixture → status band |
