# 022 Editor inbox is `review_queue_items`, not the `pending_review` view

**Status:** accepted
**Date:** 2026-09-08
**Sources:** `ee3a003`; `porirua_directory/directus/pending-review.sql`; Directory module Review tab (custom UI on top of the same table).

## Decision

The working inbox is the `review_queue_items` table (pending preset, generated `change_summary`). The `pending_review` SQL view stays SQL-only and hidden. Directus cannot inspect that view: it has no fields Directus understands and no primary key, so the visible sidebar collection 403ed.

## Context

The view was meant to be a friendly inbox. App-access alone does not make a SQL view editable. Editors opened a collection with no rows they could act on, while the real pending items sat on a hidden table. The custom module now reads the table through the sidecar; stock Data Studio, if used, must open the same table.

## Alternatives considered

- **Keep the view as the sidebar collection.** Lost: 403, no approve.
- **Teach Directus a primary key on the view.** Fragile, and the module was already going to replace Content.
- **Inbox as a new table.** Lost: a second copy of pending state to drift from the runner.

## Consequences

Do not add a visible `pending_review` collection. Closed rows keep `proposed.editor_decision` so Review can list recently finished work after a reload without a third table. List-view Approve / Hide / Reject loop every selected key; Edit-and-approve and Roll back stay single-item and 400 if extra keys arrive (`7d18884`). A `both` button that still reads `keys[0]` silently drops the rest of a selection.

## Revisit if

The module is the only UI forever (then Data Studio presets matter less) and the view can be dropped, or Directus gains first-class SQL-view collections. Do not re-expose the view to “simplify” the sidebar.
