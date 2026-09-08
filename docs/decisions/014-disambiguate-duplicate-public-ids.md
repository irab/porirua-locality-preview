# 014 Duplicate public ids are disambiguated at bootstrap and merged editorially

**Status:** accepted
**Date:** 2026-09-08
**Sources:** `porirua_directory/scripts/lib/catalog-bootstrap.mjs`; `tests/catalog-roundtrip.test.mjs` comment; live GET `https://directory-dev.bsky.nz/api/catalog` on 8 Sep 2026. Contrast [open-duplicate-org-cards](../issues/open-duplicate-org-cards.md).

## Decision

When two organisation cards share a `public_id`, bootstrap makes the id unique deterministically: the winner keeps the bare id; the other gets `-<first 4 hex of sha256(cluster_key)>`. The cards stay in the catalog. Cleaning them is an editor merge later — not a pipeline delete, and not a silent drop.

## Context

Postgres unique-constrains `public_id`. The committed Phase 1 JSON already contained two collisions. Suppressing one card at import would hide a live listing without an editor decision. Assigning suffixes by row order would change ids on every shuffle.

Two real cases, different root causes:

1. **`org-te-waka-whaiora-trust`** — `orgClusterKey` includes phone. Same trust, same address, same rounded geo; phones `04 237 9608` (four-line card) vs `0800 826 428` (South Wairarapa Truancy Service card). `orgIdForCluster` slugs both to one id.
2. **`community-te-wahi-tiaki-tatou`** — the same organisation entered twice in the Connections Map sheet at slightly different addresses. Duplicate card id **and** duplicate line id.

Live catalog on 8 Sep 2026 served both bare and suffixed ids: `org-te-waka-whaiora-trust`, `org-te-waka-whaiora-trust-342f`, `community-te-wahi-tiaki-tatou`, `community-te-wahi-tiaki-tatou-ea82`.

These are **not** the four open duplicate-**card** pairs (Whānau / Rūnanga macron splits, Te Waka / Te Wāhi twins that already have different prefixes). Those have no `public_id` collision. Do not fold this decision into that backlog.

## Alternatives considered

- **Drop the loser at import.** Lost: a public listing disappears with no editor, and My list links 404.
- **Suffix by array order.** Lost: a shuffled envelope bootstraps different primary keys.
- **Fix `orgClusterKey` / the sheet in the same change.** Dropping phone from the cluster key merges exactly one group (Te Waka). That is a catalog change with a before/after, not a bootstrap constraint fix. Sheet cleanup is editorial.

## Consequences

Organisation row ids become the (possibly suffixed) public id so a shuffled envelope still bootstraps the same keys. The live envelope is not byte-identical to committed JSON ([002](./002-catalog-envelope-roundtrip.md)). Merge belongs to the duplicate-detection admin task, not to `db:import`.

## Revisit if

The two collisions are merged in the catalog and a before/after snapshot is accepted, or `orgClusterKey` stops including phone **and** the sheet is cleaned — then the suffix path should have no work, and the test that expects two rows per colliding id should fail on purpose.
