# 013 Status-write rules

**Status:** accepted
**Date:** 2026-09-08
**Sources:** `1ba2fc0`, `a7b3844`, `3ce4310`; `applyAcceptedService` / `rejectReviewItem` in `porirua_directory/scripts/approve-review.mjs`.

## Decision

`status` means “is this row on the public site after the next publish?” Three rules, from three bugs:

1. **A government change does not flip a live row to `pending_review`.** Only a genuinely new FSD insert uses that status.
2. **Approving a change does not republish a listing an editor hid.** `applyAcceptedService` writes `status='published'` only when the row is not already `hidden`.
3. **Rejecting a new service hides it** with the same hide override a removal uses, so the next sync cannot raise it as new.

## Context

Each rule is a distinct failure, not one “be careful with status” lesson.

- If a weekly `changed` item moved `status` to `pending_review`, the next snapshot dropped the listing from the public site while an editor was still thinking about a phone number (`1ba2fc0`).
- If approve always wrote `published`, “Take it off the site” followed by “Accept this government address” put the hidden listing back on (`1ba2fc0`).
- If reject of a **new** row left it `published` (or restored it to published), “Don't add this” put the listing on the public site (`a7b3844`). The next Monday it came back as new unless a hide lock existed.

Related, not the same bug: Keep-as-community on a hidden FSD dropout must not undo a deliberate hide (`3ce4310`).

## Alternatives considered

- **Queueing implies unpublish.** Lost: the live site flickers every Monday.
- **Approve always publishes.** Lost: hide is not sticky.
- **Reject of new means “leave it as inserted.”** Lost: insert was `pending_review` or `published` depending on the path; without a hide lock the next sync resurrects it.
- **Reject writes `published` to “restore.”** That is correct for a **changed** row that was already live. It is wrong for **new**.

## Consequences

New FSD inserts stay off snapshots until someone approves. Hidden stays hidden across approve, reject-of-new, and keep-as-community. Reject of `changed` restores columns from `raw_import` and does **not** write `status`. Status writes still do not reach visitors until Publish.

## Revisit if

Locality wants a “preview pending changes on the public site”, or hide becomes a separate flag from `status`. Until then, do not use `pending_review` as a workspace for live rows.
