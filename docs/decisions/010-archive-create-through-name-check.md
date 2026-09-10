# 010 Archive rather than delete; creates publish straight through; near-name check at create

**Status:** accepted
**Date:** 2026-09-08
**Sources:** `814b9a6`; `porirua_directory/scripts/listings.mjs`; `scripts/lib/name-match.mjs`.

## Decision

Listings are archived (`status=hidden` plus a hide override), not deleted. A Locality create is written `published` and does **not** insert a `review_queue_items` row. The public site still serves the last snapshot until Publish. On create, the editor is warned about near-duplicate organisation names (NFD fold plus distinctive token overlap) and can open the existing one or create anyway.

## Context

Review exists for the weekly government feed, not for Moana adding a marae. Hard delete would destroy the FSD identity needed to stay quiet next week. Silent create without a name check is how the sheet produced `community-te-wahi-tiaki-tatou` twice.

## Alternatives considered

- **Hard delete.** Lost: next week’s CSV looks like a new SERVICE_ID, or a removal cannot be undone.
- **Creates go to the review queue.** Lost: Locality would review their own typing. The queue is government-only.
- **Creates go live without Publish.** Lost: a typo is on the public site before anyone looks. Publish stays an explicit step.
- **Block create on a name match.** Lost: false positives (Whānau vs a different Whānau Centre). Warn, do not block.
- **No name check.** Lost: more duplicate cards. The four open pairs in `docs/issues/open-duplicate-org-cards.md` are the backlog, not a reason to skip the warning.

## Consequences

Hidden rows stay in Postgres and stay off the next snapshot. Restore is “put it back on the site”, not undelete. The matcher does **not** change `normalizedOrgName` / clustering — closing that fork is a catalog change ([015](./015-diacritic-folding.md)). `confirmCreateAnyway` is the escape hatch.

## Revisit if

Locality wants creates to be reviewed by a second person, or the merge tool lands and create-anyway should be refused when a live card already folds equal.
