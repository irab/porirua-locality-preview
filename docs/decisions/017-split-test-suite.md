# 017 Parallel unit tests and sequential shared-stack tests

**Status:** accepted
**Date:** 2026-09-08
**Sources:** `27627e5`; `porirua_directory/scripts/run-node-tests.mjs`; `tests/node-test-partition.test.mjs`.

## Decision

`npm test` runs pure unit files in parallel, then Directus-backed files one at a time (`--test-concurrency=1`). A guard fails the run if a new file uses the shared stack (`bootstrapDirectus`, `withDirectusDatabase`, `probeDirectus`) but is missing from `DIRECTUS_TEST_FILES`.

## Context

Those files share one Directus and one Postgres. Under `node --test` they bootstrapped and truncated under each other. The suite flickered and the schema was not the schema the next file expected. `npm run test:db` and `test:sync` already used concurrency 1 for the same reason.

## Alternatives considered

- **Run everything in parallel (`node --test tests/*.test.mjs`).** Lost: that is the race. The file comment exists so nobody “simplifies” `npm test` back to a single glob.
- **Run everything sequentially.** Lost: the unit files are the majority and are safe in parallel.
- **Give every Directus test its own compose project.** Safer isolation, much slower CI, and more ports to collide across worktrees.
- **Trust reviewers to update the list.** Lost: the next file will be forgotten. The guard reads the source.

## Consequences

`npm run test:directus` must stay in sync with `DIRECTUS_TEST_FILES`. Database-backed `tests/db-*.test.mjs` skip when Postgres is unreachable so laptops without Docker stay green. Compose project name is `porirua-directus`; `directus:down` includes `-v` so a leftover admin user does not poison the next up.

## Revisit if

The shared stack is replaced by per-file containers, or `node --test` gains a first-party “serial group” that makes the hand list unnecessary. Until then, do not delete the guard to make a log prettier.
