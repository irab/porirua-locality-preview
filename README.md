# Porirua Locality — Map Preview

A tiny, zero-backend preview site for a community map intended for the
[Porirua Locality](https://reindeer-avocado-974t.squarespace.com/) Squarespace site
(Te Wāhi Tiaki Tātou).

It renders a [Leaflet](https://leafletjs.com/) map of community initiatives — driven
either by a published Google Sheet or by built-in sample data — using the same
visual language that will eventually be pasted into Squarespace as a Code Block.

## Run it locally

No build step. Open `index.html` in a browser, or serve the folder so browsers
don't complain about `file://` fetches:

```bash
# Python 3
python3 -m http.server 5173
# or
npx serve .
```

Then visit <http://localhost:5173>.

## Hook it up to a Google Sheet

1. Create a Google Sheet with these columns (first row = headers):

   ```
   name | category | lat | lng | address | url | description
   ```

2. In Google Sheets: **File → Share → Publish to web → CSV → Publish**.
   Copy the resulting URL (ends with `output=csv`).

3. Open `config.js` and paste the URL:

   ```js
   googleSheetCsvUrl: "https://docs.google.com/spreadsheets/d/e/XXXXX/pub?output=csv",
   ```

4. Refresh the page. Status text at the bottom will tell you whether the sheet
   loaded or the sample data is being used.

Updates to the sheet show up within a few minutes (Google caches the published
CSV). Editors don't need any code access.

## Publishing to Squarespace

Once the preview looks right, use `squarespace-snippet.html`:

1. In Squarespace, edit the target page and add a **Code** block (requires the
   Business plan or higher).
2. Paste the contents of `squarespace-snippet.html`.
3. Edit the `GOOGLE_SHEET_CSV_URL` constant at the top to match your sheet.
4. Save. The map renders inside the live Squarespace page with the same data.

For a staging preview inside Squarespace itself, create an **unlinked page**
(Pages → Not Linked) and embed the snippet there first.

## Files

| File | Purpose |
|------|---------|
| `index.html` | Local preview shell. |
| `config.js` | Google Sheet URL + marker colours. Edit me. |
| `sample-data.js` | Fallback data used when no sheet URL is set. |
| `map.js` | Leaflet rendering logic. |
| `squarespace-snippet.html` | Self-contained version to paste into Squarespace. |

## Attribution

Map tiles © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors.
Mapping library: [Leaflet](https://leafletjs.com/).
CSV parser: [PapaParse](https://www.papaparse.com/).
