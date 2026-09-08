# 007 Operations sidecar is unauthenticated; NetworkPolicy is the boundary

**Status:** accepted
**Date:** 2026-09-08
**Sources:** `porirua_directory/directus/operations/server.mjs` header; blackbox `origin/main` `clusters/dev/tenants/porirua-directory/networkpolicy-operations.yaml` and kustomize patches on `allow-same-namespace` / `allow-ingress-controller`; `_base/network-policy.yaml`.

## Decision

The sidecar that can publish, approve, and rewrite `raw_import` listens on ClusterIP `:8790` with **no authentication**. The only authorisation gate is the Directus endpoint `/directory-editor` (Editor or Admin session) before it proxies. NetworkPolicy is what stops the rest of the cluster — and Traefik — from calling it.

## Context

Directus Flows were kept thin so tests can call the same functions the UI uses. Putting auth on the sidecar would mean a second credential to rotate, or sharing the Directus secret with a process that already has the database URL. The cheaper trade was “nothing on the network can reach it except Directus.”

## Alternatives considered

- **Authenticate the sidecar (shared secret or mTLS).** Safer. Lost on time and on keeping Flow JSON and local tests simple. Still the first thing to add if the NetworkPolicy is ever widened.
- **Give the sidecar an Ingress.** Lost immediately: it would be on the public internet with no auth.
- **Put the write logic inside Directus hooks only.** Lost: the weekly CLI and the UI would drift; `approveReviewItem` exists so they cannot.

## Consequences

**Blast radius:** any pod that can open `operations:8790` can publish a catalog, hide listings, and rewrite `raw_import`. That is not a theoretical note — it is the design.

On directory-dev today the tenant patches `_base` so `app=operations` is **outside** same-namespace and Traefik allow lists. `operations-from-directus-only` allows Directus → `:8790` and operations → Postgres `:5432`. Operations still matches `_base` `allow-dns` and `allow-egress-internet` (443/80) so publish can purge Cloudflare. Local compose binds host `18790` for tests; that bind is not a public API.

The browser never calls the sidecar. The module talks to Directus; Directus talks to the sidecar.

## Revisit if

A second caller needs the sidecar (a Job outside the Directus pod, a debug port, a second namespace), or anyone can show a path from Traefik or another tenant pod to `:8790`. Then add a shared secret before widening the policy — do not “just allow the Job.”
