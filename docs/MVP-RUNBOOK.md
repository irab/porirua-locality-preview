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

1. `import:fsd` — downloads FSD CSV → `data/fsd-porirua.raw.json`
2. `merge:services` — Connections Map + FSD + overrides → `data/services.json`

**Editors (community orgs):** update the [Connections Map Google Sheet](https://docs.google.com/spreadsheets/d/1xKFgoYtjND3mfgojyddnq2zyKkxH7NXNGejDzFKQP7I/edit) (same as `porirua_connections_map`).

**Hide FSD rows:** add ids to `porirua_directory/data/overrides.json` → re-run `npm run merge:services`.

Commit `data/services.json` when ready to deploy.

---

## Local preview

```bash
cd porirua_directory
npm run serve
# http://localhost:5173/directory.html
```

---

## Tests

```bash
cd porirua_directory
npm test
```

---

## Deploy (Milestone D — when implemented)

1. Build and push container image (GHCR).
2. Argo sync blackbox prod tenant `porirua-directory` with Ingress host `directory.bsky.nz`.
3. Confirm ExternalDNS + Cloudflare (see [blackbox bsky.nz README](file:///Users/ira/repos/blackbox/infra/cloudflare/bsky.nz/README.md)).
4. Verify `https://directory.bsky.nz` loads with updated JSON.

---

## Feedback (between Phase 1 and 2)

Collect input on categories, community filters, crisis strip, and schools visibility before Phase 2 admin build.
