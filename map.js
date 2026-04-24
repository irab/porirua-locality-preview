// Renders the Porirua Locality events-by-recommendation preview.
// Reads config from window.PORIRUA_MAP_CONFIG (see config.js).
// Data: published Google Sheet CSV or window.PORIRUA_SAMPLE_EVENTS.

(function () {
  function ready(fn) {
    if (window.L && window.Papa) return fn();
    setTimeout(function () { ready(fn); }, 50);
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function slug(s) {
    return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  function normaliseRow(row) {
    var get = function (k) { return row[k] || row[k[0].toUpperCase() + k.slice(1)] || ""; };
    var name = get("name");
    var theme = get("theme");
    if (!name || !theme) return null;
    var lat = parseFloat(get("lat") || get("latitude"));
    var lng = parseFloat(get("lng") || get("longitude"));
    return {
      name: name,
      theme: theme,
      subtheme: get("subtheme"),
      date: get("date"),
      time: get("time"),
      venue: get("venue"),
      address: get("address"),
      lat: isNaN(lat) ? null : lat,
      lng: isNaN(lng) ? null : lng,
      url: get("url") || get("website"),
      description: get("description"),
    };
  }

  function parseDate(s) {
    if (!s) return null;
    var d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }

  function formatDateParts(dateStr) {
    var d = parseDate(dateStr);
    if (!d) return { day: "", mon: "", yr: "" };
    return {
      day: String(d.getDate()),
      mon: d.toLocaleString("en-NZ", { month: "short" }),
      yr: String(d.getFullYear()),
    };
  }

  function compareEvents(a, b) {
    var da = parseDate(a.date), db = parseDate(b.date);
    if (da && db) return da - db;
    if (da) return -1;
    if (db) return 1;
    return a.name.localeCompare(b.name);
  }

  function buildIcon(L, color) {
    return L.divIcon({
      className: "cat-marker",
      html: '<div style="width:28px;height:28px;border-radius:50%;background:' + color
          + ';border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.25);"></div>',
      iconSize: [28, 28], iconAnchor: [14, 14],
    });
  }

  function buildPopup(ev, theme) {
    var color = theme ? theme.color : "#60174C";
    var fontBody = '"aktiv-grotesk","Poppins",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif';
    var fontHead = '"Recoleta","DM Serif Display",Georgia,serif';
    var html = '<div style="max-width:280px;font-family:' + fontBody + ';color:#3c1b30;">';
    html += '<span style="display:inline-block;font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:#fff;background:'
          + color + ';padding:3px 9px;border-radius:999px;font-weight:700;margin-bottom:8px;">'
          + esc(theme ? theme.title : ev.theme) + '</span>';
    if (ev.subtheme) html += ' <span style="font-size:10px;color:#8a677a;text-transform:uppercase;letter-spacing:.08em;font-weight:600;">' + esc(ev.subtheme) + '</span>';
    html += '<strong style="font-family:' + fontHead + ';font-size:16px;line-height:1.25;display:block;margin:4px 0 4px;color:#60174C;">' + esc(ev.name) + '</strong>';
    var dateLine = [ev.date, ev.time].filter(Boolean).join(" · ");
    if (dateLine) html += '<div style="font-size:12px;color:#60174C;font-weight:600;margin-top:2px;">' + esc(dateLine) + '</div>';
    if (ev.venue || ev.address) {
      html += '<div style="font-size:12px;color:#8a677a;margin-top:2px;">' + esc([ev.venue, ev.address].filter(Boolean).join(", ")) + '</div>';
    }
    if (ev.description) html += '<p style="font-size:13px;line-height:1.5;color:#3c1b30;margin:10px 0 8px;">' + esc(ev.description) + '</p>';
    if (ev.url) html += '<a href="' + esc(ev.url) + '" target="_blank" rel="noopener noreferrer" style="font-size:12px;color:#cf2028;font-weight:600;text-decoration:none;border-bottom:1px solid currentColor;">Learn more &rarr;</a>';
    html += "</div>";
    return html;
  }

  function renderMap(L, cfg, events, themeById) {
    var map = L.map("map", { scrollWheelZoom: false })
      .setView([cfg.center.lat, cfg.center.lng], cfg.zoom || 12);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    var markers = {};
    var bounds = [];
    events.forEach(function (ev, i) {
      if (ev.lat == null || ev.lng == null) return;
      var theme = themeById[ev.theme];
      var color = theme ? theme.color : cfg.defaultColor;
      var m = L.marker([ev.lat, ev.lng], { icon: buildIcon(L, color) })
        .bindPopup(buildPopup(ev, theme), { maxWidth: 300 })
        .addTo(map);
      markers[i] = m;
      bounds.push([ev.lat, ev.lng]);
    });

    if (bounds.length > 1) map.fitBounds(bounds, { padding: [24, 24], maxZoom: 14 });
    else if (bounds.length === 1) map.setView(bounds[0], 14);

    return { map: map, markers: markers };
  }

  function renderThemeNav(cfg, grouped) {
    var nav = document.getElementById("theme-nav");
    nav.innerHTML = "";
    cfg.themes.forEach(function (t) {
      var n = (grouped[t.id] || []).length;
      var b = document.createElement("button");
      b.type = "button";
      b.innerHTML = '<span class="swatch" style="background:' + t.color + '"></span>'
                  + esc(t.title) + ' <span style="color:#6b7280">(' + n + ')</span>';
      b.onclick = function () {
        var el = document.getElementById("theme-" + slug(t.id));
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      };
      nav.appendChild(b);
    });
  }

  function renderEventList(theme, events, onClickEvent) {
    if (!events.length) {
      return '<ul class="events empty"><li style="padding:14px 18px;">No events yet under this recommendation.</li></ul>';
    }
    var html = '<ul class="events">';
    events.forEach(function (ev, idx) {
      var d = formatDateParts(ev.date);
      var metaParts = [];
      if (ev.time) metaParts.push(esc(ev.time));
      if (ev.venue) metaParts.push(esc(ev.venue));
      if (ev.address) metaParts.push(esc(ev.address));
      html += '<li data-event-index="' + ev.__idx + '">';
      html += '<div class="date"><span class="day">' + esc(d.day) + '</span><span class="mon">' + esc(d.mon) + '</span><span class="yr">' + esc(d.yr) + '</span></div>';
      html += '<div>';
      if (ev.subtheme) {
        html += '<span class="pill" style="background:' + theme.color + '">' + esc(ev.subtheme) + '</span>';
      }
      html += '<span class="title">' + esc(ev.name) + '</span>';
      if (metaParts.length) html += '<div class="meta">' + metaParts.join(" · ") + '</div>';
      if (ev.description) html += '<div class="desc">' + esc(ev.description) + '</div>';
      if (ev.url) html += '<div class="meta" style="margin-top:4px;"><a href="' + esc(ev.url) + '" target="_blank" rel="noopener">Learn more &rarr;</a></div>';
      html += '</div>';
      html += '<div class="chev">&rsaquo;</div>';
      html += '</li>';
    });
    html += '</ul>';
    return html;
  }

  function renderThemes(cfg, grouped, onClickEvent) {
    var root = document.getElementById("themes");
    root.innerHTML = "";
    cfg.themes.forEach(function (t) {
      var events = grouped[t.id] || [];
      var card = document.createElement("article");
      card.className = "theme-card";
      card.id = "theme-" + slug(t.id);
      card.style.setProperty("--theme", t.color);
      var head = '<div class="theme-head" style="border-left-color:' + t.color + '">'
               + '<span class="count">' + events.length + ' event' + (events.length === 1 ? "" : "s") + '</span>'
               + '<h2>' + esc(t.title) + '</h2>'
               + '<div class="sub">' + esc(t.subtitle || "") + '</div>'
               + (t.description ? '<p>' + esc(t.description) + '</p>' : "")
               + '</div>';
      card.innerHTML = head + renderEventList(t, events);
      root.appendChild(card);
    });

    root.addEventListener("click", function (e) {
      var li = e.target.closest("li[data-event-index]");
      if (!li) return;
      var idx = parseInt(li.getAttribute("data-event-index"), 10);
      if (!isNaN(idx)) onClickEvent(idx);
    });
  }

  function groupEvents(cfg, events) {
    var grouped = {};
    cfg.themes.forEach(function (t) { grouped[t.id] = []; });
    // Put events under their theme; drop events with an unrecognised theme into a catch-all.
    events.forEach(function (ev, i) {
      ev.__idx = i;
      if (grouped[ev.theme]) grouped[ev.theme].push(ev);
      else {
        if (!grouped.__other) grouped.__other = [];
        grouped.__other.push(ev);
      }
    });
    Object.keys(grouped).forEach(function (k) { grouped[k].sort(compareEvents); });
    return grouped;
  }

  function wirePdfLinks(cfg) {
    var url = cfg.recommendationsPdfUrl;
    if (!url) return;
    ["recs-pdf-link", "recs-pdf-link-foot"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.href = url;
    });
  }

  function loadFromSheet(csvUrl) {
    return new Promise(function (resolve, reject) {
      window.Papa.parse(csvUrl, {
        download: true, header: true, skipEmptyLines: true,
        complete: function (r) { resolve((r.data || []).map(normaliseRow).filter(Boolean)); },
        error: reject,
      });
    });
  }

  ready(function () {
    var cfg = window.PORIRUA_MAP_CONFIG || {};
    var status = document.getElementById("status");
    var themeById = {};
    (cfg.themes || []).forEach(function (t) { themeById[t.id] = t; });
    wirePdfLinks(cfg);

    function run(events, note) {
      if (!events.length) {
        status.textContent = "No events to display" + (note ? " (" + note + ")" : "") + ".";
      } else {
        status.textContent = "Showing " + events.length + " event" + (events.length === 1 ? "" : "s")
                             + (note ? " (" + note + ")" : "") + ".";
      }
      var grouped = groupEvents(cfg, events);
      var rendered = renderMap(window.L, cfg, events, themeById);
      renderThemeNav(cfg, grouped);
      renderThemes(cfg, grouped, function (idx) {
        var ev = events[idx];
        var m = rendered.markers[idx];
        if (m) {
          rendered.map.setView(m.getLatLng(), 15, { animate: true });
          setTimeout(function () { m.openPopup(); }, 250);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      });
    }

    var fallback = (window.PORIRUA_SAMPLE_EVENTS || []).map(normaliseRow).filter(Boolean);

    if (cfg.googleSheetCsvUrl) {
      status.textContent = "Loading events from Google Sheet…";
      loadFromSheet(cfg.googleSheetCsvUrl)
        .then(function (events) {
          if (!events.length) return run(fallback, "sample data — no valid rows in sheet");
          run(events);
        })
        .catch(function (err) {
          console.error("[porirua-preview] Failed to load sheet:", err);
          run(fallback, "sample data — sheet failed to load");
        });
    } else {
      run(fallback, "sample data — no sheet URL set");
    }
  });
})();
