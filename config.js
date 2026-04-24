// Configuration for the Porirua Locality map preview.
// Safe to edit without touching the rest of the site.

window.PORIRUA_MAP_CONFIG = {
  // Paste the "Publish to web" CSV URL from Google Sheets here.
  // File -> Share -> Publish to web -> CSV -> Publish.
  // Leave as "" to use the built-in sample data in sample-data.js.
  googleSheetCsvUrl: "",

  // Initial map view (Porirua city centre).
  center: { lat: -41.1350, lng: 174.8400 },
  zoom: 12,

  // Marker colours per category. Add/adjust as your sheet evolves.
  categoryColors: {
    "Assembly": "#1a3d2a",
    "ROCC":     "#b91c1c",
    "Kai":      "#ca8a04",
    "Hauora":   "#0e7490",
    "Housing":  "#7c3aed",
    "Climate":  "#15803d",
  },

  defaultColor: "#1a3d2a",
};
