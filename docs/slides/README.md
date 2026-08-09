# Slide decks

## Your Porirua Directory — MVP walkthrough

**File:** [directory-mvp-walkthrough.html](./directory-mvp-walkthrough.html)

Stakeholder walkthrough of **Phase 1 MVP**: what shipped on the directory (browse layout, map, My list, crisis footer, data pipeline), geocode QA, near-me demo, known org/subservices gap, accessibility target, landing map-first options, and Phase 1.5/2 roadmap. Several slides embed the local app in iframes.

### Present locally

**Important:** Start the HTTP server from the **repository root** (not `docs/slides/`). Embeds load `../../porirua_directory/index.html` relative to this deck.

```bash
cd /path/to/porirua-locality-preview
python3 -m http.server 8080
```

Open: [http://localhost:8080/docs/slides/directory-mvp-walkthrough.html](http://localhost:8080/docs/slides/directory-mvp-walkthrough.html)

Ensure `porirua_directory/index.html` and `porirua_directory/data/services.json` exist (run `cd porirua_directory && npm run build:data` if embeds look empty).

> Reveal.js loads from a CDN — internet access when presenting.

### Controls

Same as the examples deck: → / Space next, ← previous, **F** fullscreen, **Esc** overview, **?** help.

### Export to PDF

Add `?print-pdf` to the URL before printing (background graphics on). Embedded iframes may not print fully — use live presentation for demos.

---

## Human Services Directory Examples

**File:** [human-services-directory-examples.html](./human-services-directory-examples.html)

Reference presentation comparing Ask Izzy, 211, Family Services Directory, ORServices, and other examples relevant to the Porirua Services Directory project.

**Repo context:** [`docs/README.md`](../README.md) — requirements and this deck live under `docs/`; app code is in `porirua_directory/` and `porirua_connections_map/`.

**Audience:** Written for non-technical stakeholders — plain language, no software jargon. Technical detail lives in the requirements doc appendices.

### Present locally

From the repo root:

```bash
python3 -m http.server 8080
```

Open: [http://localhost:8080/docs/slides/human-services-directory-examples.html](http://localhost:8080/docs/slides/human-services-directory-examples.html)

> The deck loads Reveal.js from a CDN — you need internet access when presenting.

### Controls

| Key | Action |
|-----|--------|
| → / ↓ / Space | Next slide |
| ← / ↑ | Previous slide |
| **F** | Fullscreen |
| **Esc** | Slide overview |
| **?** | Help overlay |

Touch/swipe works on tablets.

### Export to PDF

1. Open the deck in Chrome.
2. Add `?print-pdf` to the URL, e.g.  
   `http://localhost:8080/docs/slides/human-services-directory-examples.html?print-pdf`
3. Wait for slides to render, then **Print → Save as PDF** (enable background graphics).

### Source markdown

The content is also available as a document: [../human-services-directory-examples-overview.md](../human-services-directory-examples-overview.md)
