# AI-assisted contributing

How we use Cursor (and similar tools) on the **Porirua Locality preview** monorepo so changes stay documented, testable, and easy to review.

## For humans

- AI is a **pair programmer**, not the author of record — you review diffs, run checks, and decide when to commit.
- Prefer **small, focused** changes with **updated docs** when behavior or ops steps change.
- **Deployable directory data** lives in `porirua_directory/data/services.json`; commit it when you intend to publish an updated dataset.

## For agents

Start with **[`AGENTS.md`](../AGENTS.md)** at the repo root (commands, doc map, deploy URL).

Persistent Cursor rules:

- **[`.cursor/rules/ai-workflow.mdc`](../.cursor/rules/ai-workflow.mdc)** — always on: monorepo layout, documentation expectations, commit policy, verification, minimal scope.
- **[`.cursor/rules/porirua-directory-data.mdc`](../.cursor/rules/porirua-directory-data.mdc)** — when editing `porirua_directory/`: pipeline, tests, what to commit, phase1 spec updates.

## Which docs to update

| If you changed… | Update |
|-----------------|--------|
| Hosting, nginx, Cloudflare, high-level data flow | [`architecture/porirua-directory-architecture.md`](./architecture/porirua-directory-architecture.md) |
| FSD filters, merge logic, JSON schema, overrides | [`porirua-directory-phase1-spec.md`](./porirua-directory-phase1-spec.md) |
| Rebuild, deploy, editor workflow | [`MVP-RUNBOOK.md`](./MVP-RUNBOOK.md) |
| Phase scope, budget, stakeholder requirements | [`porirua-services-directory-requirements-v2.md`](./porirua-services-directory-requirements-v2.md) (concise SOW); changelog in [`porirua-services-directory-requirements.md`](./porirua-services-directory-requirements.md) (v1) |
| App README-level usage | `porirua_directory/README.md` or `porirua_connections_map/README.md` |

Keep doc updates in the **same commit** as the related code when you ask the agent to commit.

## Commit expectations

- Commits happen **only when you ask** explicitly.
- Messages should be **full sentences** explaining **why**, not bullet dumps of filenames.
- Do not bypass git hooks; do not commit `.env` or credentials.
- Group logical changes together; split only when you want separate review units.
- For large or novel agent-built features, mention **AI assistance** in the commit body or PR so reviewers know what to scrutinize.

## Verification

Before merging or declaring work done:

| Area | Command / action |
|------|------------------|
| Directory import/merge scripts | `cd porirua_directory && npm test` |
| After pipeline changes | `npm run build:data` |
| Directory UI flows | `npm run test:e2e` when appropriate |
| Connections Map | Manual check via local `python3 -m http.server` |

## Related indexes

- [`docs/README.md`](./README.md) — all stakeholder and technical docs
- [`AGENTS.md`](../AGENTS.md) — agent quick reference
