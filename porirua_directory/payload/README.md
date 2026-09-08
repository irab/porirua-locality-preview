# Payload Directory admin

Payload 3 replacement surface for the Directus Directory module. Catalog data stays in Postgres via the operations sidecar. This app is **auth + shells** — Listings, Review, and Publish are sibling tasks.

Planned **dev** host: `https://admin-payload-directory-dev.bsky.nz`. Directus on `admin-directory-dev.bsky.nz` remains the live publisher until the Publish child says otherwise.

## Auth

The sidecar has no authentication. Every Directory route except local `GET /api/directory-editor/health` goes through `editor-core/operations-proxy.mjs`:

- Unauthenticated → 401
- Viewer / other roles → 403
- Admin, Editor, Reviewer → proxied (`isEditorOrAdmin`)
- Mutations overwrite `createdBy` / `user` with the Payload user id

Do not let the browser call `OPERATIONS_URL`. Do not widen the operations NetworkPolicy until this proxy is in the image.

## Local run

```bash
# from porirua_directory/
docker compose -p porirua-payload -f docker-compose.payload.yml up -d --wait
# http://127.0.0.1:18100/admin
# editor@example.com / editor-local
```

Or without Docker, after the compose Postgres is up:

```bash
cd payload
cp .env.example .env
npm install
npm run dev
```

Point `OPERATIONS_URL` at the Directus compose sidecar (`http://127.0.0.1:18790`) when you want live catalog reads. Without it, Directory home still loads; sidecar calls return 500.

## Shared imports for siblings

See [src/directory/README.md](./src/directory/README.md).
