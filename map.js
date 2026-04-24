// Renders the Porirua Locality preview map.
// Reads config from window.PORIRUA_MAP_CONFIG (see config.js).
// Data source: a published Google Sheet CSV, or the built-in sample data.

(function () {
  function ready(fn) {
    if (window.L && window.Papa) return fn();
    setTimeout(function () { ready(fn); }, 50);
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function normaliseRow(row) {
    var name = row.name || row.Name || "";
    var category = row.category || row.Category || "";
    var lat = parseFloat(row.lat || row.latitude || row.Lat || row.Latitude);
    var lng = parseFloat(row.lng || row.longitude || row.Lng || row.Longitude);
    if (!name || isNaN(lat) || isNaN(lng)) return null;
    return {
      name: name,
      category: category,
      lat: lat,
      lng: lng,
      address: row.address || row.Address || "",
      url: row.url || row.URL || row.website || row.Website || "",
      description: row.description || row.Description || "",
    };
  }

  function buildPopup(p) {
    var html = '<div style="max-width:260px;font-family:-apple-system,BlinkMacSystemFont,sans-serif;">';
    html += '<strong style="font-size:14px;line-height:1.3;display:block;margin-bottom:4px;">' + escapeHtml(p.name) + "</strong>";
    if (p.category) {
      html += '<span style="font-size:10px;text-transform:uppercase;letter-spacing:0.05em;color:#6b7280;font-weight:600;">' + escapeHtml(p.category) + "</span>";
    }
    if (p.description) {
      html += '<p style="font-size:13px;line-height:1.5;color:#374151;margin:10px 0 8px;">' + escapeHtml(p.description) + "</p>";
    }
    if (p.address) {
      html += '<p style="font-size:11px;color:#6b7280;margin:0 0 6px;">' + escapeHtml(p.address) + "</p>";
    }
    if (p.url) {
      html += '<a href="' + escapeHtml(p.url) + '" target="_blank" rel="noopener noreferrer" style="font-size:12px;color:#166534;text-decoration:none;font-weight:500;">Learn more &rarr;</a>';
    }
    html += "</div>";
    return html;
  }

  function buildIcon(L, color) {
    return L.divIcon({
      className: "cat-marker",
      html: '<div style="width:28px;height:28px;border-radius:50%;background:' + color + ';border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.25);"></div>',
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });
  }

  function renderLegend(cfg, categoriesSeen) {
    var el = document.getElementById("legend");
    if (!el) return;
    el.innerHTML = "";
    categoriesSeen.forEach(function (cat) {
      var color = cfg.categoryColors[cat] || cfg.defaultColor;
      var span = document.createElement("span");
      span.innerHTML = '<span class="swatch" style="background:' + color + ';"></span>' + escapeHtml(cat);
      el.appendChild(span);
    });
  }

  function renderMap(places) {
    var cfg = window.PORIRUA_MAP_CONFIG || {};
    var L = window.L;
    var status = document.getElementById("status");

    var map = L.map("map", { scrollWheelZoom: false })
      .setView([cfg.center.lat, cfg.center.lng], cfg.zoom || 12);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    var bounds = [];
    var categoriesSeen = [];
    places.forEach(function (p) {
      var color = cfg.categoryColors[p.category] || cfg.defaultColor;
      L.marker([p.lat, p.lng], { icon: buildIcon(L, color) })
        .bindPopup(buildPopup(p), { maxWidth: 280 })
        .addTo(map);
      bounds.push([p.lat, p.lng]);
      if (p.category && categoriesSeen.indexOf(p.category) === -1) {
        categoriesSeen.push(p.category);
      }
    });

    if (bounds.length > 1) {
      map.fitBounds(bounds, { padding: [24, 24], maxZoom: 14 });
    } else if (bounds.length === 1) {
      map.setView(bounds[0], 14);
    }

    renderLegend(cfg, categoriesSeen);
    if (status) status.textContent = "Showing " + places.length + " location" + (places.length === 1 ? "" : "s") + ".";
  }

  function loadFromSheet(csvUrl) {
    return new Promise(function (resolve, reject) {
      window.Papa.parse(csvUrl, {
        download: true,
        header: true,
        skipEmptyLines: true,
        complete: function (results) {
          var places = (results.data || [])
            .map(normaliseRow)
            .filter(Boolean);
          resolve(places);
        },
        error: reject,
      });
    });
  }

  ready(function () {
    var cfg = window.PORIRUA_MAP_CONFIG || {};
    var status = document.getElementById("status");

    function fallbackToSample(reason) {
      if (status) status.textContent = "Using sample data" + (reason ? " (" + reason + ")" : "") + ".";
      renderMap((window.PORIRUA_SAMPLE_DATA || []).map(normaliseRow).filter(Boolean));
    }

    if (cfg.googleSheetCsvUrl) {
      if (status) status.textContent = "Loading data from Google Sheet…";
      loadFromSheet(cfg.googleSheetCsvUrl)
        .then(function (places) {
          if (!places.length) return fallbackToSample("no valid rows found");
          renderMap(places);
        })
        .catch(function (err) {
          console.error("[porirua-preview] Failed to load sheet:", err);
          fallbackToSample("sheet failed to load");
        });
    } else {
      fallbackToSample("no sheet URL set");
    }
  });
})();
