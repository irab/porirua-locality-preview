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

## Run it locally

No build step. Serve the folder (so browsers allow the CSV fetch):

```bash
cd porirua-locality-preview
python3 -m http.server 5173
# or:  npx serve .
```

Then open <http://localhost:5173>.

## Hook it up to a Google Sheet

1. Create a Google Sheet with one row per organisation and these columns
   (first row = headers):

   ```
   name | orgType | theme | themes | venue | address | lat | lng | url | description | initiatives
   ```

   - `name` is the organisation's name (e.g. "Ngāti Toa Rangatira").
   - `orgType` must be one of the organisation-type ids in the table above
     (exact match, e.g. `Iwi & Marae`).
   - `theme` is the **primary** recommendation this organisation anchors to
     (exact match to a theme id). Drives the section the org appears under
     when no theme filter is active, plus the marker colour.
   - `themes` is optional — a **comma-separated list** of additional
     recommendation ids the organisation contributes to
     (e.g. `Te Taiao, Rangatahi`). Used for cross-cutting chips + filter
     matching. The primary theme is added automatically; you don't need to
     repeat it here.
   - `venue` + `address` describe where the org is based or where it
     predominantly operates.
   - `lat`/`lng` are optional but needed to pin the org on the map.
   - `url` is the organisation's website.
   - `description` is 1-3 sentences about what they do.
   - `initiatives` is optional — a list of flagship programmes, **separated
     by `|` or `;`** (e.g. `Reimagining Hui | Monthly e-Pānui | PCLF`).
     Renders as a bullet list under each org.

2. In Google Sheets: **File → Share → Publish to web → CSV → Publish**, then
   copy the URL (ends with `output=csv`).

3. Paste that URL into `config.js`:

   ```js
   googleSheetCsvUrl: "https://docs.google.com/spreadsheets/d/e/XXXXX/pub?output=csv",
   ```

Updates to the sheet appear within a few minutes (Google caches the published CSV).
Editors don't need any code access.

## Publishing to Squarespace

Once the preview looks right, use `squarespace-snippet.html`:

1. In Squarespace, edit the target page and add a **Code** block
   (requires the Business plan or higher).
2. Paste the contents of `squarespace-snippet.html` in.
3. Edit the `GOOGLE_SHEET_CSV_URL` constant at the top to match your sheet.
4. Save. The organisations + map render in the live page with the same data.

For a staging preview inside Squarespace itself, create an **unlinked page**
(Pages → Not Linked) and embed the snippet there first.

## Files

| File | Purpose |
|------|---------|
| `index.html` | Local preview shell. |
| `config.js` | Google Sheet URL, map center, theme + org-type definitions. Edit me. |
| `sample-data.js` | Fallback organisation inventory (23 real Porirua organisations), used when no sheet URL is set. |
| `map.js` | Rendering logic (map, filter bars, org cards, popups). |
| `squarespace-snippet.html` | Self-contained version to paste into Squarespace. |
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
