# 012 Queue hygiene: one pending per entity and kind; ruled-on flags stay quiet

**Status:** accepted
**Date:** 2026-09-08
**Sources:** `b4dcff6`, `b048a31`; `decideQueueWrite` in `porirua_directory/scripts/fsd-sync-run.mjs`.

## Decision

There is at most one **pending** `review_queue_items` row per entity and kind. A later run refreshes that row in place instead of inserting another. A `geocode_flag` that an editor already accepted or rejected for the **same flag code** is not raised again. A different code is new information.

## Context

Geocode flags stacked every week. An editor could never empty the queue: the same Cook Strait pin came back as a new row after they had already said it was fine. That is the re-queue-forever bug. The same stacking applied to `changed` / `removed` if the runner inserted blindly.

## Alternatives considered

- **Insert a new row every run.** Lost: the queue grows without bound; “pending” becomes meaningless.
- **Close the old row and open a new one.** Lost: the editor’s in-progress item vanishes; undo/history is harder.
- **Never re-raise any geocode flag for that service.** Lost: a pin that later jumps to a new reason code would stay silent.
- **Do nothing about flags (leave them out of the queue).** Lost: Ora Toa-style marine pins stay on the public map with no editor prompt.

## Consequences

`decideQueueWrite` returns `insert` | `refresh` | `skip`. Directus and the CLI share `approveReviewItem` so the baseline cannot drift from a second copy. The CronJob is still **suspended** on directory-dev; this rule is what makes unsuspending it survivable.

## Revisit if

Editors need a history of every weekly occurrence (then keep the pending singleton and write a separate audit), or flag codes are refined so “same code” is no longer the right quiet rule.
