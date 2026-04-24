// Porirua Locality data loader.
// -----------------------------------------------------------------------------
// Single entry point for resolving the organisation inventory. The data lives
// in a Google Sheet (primary) with the bundled CSV as a fallback.
//
// Usage (see map.js):
//
//   window.PORIRUA_DATA.load(cfg)
//     .then(function (result) {
//        // result.orgs  -> Array<Organisation>   ([] if nothing loaded)
//        // result.source -> "sheet" | "csv" | "none"
//        // result.note  -> human-readable status suffix (or "")
//     });
//
// Resolution order:
//   1. If cfg.googleSheetCsvUrl is set, fetch that (Google Sheets CSV export).
//   2. Fall back to cfg.dataCsvUrl (default: "./data/organisations.csv").
//   3. If both fail, resolve with an empty list + an error note. The map
//      renders an empty state and the status line tells editors what went
//      wrong (see setStatus in map.js). Requires serving over http(s) —
//      opening index.html via file:// will not work.
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

  // ---- main entry ----------------------------------------------------------

  function load(cfg) {
    cfg = cfg || {};
    var sheetUrl = (cfg.googleSheetCsvUrl || "").trim();
    var csvUrl = (cfg.dataCsvUrl || "./data/organisations.csv").trim();

    var attempts = [];
    if (sheetUrl) attempts.push({ kind: "sheet", url: sheetUrl });
    if (csvUrl) attempts.push({ kind: "csv", url: csvUrl });

    function empty(note) {
      return { orgs: [], source: "none", note: note || "no data source configured" };
    }

    function tryNext(i, lastErrorNote) {
      if (i >= attempts.length) {
        return Promise.resolve(empty(lastErrorNote || "could not load organisations"));
      }
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

    if (!attempts.length) return Promise.resolve(empty());
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
