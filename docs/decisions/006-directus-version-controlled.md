# 006 Directus as the admin plane, from version-controlled `snapshot.yaml`

**Status:** accepted
**Date:** 2026-09-08
**Sources:** `a8ccd7f`, `2cd778c`, `2627f23`; `porirua_directory/directus/snapshot.yaml`; `scripts/directus/bootstrap.mjs`.

## Decision

Editors work in Directus. Collections, roles, permissions, presets, and Flows are applied from git (`snapshot.yaml`, `directus/flows/`, bootstrap) rather than clicked into a running instance and hoped to survive the next pin.

## Context

Locality editors need a repeatable workspace for review, sticky FSD curation, publish, and rollback. A developer restoring a snapshot by hand after every image roll is not an editor product. Clicked-in Data Studio state drifted the moment two environments existed.

## Alternatives considered

- **Clicked-in Data Studio only.** Lost: the next pin wipes or forks the workspace; there is no reviewable diff.
- **No CMS — custom admin from day one.** Lost: time. Directus was the default so non-technical editors could start; D1 + a custom admin remains the documented **exit**, not the path.
- **Rewrite `snapshot.yaml` in place from the running instance during bootstrap.** Lost: the Job image is read-only (`USER node`); in-place write failed the wave-3 hook with EACCES. Export goes to `DIRECTUS_SNAPSHOT_OUT` or `/tmp`.

## Consequences

Bootstrap is an Argo Sync hook (wave 3, before Ingress). It must **not** PATCH the Editor password on every sync: Directus deletes that user’s `directus_sessions` when `password` is in the payload, the leftover cookie 401s `/extensions/sources/index.js`, and the Directory module never registers (`2627f23`). Only write the password when create or a failed login proves it is wrong. The Editor role’s `last_page` is clamped to `/directory`.

## Revisit if

Directus is withdrawn (export Postgres, keep the snapshot envelope, build the D1 exit), or bootstrap is proven safe to apply incrementally without a full snapshot apply.
