# 004 Cloudflare purge on publish

**Status:** accepted
**Date:** 2026-09-08
**Sources:** `8731dbd`; `porirua_directory/scripts/lib/edge-cache.mjs`; `tests/db-publish-purge.test.mjs`; directory-dev GET `/api/catalog` on 8 Sep 2026 returned `Cache-Control: public, max-age=60, s-maxage=86400` and `ETag: "12"`.

## Decision

Publish is not finished until the public catalog URL is purged at Cloudflare. A failed purge is a failed publish: the previous `is_current` snapshot is restored. Rollback and undo-publish purge the same way.

## Context

The API advertises a 60-second browser cache and a **day-long** shared cache so Traefik and Cloudflare can reuse the envelope. The in-process pointer TTL ([003](./003-immutable-snapshots-ttl-pointer.md)) only refreshes what the API itself believes. It cannot evict an edge object that is allowed to live for 86400 seconds. Without a purge, editors would publish, see the old catalog, and publish again.

## Alternatives considered

- **Rely on the pointer TTL alone.** Lost: `s-maxage=86400` can hide the new snapshot for up to 24 hours at the edge.
- **Shorten `s-maxage` to the pointer TTL.** Lost: every browse after 30s refetches a large JSON document through origin. The shared cache exists so we do not do that.
- **Purge as a best-effort side effect.** Lost: a failed purge looks like a successful publish. Tests require the opposite: a failed purge must not leave the new snapshot current.
- **Skip purge on the tenant (`CATALOG_SKIP_PURGE`).** Allowed only for local tests. Never on a tenant.

## Consequences

`CLOUDFLARE_ZONE_ID` and `CLOUDFLARE_API_TOKEN` (purge permission) are required secrets on directory-dev. The default `CATALOG_PUBLIC_URL` in code is `https://directory.bsky.nz/api/catalog`; the tenant ConfigMap overrides it to `https://directory-dev.bsky.nz/api/catalog`. Forgetting that override would purge the **prod** URL — which today is HTML, not the API. Observed on 8 Sep 2026: GET catalog was `cf-cache-status: DYNAMIC` (not HIT), so this curl did not prove the edge is honouring `s-maxage`. The purge still exists because the advertised header allows a 24-hour shared cache.

## Revisit if

The advertised `s-maxage` is dropped or Cloudflare is taken out of the path. Until then, do not treat a successful `is_current` flip as a finished publish.
