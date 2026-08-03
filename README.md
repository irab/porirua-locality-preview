# Porirua Locality — preview monorepo

Two self-contained web apps for [Porirua Locality](https://www.porirualocality.co.nz/):

| Directory | Purpose |
|-----------|---------|
| [`porirua_connections_map/`](porirua_connections_map/) | **Community Connections Map** — Assembly-themed organisation inventory (Squarespace embed + local preview) |
| [`porirua_directory/`](porirua_directory/) | **Services directory (MVP)** — find help in Porirua (Connections Map + Family Services Directory) |

Shared product docs live in [`docs/`](docs/) — see [`docs/README.md`](docs/README.md) for the full index (requirements, examples, slides, MVP plan).

Contributors using AI (Cursor, etc.): start with [`AGENTS.md`](AGENTS.md) and [`docs/AI-CONTRIBUTING.md`](docs/AI-CONTRIBUTING.md).

## Quick start

**Connections Map (existing):**

```bash
cd porirua_connections_map
python3 -m http.server 5173
# open http://localhost:5173
```

**Services directory (in development):**

```bash
cd porirua_directory
npm install
npm run serve
# open http://localhost:5173/directory.html
```

See each subdirectory’s README for data editing, deploy, and Squarespace instructions.
