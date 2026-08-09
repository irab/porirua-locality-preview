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
4. Verify [https://directory.bsky.nz](https://directory.bsky.nz).

**Pin a SHA:** edit `deployment.yaml` image tag to `:sha` instead of `:latest` for reproducible rollouts.

---

## Stakeholder feedback (between Phase 1 and 2)

Use this checklist when testing the MVP with help-seekers and the Porirua Locality team:

| Topic | Question |
|-------|----------|
| Browse entry | Is **I need help** vs **Connect with community** clear? |
| Need categories | Are the nine help categories the right plain-language set? |
| Community filters | Can people find marae, councils, and kai initiatives without schools crowding the view? |
| Crisis strip | Compact enough on the community path; visible enough on the help path? |
| Search & map | Can people find a known service (name or suburb) on a phone? |
| Trust | Do **Community map** badges and descriptions feel local and accurate? |
| Gaps | What services or org types are missing from the merged list? |

Capture notes for Phase 2 priorities (admin UI, weekly FSD sync, Squarespace embed, **D1 + Workers vs Directus** spike).
