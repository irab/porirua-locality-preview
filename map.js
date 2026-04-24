// Renders the Porirua Locality organisation inventory, grouped by Porirua
// Assembly recommendation with two filter bars (recommendation + org type).
// Reads config from window.PORIRUA_MAP_CONFIG (see config.js).
// Data resolution is delegated to window.PORIRUA_DATA.load (see data-loader.js):
//   Google Sheet CSV  >  local ./data/organisations.csv.
// If both fail the page renders an empty state with an explanatory status line.

(function () {
  function ready(fn) {
    if (window.L && window.Papa && window.PORIRUA_DATA) return fn();
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

  // hex ("#rrggbb") -> "rgba(r,g,b,a)". Used to tint filter chips with a
  // muted shade of the org-type colour so the legend reads at a glance.
  function tint(hex, alpha) {
    var h = String(hex || "").replace("#", "");
    if (h.length !== 6) return "rgba(96,23,76," + alpha + ")";
    var r = parseInt(h.slice(0, 2), 16);
    var g = parseInt(h.slice(2, 4), 16);
    var b = parseInt(h.slice(4, 6), 16);
    return "rgba(" + r + "," + g + "," + b + "," + alpha + ")";
  }

  function svgIcon(iconKey, color, size, strokeWidth) {
    var inner = (window.PORIRUA_ICONS || {})[iconKey];
    if (!inner) return "";
    var sw = strokeWidth || 2;
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size
         + '" viewBox="0 0 24 24" fill="none" stroke="' + color + '" stroke-width="' + sw
         + '" stroke-linecap="round" stroke-linejoin="round">' + inner + '</svg>';
  }

  // Marker: one colour + one icon per organisation TYPE, so the same kind
  // of organisation (e.g. all schools) shares a single marker style on the
  // map. The recommendation mix shows up through the theme chips in the
  // card + popup, not the marker.
  function buildIcon(L, orgType) {
    var color = orgType && orgType.color ? orgType.color : "#60174C";
    var inner = orgType && orgType.icon ? svgIcon(orgType.icon, "#fff", 18, 2.2) : "";
    var html =
      '<div style="width:36px;height:36px;border-radius:50%;background:' + color
      + ';border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;">'
      + inner + '</div>';
    return L.divIcon({
      className: "org-marker",
      html: html,
      iconSize: [36, 36], iconAnchor: [18, 18],
    });
  }

  function buildPopup(org, themeById, orgType) {
    // Accent colour follows the organisation TYPE so the whole popup reads
    // as a coherent unit with the marker + card badge.
    var color = orgType && orgType.color ? orgType.color : "#60174C";
    var fontBody = '"aktiv-grotesk","Poppins",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif';
    var fontHead = '"Recoleta","DM Serif Display",Georgia,serif';

    var html = '<div style="max-width:300px;font-family:' + fontBody + ';color:#3c1b30;">';

    // Org type pill — wrapped in its own block so it always sits on its
    // own row above the heading (inline-flex on the pill alone isn't enough
    // to guarantee a line break when followed by a heavy heading).
    if (orgType) {
      html += '<div style="margin:0 0 8px;">'
            + '<span style="display:inline-flex;align-items:center;gap:5px;font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:#fff;background:'
            + orgType.color + ';padding:3px 9px;border-radius:999px;font-weight:700;">'
            + svgIcon(orgType.icon, "#fff", 11, 2) + esc(orgType.title) + '</span>'
            + '</div>';
    }

    html += '<div style="font-family:' + fontHead + ';font-size:17px;line-height:1.25;margin:0 0 8px;color:#60174C;font-weight:700;">' + esc(org.name) + '</div>';

    // Theme chips — one per recommendation the org contributes to.
    if (org.themes && org.themes.length) {
      html += '<div style="display:flex;flex-wrap:wrap;gap:4px;margin:4px 0 6px;">';
      org.themes.forEach(function (tid) {
        var t = themeById[tid];
        if (!t) return;
        html += '<span style="display:inline-flex;align-items:center;gap:4px;font-size:9.5px;text-transform:uppercase;letter-spacing:.08em;color:#fff;background:'
              + t.color + ';padding:2px 7px;border-radius:999px;font-weight:700;">'
              + svgIcon(t.icon, "#fff", 10, 2.2) + esc(t.title) + '</span>';
      });
      html += '</div>';
    }

    if (org.venue || org.address) {
      html += '<div style="font-size:12px;color:#8a677a;margin-top:2px;">' + esc([org.venue, org.address].filter(Boolean).join(", ")) + '</div>';
    }

    if (org.description) {
      html += '<p style="font-size:13px;line-height:1.5;color:#3c1b30;margin:10px 0 6px;">' + esc(org.description) + '</p>';
    }

    if (org.initiatives && org.initiatives.length) {
      html += '<div style="font-size:10.5px;text-transform:uppercase;letter-spacing:.08em;color:' + color + ';font-weight:700;margin-top:8px;margin-bottom:3px;">Key initiatives</div>';
      html += '<ul style="margin:0;padding-left:18px;font-size:12.5px;line-height:1.45;color:#3c1b30;">';
      org.initiatives.forEach(function (it) { html += '<li>' + esc(it) + '</li>'; });
      html += '</ul>';
    }

    if (org.labels && org.labels.length) {
      html += '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:10px;">';
      org.labels.forEach(function (label) {
        html += '<span style="font-size:10px;color:#60174C;background:#f3d7d3;padding:2px 8px;border-radius:999px;font-weight:600;letter-spacing:.02em;">'
              + esc(label) + '</span>';
      });
      html += '</div>';
    }

    if (org.url) {
      html += '<a href="' + esc(org.url) + '" target="_blank" rel="noopener noreferrer" style="display:inline-block;margin-top:10px;font-size:12px;color:#cf2028;font-weight:600;text-decoration:none;border-bottom:1px solid currentColor;">Visit website &rarr;</a>';
    }

    html += "</div>";
    return html;
  }

  function initMap(L, cfg) {
    var map = L.map("map", { scrollWheelZoom: false })
      .setView([cfg.center.lat, cfg.center.lng], cfg.zoom || 12);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);
    var layer = L.layerGroup().addTo(map);
    return { map: map, layer: layer, markersByIdx: {} };
  }

  function buildTooltip(org) {
    return '<div class="org-tooltip-inner">'
         + '<div class="org-tooltip-name">' + esc(org.name) + '</div>'
         + '<div class="org-tooltip-hint">Click to see more</div>'
         + '</div>';
  }

  function populateMap(L, cfg, mapCtx, orgs, themeById, orgTypeById) {
    mapCtx.layer.clearLayers();
    mapCtx.markersByIdx = {};
    var bounds = [];
    orgs.forEach(function (org) {
      if (org.lat == null || org.lng == null) return;
      var orgType = orgTypeById[org.orgType];
      var m = L.marker([org.lat, org.lng], { icon: buildIcon(L, orgType) })
        .bindPopup(buildPopup(org, themeById, orgType), { maxWidth: 320 })
        .bindTooltip(buildTooltip(org), {
          direction: "top",
          offset: [0, -18],
          opacity: 1,
          className: "org-tooltip",
        });
      mapCtx.layer.addLayer(m);
      mapCtx.markersByIdx[org.__idx] = m;
      bounds.push([org.lat, org.lng]);
    });
    // maxZoom 16 lets tightly-clustered orgs (e.g. the three council venues
    // all in central Porirua) actually separate on screen when filtered.
    // Leaflet still picks a lower zoom when markers are genuinely spread
    // out, so this only bites the clustered case.
    if (bounds.length > 1) mapCtx.map.fitBounds(bounds, { padding: [24, 24], maxZoom: 16 });
    else if (bounds.length === 1) mapCtx.map.setView(bounds[0], 15);
    else mapCtx.map.setView([cfg.center.lat, cfg.center.lng], cfg.zoom || 12);
  }

  function renderChip(item, stateSet, onChange, opts) {
    var tinted = !!(opts && opts.tinted);
    var b = document.createElement("button");
    b.type = "button";
    b.className = "filter-chip" + (tinted ? " tinted" : "");
    b.setAttribute("data-key", item.id);
    var active = stateSet.has(item.id);
    if (tinted) {
      // Border only — no tinted fill. The coloured border matches the
      // marker colour (legend cue) while the white fill preserves the
      // "this is a clickable filter" affordance.
      b.style.setProperty("--chip-border", tint(item.color, 0.55));
      b.style.setProperty("--chip-border-hover", tint(item.color, 0.9));
    }
    if (active) {
      b.classList.add("active");
      b.style.background = item.color;
      b.style.borderColor = item.color;
    }
    var iconColor = active ? "#fff" : item.color;
    b.innerHTML = '<span class="filter-chip-icon">' + svgIcon(item.icon, iconColor, 14, 2) + '</span>'
                + '<span class="filter-chip-label">' + esc(item.title) + '</span>';
    b.onclick = function () {
      if (stateSet.has(item.id)) stateSet.delete(item.id);
      else stateSet.add(item.id);
      onChange();
    };
    return b;
  }

  function renderFilters(cfg, state, onChange) {
    var root = document.getElementById("filters");
    if (!root) return;
    root.innerHTML = "";

    function bar(labelText, items, stateSet, opts) {
      var wrap = document.createElement("div");
      wrap.className = "filter-bar";
      var label = document.createElement("span");
      label.className = "filter-label";
      label.textContent = labelText;
      wrap.appendChild(label);
      var chips = document.createElement("div");
      chips.className = "filter-chips";
      items.forEach(function (it) { chips.appendChild(renderChip(it, stateSet, onChange, opts)); });
      wrap.appendChild(chips);
      return wrap;
    }

    root.appendChild(bar("Filter by recommendation", cfg.themes || [], state.themes));
    var orgTypes = window.PORIRUA_ORG_TYPES || [];
    if (orgTypes.length) root.appendChild(bar("Filter by organisation", orgTypes, state.orgs, { tinted: true }));

    if (state.themes.size + state.orgs.size > 0) {
      var clear = document.createElement("button");
      clear.type = "button";
      clear.className = "filter-clear";
      clear.textContent = "Clear all filters";
      clear.onclick = function () { state.themes.clear(); state.orgs.clear(); onChange(); };
      root.appendChild(clear);
    }
  }

  // Build a {themeId: [orgs]} map.
  // - If `activeThemes` is empty, each org is placed under its primary theme.
  // - Otherwise, each active theme section lists every org whose `themes`
  //   array contains that theme (orgs can appear in multiple sections when
  //   they cross-cut the selected filters).
  function groupOrgs(cfg, orgs, activeThemes) {
    var grouped = {};
    cfg.themes.forEach(function (t) { grouped[t.id] = []; });
    if (activeThemes && activeThemes.size) {
      orgs.forEach(function (org) {
        org.themes.forEach(function (tid) {
          if (activeThemes.has(tid) && grouped[tid]) grouped[tid].push(org);
        });
      });
    } else {
      orgs.forEach(function (org) {
        if (grouped[org.theme]) grouped[org.theme].push(org);
      });
    }
    Object.keys(grouped).forEach(function (k) {
      grouped[k].sort(function (a, b) { return a.name.localeCompare(b.name); });
    });
    return grouped;
  }

  function renderOrgList(orgs, themeById, orgTypeById) {
    if (!orgs.length) {
      return '<ul class="orgs empty"><li>No organisations match the current filters.</li></ul>';
    }
    var html = '<ul class="orgs">';
    orgs.forEach(function (org) {
      var orgType = orgTypeById[org.orgType];
      var orgColor = orgType ? orgType.color : "#8a677a";
      html += '<li data-org-index="' + org.__idx + '">';
      html += '<div class="org-badge" style="background:' + orgColor + '">'
           + (orgType ? svgIcon(orgType.icon, "#fff", 22, 2) : "")
           + '</div>';
      html += '<div class="org-body">';

      // Top row: org-type pill + cross-cutting theme chips
      var pills = "";
      if (orgType) {
        pills += '<span class="pill org" style="background:' + orgType.color + '">'
               + '<span class="pill-icon">' + svgIcon(orgType.icon, "#fff", 11, 2) + '</span>'
               + esc(orgType.title) + '</span>';
      }
      (org.themes || []).forEach(function (tid) {
        var t = themeById[tid];
        if (!t) return;
        pills += '<span class="pill theme" style="background:' + t.color + '">'
               + '<span class="pill-icon">' + svgIcon(t.icon, "#fff", 10, 2.2) + '</span>'
               + esc(t.title) + '</span>';
      });
      if (pills) html += '<div class="pills">' + pills + '</div>';

      html += '<div class="title">' + esc(org.name) + '</div>';

      var loc = [org.venue, org.address].filter(Boolean).join(" · ");
      if (loc) html += '<div class="meta">' + esc(loc) + '</div>';
      if (org.description) html += '<div class="desc">' + esc(org.description) + '</div>';

      if (org.initiatives && org.initiatives.length) {
        html += '<div class="initiatives-label" style="color:' + orgColor + '">Key initiatives</div>';
        html += '<ul class="initiatives">';
        org.initiatives.forEach(function (it) { html += '<li>' + esc(it) + '</li>'; });
        html += '</ul>';
      }

      if (org.labels && org.labels.length) {
        html += '<div class="labels">';
        org.labels.forEach(function (label) {
          html += '<span class="label-chip">' + esc(label) + '</span>';
        });
        html += '</div>';
      }

      if (org.url) {
        html += '<div class="meta" style="margin-top:6px;"><a href="' + esc(org.url) + '" target="_blank" rel="noopener">Visit website &rarr;</a></div>';
      }

      html += '</div>';
      html += '<div class="chev">&rsaquo;</div>';
      html += '</li>';
    });
    html += '</ul>';
    return html;
  }

  function renderThemes(cfg, grouped, themeById, orgTypeById, onClickOrg, hiddenThemes) {
    var root = document.getElementById("themes");
    root.innerHTML = "";
    cfg.themes.forEach(function (t) {
      if (hiddenThemes && hiddenThemes.has(t.id)) return;
      var orgs = grouped[t.id] || [];
      var card = document.createElement("article");
      card.className = "theme-card";
      card.id = "theme-" + slug(t.id);
      card.style.setProperty("--theme", t.color);
      var badge = t.icon
        ? '<div class="theme-badge" style="background:' + t.color + '">' + svgIcon(t.icon, "#fff", 22, 2) + '</div>'
        : "";
      var head = '<div class="theme-head" style="border-left-color:' + t.color + '">'
               + '<span class="count">' + orgs.length + ' organisation' + (orgs.length === 1 ? "" : "s") + '</span>'
               + badge
               + '<div class="theme-head-text">'
               + '<h2>' + esc(t.title) + '</h2>'
               + '<div class="sub">' + esc(t.subtitle || "") + '</div>'
               + (t.description ? '<p>' + esc(t.description) + '</p>' : "")
               + '</div>'
               + '</div>';
      card.innerHTML = head + renderOrgList(orgs, themeById, orgTypeById);
      root.appendChild(card);
    });

    root.onclick = function (e) {
      var li = e.target.closest("li[data-org-index]");
      if (!li) return;
      var idx = parseInt(li.getAttribute("data-org-index"), 10);
      if (!isNaN(idx)) onClickOrg(idx);
    };
  }

  function wirePdfLinks(cfg) {
    var url = cfg.recommendationsPdfUrl;
    if (!url) return;
    ["recs-pdf-link", "recs-pdf-link-foot"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.href = url;
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
    var allOrgs = [];
    var mapCtx = null;

    function matchesFilters(org) {
      if (state.themes.size) {
        var hit = false;
        var ts = org.themes || [];
        for (var i = 0; i < ts.length; i++) {
          if (state.themes.has(ts[i])) { hit = true; break; }
        }
        if (!hit) return false;
      }
      if (state.orgs.size && !state.orgs.has(org.orgType)) return false;
      return true;
    }

    function setStatus(visibleCount, totalCount) {
      if (!totalCount) {
        status.textContent = "No organisations to display" + (state.note ? " (" + state.note + ")" : "") + ".";
        return;
      }
      var parts = [];
      if (visibleCount === totalCount) {
        parts.push("Showing all " + totalCount + " organisation" + (totalCount === 1 ? "" : "s"));
      } else {
        parts.push("Showing " + visibleCount + " of " + totalCount + " organisations");
      }
      var filters = [];
      if (state.themes.size) filters.push(state.themes.size + " recommendation" + (state.themes.size === 1 ? "" : "s"));
      if (state.orgs.size) filters.push(state.orgs.size + " organisation type" + (state.orgs.size === 1 ? "" : "s"));
      if (filters.length) parts.push("filtered by " + filters.join(" and "));
      if (state.note) parts.push("(" + state.note + ")");
      status.textContent = parts.join(" — ") + ".";
    }

    function refresh() {
      var visible = allOrgs.filter(matchesFilters);
      var grouped = groupOrgs(cfg, visible, state.themes);
      var hiddenThemes = null;
      if (state.themes.size) {
        hiddenThemes = new Set();
        cfg.themes.forEach(function (t) { if (!state.themes.has(t.id)) hiddenThemes.add(t.id); });
      }
      populateMap(window.L, cfg, mapCtx, visible, themeById, orgTypeById);
      renderFilters(cfg, state, refresh);
      renderThemes(cfg, grouped, themeById, orgTypeById, function (idx) {
        var m = mapCtx.markersByIdx[idx];
        if (m) {
          mapCtx.map.setView(m.getLatLng(), 15, { animate: true });
          setTimeout(function () { m.openPopup(); }, 250);
          var mapEl = document.getElementById("map");
          if (mapEl) mapEl.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, hiddenThemes);
      setStatus(visible.length, allOrgs.length);
    }

    function bootstrap(orgs, note) {
      state.note = note || "";
      allOrgs = orgs.map(function (o, i) { o.__idx = i; return o; });
      mapCtx = initMap(window.L, cfg);
      refresh();
    }

    status.textContent = cfg.googleSheetCsvUrl
      ? "Loading organisations from Google Sheet…"
      : "Loading organisations…";

    window.PORIRUA_DATA.load(cfg).then(function (result) {
      bootstrap(result.orgs, result.note);
    }).catch(function (err) {
      console.error("[porirua-preview] data loader failed:", err);
      bootstrap([], "data loader crashed — check the console");
    });
  });
})();
