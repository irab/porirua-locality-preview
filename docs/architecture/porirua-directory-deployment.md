# Porirua Directory — deployment and services (as of 8 Sep 2026)

This is the services and deploy snapshot. It describes the system that **exists**, not the one someone intended.

Product context (audiences, Phase 1 model, why the directory exists) stays in [porirua-directory-architecture.md](./porirua-directory-architecture.md). Why the stack was chosen is in [docs/decisions/](../decisions/README.md). How Moana uses Review and Listings is the editor-guide / handover task — not this file.

**Prod Phase 2 is not built.** Sentences about Postgres, `/api/catalog`, Directus, the sidecar, or the CronJob apply to **directory-dev** unless they say otherwise.

## Verification banner

Checked on 8 Sep 2026. Do not treat a later pin as implied.

| What | Value that day |
|------|----------------|
| App tree this document was written against | `4e3a3d1` (`feature/payload-directory-ed-oi4` — Payload `image-dev` pin) |
| `origin/main` of this repo | `db282d3` — Phase 1 only |
| blackbox `origin/main` (before this Payload pin) | `bf0dae2` |
| directory-dev catalog / sidecar pin | `b65e5d723e344f6ea36b29d23219cde27c022a93` — unchanged. Directus Deployment is scaled to zero |
| directory-dev Payload pin | `4e3a3d1227748c190583a19e7b9254228d4c9984` — `ghcr.io/irab/porirua-directory-payload` only (blackbox `e077b59`, PR #105) |
| Live Payload editor sign-in | `200` as Editor on `https://admin-payload-directory-dev.bsky.nz`; `/publish-status` 143 unpublished, `/queue` 13 to review, `/listings` real organisations |
| Live Payload editor map | Leaflet on OpenStreetMap tiles. Review card that moves a pin: 6/6 tiles. Listing form: 3/3 tiles, draggable marker, `© OpenStreetMap` credited. The Taeaomanino Trust card is 267px tall, not the 1301px it was when a bare `.verify` inherited Payload's `min-height: 100vh` |
| Payload editor e2e against that host | 6 passed, 1 skipped (`createdBy` needs the local operations mock). The Review decision step also skipped: it will not decide a real government row |
| Prod image pin | `ghcr.io/irab/porirua-directory:ec5c102a9fcbcfa5af356508ac4b8dea5cda6262` (nginx only) |
| Live `GET https://directory-dev.bsky.nz/api/catalog` | `200` `application/json`, `Cache-Control: public, max-age=60, s-maxage=86400`, `ETag: "13"`, `generatedAt` `2026-09-08T10:06:15.248Z`, 145 services |
| Live `GET https://directory-dev.bsky.nz/api/health` | `{"ok":true,"database":"reachable"}` |
| Live `HEAD https://directory-dev.bsky.nz/api/catalog` | `404` `{error:"not found"}` — the API handles **GET only** (`api/server.mjs`). Not fixed here. |
| Live `GET https://directory.bsky.nz/api/catalog` | `200` `text/html` — the Phase 1 homepage. There is no catalog API on prod. |
| `cf-cache-status` on the catalog GET | `DYNAMIC` (this curl did not observe a HIT). The API still *advertises* `s-maxage=86400`. |

Catalog / Directus / sidecar manifests stay on blackbox `origin/main` (`bf0dae2`). The Payload admin pin is a **dev-only** addition under `clusters/dev/tenants/porirua-directory/`. Do not read a later Payload SHA as a Directus repin.

---

## What exists

### Dev (`dev-porirua-directory`)

Public site: [https://directory-dev.bsky.nz](https://directory-dev.bsky.nz)
Admin (editor and publisher): [https://admin-payload-directory-dev.bsky.nz](https://admin-payload-directory-dev.bsky.nz)
Old Directus hostname (redirect): [https://admin-directory-dev.bsky.nz](https://admin-directory-dev.bsky.nz)

One publisher: `CATALOG_PUBLISHER` is `payload` or `directus` (default `payload`). Both authorizing proxies refuse `POST /publish` and `POST /undo-publish` when they are not that host. directory-dev publishes from Payload. Directus is scaled to zero — do not bring it back without a gated image, or both hosts can publish.
Manifests: blackbox `clusters/dev/tenants/porirua-directory/`
Namespace: `dev-porirua-directory`

| Workload | Responsible for | Site stays up if it fails? |
|----------|-----------------|----------------------------|
| nginx `porirua-directory` | Static UI + baked `data/services.json` | **No** — no HTML |
| `catalog-api` | `GET /api/catalog`, `GET /api/health` | **Yes** — UI falls back to baked JSON (stale) |
| Postgres `postgres:16-alpine` + PVC | Canonical store, snapshots, queue | API serves the last in-process snapshot if it already had one; otherwise `503`; UI then falls back |
| `operations` ClusterIP `:8790` | Publish, review, listings writes, purge | Public site unchanged (last snapshot). Editors cannot save or publish |
| Directus + Directory module image | Retired. Replicas 0. Manifests kept for rollback | Public site unchanged |
| Payload admin | Directory editor + `/api/directory-editor` auth gate and publisher. Own `porirua_payload` database | Public site unchanged until she publishes |
| `fsd-sync` CronJob | Weekly review-queue fill | Public site unchanged. **`suspend: true` in dev** |
| `catalog-bootstrap` / `directus-bootstrap` / `payload-db-init` Jobs | First sync / each Argo hook / create `porirua_payload` if missing | N/A after first success; a bad Directus bootstrap can hide the module |

### Prod (`prod-porirua-directory`) — Phase 2 (11 Sep 2026)

Public site: [https://yourporirua.nz](https://yourporirua.nz)  
Catalog: [https://yourporirua.nz/api/catalog](https://yourporirua.nz/api/catalog)  
Payload editor: [https://admin.yourporirua.nz](https://admin.yourporirua.nz)  
Legacy: [https://directory.bsky.nz](https://directory.bsky.nz) 301s to the apex.

Same shape as dev: nginx + catalog-api + Postgres (new PVC) + operations + Payload publisher. Directus is not deployed. FSD CronJob is suspended. First pins are the dev-proven SHAs (nginx `f62b8fb`, catalog/sidecar `b65e5d7`, Payload `ad815ab`). Secrets and the volume are new — dev blobs are not copied.

---

## How a public request reaches data

```mermaid
flowchart LR
  Browser --> CF[Cloudflare directory-dev.bsky.nz]
  CF --> Origin["blackbox :4443"]
  Origin --> Traefik
  Traefik -->|"/api priority 200"| API[catalog-api :3000]
  Traefik -->|"/ priority 100"| Nginx[nginx :8080]
  API --> Mem[in-process snapshot cache]
  Mem --> PG[(Postgres catalog_snapshots)]
  Browser -->|"fallback ./data/services.json"| Nginx
```

On **prod** the same split applies on `yourporirua.nz`: Cloudflare Flexible → origin `:443` → sslh → Traefik. `/api` (priority 200) goes to catalog-api; `/` (priority 100) goes to nginx. The UI falls back to baked `data/services.json` if the API is down or returns non-JSON.

### Cache layers (dev)

| Layer | Behaviour |
|-------|-----------|
| Browser | `max-age=60` |
| Shared / edge | advertised `s-maxage=86400`; publish must purge ([004](../decisions/004-cloudflare-purge-on-publish.md)) |
| API process | envelope **bodies** cached forever by version; **pointer** re-checked every `CATALOG_CURRENT_TTL_MS` (5000 on directory-dev, 30000 default) |
| UI fallback | baked `data/services.json` after 4s timeout, non-JSON, or a body without `services[]` |

`ETag` is the snapshot version (`"13"` on the day this was re-checked). `If-None-Match` returns 304. `?version=N` pins a historical snapshot without flipping `is_current` (verified `?version=1` → `ETag: "1"`).

---

## How an editor change reaches the public site

```mermaid
sequenceDiagram
  participant Editor
  participant Module as Directory module
  participant Directus
  participant Sidecar as operations :8790
  participant PG as Postgres
  participant CF as Cloudflare
  participant API as catalog-api
  Editor->>Module: Review decision or Listings save
  Module->>Directus: /directory-editor (session)
  Directus->>Sidecar: unauthenticated POST
  Sidecar->>PG: status / raw_import / queue
  Note over PG: Site still serves the previous snapshot
  Editor->>Module: Publish
  Sidecar->>PG: new snapshot, flip is_current
  Sidecar->>CF: purge /api/catalog
  Note over API: pointer refresh within TTL
```

Creates never insert `review_queue_items` ([010](../decisions/010-archive-create-through-name-check.md)). Review is government-only. Status writes do not go live until Publish. A failed purge restores the previous `is_current` ([004](../decisions/004-cloudflare-purge-on-publish.md)). Undo publish is version-checked ([018](../decisions/018-undo-publish-version-guard.md)).

The sidecar has no auth. NetworkPolicy is the boundary ([007](../decisions/007-operations-sidecar-networkpolicy.md)). `operations-from-directus-only` admits pods labelled `app: payload` (and still lists `app: directus` for a rollback) to `:8790`. Payload is the live publisher (`CATALOG_PUBLISHER=payload`). The browser never calls `:8790`. The sidecar stays ClusterIP with no Ingress. Never set `CATALOG_SKIP_PURGE` on a tenant.

Editor-facing copy of this path belongs to the handover task. This section is the technical path only.

---

## How the weekly government sync gets data in

```mermaid
flowchart TD
  Cron["CronJob Monday 01:00 UTC — suspended in dev"] --> CSV[FSD CSV data.govt.nz]
  CSV --> Filter[Porirua filter + geocode QA]
  Filter --> Collapse[SERVICE_ID collapse]
  Collapse --> Diff["diff vs raw_import"]
  Diff --> Queue[review_queue_items]
  Diff --> Runs[import_runs]
  Queue -.->|does not write| Snap[catalog_snapshots]
  Abort["includedCount strictly below 75% of last success"] --> Fail["import_runs failed, zero removal rows"]
```

It **stops short of publishing**. No `catalog_snapshots` row, no `is_current` flip, no purge. New FSD inserts are `pending_review`; `changed` items leave `services.status` as the editor left it ([013](../decisions/013-status-write-rules.md)).

On directory-dev the CronJob is `suspend: true` (`0 1 * * 1`, `concurrencyPolicy: Forbid`, `backoffLimit: 1`). The Job template waits for Postgres with the same busybox `nc -z postgres 5432` init as catalog-bootstrap. A one-off proof:

```bash
kubectl -n dev-porirua-directory create job fsd-sync-manual --from=cronjob/fsd-sync
```

(Investigation only; this document does not run that.)

---

## Images

| Image | Dockerfile | Built by | Tags |
|-------|------------|----------|------|
| `ghcr.io/irab/porirua-directory` | `porirua_directory/Dockerfile` | `image` on push to `main`, **and** `image-dev` on `workflow_dispatch` | `:latest` + SHA on main; SHA only on dispatch |
| `ghcr.io/irab/porirua-directory-api` | `Dockerfile.api` | `image-dev` only | SHA |
| `ghcr.io/irab/porirua-directory-sync` | `Dockerfile.sync` | `image-dev` only | SHA |
| `ghcr.io/irab/porirua-directory-operations` | `Dockerfile.operations` | `image-dev` only | SHA |
| `ghcr.io/irab/porirua-directory-directus` | `Dockerfile.directus` | `image-dev` only | SHA |
| `ghcr.io/irab/porirua-directory-payload` | `Dockerfile.payload` | `image-dev` only | SHA |
| `postgres:16-alpine` | upstream | n/a | floating minor |
| `busybox:1.36` | upstream | n/a | wait-for-postgres init |

Trigger for the six SHA tags:

```bash
gh workflow run directory.yml --ref <branch>
```

A push to `main` still builds nginx only (`4927491`). That is why a merge-to-main cannot produce the pins a Phase 2 prod tenant would need (blackbox PR #79).

**Running version** = the SHA in the blackbox pin, not “whatever is on `main`”, and not necessarily this repo’s HEAD. On 8 Sep 2026 directory-dev catalog/Directus/sidecar ran `b65e5d7` while Payload was pinned separately at `8a5f30b`.

Never pin `:dev` or a floating `:latest` on the tenant. A pin is not done until an Editor session after the roll shows Review / Listings (`e76d04c`).

`Dockerfile.operations` must copy `scripts/`, `editor-core/`, `config-directory.js`, and `directus/` or the sidecar crash-loops before `/health` binds (`db88bcc`).

`Dockerfile.payload` must copy `editor-core/` and `config-directory.js` so `/api/directory-editor` stays the shared authorizing proxy.

A production Payload image never `push`es schema (`@payloadcms/db-postgres` skips push whenever `NODE_ENV` is `production`), and `next start` never runs the config's `onInit`. So `npm run start:migrate` does both jobs in order before serving: `payload migrate` applies `src/migrations`, then `payload run src/seed-cli.ts` creates any missing editor account. Both are idempotent and log what they did. Migrations alone leave the tables empty, which reads as a working admin where every sign-in returns 401. `PAYLOAD_PUSH_SCHEMA` is gone; it was a no-op on a built image.

---

## Secrets, ingress, DNS, CronJob (dev today)

### Secrets

SealedSecret `porirua-directory-secrets`. Required **keys** (from `secret.example.yaml` — values are not repeated here):

`DATABASE_URL`, `POSTGRES_PASSWORD`, `CLOUDFLARE_ZONE_ID`, `CLOUDFLARE_API_TOKEN` (must be able to POST purge), `DIRECTUS_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `EDITOR_EMAIL`, `EDITOR_PASSWORD`.

SealedSecret `porirua-payload-secrets` (separate — do not copy the catalog `DATABASE_URL` into it): `PAYLOAD_SECRET`, `REVIEWER_EMAIL`, `REVIEWER_PASSWORD`. Admin and Editor seed accounts reuse the first secret. The Payload pod builds a `postgres://…/porirua_payload` URL at startup from `POSTGRES_PASSWORD`.

SealedSecrets cannot unseal until the namespace exists. After first sync, copy `ghcr-io` from `dev-polis` (private GHCR). Do not copy either SealedSecret toward prod.

ConfigMap `porirua-directory-config`: `CATALOG_PUBLIC_URL=https://directory-dev.bsky.nz/api/catalog`, `CATALOG_CURRENT_TTL_MS=5000`, `CATALOG_PUBLISHER=payload`, `DIRECTUS_PUBLIC_URL=https://admin-directory-dev.bsky.nz`, `PAYLOAD_PUBLIC_URL=https://admin-payload-directory-dev.bsky.nz`, `PAYLOAD_DB=porirua_payload`, `OPERATIONS_URL=http://operations:8790`. Never set `CATALOG_SKIP_PURGE` on the tenant.

### Ingress and DNS

- ExternalDNS creates proxied A records `directory-dev`, `admin-directory-dev`, and `admin-payload-directory-dev` → `101.100.135.172`.
- TLS: Cloudflare Universal on `*.bsky.nz`. No in-cluster TLS secret.
- Cloudflare Flexible → origin `:4443` → Traefik. Public URLs do not include `:4443`.
- `/api` Ingress priority 200; `/` priority 100 ([021](../decisions/021-split-api-ingress.md)).
- `admin-directory-dev.bsky.nz` redirects to `admin-payload-directory-dev.bsky.nz`. Directus replicas are 0.
- Payload admin is `admin-payload-directory-dev.bsky.nz` → Payload `:3000`. Dev only. This host publishes.
- Ingress health checks are disabled: Traefik never writes `status.loadBalancer`.

### Boot order

| Wave | Resources |
|------|-----------|
| 0 | ConfigMap, SealedSecrets, NetworkPolicies, Postgres |
| 1 (Sync hook) | `catalog-bootstrap` — schema + `db-import-from-json.mjs` + first publish if no `is_current`. `payload-db-init` — `CREATE DATABASE porirua_payload` if missing |
| 2 | operations, catalog-api, nginx, Directus (replicas 0), Payload, FSD CronJob (suspended) |
| 3 (Sync hook) | `directus-bootstrap` + `https-proto` middleware — **before** Ingress |
| 4 | Ingresses (`DisableResourceHealthCheck`) |

### NetworkPolicy

`_base` default-deny, then allow-same-namespace and allow-ingress-controller are **patched** so they do not select `app=operations`. `operations-from-directus-only` allows Directus **or** Payload → `:8790` (two `from` podSelectors; Directus is not removed) and operations → Postgres `:5432`. Operations still matches `_base` `allow-dns` and `allow-egress-internet` (80/443) so purge can reach Cloudflare.

### CronJob

`fsd-sync`: `0 1 * * 1`, **suspended**, waits for Postgres. Writes `review_queue_items` and `import_runs` only.

---

## Failure modes (outside view)

| Failure | Visitor sees | Editor sees |
|---------|--------------|-------------|
| Postgres down | Last in-process snapshot if the API already had one; otherwise API `503` and the UI shows baked JSON | Review / listings / publish fail |
| API down, hung >4s, or non-JSON (including HTML) | Baked `data/services.json` (stale). Playwright asserts which source was consumed | Publish may still write Postgres; the public site looks unchanged until the API returns |
| Sidecar down | Last snapshot, unchanged | Module actions fail |
| Bad publish / purge fail | Previous snapshot stays current | Publish errors; `is_current` is not left on the new row |
| Directus down / scaled to zero | Unchanged | Expected. Use Payload. |
| Payload down / auth gate 401 | Unchanged | Editor and publish unavailable. Directus is retired and cannot stand in. |
| Weekly CronJob fail / sanity abort | Unchanged | Queue does not grow; `import_runs.status='failed'` |
| Nginx down | Site down | Admin may still work on the other hosts |

HEAD `/api/catalog` returning 404 is not a visitor path (the UI uses GET). It is a footgun for anyone health-checking with `curl -I`.

---

## What differs between dev and prod

| | dev.yourporirua.nz | yourporirua.nz (prod) |
|--|---------------|---------------------------|
| Stack | Catalog images + Payload admin + Postgres + sidecar + Directus scaled to 0 + suspended CronJob | Same, without Directus |
| `/api/catalog` | JSON snapshot | JSON snapshot after bootstrap |
| Admin host | `admin-dev.yourporirua.nz` | `admin.yourporirua.nz` |
| Publish | Snapshot + Cloudflare purge from Payload | Same |
| Weekly FSD | Runner exists, CronJob suspended | Same (suspended) |
| Image build | `workflow_dispatch` six SHAs | `main` push builds nginx, API, operations, Payload, sync |

## What is still gated

- CronJob unsuspended only when editors are ready for a weekly queue.
- Re-pin every image to one merge SHA after the first roll if you want a single version.
- Editor sign-in after Argo rolls — pin is not done until Review / Listings / unpublished load on `admin.yourporirua.nz`.

---

## Related

- [Decision records](../decisions/README.md)
- [Product architecture](./porirua-directory-architecture.md)
- [MVP runbook](../MVP-RUNBOOK.md) — local commands and editor-module operational notes (handover task will consolidate)
- [Editor one-pager](../design/editor-guide.md) — not rewritten here
- blackbox tenant README: `clusters/dev/tenants/porirua-directory/README.md` on directory-dev (dev only; do not copy to `clusters/prod/**`)
