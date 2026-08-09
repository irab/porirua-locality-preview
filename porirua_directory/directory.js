import { loadServices } from "./directory-data.js";
import { formatDescription } from "./format-description.mjs";
import {
  crisisLinks,
  needCategories,
  communityFilters,
  mapDefaults,
  nearMeRadiusKm,
} from "./config-directory.js";

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function waitForLeaflet() {
  return new Promise((resolve) => {
    const tick = () => {
      if (window.L) resolve(window.L);
      else setTimeout(tick, 40);
    };
    tick();
  });
}

function isSchool(service) {
  return (
    service.communityFilters?.includes("schools") ||
    /school|kura/i.test(service.orgType ?? "")
  );
}

function matchesSearch(service, query) {
  if (!query) return true;
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay = [service.name, service.description, service.address]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

function matchesCommunity(service, activeFilters) {
  const isComm =
    service.source === "community" ||
    (service.communityFilters?.length ?? 0) > 0;
  if (!isComm) return false;
  if (isSchool(service) && !activeFilters.has("schools")) return false;
  if (activeFilters.size === 0) {
    return service.source === "community" && !isSchool(service);
  }
  return service.communityFilters?.some((f) => activeFilters.has(f));
}

function filterServices(services, state) {
  let list = services;

  if (state.mode === "support") {
    list = list.filter(
      (s) => s.source === "fsd" || (s.categories?.length ?? 0) > 0
    );
    if (state.activeNeeds.size > 0) {
      list = list.filter((s) =>
        s.categories?.some((c) => state.activeNeeds.has(c))
      );
    }
  } else if (state.mode === "community") {
    list = list.filter((s) => matchesCommunity(s, state.activeCommunityFilters));
  } else {
    return [];
  }

  if (state.search.trim()) {
    list = list.filter((s) => matchesSearch(s, state.search));
  }
  return list;
}

function renderCrisis(container, emphasis) {
  container.classList.toggle("crisis--emphasis", emphasis);
  const links = crisisLinks
    .map(
      (c) =>
        `<a class="crisis__link" href="${esc(c.href)}" title="${esc(c.description)}">${esc(c.label)}</a>`
    )
    .join("");
  container.innerHTML = `<div class="crisis__inner"><span class="crisis__label">Crisis:</span>${links}</div>`;
}

function renderChips(container, items, activeSet, attr) {
  container.innerHTML = items
    .map(
      (item) =>
        `<button type="button" class="chip${activeSet.has(item.id) ? " is-on" : ""}" data-${attr}="${esc(item.id)}">${esc(item.label)}</button>`
    )
    .join("");
}

const FAV_TRASH_ICON = `<svg class="card__fav-icon" width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" focusable="false"><path d="M5.5 2.5V3h-2v1h11V3h-2v-.5a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1zM3 5v8.5a1.5 1.5 0 0 0 1.5 1.5h7a1.5 1.5 0 0 0 1.5-1.5V5H3zm2.5 2h1v6h-1V7zm3 0h1v6h-1V7z"/></svg>`;

function renderCard(service, favoriteIds) {
  const badges = (service.badges ?? [])
    .map((b) => `<span class="badge">${esc(b)}</span>`)
    .join("");
  const orgType = service.orgType
    ? `<span class="badge badge--type">${esc(service.orgType)}</span>`
    : "";
  const phone = service.phone
    ? `<p class="card__contact"><a href="tel:${esc(service.phone.replace(/\s/g, ""))}">${esc(service.phone)}</a></p>`
    : "";
  const url = service.url
    ? `<p class="card__contact"><a href="${esc(service.url)}" rel="noopener noreferrer">Website</a></p>`
    : "";
  const address = service.address
    ? `<p class="card__contact">${esc(service.address)}</p>`
    : "";
  const onList = favoriteIds.has(service.id);
  const favAria = onList
    ? `Remove ${service.name} from your list`
    : `Add ${service.name} to your list`;
  const favInner = onList
    ? `${FAV_TRASH_ICON}<span class="card__fav-text">Remove</span>`
    : `<span class="card__fav-text">Add to your list</span>`;
  const favBtn = `<button type="button" class="card__fav${onList ? " is-on-list" : ""}" data-fav-toggle="${esc(service.id)}" aria-pressed="${onList ? "true" : "false"}" aria-label="${esc(favAria)}">${favInner}</button>`;

  return `<article class="card" data-id="${esc(service.id)}">
    <div class="card__head">
      <h3 class="card__title">${esc(service.name)}</h3>
      ${favBtn}
    </div>
    <div class="card__meta">${badges}${orgType}</div>
    ${service.description ? `<div class="card__desc">${formatDescription(service.description)}</div>` : ""}
    ${address}${phone}${url}
  </article>`;
}

const needLabelById = Object.fromEntries(
  needCategories.map((n) => [n.id, n.label])
);

const MAP_POPUP_DESC_MAX = 280;

function splitPipeOrSemi(value) {
  return String(value ?? "")
    .split(/[|;]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function truncatePlain(text, maxLen = MAP_POPUP_DESC_MAX) {
  const t = String(text ?? "")
    .trim()
    .replace(/\s+/g, " ");
  if (!t) return "";
  if (t.length <= maxLen) return t;
  const cut = t.slice(0, maxLen).replace(/\s+\S*$/, "");
  return `${cut}…`;
}

function buildMapPopup(service, distKm) {
  const isCommunity =
    service.source === "community" ||
    (service.communityFilters?.length ?? 0) > 0;
  const meta = service.communityMeta;

  let html = '<div class="map-popup">';

  if (service.orgType) {
    html += `<div class="map-popup__pills"><span class="map-popup__pill map-popup__pill--type">${esc(service.orgType)}</span></div>`;
  }

  html += `<div class="map-popup__title">${esc(service.name)}</div>`;

  const categoryLabels = (service.categories ?? [])
    .map((id) => needLabelById[id])
    .filter(Boolean);
  const badgeItems = [...(service.badges ?? []), ...categoryLabels];
  if (badgeItems.length) {
    html += '<div class="map-popup__pills">';
    badgeItems.forEach((label) => {
      html += `<span class="map-popup__pill">${esc(label)}</span>`;
    });
    html += "</div>";
  }

  if (isCommunity && meta?.themes) {
    const themes = String(meta.themes)
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    if (themes.length) {
      html += '<div class="map-popup__pills map-popup__pills--themes">';
      themes.forEach((theme) => {
        html += `<span class="map-popup__pill map-popup__pill--theme">${esc(theme)}</span>`;
      });
      html += "</div>";
    }
  }

  if (service.address) {
    html += `<div class="map-popup__location">${esc(service.address)}</div>`;
  }

  const desc = truncatePlain(service.description);
  if (desc) {
    html += `<p class="map-popup__desc">${esc(desc)}</p>`;
  }

  if (isCommunity && meta?.initiatives) {
    const items = splitPipeOrSemi(meta.initiatives);
    if (items.length) {
      html += '<div class="map-popup__section-label">Key initiatives</div>';
      html += '<ul class="map-popup__list">';
      items.forEach((item) => {
        html += `<li>${esc(item)}</li>`;
      });
      html += "</ul>";
    }
  }

  if (isCommunity && meta?.labels) {
    const labels = splitPipeOrSemi(meta.labels);
    if (labels.length) {
      html += '<div class="map-popup__pills map-popup__pills--labels">';
      labels.forEach((label) => {
        html += `<span class="map-popup__label-chip">${esc(label)}</span>`;
      });
      html += "</div>";
    }
  }

  if (service.phone) {
    const tel = service.phone.replace(/\s/g, "");
    html += `<p class="map-popup__phone"><a href="tel:${esc(tel)}">${esc(service.phone)}</a></p>`;
  }

  if (service.url) {
    html += `<a class="map-popup__link" href="${esc(service.url)}" target="_blank" rel="noopener noreferrer">Visit website →</a>`;
  }

  if (distKm != null) {
    html += `<div class="map-popup__distance">${distKm.toFixed(1)} km away</div>`;
  }

  html += "</div>";
  return html;
}

const FAVORITES_STORAGE_KEY = "porirua-directory-favorites";

function loadFavoriteIds() {
  try {
    const raw = sessionStorage.getItem(FAVORITES_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id) => typeof id === "string" && id.length > 0));
  } catch {
    return new Set();
  }
}

function persistFavoriteIds(ids) {
  sessionStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify([...ids]));
}

