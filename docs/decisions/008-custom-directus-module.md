# 008 Custom Directory module rather than stock Data Studio

**Status:** accepted
**Date:** 2026-09-08
**Sources:** `05c6c4f`, `4bd9cd6`, `b47b8e9`; `porirua_directory/directus/extensions/directory-editor/`.

## Decision

Editors and Admins reach review and listings through a custom Directus module at `/directory` (Review | Listings), not through the stock Content app. The module is baked into a fifth image, `ghcr.io/irab/porirua-directory-directus:<sha>`. Viewers get 403.

## Context

Stock Data Studio exposed raw collections, a SQL view that 403ed ([022](./022-review-inbox-on-queue-table.md)), and Flows that did not render without `directus_flows` read. Locality testers were not meant to learn `cluster_key`. The accepted interface design (8 Sep 2026) is a two-tab workspace, not a generic CMS.

## Alternatives considered

- **Keep editors on Content / collection bookmarks.** Lost: `pending_review` 403s; internals leak; publish buttons hide; the accepted design cannot be built from stock Interfaces.
- **A standalone admin app outside Directus.** That is the D1 exit. Lost for Phase 2: it rebuilds auth, roles, and hosting.
- **Load the module from a volume or URL at runtime.** Lost: pin and rollback would split “Directus” from “the Directory button.”

## Consequences

**Cost:** a frontend build (`dist` is not in git), a custom image, a pin path, and a cookie-auth module script (`/extensions/sources/index.js`). Stock `directus/directus` on this tenant is a broken editor — no Review, no Listings. A pin is not done until someone signs in as Editor after the roll and sees the module, not Directus “Page Not Found” (`e76d04c`). The module uses Directus 11’s Axios `useApi()` client; the old `$api.transport` SDK is gone (`b47b8e9`). `main` does not build this image — only `workflow_dispatch` `image-dev` does.

## Revisit if

The D1 + custom-admin exit is taken (this image goes away with Directus), or Directus ships a first-party way to replace Content that matches the accepted design without a fork of the image.
