# Porirua Locality — Events by Assembly Recommendation

A tiny, zero-backend preview site that renders community events grouped under
the six overarching recommendations of the
[Porirua Assembly](https://static1.squarespace.com/static/61a403b442b8840d9ed2143a/t/68355b24fb37801191c0ad0a/1748327214881/Porirua+Assembly+Recommendations-compressed.pdf),
with a Leaflet map coloured by theme. Built to be copy-pasted into the
[Porirua Locality](https://reindeer-avocado-974t.squarespace.com/) Squarespace site.

## The six themes

From the Porirua Assembly Recommendations:

| Theme id (used in the sheet)  | Heading                       | Focus                                     |
| ----------------------------- | ----------------------------- | ----------------------------------------- |
| `Rangatahi`                   | Rangatahi                     | Youth                                     |
| `Weaving Porirua Together`    | Weaving Porirua Together      | Resilient People Network                  |
| `Te Taiao`                    | Te Taiao                      | Our Environment                           |
| `How We Roll`                 | How We Roll                   | Approach & Implementation                 |
| `Know More Do More`           | Know More Do More             | Action Through Education and Awareness    |
| `How Stuff Works`             | How Stuff Works               | Resilient Infrastructure                  |

Events under `How Stuff Works` can optionally set a `subtheme` of `Water`,
`Waste`, `Transport`, `Energy`, or `Health`.

## Run it locally

No build step. Serve the folder (so browsers allow the CSV fetch):

```bash
cd porirua-locality-preview
python3 -m http.server 5173
# or:  npx serve .
```

Then open <http://localhost:5173>.

## Hook it up to a Google Sheet

1. Create a Google Sheet with these columns (first row = headers):

   ```
   name | theme | subtheme | date | time | venue | address | lat | lng | url | description
   ```

   - `theme` must be one of the ids in the table above (exact match).
   - `date` works with any format `new Date()` can parse, e.g. `2026-05-10`.
   - `subtheme` is only used for `How Stuff Works` events (Water/Waste/…).
   - `lat`/`lng` are optional but needed to pin an event on the map.

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
4. Save. The events + map render in the live page with the same data.

For a staging preview inside Squarespace itself, create an **unlinked page**
(Pages → Not Linked) and embed the snippet there first.

## Files

| File | Purpose |
|------|---------|
| `index.html` | Local preview shell. |
| `config.js` | Google Sheet URL, map center, theme definitions. Edit me. |
| `sample-data.js` | Fallback events, used when no sheet URL is set. |
| `map.js` | Rendering logic (map, theme nav, event cards, popups). |
| `squarespace-snippet.html` | Self-contained version to paste into Squarespace. |
| `README.md` | This file. |

## Attribution

Map tiles © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors.
Mapping library: [Leaflet](https://leafletjs.com/).
CSV parser: [PapaParse](https://www.papaparse.com/).
Theme content derived from the Porirua Assembly Recommendations.
