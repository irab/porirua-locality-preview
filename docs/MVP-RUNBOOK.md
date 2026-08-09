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

1. `import:fsd` — downloads FSD CSV → `data/fsd-porirua.raw.json` and **`data/fsd-porirua-excluded.json`** (geo filter audit)
2. `merge:services` — Connections Map + FSD + overrides → `data/services.json`

**Editors (community orgs):** update the [Connections Map Google Sheet](https://docs.google.com/spreadsheets/d/1xKFgoYtjND3mfgojyddnq2zyKkxH7NXNGejDzFKQP7I/edit) (same as `porirua_connections_map`).

**Hide FSD rows:** add ids to `porirua_directory/data/overrides.json` → re-run `npm run merge:services`.

Commit `data/services.json` when ready to deploy.

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

CI (`.github/workflows/directory.yml`) runs unit + e2e on PRs; builds and pushes `ghcr.io/irab/porirua-directory:latest` on push to `main`.

---

## Deploy

1. Push to `main` with updated `data/services.json` (if needed) — workflow builds and pushes the container image.
2. ArgoCD syncs blackbox prod tenant **`porirua-directory`** (`clusters/prod/tenants/porirua-directory/`).
3. ExternalDNS upserts `directory.bsky.nz` when the Ingress is healthy (see [blackbox bsky.nz README](file:///Users/ira/repos/blackbox/infra/cloudflare/bsky.nz/README.md)).
4. Verify [https://directory.bsky.nz](https://directory.bsky.nz) — headings **Recoleta**, body **Aktiv Grotesk** (Adobe Typekit kit `xcy1epi`). If body font falls back to Poppins/system sans, add **directory.bsky.nz** to the kit’s allowed domains in Adobe Fonts.

**Pin a SHA:** edit `deployment.yaml` image tag to `:sha` instead of `:latest` for reproducible rollouts.

---

## Stakeholder feedback (between Phase 1 and 2)

Use this checklist when testing the MVP with help-seekers and the Porirua Locality team:

| Topic | Question |
|-------|----------|
| Browse entry | Is **Find support** vs **Connect with community** clear on landing (**I would like to…**)? |
| Need categories | Are the nine support categories the right plain-language set? |
| Community filters | Can people find marae, councils, and kai initiatives without schools crowding the view? |
| Crisis footer | Sticky bar readable on mobile; links work from landing, browse, and About? |
| Browse layout | **Back** to change path (subnav hidden); filters left, optional map, results — quick on a phone? |
| Search & map | Can people find a known service (name or suburb) on a phone? |
| Trust | Do community org descriptions and org-type chips feel local and accurate? |
| Gaps | What services or org types are missing from the merged list? |

Capture notes for Phase 2 priorities (admin UI, weekly FSD sync, Squarespace embed, **D1 + Workers vs Directus** spike).