function parseHash() {
  const raw = location.hash.replace(/^#/, "").toLowerCase();
  const routePart = raw.split(/[&?]/)[0];
  if (routePart === "mylist") return { kind: "mylist" };
  if (routePart === "support" || routePart === "community")
    return { kind: "browse", mode: routePart };
  return { kind: "landing" };
}

const BROWSE_LAYOUTS = new Set(["default", "top", "three-column"]);

function normalizeBrowseLayout(value) {
  const v = String(value ?? "")
    .trim()
    .toLowerCase();
  if (!v || v === "top" || v === "default") return "default";
  if (v === "three-column" || v === "threecolumn" || v === "3col") return "three-column";
  if (BROWSE_LAYOUTS.has(v)) return v;
  return "default";
}

function parseBrowseLayoutFromHash() {
  const m = location.hash.match(/(?:^|[&#?])layout=([\w-]+)/i);
  return m ? normalizeBrowseLayout(m[1]) : null;
}

function resolveBrowseLayout() {
  const params = new URLSearchParams(location.search);
  if (params.has("layout")) {
    return normalizeBrowseLayout(params.get("layout"));
  }
  const fromHash = parseBrowseLayoutFromHash();
  if (fromHash != null) return fromHash;
  return "three-column";
}

/** Query `layout` value when persisting URL (omit when production default). */
function layoutQueryValue(normalized) {
  if (normalized === "three-column") return null;
  if (normalized === "default") return "top";
  return normalized;
}

function parseDemoQuery() {
  const params = new URLSearchParams(location.search);
  const demo = params.get("demo") === "1";
  const layout = resolveBrowseLayout();
  return { demo, layout };
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function applyBrowseLayout(layout) {
  const normalized = normalizeBrowseLayout(layout);
  if (normalized === "default") {
    delete document.body.dataset.browseLayout;
  } else {
    document.body.dataset.browseLayout = normalized;
  }
  return normalized;
}

function buildUrlWithQuery(updates) {
  const params = new URLSearchParams(location.search);
  Object.entries(updates).forEach(([key, value]) => {
    if (value == null || value === "") params.delete(key);
    else params.set(key, value);
  });
  const q = params.toString();
  return `${location.pathname}${q ? `?${q}` : ""}${location.hash}`;
}

function syncHash(kind, mode) {
  let next = "";
  if (kind === "mylist") next = "#mylist";
  else if (kind === "browse" && mode) next = `#${mode}`;
  if (location.hash !== next) {
    history.replaceState(null, "", `${location.pathname}${location.search}${next}`);
  }
}

async function main() {
  const crisisEl = document.getElementById("crisis-strip");
  const viewLanding = document.getElementById("view-landing");
  const viewBrowse = document.getElementById("view-browse");
  const viewMylist = document.getElementById("view-mylist");
  const siteSubnav = document.getElementById("site-subnav");
  const navMylist = document.getElementById("nav-mylist");
  const mylistBack = document.getElementById("mylist-back");
  const mylistStatus = document.getElementById("mylist-status");
  const mylistResults = document.getElementById("mylist-results");
  const mylistPrint = document.getElementById("mylist-print");
  const backBtn = document.getElementById("back-to-landing");
  const mapBlock = document.getElementById("map-block");
  const supportFilters = document.getElementById("filters-support");
  const communityFiltersEl = document.getElementById("filters-community");
  const needChips = document.getElementById("need-chips");
  const communityChips = document.getElementById("community-chips");
  const searchInput = document.getElementById("search-input");
  const browseSearch = document.getElementById("browse-search");
  const searchToggle = document.getElementById("search-toggle");
  const searchClose = document.getElementById("search-close");
  const browseSearchField = document.getElementById("browse-search-field");
  const statusLine = document.getElementById("status-line");
  const resultsEl = document.getElementById("directory-results");
  const mapEl = document.getElementById("directory-map");
  const showMapCheckbox = document.getElementById("show-map");
  const hideMapBtn = document.getElementById("hide-map-btn");
  const findNearMeBtn = document.getElementById("find-near-me");
  const nearMeStatus = document.getElementById("near-me-status");
  const demoTools = document.getElementById("demo-tools");
  const demoLayoutSelect = document.getElementById("demo-layout-select");
  const browseChromeExpand = document.getElementById("browse-chrome-expand");

  const BROWSE_CHROME_EXPAND_SCROLL_Y = 56;
  const BROWSE_CHROME_SCROLL_DELTA = 10;
  let browseChromeCollapsed = false;
  let browseChromeLastScrollY = 0;
  let browseChromeScrollScheduled = false;

  const demoQuery = parseDemoQuery();
  let browseLayout = applyBrowseLayout(demoQuery.layout);

  const state = {
    mode: null,
    activeNeeds: new Set(),
    activeCommunityFilters: new Set(),
    search: "",
    showMap: false,
    nearMe: null,
  };

  function setSearchOpen(open) {
    if (!browseSearch || !searchToggle || !browseSearchField) return;
    browseSearch.classList.toggle("is-open", open);
    browseSearch.setAttribute("aria-expanded", open ? "true" : "false");
    searchToggle.setAttribute("aria-expanded", open ? "true" : "false");
    searchToggle.hidden = open;
    browseSearchField.hidden = !open;
    browseSearchField.setAttribute("aria-hidden", open ? "false" : "true");
    if (searchInput) {
      searchInput.tabIndex = open ? 0 : -1;
    }
    if (open && searchInput) {
      window.requestAnimationFrame(() => searchInput.focus());
    } else if (!open) {
      searchToggle.hidden = false;
      searchToggle.focus();
    }
  }

  function closeSearch() {
    setSearchOpen(false);
  }

  function openSearch() {
    setBrowseChromeCollapsed(false);
    setSearchOpen(true);
  }

  function clearSearchField() {
    state.search = "";
    if (searchInput) searchInput.value = "";
  }

  const favoriteIds = loadFavoriteIds();

  renderCrisis(crisisEl, true);
  renderChips(needChips, needCategories, state.activeNeeds, "need");
  renderChips(
    communityChips,
    communityFilters,
    state.activeCommunityFilters,
    "community"
  );

  let services = [];
  try {
    const loaded = await loadServices();
    services = loaded.services;
  } catch (err) {
    statusLine.textContent =
      "We couldn’t load the listings. Please refresh the page and try again.";
    return;
  }

  let map = null;
  let markerLayer = null;
  let userMarker = null;
  let userRadiusCircle = null;
  let markersById = new Map();
  let mapSyncGeneration = 0;

  const SERVICE_MARKER_STYLE = {
    color: "#60164c",
    fillColor: "#ce2026",
    fillOpacity: 0.9,
    weight: 2,
  };

  function isThreeColumnDesktop() {
    return (
      browseLayout === "three-column" &&
      window.matchMedia("(min-width: 1024px)").matches
    );
  }

  function syncMapChrome() {
    if (hideMapBtn) {
      const mapVisible = mapBlock && !mapBlock.hidden;
      hideMapBtn.hidden = !(isThreeColumnDesktop() && state.showMap && mapVisible);
    }
  }

  function scheduleMapResize() {
    if (!map) return;
    const run = () => {
      if (!map) return;
      map.invalidateSize();
    };
    requestAnimationFrame(() => {
      run();
      requestAnimationFrame(run);
    });
    window.setTimeout(run, 120);
  }

  function setDemoChromeVisible() {
    const show = demoQuery.demo;
    if (demoTools) demoTools.hidden = !show;
    if (demoLayoutSelect) {
      demoLayoutSelect.value =
        browseLayout === "three-column" ? "three-column" : "default";
    }
  }
  setDemoChromeVisible();

  function updateNearMeUi() {
    if (!findNearMeBtn) return;
    const on = Boolean(state.nearMe);
    findNearMeBtn.classList.toggle("is-on", on);
    findNearMeBtn.setAttribute("aria-pressed", on ? "true" : "false");
    findNearMeBtn.textContent = on
      ? "Near me: on — tap to turn off"
      : "Find support near me";
  }

  function clearNearMe({ hideStatus = true } = {}) {
    state.nearMe = null;
    updateNearMeUi();
    if (hideStatus && nearMeStatus) {
      nearMeStatus.hidden = true;
      nearMeStatus.textContent = "";
    }
  }

  function removeUserMapOverlays() {
    if (userMarker) {
      userMarker.remove();
      userMarker = null;
    }
    if (userRadiusCircle) {
      userRadiusCircle.remove();
      userRadiusCircle = null;
    }
  }

  async function ensureMap() {
    if (map) return;
    const L = await waitForLeaflet();
    map = L.map(mapEl, { scrollWheelZoom: false }).setView(
      [mapDefaults.lat, mapDefaults.lng],
      mapDefaults.zoom
    );
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 18,
    }).addTo(map);
    markerLayer = L.layerGroup().addTo(map);
  }

  function mappableServices(list) {
    return list.filter((s) => s.lat != null && s.lng != null);
  }

  function setMapBlockVisible(visible) {
    mapBlock.hidden = !visible;
    mapBlock.classList.toggle("map-block--hidden", !visible);
    syncMapChrome();
  }

  function distanceKmToService(service) {
    if (!state.nearMe || service.lat == null || service.lng == null) return null;
    return haversineKm(
      state.nearMe.lat,
      state.nearMe.lng,
      service.lat,
      service.lng
    );
  }

  function applyNearMeListFilter(list) {
    if (!state.nearMe) return list;
    return list.filter((s) => {
      const d = distanceKmToService(s);
      return d != null && d <= nearMeRadiusKm;
    });
  }

  function fitMapToPoints(points) {
    if (!map || !window.L || points.length === 0) return;
    const L = window.L;
    if (points.length === 1) {
      map.setView(points[0], 14);
      return;
    }
    const bounds = L.latLngBounds(points);
    map.fitBounds(bounds, { maxZoom: 15, padding: [28, 28] });
  }

  function mapPointsForView(mappable) {
    const points = mappable.map((s) => [s.lat, s.lng]);
    if (state.nearMe) {
      points.push([state.nearMe.lat, state.nearMe.lng]);
    }
    return points;
  }

  function syncUserMapOverlays(L) {
    if (!state.nearMe) {
      removeUserMapOverlays();
      return;
    }
    const { lat, lng } = state.nearMe;
    if (!userMarker) {
      userMarker = L.circleMarker([lat, lng], {
        radius: 9,
        color: "#1a5276",
        fillColor: "#3498db",
        fillOpacity: 0.9,
        weight: 2,
      }).addTo(map);
      userMarker.bindPopup("Your location (this visit only)");
    } else {
      userMarker.setLatLng([lat, lng]);
    }
    if (!userRadiusCircle) {
      userRadiusCircle = L.circle([lat, lng], {
        radius: nearMeRadiusKm * 1000,
        color: "#1a5276",
        fillColor: "#3498db",
        fillOpacity: 0.08,
        weight: 1,
        dashArray: "4 6",
      }).addTo(map);
    } else {
      userRadiusCircle.setLatLng([lat, lng]);
    }
  }

  async function syncMapForFiltered(filtered) {
    const syncGen = ++mapSyncGeneration;
    const mappable = mappableServices(filtered);
    const showMapBlock =
      state.showMap &&
      (state.nearMe || (filtered.length > 0 && mappable.length > 0));
    setMapBlockVisible(showMapBlock);

    if (!showMapBlock) {
      if (markerLayer) {
        markerLayer.clearLayers();
        markersById = new Map();
      }
      removeUserMapOverlays();
      return;
    }

    await ensureMap();
    if (syncGen !== mapSyncGeneration) return;

    markerLayer.clearLayers();
    markersById = new Map();
    const L = window.L;

    syncUserMapOverlays(L);

    mappable.forEach((service) => {
      const dist = distanceKmToService(service);
      const nearby = state.nearMe && dist != null && dist <= nearMeRadiusKm;
      const marker = L.circleMarker([service.lat, service.lng], {
        radius: nearby ? 9 : 7,
        ...SERVICE_MARKER_STYLE,
      });
      marker.bindPopup(buildMapPopup(service, dist), { maxWidth: 320 });
      marker.addTo(markerLayer);
      markersById.set(service.id, marker);
    });

    requestAnimationFrame(() => {
      if (syncGen !== mapSyncGeneration || !map) return;
      scheduleMapResize();
      const viewPoints = mapPointsForView(mappable);
      if (viewPoints.length > 0) {
        fitMapToPoints(viewPoints);
      } else if (state.nearMe) {
        map.setView([state.nearMe.lat, state.nearMe.lng], 12);
      }
    });
    syncMapChrome();
  }

  function updateModeButtons(mode) {
    document.querySelectorAll("[data-mode]").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.mode === mode);
    });
  }

  function updateNavMylistCurrent() {
    if (!navMylist) return;
    const onMylist = document.body.dataset.view === "mylist";
    navMylist.classList.toggle("site-nav__link--current", onMylist);
    if (onMylist) navMylist.setAttribute("aria-current", "page");
    else navMylist.removeAttribute("aria-current");
  }

  function setBrowseChromeCollapsed(collapsed, { force = false } = {}) {
    if (!force && browseChromeCollapsed === collapsed) return;
    browseChromeCollapsed = collapsed;
    if (collapsed) {
      document.body.dataset.browseChrome = "collapsed";
    } else {
      delete document.body.dataset.browseChrome;
    }
    if (browseChromeExpand) {
      browseChromeExpand.hidden = !collapsed;
      browseChromeExpand.setAttribute(
        "aria-expanded",
        collapsed ? "false" : "true"
      );
    }
    if (map && mapBlock && !mapBlock.hidden) {
      scheduleMapResize();
    }
  }

  function resetBrowseChrome() {
    browseChromeLastScrollY = window.scrollY;
    setBrowseChromeCollapsed(false, { force: true });
  }

  function updateBrowseChromeFromScroll() {
    browseChromeScrollScheduled = false;
    if (document.body.dataset.view !== "browse") return;
    if (browseSearch?.classList.contains("is-open")) {
      setBrowseChromeCollapsed(false);
      browseChromeLastScrollY = window.scrollY;
      return;
    }

    const y = window.scrollY;
    const delta = y - browseChromeLastScrollY;
    browseChromeLastScrollY = y;

    if (y <= BROWSE_CHROME_EXPAND_SCROLL_Y) {
      setBrowseChromeCollapsed(false);
      return;
    }
    if (delta > BROWSE_CHROME_SCROLL_DELTA) {
      setBrowseChromeCollapsed(true);
    } else if (delta < -BROWSE_CHROME_SCROLL_DELTA) {
      setBrowseChromeCollapsed(false);
    }
  }

  function onBrowseWindowScroll() {
    if (document.body.dataset.view !== "browse") return;
    if (!browseChromeScrollScheduled) {
      browseChromeScrollScheduled = true;
      requestAnimationFrame(updateBrowseChromeFromScroll);
    }
  }

  window.addEventListener("scroll", onBrowseWindowScroll, { passive: true });

  function setView(view) {
    document.body.dataset.view = view;
    const landing = view === "landing";
    const mylist = view === "mylist";
    viewLanding.hidden = !landing;
    viewBrowse.hidden = landing || mylist;
    if (viewMylist) viewMylist.hidden = !mylist;
    if (siteSubnav) {
      siteSubnav.hidden = !landing;
      siteSubnav.setAttribute("aria-hidden", landing ? "false" : "true");
    }
    if (view !== "browse") {
      resetBrowseChrome();
    } else {
      browseChromeLastScrollY = window.scrollY;
    }
    updateNavMylistCurrent();
  }

  function renderMyList() {
    if (!mylistResults) return;
    const ordered = [...favoriteIds]
      .map((id) => services.find((s) => s.id === id))
      .filter(Boolean);
    const hasItems = ordered.length > 0;
    if (mylistPrint) {
      mylistPrint.hidden = !hasItems;
      mylistPrint.disabled = !hasItems;
    }
    if (!hasItems) {
      if (mylistStatus) mylistStatus.textContent = "";
      mylistResults.innerHTML =
        '<p class="empty-state">Your list is empty. Browse organisations and services, then tap <strong>Add to your list</strong> on any place you want to keep for this visit.</p>';
    } else {
      if (mylistStatus) {
        const n = ordered.length;
        mylistStatus.textContent = `${n} ${n === 1 ? "place" : "places"} saved for this visit`;
      }
      mylistResults.innerHTML = ordered.map((s) => renderCard(s, favoriteIds)).join("");
    }
  }

  function showMyList({ fromHash = false } = {}) {
    setView("mylist");
    if (!fromHash) syncHash("mylist");
    renderMyList();
  }

  function toggleFavorite(id) {
    if (!id) return;
    if (favoriteIds.has(id)) favoriteIds.delete(id);
    else favoriteIds.add(id);
    persistFavoriteIds(favoriteIds);
    const view = document.body.dataset.view;
    if (view === "browse") refresh();
    else if (view === "mylist") renderMyList();
  }

  function handleFavClick(e) {
    const favBtn = e.target.closest("[data-fav-toggle]");
    if (!favBtn) return false;
    toggleFavorite(favBtn.dataset.favToggle);
    return true;
  }

  function setMode(mode, { fromHash = false } = {}) {
    if (mode !== "support" && mode !== "community") {
      mode = null;
    }

    if (mode) {
      state.mode = mode;
      state.activeNeeds.clear();
      state.activeCommunityFilters.clear();
      state.search = "";
      state.showMap = false;
      clearNearMe();
      if (showMapCheckbox) showMapCheckbox.checked = false;
      clearSearchField();
      closeSearch();
      setView("browse");
    } else {
      state.mode = null;
      state.activeNeeds.clear();
      state.activeCommunityFilters.clear();
      state.search = "";
      state.showMap = false;
      clearNearMe();
      if (showMapCheckbox) showMapCheckbox.checked = false;
      clearSearchField();
      closeSearch();
      setView("landing");
      statusLine.textContent = "";
      resultsEl.innerHTML = "";
      setMapBlockVisible(false);
    }

    supportFilters.classList.toggle("filters--hidden", mode !== "support");
    communityFiltersEl.classList.toggle(
      "filters--hidden",
      mode !== "community"
    );
    updateModeButtons(mode);
    renderChips(needChips, needCategories, state.activeNeeds, "need");
    renderChips(
      communityChips,
      communityFilters,
      state.activeCommunityFilters,
      "community"
    );
    if (!fromHash) syncHash(mode ? "browse" : "landing", mode);
    if (mode && browseLayout === "three-column") {
      state.showMap = true;
      if (showMapCheckbox) showMapCheckbox.checked = true;
    }
    if (mode) refresh();
  }

  function refresh() {
    if (!state.mode) return;

    let filtered = filterServices(services, state);
    if (state.nearMe) {
      filtered = applyNearMeListFilter(filtered);
    }
    syncMapForFiltered(filtered);

    if (filtered.length === 0) {
      if (state.nearMe) {
        statusLine.textContent =
          `No Porirua listings with a map location within ${nearMeRadiusKm} km of you — try clearing filters or tap Near me to turn off.`;
        resultsEl.innerHTML =
          `<p class="empty-state">Nothing in this directory within ${nearMeRadiusKm} km of your location. Most listings are in Porirua — turn off <strong>Near me</strong> to browse all places, or clear your filters.</p>`;
      } else {
        statusLine.textContent =
          "Nothing found — try another topic or search.";
        resultsEl.innerHTML =
          '<p class="empty-state">We couldn’t find anything. Try clearing your choices or using a wider search.</p>';
      }
    } else {
      let status = `${filtered.length} listing${filtered.length === 1 ? "" : "s"}`;
      if (state.nearMe) {
        status += ` within ${nearMeRadiusKm} km`;
      }
      statusLine.textContent = status;
      resultsEl.innerHTML = filtered.map((s) => renderCard(s, favoriteIds)).join("");
    }
  }

  document.querySelectorAll("[data-mode]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (document.body.dataset.view === "browse") return;
      setMode(btn.dataset.mode);
    });
  });

  backBtn.addEventListener("click", () => setMode(null));

  if (mylistBack) {
    mylistBack.addEventListener("click", () => setMode(null));
  }

  function setPrintingMylist(on) {
    document.body.classList.toggle("printing-mylist", on);
  }

  window.addEventListener("beforeprint", () => {
    if (document.body.dataset.view === "mylist") setPrintingMylist(true);
  });
  window.addEventListener("afterprint", () => setPrintingMylist(false));

  if (mylistPrint) {
    mylistPrint.addEventListener("click", () => {
      if (document.body.dataset.view !== "mylist") return;
      setPrintingMylist(true);
      window.print();
    });
  }

  if (showMapCheckbox) {
    showMapCheckbox.addEventListener("change", () => {
      state.showMap = showMapCheckbox.checked;
      refresh();
    });
  }

  if (hideMapBtn) {
    hideMapBtn.addEventListener("click", () => {
      state.showMap = false;
      if (showMapCheckbox) showMapCheckbox.checked = false;
      refresh();
    });
  }

  window.addEventListener("resize", () => {
    syncMapChrome();
    if (map && mapBlock && !mapBlock.hidden) scheduleMapResize();
  });

  if (demoLayoutSelect) {
    demoLayoutSelect.addEventListener("change", () => {
      const next = normalizeBrowseLayout(demoLayoutSelect.value);
      browseLayout = applyBrowseLayout(next);
      const layoutParam = layoutQueryValue(next);
      history.replaceState(
        null,
        "",
        buildUrlWithQuery({ demo: demoQuery.demo ? "1" : null, layout: layoutParam })
      );
      if (next === "three-column" && !state.showMap) {
        state.showMap = true;
        if (showMapCheckbox) showMapCheckbox.checked = true;
      }
      refresh();
      setDemoChromeVisible();
      scheduleMapResize();
    });
  }

  if (findNearMeBtn) {
    findNearMeBtn.addEventListener("click", () => {
      if (!demoQuery.demo) return;
      if (state.nearMe) {
        clearNearMe();
        refresh();
        return;
      }
      if (!navigator.geolocation) {
        if (nearMeStatus) {
          nearMeStatus.hidden = false;
          nearMeStatus.textContent =
            "Your browser doesn’t support location. Use search or the map instead.";
        }
        return;
      }
      if (nearMeStatus) {
        nearMeStatus.hidden = false;
        nearMeStatus.textContent = "Requesting your location…";
      }
      findNearMeBtn.disabled = true;
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          findNearMeBtn.disabled = false;
          state.nearMe = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracyM: pos.coords.accuracy,
          };
          state.showMap = true;
          if (showMapCheckbox) showMapCheckbox.checked = true;
          updateNearMeUi();
          if (nearMeStatus) {
            nearMeStatus.hidden = false;
            let msg = `Showing places within ${nearMeRadiusKm} km of you. Location is not saved.`;
            const acc = pos.coords.accuracy;
            if (typeof acc === "number" && acc > 5000) {
              msg += ` Your device reported low accuracy (about ${Math.round(acc / 1000)} km) — results may not match where you are.`;
            }
            nearMeStatus.textContent = msg;
          }
          refresh();
        },
        (err) => {
          findNearMeBtn.disabled = false;
          clearNearMe({ hideStatus: false });
          const msg =
            err.code === err.PERMISSION_DENIED
              ? "Location was blocked. You can still browse all listings and use Show map."
              : "We couldn’t get your location. Try again or browse without near me.";
          if (nearMeStatus) {
            nearMeStatus.hidden = false;
            nearMeStatus.textContent = msg;
          }
          refresh();
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    });
  }

  needChips.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-need]");
    if (!btn) return;
    const id = btn.dataset.need;
    if (state.activeNeeds.has(id)) {
      state.activeNeeds.clear();
    } else {
      state.activeNeeds.clear();
      state.activeNeeds.add(id);
    }
    renderChips(needChips, needCategories, state.activeNeeds, "need");
    refresh();
  });

  communityChips.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-community]");
    if (!btn) return;
    const id = btn.dataset.community;
    if (state.activeCommunityFilters.has(id)) state.activeCommunityFilters.delete(id);
    else state.activeCommunityFilters.add(id);
    renderChips(
      communityChips,
      communityFilters,
      state.activeCommunityFilters,
      "community"
    );
    refresh();
  });

  if (searchInput) {
    searchInput.tabIndex = -1;
    searchInput.addEventListener("input", () => {
      state.search = searchInput.value;
      refresh();
    });

    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeSearch();
      }
    });
  }

  if (searchToggle) {
    searchToggle.addEventListener("click", () => {
      if (browseSearch?.classList.contains("is-open")) {
        closeSearch();
      } else {
        openSearch();
      }
    });
  }

  if (searchClose) {
    searchClose.addEventListener("click", () => {
      closeSearch();
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || !browseSearch?.classList.contains("is-open")) return;
    if (e.target === searchInput) return;
    closeSearch();
  });

  resultsEl.addEventListener("click", (e) => {
    if (handleFavClick(e)) return;
    const card = e.target.closest(".card");
    if (!card || !map) return;
    const marker = markersById.get(card.dataset.id);
    if (marker) {
      map.panTo(marker.getLatLng());
      marker.openPopup();
    }
  });

  if (mylistResults) {
    mylistResults.addEventListener("click", (e) => {
      handleFavClick(e);
    });
  }

  browseChromeExpand?.addEventListener("click", () => {
    setBrowseChromeCollapsed(false);
    browseChromeExpand.blur();
  });

  window.addEventListener("hashchange", () => {
    const route = parseHash();
    if (route.kind === "mylist") {
      showMyList({ fromHash: true });
    } else if (route.kind === "browse") {
      setMode(route.mode, { fromHash: true });
    } else if (state.mode) {
      setMode(null, { fromHash: true });
    } else if (document.body.dataset.view === "mylist") {
      setView("landing");
    }
  });

  const initialRoute = parseHash();
  if (initialRoute.kind === "mylist") {
    showMyList({ fromHash: true });
  } else if (initialRoute.kind === "browse") {
    setMode(initialRoute.mode, { fromHash: true });
  } else {
    setView("landing");
  }
}

main();
