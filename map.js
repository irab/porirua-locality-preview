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

  // Render a Lucide-style stroked SVG for the given icon key.
  function svgIcon(iconKey, color, size, strokeWidth) {
    var inner = (window.PORIRUA_ICONS || {})[iconKey];
    if (!inner) return "";
    var sw = strokeWidth || 2;
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size
         + '" viewBox="0 0 24 24" fill="none" stroke="' + color + '" stroke-width="' + sw
         + '" stroke-linecap="round" stroke-linejoin="round">' + inner + '</svg>';
  }

  function subthemeIcon(subtheme, color, size) {
    var key = (window.PORIRUA_SUBTHEME_ICONS || {})[subtheme];
    if (!key) return "";
    return svgIcon(key, color, size || 14, 2);
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
      orgType: get("orgType") || get("organisationType") || get("orgtype") || "",
      orgName: get("orgName") || get("organisation") || get("organization") || "",
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

  function buildIcon(L, color, theme) {
    var iconHtml = theme && theme.icon ? svgIcon(theme.icon, "#fff", 18, 2.2) : "";
    var inner =
      '<div style="width:36px;height:36px;border-radius:50%;background:' + color
      + ';border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;">'
      + iconHtml + '</div>';
    return L.divIcon({
      className: "cat-marker",
      html: inner,
      iconSize: [36, 36], iconAnchor: [18, 18],
    });
  }

  function buildPopup(ev, theme, orgType) {
    var color = theme ? theme.color : "#60174C";
    var fontBody = '"aktiv-grotesk","Poppins",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif';
    var fontHead = '"Recoleta","DM Serif Display",Georgia,serif';
    var html = '<div style="max-width:290px;font-family:' + fontBody + ';color:#3c1b30;">';
    var themeIcon = theme && theme.icon ? svgIcon(theme.icon, "#fff", 11, 2.2) : "";
    html += '<span style="display:inline-flex;align-items:center;gap:5px;font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:#fff;background:'
          + color + ';padding:3px 9px;border-radius:999px;font-weight:700;margin-bottom:8px;vertical-align:middle;">'
          + themeIcon + esc(theme ? theme.title : ev.theme) + '</span>';
    if (ev.subtheme) {
      var sIcon = subthemeIcon(ev.subtheme, "#8a677a", 11);
      html += ' <span style="display:inline-flex;align-items:center;gap:4px;font-size:10px;color:#8a677a;text-transform:uppercase;letter-spacing:.08em;font-weight:600;vertical-align:middle;">'
            + sIcon + esc(ev.subtheme) + '</span>';
    }
    html += '<strong style="font-family:' + fontHead + ';font-size:16px;line-height:1.25;display:block;margin:4px 0 4px;color:#60174C;">' + esc(ev.name) + '</strong>';
    if (orgType || ev.orgName) {
      var oIcon = orgType && orgType.icon ? svgIcon(orgType.icon, orgType.color, 11, 2) : "";
      var parts = [];
      if (orgType) parts.push(esc(orgType.title));
      if (ev.orgName) parts.push(esc(ev.orgName));
      html += '<div style="font-size:11px;color:#8a677a;margin-top:2px;display:flex;align-items:center;gap:5px;">'
            + oIcon + '<span>' + parts.join(" · ") + '</span></div>';
    }
    var dateLine = [ev.date, ev.time].filter(Boolean).join(" · ");
    if (dateLine) html += '<div style="font-size:12px;color:#60174C;font-weight:600;margin-top:6px;">' + esc(dateLine) + '</div>';
    if (ev.venue || ev.address) {
      html += '<div style="font-size:12px;color:#8a677a;margin-top:2px;">' + esc([ev.venue, ev.address].filter(Boolean).join(", ")) + '</div>';
    }
    if (ev.description) html += '<p style="font-size:13px;line-height:1.5;color:#3c1b30;margin:10px 0 8px;">' + esc(ev.description) + '</p>';
    if (ev.url) html += '<a href="' + esc(ev.url) + '" target="_blank" rel="noopener noreferrer" style="font-size:12px;color:#cf2028;font-weight:600;text-decoration:none;border-bottom:1px solid currentColor;">Learn more &rarr;</a>';
    html += "</div>";
    return html;
  }

  // Initialise the map once; return helpers that let us re-populate markers.
  function initMap(L, cfg) {
    var map = L.map("map", { scrollWheelZoom: false })
      .setView([cfg.center.lat, cfg.center.lng], cfg.zoom || 12);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    var layer = L.layerGroup().addTo(map);
    return { map: map, layer: layer };
  }

  function populateMap(L, cfg, mapCtx, events, themeById, orgTypeById) {
    mapCtx.layer.clearLayers();
    mapCtx.markersByIdx = {};
    var bounds = [];
    events.forEach(function (ev) {
      if (ev.lat == null || ev.lng == null) return;
      var theme = themeById[ev.theme];
      var orgType = orgTypeById[ev.orgType];
      var color = theme ? theme.color : cfg.defaultColor;
      var m = L.marker([ev.lat, ev.lng], { icon: buildIcon(L, color, theme) })
        .bindPopup(buildPopup(ev, theme, orgType), { maxWidth: 310 });
      mapCtx.layer.addLayer(m);
      mapCtx.markersByIdx[ev.__idx] = m;
      bounds.push([ev.lat, ev.lng]);
    });
    if (bounds.length > 1) mapCtx.map.fitBounds(bounds, { padding: [24, 24], maxZoom: 14 });
    else if (bounds.length === 1) mapCtx.map.setView(bounds[0], 14);
    else mapCtx.map.setView([cfg.center.lat, cfg.center.lng], cfg.zoom || 12);
  }

  // Render a filter chip. `item` needs {id,title,icon,color}. Toggles `state` on click.
  function renderChip(item, state, onChange) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "filter-chip";
    b.setAttribute("data-key", item.id);
    var active = state.has(item.id);
    if (active) {
      b.classList.add("active");
      b.style.background = item.color;
      b.style.borderColor = item.color;
    }
    var iconColor = active ? "#fff" : item.color;
    b.innerHTML = '<span class="filter-chip-icon">' + svgIcon(item.icon, iconColor, 14, 2) + '</span>'
                + '<span class="filter-chip-label">' + esc(item.title) + '</span>';
    b.onclick = function () {
      if (state.has(item.id)) state.delete(item.id);
      else state.add(item.id);
      onChange();
    };
    return b;
  }

  function renderFilters(cfg, state, onChange) {
    var root = document.getElementById("filters");
    if (!root) return;
    root.innerHTML = "";

    function bar(labelText, items, stateSet) {
      var wrap = document.createElement("div");
      wrap.className = "filter-bar";
      var label = document.createElement("span");
      label.className = "filter-label";
      label.textContent = labelText;
      wrap.appendChild(label);
      var chips = document.createElement("div");
      chips.className = "filter-chips";
      items.forEach(function (it) { chips.appendChild(renderChip(it, stateSet, onChange)); });
      wrap.appendChild(chips);
      return wrap;
    }

    root.appendChild(bar("Filter by recommendation", cfg.themes || [], state.themes));
    var orgTypes = window.PORIRUA_ORG_TYPES || [];
    if (orgTypes.length) root.appendChild(bar("Filter by organisation", orgTypes, state.orgs));

    // Clear-filters bar: only shown if any filter is active.
    var hasFilters = state.themes.size + state.orgs.size > 0;
    if (hasFilters) {
      var clear = document.createElement("button");
      clear.type = "button";
      clear.className = "filter-clear";
      clear.textContent = "Clear all filters";
      clear.onclick = function () { state.themes.clear(); state.orgs.clear(); onChange(); };
      root.appendChild(clear);
    }
  }

  function renderEventList(theme, events, orgTypeById) {
    if (!events.length) {
      return '<ul class="events empty"><li style="padding:14px 18px;">No events match the current filters.</li></ul>';
    }
    var html = '<ul class="events">';
    events.forEach(function (ev) {
      var d = formatDateParts(ev.date);
      var metaParts = [];
      if (ev.time) metaParts.push(esc(ev.time));
      if (ev.venue) metaParts.push(esc(ev.venue));
      if (ev.address) metaParts.push(esc(ev.address));
      var orgType = orgTypeById[ev.orgType];
      html += '<li data-event-index="' + ev.__idx + '">';
      html += '<div class="date"><span class="day">' + esc(d.day) + '</span><span class="mon">' + esc(d.mon) + '</span><span class="yr">' + esc(d.yr) + '</span></div>';
      html += '<div>';
      var pills = "";
      if (ev.subtheme) {
        var sIcon = subthemeIcon(ev.subtheme, "#fff", 11);
        pills += '<span class="pill" style="background:' + theme.color + '">'
               + (sIcon ? '<span class="pill-icon">' + sIcon + '</span>' : '')
               + esc(ev.subtheme) + '</span>';
      }
      if (orgType) {
        pills += '<span class="pill org" style="background:' + orgType.color + '">'
               + '<span class="pill-icon">' + svgIcon(orgType.icon, "#fff", 11, 2) + '</span>'
               + esc(orgType.title) + '</span>';
      }
      if (pills) html += pills;
      html += '<span class="title">' + esc(ev.name) + '</span>';
      if (ev.orgName) html += '<div class="meta org-name">' + esc(ev.orgName) + '</div>';
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

  function renderThemes(cfg, grouped, orgTypeById, onClickEvent, hiddenThemes) {
    var root = document.getElementById("themes");
    root.innerHTML = "";
    cfg.themes.forEach(function (t) {
      if (hiddenThemes && hiddenThemes.has(t.id)) return;
      var events = grouped[t.id] || [];
      var card = document.createElement("article");
      card.className = "theme-card";
      card.id = "theme-" + slug(t.id);
      card.style.setProperty("--theme", t.color);
      var badge = t.icon
        ? '<div class="theme-badge" style="background:' + t.color + '">' + svgIcon(t.icon, "#fff", 22, 2) + '</div>'
        : "";
      var head = '<div class="theme-head" style="border-left-color:' + t.color + '">'
               + '<span class="count">' + events.length + ' event' + (events.length === 1 ? "" : "s") + '</span>'
               + badge
               + '<div class="theme-head-text">'
               + '<h2>' + esc(t.title) + '</h2>'
               + '<div class="sub">' + esc(t.subtitle || "") + '</div>'
               + (t.description ? '<p>' + esc(t.description) + '</p>' : "")
               + '</div>'
               + '</div>';
      card.innerHTML = head + renderEventList(t, events, orgTypeById);
      root.appendChild(card);
    });

    root.onclick = function (e) {
      var li = e.target.closest("li[data-event-index]");
      if (!li) return;
      var idx = parseInt(li.getAttribute("data-event-index"), 10);
      if (!isNaN(idx)) onClickEvent(idx);
    };
  }

  function groupEvents(cfg, events) {
    var grouped = {};
    cfg.themes.forEach(function (t) { grouped[t.id] = []; });
    events.forEach(function (ev) {
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
    var orgTypeById = {};
    (window.PORIRUA_ORG_TYPES || []).forEach(function (o) { orgTypeById[o.id] = o; });
    wirePdfLinks(cfg);

    var state = { themes: new Set(), orgs: new Set(), note: "" };
    var allEvents = [];
    var mapCtx = null;

    function matchesFilters(ev) {
      if (state.themes.size && !state.themes.has(ev.theme)) return false;
      if (state.orgs.size && !state.orgs.has(ev.orgType)) return false;
      return true;
    }

    function setStatus(visibleCount, totalCount) {
      var parts = [];
      if (!totalCount) {
        status.textContent = "No events to display" + (state.note ? " (" + state.note + ")" : "") + ".";
        return;
      }
      if (visibleCount === totalCount) {
        parts.push("Showing all " + totalCount + " event" + (totalCount === 1 ? "" : "s"));
      } else {
        parts.push("Showing " + visibleCount + " of " + totalCount + " events");
      }
      var filters = [];
      if (state.themes.size) filters.push(state.themes.size + " recommendation" + (state.themes.size === 1 ? "" : "s"));
      if (state.orgs.size) filters.push(state.orgs.size + " organisation type" + (state.orgs.size === 1 ? "" : "s"));
      if (filters.length) parts.push("filtered by " + filters.join(" and "));
      if (state.note) parts.push("(" + state.note + ")");
      status.textContent = parts.join(" — ") + ".";
    }

    function refresh() {
      var visible = allEvents.filter(matchesFilters);
      var grouped = groupEvents(cfg, visible);

      // If a theme filter is active, hide non-selected theme cards entirely.
      var hiddenThemes = null;
      if (state.themes.size) {
        hiddenThemes = new Set();
        cfg.themes.forEach(function (t) { if (!state.themes.has(t.id)) hiddenThemes.add(t.id); });
      }

      populateMap(window.L, cfg, mapCtx, visible, themeById, orgTypeById);
      renderFilters(cfg, state, refresh);
      renderThemes(cfg, grouped, orgTypeById, function (idx) {
        var m = mapCtx.markersByIdx[idx];
        if (m) {
          mapCtx.map.setView(m.getLatLng(), 15, { animate: true });
          setTimeout(function () { m.openPopup(); }, 250);
          var mapEl = document.getElementById("map");
          if (mapEl) mapEl.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, hiddenThemes);
      setStatus(visible.length, allEvents.length);
    }

    function bootstrap(events, note) {
      state.note = note || "";
      allEvents = events.map(function (ev, i) { ev.__idx = i; return ev; });
      mapCtx = initMap(window.L, cfg);
      refresh();
    }

    var fallback = (window.PORIRUA_SAMPLE_EVENTS || []).map(normaliseRow).filter(Boolean);

    if (cfg.googleSheetCsvUrl) {
      status.textContent = "Loading events from Google Sheet…";
      loadFromSheet(cfg.googleSheetCsvUrl)
        .then(function (events) {
          if (!events.length) return bootstrap(fallback, "sample data — no valid rows in sheet");
          bootstrap(events);
        })
        .catch(function (err) {
          console.error("[porirua-preview] Failed to load sheet:", err);
          bootstrap(fallback, "sample data — sheet failed to load");
        });
    } else {
      bootstrap(fallback, "sample data — no sheet URL set");
    }
  });
})();
