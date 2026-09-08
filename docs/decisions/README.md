# Directory decisions

Why Phase 2 of **Your Porirua Directory** looks the way it does. These records are not a substitute for the code. Each one records the choice, what forced it, what was rejected, and what would reopen it.

**Verified against:** app tree `345edc0` (integrated Phase 2 tip on 8 Sep 2026). Claims about the running stack were checked against [directory-dev](https://directory-dev.bsky.nz) and blackbox `origin/main` the same day. See [deployment snapshot](../architecture/porirua-directory-deployment.md) for services and failure modes.

**Not this folder:** how Moana uses Review and Listings — [editor one-pager](../design/editor-guide.md) and the handover task that owns the editor runbook.

## Format

Every record uses the same headings: Decision, Context, Alternatives considered, Consequences, Revisit if. Status is `accepted` when the tree implements the choice, or `accepted (partial)` when the tree is honest that only part of the choice is applied.

## Index

| # | Decision | Status | One-line why |
|---|----------|--------|----------------|
| [001](./001-public-catalog-from-database.md) | Public data is served from a database, not the committed JSON | accepted | Editors must publish without rebuilding the nginx image |
| [002](./002-catalog-envelope-roundtrip.md) | Catalog envelope shape; rows and envelope round-trip losslessly | accepted | Inferred grain or FSD ids flatten org cards and break My list |
| [003](./003-immutable-snapshots-ttl-pointer.md) | Immutable snapshots; cache bodies, re-check `is_current` on a TTL | accepted | Publish must go live without rolling the API; LISTEN/NOTIFY was passed over |
| [004](./004-cloudflare-purge-on-publish.md) | Cloudflare purge on publish | accepted | Day-long shared cache would hide a new snapshot for up to 24 hours |
| [005](./005-services-json-static-fallback.md) | `data/services.json` is a static fallback, not the source of truth | accepted | The site stays up when the API is down; the copy ages with the image |
| [006](./006-directus-version-controlled.md) | Directus admin plane from version-controlled `snapshot.yaml` | accepted | Clicked-in Data Studio state is not repeatable across pins |
| [007](./007-operations-sidecar-networkpolicy.md) | Sidecar is unauthenticated; NetworkPolicy is the boundary | accepted | Keep Flow JSON thin; the blast radius is real |
| [008](./008-custom-directus-module.md) | Custom Directory module, not stock Data Studio | accepted | Content collections 403ed and hid the work; costs a fifth image |
| [009](./009-google-sheet-retired-for-directory.md) | Sheet retired for the directory; retained for the Connections Map | accepted | Two products, no sync between them |
| [010](./010-archive-create-through-name-check.md) | Archive rather than delete; creates go straight through; warn on near names | accepted | Review is for government updates, not Locality creates |
| [011](./011-raw-import-merge-then-canonicalise.md) | `raw_import`: merge previous, then fill fingerprint keys | accepted | Partial approve dropped url/categories and re-queued forever |
| [012](./012-queue-hygiene.md) | One pending item per entity and kind; ruled-on flags stay quiet | accepted | Geocode flags stacked every week |
| [013](./013-status-write-rules.md) | Changed stays published; approve respects hide; reject-new hides | accepted | Three distinct bugs, each taking listings on or off the site by accident |
| [014](./014-disambiguate-duplicate-public-ids.md) | Colliding public ids are suffixed at bootstrap, merged editorially | accepted | Unique constraint vs two real live collisions with different causes |
| [015](./015-diacritic-folding.md) | Fold macrons for matching; macronised form wins on display | accepted (partial) | Matcher folds; published clustering still does not |
| [016](./016-dev-first-prod-gated.md) | Dev-first; production gated on explicit human authorisation | accepted | Prod still runs the Phase 1 nginx pin |
| [017](./017-split-test-suite.md) | Parallel unit tests, sequential shared-stack tests, with a guard | accepted | Parallel `node --test` raced one Directus and one Postgres |
| [018](./018-undo-publish-version-guard.md) | Undo publish is version-checked | accepted | A leftover tab must not roll back a later publish |
| [019](./019-three-way-lock-sticky-curation.md) | Weekly feed diffs against `raw_import`, not live columns | accepted | Editor curation must survive the next CSV |
| [020](./020-fsd-service-id-prefix.md) | Bootstrap identity is `fsd-` + `SERVICE_ID` | accepted | Published `fsdServiceId` is `FSD_ID`; using it queues every line |
| [021](./021-split-api-ingress.md) | `/api` is its own Traefik Ingress at priority 200 | accepted | Equal priority let nginx answer `/api/catalog` with HTML |
| [022](./022-review-inbox-on-queue-table.md) | Inbox is `review_queue_items`, not the `pending_review` view | accepted | Directus 403s a SQL view with no primary key |

## How to add one

Copy the headings from any accepted record. Number sequentially. Add a row here and in [docs/README.md](../README.md). Do not paraphrase a function; if there is no rejected alternative, it is not a decision record.
