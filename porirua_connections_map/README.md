# Porirua Locality — Organisations by Assembly Recommendation

A tiny, zero-backend preview site that renders an **inventory of Porirua
organisations** (iwi, marae, community groups, kaupapa groups, kura, councils,
social enterprises, advocates) grouped under the six overarching
recommendations of the
[Porirua Assembly](https://static1.squarespace.com/static/61a403b442b8840d9ed2143a/t/68355b24fb37801191c0ad0a/1748327214881/Porirua+Assembly+Recommendations-compressed.pdf),
with a Leaflet map coloured by recommendation. Built to be copy-pasted into
the [Porirua Locality](https://reindeer-avocado-974t.squarespace.com/)
Squarespace site.

**Repo location:** this app lives in [`porirua_connections_map/`](.) in the monorepo. The services finder is in [`porirua_directory/`](../porirua_directory/). Shared requirements and slides: [`docs/`](../docs/README.md).

One marker per organisation. Each organisation declares a **primary**
recommendation (for grouping) plus optional **cross-cutting** recommendations
it also contributes to (shown as chips, and used for filtering).

## The six themes

From the Porirua Assembly Recommendations:

| Theme id (used in the sheet)  | Heading                       | Focus                                  | Icon         |
| ----------------------------- | ----------------------------- | -------------------------------------- | ------------ |
| `Rangatahi`                   | Rangatahi                     | Youth                                  | sprout       |
| `Weaving Porirua Together`    | Weaving Porirua Together      | Resilient People Network               | network      |
| `Te Taiao`                    | Te Taiao                      | Our Environment                        | trees        |
| `How We Roll`                 | How We Roll                   | Approach & Implementation              | compass      |
| `Know More Do More`           | Know More Do More             | Action Through Education and Awareness | book-open    |
| `How Stuff Works`             | How Stuff Works               | Resilient Infrastructure               | cog          |

Icons are Lucide-style stroked SVGs, used in the theme card badges, the theme
chips on each organisation, and the filter bar.

## Organisation types

Every organisation is tagged with its **type**, which powers the second filter
and the org-type pill + marker icon:

| Org type id (used in the sheet) | Typical examples                                                                                                            | Icon           |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | -------------- |
| `Iwi & Marae`                   | Ngāti Toa Rangatira (Takapūwāhia + Hongoeka)                                                                                 | landmark       |
| `Community Group`               | Te Wāhi Tiaki Tātou, PCLF, Porirua Assembly, R.O.C.C., Wesley Community Action, Pātaka Kai, Ngahere Korowai, Para Kore, Autism NZ | users          |
| `Kaupapa Group`                 | Kai Kaupapa Group, Housing Kaupapa Group (PCLF)                                                                              | users-round    |
| `School / Kura`                 | Porirua College, Aotea College, Enviroschools Porirua cluster                                                                | graduation-cap |
| `Council / Government`          | Porirua City Council, Kāinga Ora Porirua, Metlink / Greater Wellington                                                        | building-2     |
| `Social Enterprise`             | Te Umu ki Rangituhi (Porirua's Social Supermarket), Te Āhuru Mōwai                                                            | store          |
| `Advocacy / Research`           | Porirua Harbour Trust, Sustainability Trust, Te Reo o Ngā Tāngata / The People Speak                                         | megaphone      |

## Map markers

- **Colour** and **icon** are both driven by the organisation's **type**.
  Every school shares one marker, every iwi shares another, etc. Same for
  the round badge next to each organisation in the list.
- The **recommendation mix** for each org is shown separately as chips on
  the card + popup (one chip per primary / cross-cutting recommendation).

So scanning the map tells you *what kind of organisation* is where; clicking
through reveals which recommendations each one contributes to.

## Filtering

Two filter bars sit between the map and the theme cards:

1. **Filter by recommendation** — toggles the six Assembly themes. Any org
   whose primary **or** cross-cutting themes include a selected recommendation
   is shown, and orgs appear under **every** selected theme section they
   contribute to (so you can see cross-cutting kaupapa in context).
2. **Filter by organisation** — toggles the organisation-type chips above.

Filters combine (logical AND) and are multi-select. A **Clear all filters**
button appears when any chip is active.

## Data model

The **live** data source is a Google Sheet maintained by the Porirua
Locality team:
[Porirua Climate Assembly Map](https://docs.google.com/spreadsheets/d/1xKFgoYtjND3mfgojyddnq2zyKkxH7NXNGejDzFKQP7I/edit).

`map.js` delegates all loading to `data-loader.js`, which resolves the
inventory in this order:

1. **Google Sheet** — `cfg.googleSheetCsvUrl` (default: the sheet above).
   Editors update the sheet, the site reflects it on next load (~5 min
   Google cache). Non-technical contributors never need to touch the repo.
2. **Local CSV** — `cfg.dataCsvUrl`, default `./data/organisations.csv`.
   Used when the sheet is unreachable (Google outage, offline, private).
   Also the fallback for `squarespace-snippet.html` if the hosted CSV
   becomes unavailable.

If both fail, the map renders an empty state and the status line under
the map tells you which source was tried. **Always serve the page over
http(s)** (`python3 -m http.server`, GitHub Pages, Squarespace, etc.) —
opening `index.html` via `file://` will block both fetches and show the
empty state.

### CSV columns

The CSV (and the published Google Sheet) must have these headers in the
first row, in any order:

```
name, orgType, theme, themes, venue, address, lat, lng, url, description, initiatives, labels
```

| Column        | Required | Meaning                                                                                                                                                        |
| ------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`        | yes      | Organisation's name (e.g. `Ngāti Toa Rangatira`).                                                                                                              |
| `orgType`     | yes      | One of the org-type ids above (exact match, e.g. `Iwi & Marae`). Drives the org-type pill + marker icon.                                                        |
| `theme`       | yes      | Primary recommendation this org anchors to (exact theme id). Drives the theme card it appears under when no theme filter is active, plus the marker colour. |
| `themes`      | no       | **Comma-separated** cross-cutting recommendations (e.g. `Te Taiao, Rangatahi`). The primary theme is added automatically — no need to repeat it.             |
| `venue`       | no       | Where they're based (e.g. `Takapūwāhia Marae`).                                                                                                               |
| `address`     | no       | Street-level address or suburb.                                                                                                                                |
| `lat`, `lng`  | no       | Needed to pin the org on the map. Organisations without coordinates still render in the list but not the map.                                                  |
| `url`         | no       | Organisation's website.                                                                                                                                        |
| `description` | no       | 1–3 sentences about what they do.                                                                                                                              |
| `initiatives` | no       | Flagship programmes / kaupapa. **`\|` or `;` separated** (e.g. `Reimagining Hui \| Monthly e-Pānui \| PCLF`). Renders as a bullet list under each org.          |
| `labels`      | no       | Free-form descriptor tags (e.g. `kai \| dignity \| Cannons Creek`). **`\|` or `;` separated**. Renders as small neutral chips on each card and in the popup. Handy for cross-cutting tags that don't fit the six Assembly recommendations (kaupapa Māori, te reo, harbour accord, deliberative, …). |

Cells containing commas (e.g. most descriptions) must be double-quoted in
the CSV — the generated file already does this.

## Run it locally

No build step. Serve the folder (so the browser can fetch the CSV):

```bash
cd porirua-locality-preview/porirua_connections_map
python3 -m http.server 5173
# or:  npx serve .
```

Then open <http://localhost:5173>. The status line under the map tells you
which data source rendered (`csv`, `sheet`, or `sample`).

## Edit the inventory

**Option A — edit the CSV directly** (for devs / anyone comfortable with a
PR):

1. Open `data/organisations.csv` in a text editor or spreadsheet app.
2. Add / edit a row. Keep array cells (`themes`, `initiatives`, `labels`)
   using the conventions above.
3. Commit + push. Every consumer (local preview, anywhere `dataCsvUrl`
   points) picks up the change on next load.

**Option B — edit the Google Sheet** (no PRs, live updates):

The sheet is already wired up in `config.js` and
`squarespace-snippet.html`:

- Sheet: <https://docs.google.com/spreadsheets/d/1xKFgoYtjND3mfgojyddnq2zyKkxH7NXNGejDzFKQP7I/edit>
- CSV endpoint:
  `https://docs.google.com/spreadsheets/d/1xKFgoYtjND3mfgojyddnq2zyKkxH7NXNGejDzFKQP7I/export?format=csv&gid=0`

Header row must match the CSV columns above. Editors can add/remove rows
live — the site picks changes up within a few minutes (Google caches the
export).

To swap to a different sheet:

1. Make sure link-sharing is **Anyone with the link → Viewer** (required
   for the browser to fetch it without auth).
2. Grab the sheet id from its URL
   (`.../d/<SHEET_ID>/edit?gid=<TAB_ID>`).
3. Replace the URL in `config.js` (and optionally in
   `squarespace-snippet.html`) with:

   ```
   https://docs.google.com/spreadsheets/d/<SHEET_ID>/export?format=csv&gid=<TAB_ID>
   ```

   Alternatively, **File → Share → Publish to web → CSV → Publish**
   produces a stable `…pub?output=csv` URL that also works here — pick
   whichever workflow fits.

If the sheet ever 404s or goes private, the site quietly falls back to
`data/organisations.csv`. If that fails too, the page renders an empty
state and the status line under the map says which source(s) it tried.

## Publishing to Squarespace

Once the preview looks right, use `squarespace-snippet.html`:

1. In Squarespace, edit the target page and add a **Code** block
   (requires the Business plan or higher).
2. Paste the contents of `squarespace-snippet.html` in.
3. Set `DATA_URL` at the top of the snippet to either:
   - a published Google Sheet CSV URL (`…pub?output=csv`), OR
   - a raw CSV URL — e.g. `https://raw.githubusercontent.com/irab/porirua-locality-preview/main/porirua_connections_map/data/organisations.csv`
     if you want to keep the CSV as the single source of truth.
4. Save. The organisations + map render in the live page with the same data.

For a staging preview inside Squarespace itself, create an **unlinked page**
(Pages → Not Linked) and embed the snippet there first.

## Files

| File | Purpose |
|------|---------|
| `index.html` | Local preview shell. |
| `config.js` | Data-source URLs, map center, theme + org-type definitions. Edit me. |
| `data/organisations.csv` | **Canonical inventory.** 23 Porirua organisations + labels. Single source of truth. |
| `data-loader.js` | Data-source module: resolves Google Sheet → local CSV. Exposes `window.PORIRUA_DATA.load(cfg)`. |
| `map.js` | Rendering logic (map, filter bars, org cards, popups). |
| `squarespace-snippet.html` | Self-contained version to paste into Squarespace. Reads from any CSV URL. |
| `README.md` | This file. |

## Design

The preview is styled to match the Porirua Locality Squarespace site:

- **Headings** — Recoleta (bold serif), loaded from the Squarespace site's own
  font URL.
- **Body** — Aktiv Grotesk (sans-serif), loaded from Typekit.
- **Palette** — plum `#60174C` (ink), crimson `#CF2028` (accent), cream blush
  `#FDEEEE` (background), dusty blush `#F5BFB8` (borders), extracted from the
  live site's `--black-hsl` / `--darkAccent-hsl` / `--lightAccent-hsl` /
  `--accent-hsl` CSS variables.

`squarespace-snippet.html` goes one step further: it uses those CSS variables
directly (with hardcoded fallbacks), so when pasted into a Code Block on the
Porirua Locality site it *inherits* whatever palette and fonts the site is
currently using. If you rebrand the site, the embed reflows automatically.

## Attribution

Map tiles © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors.
Mapping library: [Leaflet](https://leafletjs.com/).
CSV parser: [PapaParse](https://www.papaparse.com/).
Theme content derived from the Porirua Assembly Recommendations.
Fonts (Recoleta, Aktiv Grotesk) are the property of their respective
licensors and are loaded from the Porirua Locality Squarespace site /
Adobe Typekit kit in use by that site.
