# Documentation (monorepo)

Stakeholder and technical docs for **Porirua Locality** preview work. They apply to the whole repository, not only one app subdirectory.

## How this repo is organised

| Path | What it is |
|------|------------|
| [`porirua_connections_map/`](../porirua_connections_map/) | Assembly **Community Connections Map** (Squarespace embed, Google Sheet / CSV) |
| [`porirua_directory/`](../porirua_directory/) | **Services directory** MVP (find help — Connections Map + FSD merge) |
| [`docs/`](.) | Requirements, examples research, slides, implementation plans |

Product code lives in the two app folders; **planning and stakeholder material stays here** so one requirements doc covers both the map and the directory.

## Documents

| Document | Audience | Purpose |
|----------|----------|---------|
| [porirua-services-directory-requirements.md](./porirua-services-directory-requirements.md) | Porirua Locality, funders | Phase 1 / Phase 2 scope, budget, plain-language requirements |
| [porirua-services-directory-requirements.pdf](./porirua-services-directory-requirements.pdf) | Same (print/PDF) | Export of requirements (regenerate after v1.3 md changes) |
| [architecture/porirua-directory-architecture.md](./architecture/porirua-directory-architecture.md) | Developers, ops | System context, data flow, hosting at directory.bsky.nz |
| [porirua-directory-phase1-spec.md](./porirua-directory-phase1-spec.md) | Developers | Phase 1 data model, FSD rules, merge, overrides |
| [MVP-RUNBOOK.md](./MVP-RUNBOOK.md) | Editors, developers | Rebuild data, deploy, test |
| [human-services-directory-examples-overview.md](./human-services-directory-examples-overview.md) | Team, stakeholders | Comparable directories (Ask Izzy, 211, FSD, etc.) |
| [human-services-directory-examples-overview.pdf](./human-services-directory-examples-overview.pdf) | Same (print/PDF) | Export of examples overview |
| [slides/human-services-directory-examples.html](./slides/human-services-directory-examples.html) | Workshops | Reveal.js deck (non-technical) |
| [slides/README.md](./slides/README.md) | Presenters | How to run and export the deck |
| [superpowers/plans/2026-07-30-porirua-services-directory-mvp.md](./superpowers/plans/2026-07-30-porirua-services-directory-mvp.md) | Developers | Step-by-step MVP build (`porirua_directory/`) |
| [AI-CONTRIBUTING.md](./AI-CONTRIBUTING.md) | Contributors, agents | Cursor/AI workflow, commits, which docs to update |

## Present the examples deck

From the **repository root**:

```bash
python3 -m http.server 8080
```

Open [http://localhost:8080/docs/slides/human-services-directory-examples.html](http://localhost:8080/docs/slides/human-services-directory-examples.html)

## Regenerating PDFs

PDFs in this folder are checked in for sharing; regenerate from the `.md` sources when requirements change (your usual Markdown → PDF workflow).
