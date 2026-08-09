# Issues directory (fixed & recurring bugs)

Short, durable write-ups for **data pipeline and directory bugs** that are worth remembering after they leave product docs and plans. Use this folder when a fix is implemented but the story (symptoms, root cause, verification) should stay searchable.

## Naming convention

| Prefix | Meaning | Example |
|--------|---------|---------|
| `fixed-` | Resolved in code; kept for history and regression context | `fixed-fsd-aranui-christchurch-filter.md` |
| `open-` | Known problem, not yet fixed (optional future use) | `open-example-slug.md` |

Use **kebab-case** slugs that name the **subsystem + symptom** (e.g. `fsd`, `merge`, `geo-filter`), not ticket numbers.

## Issue file template

Each issue should include:

1. **Status** — `Fixed`, `Open`, `Won't fix`, etc.
2. **Summary** — one paragraph
3. **Symptoms** — what users or data review saw
4. **Root cause** — technical explanation
5. **Fix** — what changed (including regex or policy if relevant)
6. **Verification** — commands, tests, or dataset checks
7. **Date** — when fixed or last verified
8. **Related code paths** — scripts, tests, specs

## Index

| Issue | Status | Summary |
|-------|--------|---------|
| [fixed-fsd-aranui-christchurch-filter.md](./fixed-fsd-aranui-christchurch-filter.md) | Fixed | FSD Porirua locality regex falsely matched Christchurch **Aranui** via **Rānui** token |
| [fixed-fsd-locality-address-context-filter.md](./fixed-fsd-locality-address-context-filter.md) | Fixed | Suburb tokens matched Whitby/Rānui street names, Auckland Ranui, or wrong FSD Porirua district |
| [fixed-fsd-ora-toa-respiratory-sea-marker.md](./fixed-fsd-ora-toa-respiratory-sea-marker.md) | Fixed | FSD row 4690 had empty address and offshore lat/lng; override to Ora Toa Health Unit, Takapūwāhia |

When you add or close an issue, update this table and link from [docs/README.md](../README.md) if the index changes materially.
