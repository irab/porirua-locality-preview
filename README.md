# Porirua Locality — Organisations by Assembly Recommendation

A tiny, zero-backend preview site that renders an **inventory of Porirua
organisations** (iwi, marae, community groups, kaupapa groups, kura, councils,
social enterprises, advocates) grouped under the six overarching
recommendations of the
[Porirua Assembly](https://static1.squarespace.com/static/61a403b442b8840d9ed2143a/t/68355b24fb37801191c0ad0a/1748327214881/Porirua+Assembly+Recommendations-compressed.pdf),
with a Leaflet map coloured by recommendation. Built to be copy-pasted into
the [Porirua Locality](https://reindeer-avocado-974t.squarespace.com/)
Squarespace site.

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

- **Colour** = the organisation's **primary** recommendation colour.
- **Icon** inside the circle = the organisation's **type** icon.

So scanning the map tells you both *which recommendation* each org anchors to
and *what kind of organisation* it is.

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

The canonical data source is a single CSV at [`data/organisations.csv`](data/organisations.csv).
`map.js` delegates all loading to `data-loader.js`, which resolves the
inventory in this order:

1. **Google Sheet** — `cfg.googleSheetCsvUrl` (if set). Good for non-technical
   editors: they update the sheet, the site reflects it within minutes.
2. **Local CSV** — `cfg.dataCsvUrl`, default `./data/organisations.csv`. Used
   whenever the repo is served directly (local preview, GitHub Pages, static
   hosting). Edit the CSV via PR.
3. **Embedded sample** — `window.PORIRUA_SAMPLE_ORGS` in `sample-data.js`.
   Deep fallback for the `file://` case (e.g. double-clicking `index.html`)
   or if both URLs above fail. The status line tells you which source
   rendered.

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
cd porirua-locality-preview
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

**Option B — connect a Google Sheet** (for editors who want a GUI, no PRs):

1. Create a Google Sheet with the exact header row listed under
   *CSV columns* above (first row = headers).
2. **File → Share → Publish to web → CSV → Publish**, then copy the URL
   (ends with `output=csv`).
3. Paste into `config.js`:

   ```js
   googleSheetCsvUrl: "https://docs.google.com/spreadsheets/d/e/XXXXX/pub?output=csv",
   ```

   When set, the sheet **overrides** the local CSV on every load. Remove
   the URL (or leave it empty) to fall back to the local file. Google
   caches published CSVs for ~5 min.

## Publishing to Squarespace

Once the preview looks right, use `squarespace-snippet.html`:

1. In Squarespace, edit the target page and add a **Code** block
   (requires the Business plan or higher).
2. Paste the contents of `squarespace-snippet.html` in.
3. Set `DATA_URL` at the top of the snippet to either:
   - a published Google Sheet CSV URL (`…pub?output=csv`), OR
   - a raw CSV URL — e.g. `https://raw.githubusercontent.com/irab/porirua-locality-preview/main/data/organisations.csv`
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
| `data-loader.js` | Data-source module: resolves Google Sheet → local CSV → embedded sample. Exposes `window.PORIRUA_DATA.load(cfg)`. |
| `sample-data.js` | Deep fallback (mirrors the CSV). Only used when fetches fail (e.g. `file://`). |
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
