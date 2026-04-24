// Porirua Locality data loader.
// -----------------------------------------------------------------------------
// Single entry point for resolving the organisation inventory, regardless of
// whether it lives in a local CSV file, a published Google Sheet, or the
// embedded `window.PORIRUA_SAMPLE_ORGS` fallback.
//
// Usage (see map.js):
//
//   window.PORIRUA_DATA.load(cfg)
//     .then(function (result) {
//        // result.orgs  -> Array<Organisation>
//        // result.source -> "sheet" | "csv" | "sample"
//        // result.note  -> human-readable status suffix (or "")
//     });
//
// Resolution order:
//   1. If cfg.googleSheetCsvUrl is set, fetch that (Google Sheets CSV export).
//   2. Else fetch cfg.dataCsvUrl (default: "./data/organisations.csv").
//   3. If either of the above fails or returns 0 rows, fall back to the
//      embedded sample (window.PORIRUA_SAMPLE_ORGS). A note is surfaced on
//      the status line so editors know which source rendered.
//
// CSV conventions for array cells (see data/organisations.csv):
//   - `themes`      -> comma-separated   ("Te Taiao, Rangatahi")
//   - `initiatives` -> pipe / semicolon  ("Hui A | Hui B | Hui C")
//   - `labels`      -> pipe / semicolon  ("kai | dignity | Cannons Creek")
//
// This file is a self-contained module. It attaches one object to window:
//   window.PORIRUA_DATA = { load, normaliseRow, splitList, splitThemes, splitLabels }
(function () {
  // ---- split helpers -------------------------------------------------------

  function splitList(s) {
    if (s == null) return [];
    if (Array.isArray(s)) return s.map(function (x) { return String(x).trim(); }).filter(Boolean);
    return String(s).split(/\s*[\n;|]+\s*/).map(function (t) { return t.trim(); }).filter(Boolean);
  }

  function splitThemes(s) {
    if (s == null) return [];
    if (Array.isArray(s)) return s.map(function (x) { return String(x).trim(); }).filter(Boolean);
    return String(s).split(/\s*,\s*/).map(function (t) { return t.trim(); }).filter(Boolean);
  }

  // Labels are free-text tags. We accept any of pipe / semicolon / newline
  // as separators, same as initiatives, so editors don't have to remember
  // two conventions. (We intentionally don't split on commas — label text
  // itself may contain commas.)
  function splitLabels(s) {
    if (s == null) return [];
    if (Array.isArray(s)) return s.map(function (x) { return String(x).trim(); }).filter(Boolean);
    return String(s).split(/\s*[\n;|]+\s*/).map(function (t) { return t.trim(); }).filter(Boolean);
  }

  // ---- row normalisation ---------------------------------------------------

  function get(row, key) {
    if (row[key] != null) return row[key];
    var cap = key[0].toUpperCase() + key.slice(1);
    if (row[cap] != null) return row[cap];
    return "";
  }

  function normaliseRow(row) {
    if (!row || typeof row !== "object") return null;
    var name = String(get(row, "name") || "").trim();
    var primary = String(get(row, "theme") || "").trim();
    if (!name || !primary) return null;

    var extra = splitThemes(get(row, "themes") || row.themes);
    var themes = extra.slice();
    if (themes.indexOf(primary) < 0) themes.unshift(primary);

    var lat = parseFloat(get(row, "lat") || get(row, "latitude"));
    var lng = parseFloat(get(row, "lng") || get(row, "longitude"));

    return {
      name: name,
      theme: primary,
      themes: themes,
      orgType: String(get(row, "orgType") || get(row, "organisationType") || get(row, "orgtype") || "").trim(),
      venue: String(get(row, "venue") || "").trim(),
      address: String(get(row, "address") || "").trim(),
      lat: isNaN(lat) ? null : lat,
      lng: isNaN(lng) ? null : lng,
      url: String(get(row, "url") || get(row, "website") || "").trim(),
      description: String(get(row, "description") || "").trim(),
      initiatives: splitList(get(row, "initiatives") || row.initiatives),
      labels: splitLabels(get(row, "labels") || row.labels),
    };
  }

  function normaliseAll(rows) {
    return (rows || []).map(normaliseRow).filter(Boolean);
  }

  // ---- network fetchers ----------------------------------------------------

  function parseCsv(url) {
    return new Promise(function (resolve, reject) {
      if (!window.Papa) return reject(new Error("PapaParse not loaded"));
      window.Papa.parse(url, {
        download: true,
        header: true,
        skipEmptyLines: true,
        complete: function (res) {
          if (res && res.data) return resolve(res.data);
          reject(new Error("Empty CSV response"));
        },
        error: function (err) { reject(err); },
      });
    });
  }

  // ---- fallback ------------------------------------------------------------

  function sampleRows() {
    return (window.PORIRUA_SAMPLE_ORGS || []).slice();
  }

  // ---- main entry ----------------------------------------------------------

  function load(cfg) {
    cfg = cfg || {};
    var sheetUrl = (cfg.googleSheetCsvUrl || "").trim();
    var csvUrl = (cfg.dataCsvUrl || "./data/organisations.csv").trim();

    var attempts = [];
    if (sheetUrl) attempts.push({ kind: "sheet", url: sheetUrl });
    if (csvUrl) attempts.push({ kind: "csv", url: csvUrl });

    function fallback(note) {
      var orgs = normaliseAll(sampleRows());
      return { orgs: orgs, source: "sample", note: note || "using embedded sample data" };
    }

    function tryNext(i, lastErrorNote) {
      if (i >= attempts.length) return Promise.resolve(fallback(lastErrorNote || ""));
      var step = attempts[i];
      return parseCsv(step.url)
        .then(function (rows) {
          var orgs = normaliseAll(rows);
          if (!orgs.length) return tryNext(i + 1, step.kind + " returned no valid rows");
          var note = "";
          if (step.kind === "sheet") note = "live from Google Sheet";
          return { orgs: orgs, source: step.kind, note: note };
        })
        .catch(function (err) {
          // eslint-disable-next-line no-console
          console.warn("[porirua] " + step.kind + " load failed:", step.url, err);
          return tryNext(i + 1, step.kind + " load failed");
        });
    }

    if (!attempts.length) {
      // No URLs configured at all — shouldn't happen given the default, but
      // we still honour explicit empty config by rendering the sample.
      return Promise.resolve(fallback("no data source configured"));
    }
    return tryNext(0, "");
  }

  window.PORIRUA_DATA = {
    load: load,
    normaliseRow: normaliseRow,
    splitList: splitList,
    splitThemes: splitThemes,
    splitLabels: splitLabels,
  };
})();
