# 021 `/api` is its own Traefik Ingress at priority 200

**Status:** accepted
**Date:** 2026-09-08
**Sources:** `bdc0b02`; blackbox `origin/main` `clusters/dev/tenants/porirua-directory/ingress-api.yaml` and `ingress.yaml`. Live: directory-dev GET `/api/catalog` is JSON; prod GET `/api/catalog` is the HTML homepage (no split Ingress there).

## Decision

On directory-dev, `/api` is a separate Ingress (`porirua-directory-api`, Traefik `router.priority` 200) to `catalog-api:3000`. `/` is `porirua-directory` (priority 100) to nginx:8080. They are not two paths on one Ingress with a shared priority.

## Context

The first sync stalled in two ways. Equal `router.priority` on `/` and `/api` let the longer PathPrefix lose: nginx answered `/api/*` with HTML, which is exactly the white-screen [005](./005-services-json-static-fallback.md) exists for. Putting Directus bootstrap after the Ingress wave deadlocked Argo because Traefik never writes Ingress ADDRESS on this cluster. Those are the lessons `bdc0b02` recorded for anyone copying the tenant.

## Alternatives considered

- **One Ingress, two paths, same priority.** Lost: `/api/catalog` is HTML.
- **Rely on PathPrefix length without setting priority.** Traefik only uses length when priority is unset. A shared annotation made them equal.
- **Put bootstrap after Ingress.** Lost: Argo waits forever on a Progressing Ingress.

## Consequences

Bootstrap is wave 3 (before Ingress). Ingresses are wave 4 with `DisableResourceHealthCheck`. A later prod tenant must copy the split and the wave order — not as if prod already has them, but as the known-good shape. Prod today has neither.

## Revisit if

The cluster starts writing Ingress load-balancer addresses, or `/api` moves to a different host. Until then, do not “simplify” the two Ingresses into one.
