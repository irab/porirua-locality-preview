# AI agents — Porirua Locality preview

Short index for Cursor and other coding agents working in this repository.

## Purpose

Monorepo for **Porirua Locality** preview web apps:

- **`porirua_directory/`** — **Your Porirua Directory** (Connections Map + NZ Family Services Directory merge).
- **`porirua_connections_map/`** — Assembly-themed **Community Connections Map** (Squarespace embed, Google Sheet source).
- **`docs/`** — requirements, architecture, runbook, phase specs, stakeholder material.

**Production target (directory):** [https://directory.bsky.nz](https://directory.bsky.nz)

## Rules (read first)

| Location | When it applies |
|----------|-----------------|
| [`.cursor/rules/ai-workflow.mdc`](.cursor/rules/ai-workflow.mdc) | Always — docs, commits, verification, scope |
| [`.cursor/rules/porirua-directory-data.mdc`](.cursor/rules/porirua-directory-data.mdc) | Files under `porirua_directory/` |

Human-oriented companion: [`docs/AI-CONTRIBUTING.md`](docs/AI-CONTRIBUTING.md)

## Key documentation

| Doc | Use for |
|-----|---------|
| [`docs/README.md`](docs/README.md) | Full docs index |
| [`docs/porirua-services-directory-requirements.md`](docs/porirua-services-directory-requirements.md) | Product scope, phases, changelog |
| [`docs/potential-changes-and-insights.md`](docs/potential-changes-and-insights.md) | MVP gaps, org/subservices deficit, roadmap options |
| [`docs/architecture/porirua-directory-architecture.md`](docs/architecture/porirua-directory-architecture.md) | System context, hosting |
| [`docs/porirua-directory-phase1-spec.md`](docs/porirua-directory-phase1-spec.md) | Data model, FSD rules, merge, overrides |
| [`docs/MVP-RUNBOOK.md`](docs/MVP-RUNBOOK.md) | Rebuild data, deploy, test |
| [`porirua_directory/README.md`](porirua_directory/README.md) | Directory app layout & npm scripts |
| [`porirua_connections_map/README.md`](porirua_connections_map/README.md) | Map embed & sheet |

## Common commands

**Services directory:**

```bash
cd porirua_directory
npm install
npm run build:data    # import FSD + merge → data/services.json
npm run serve         # http://localhost:5173/index.html
npm test              # unit tests (import/merge)
npm run test:e2e      # Playwright
```

**Connections Map (static preview):**

```bash
cd porirua_connections_map
python3 -m http.server 5173
```

**Docs deck (from repo root):**

```bash
python3 -m http.server 8080
# open docs/slides/human-services-directory-examples.html
```

## Commits and AI transparency

- Do **not** commit unless the user explicitly asks.
- When committing: complete-sentence messages (why), include related doc updates, never skip hooks, never commit secrets.
- Note materially agent-assisted work in commit body or PR when relevant.

## Verification checklist

- Data/script changes → `cd porirua_directory && npm test`
- Merge/import/rule changes → also `npm run build:data` and update phase1 spec if needed
- UI flow changes → consider `npm run test:e2e`; map app → manual smoke test
