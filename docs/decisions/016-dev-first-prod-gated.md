# 016 Dev-first promotion; production gated on explicit human authorisation

**Status:** accepted
**Date:** 2026-09-08
**Sources:** workspace rule `no-autonomous-prod-deploy`; blackbox PR #79; `.github/workflows/directory.yml` (`image` vs `image-dev`); live `https://directory.bsky.nz/api/catalog` on 8 Sep 2026 returned the HTML homepage.

## Decision

Phase 2 is built and pinned on **directory-dev**. Production stays the Phase 1 nginx pin until a human, in the same turn, explicitly authorises a prod change. A plan, an epic, or a timed-out question is not authorisation.

## Context

`directory.bsky.nz` is already public. Copying the dev PVC, SealedSecret, or a floating `:dev` tag onto prod would publish unfinished editor work and the wrong secrets. The `main` push job still builds **nginx only**, so a merge-to-main cannot even produce the four extra images a Phase 2 prod tenant would pin.

## Alternatives considered

- **Promote with the Phase 2 tree because “the work is done.”** Lost: it is not. Prod Phase 2 is a gated sibling task, still not started.
- **Build all five images on every `main` push.** Explicitly rejected for now (`4927491`): it would change what `main` does today. That choice is also why prod cannot pin API/sync/operations/Directus from a merge build (blackbox #79).
- **Pin prod to an `image-dev` SHA.** Possible later, but it means prod images come from a manual dispatch, not from merge. That still needs same-turn human authorisation.

## Consequences

This repository’s docs must not describe prod as if it had Postgres, `/api/catalog`, or Directus. Live check 8 Sep 2026: prod `/api/catalog` is `text/html` (the directory page); directory-dev `/api/catalog` is JSON `ETag: "12"`. Do not copy `clusters/prod/**` from this work. Do not copy the directory-dev PVC or SealedSecret.

## Revisit if

A human names production in the same turn (“pin `clusters/prod/…`”, “promote to prod”) **and** the image story is decided (build five images on `main`, or accept dispatch SHAs). Until then, treat any prod Phase 2 sentence as false.

## Revisited 11 Sep 2026

Same-turn authorisation: merge Payload and deploy it to production. First prod roll pins the dev-proven SHAs (nginx `f62b8fb`, catalog/sidecar `b65e5d7`, Payload `ad815ab`). The `image` job on `main` now also builds API, operations, Payload, and sync so later pins can come from a merge SHA. Directus stays off prod. New prod PVC and newly sealed secrets; dev volume and dev SealedSecret blobs are not copied.
