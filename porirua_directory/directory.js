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

function parseDemoQuery() {
  const params = new URLSearchParams(location.search);
  const demo = params.get("demo") === "1";
  const fromQuery = params.get("layout");
  const layout = normalizeBrowseLayout(fromQuery ?? parseBrowseLayoutFromHash());
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
  const statusLine = document.getElementById("status-line");
  const resultsEl = document.getElementById("directory-results");
  const mapEl = document.getElementById("directory-map");
  const showMapCheckbox = document.getElementById("show-map");
  const findNearMeBtn = document.getElementById("find-near-me");
  const nearMeStatus = document.getElementById("near-me-status");
  const demoLayoutWrap = document.getElementById("demo-layout-wrap");
  const demoLayoutSelect = document.getElementById("demo-layout-select");

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
  let markersById = new Map();

  function setDemoChromeVisible() {
    const show = demoQuery.demo;
    if (findNearMeBtn) findNearMeBtn.hidden = !show;
    if (demoLayoutWrap) demoLayoutWrap.hidden = !show;
    if (demoLayoutSelect) {
      demoLayoutSelect.value =
        browseLayout === "three-column" ? "three-column" : "default";
    }
  }
  setDemoChromeVisible();

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

  async function syncMapForFiltered(filtered) {
    const mappable = mappableServices(filtered);
    const showMapBlock =
      state.showMap && filtered.length > 0 && mappable.length > 0;
    setMapBlockVisible(showMapBlock);

    if (!showMapBlock) {
      if (markerLayer) {
        markerLayer.clearLayers();
        markersById = new Map();
      }
      if (userMarker) {
        userMarker.remove();
        userMarker = null;
      }
      return;
    }

    await ensureMap();
    markerLayer.clearLayers();
    markersById = new Map();
    const L = window.L;

    if (state.nearMe) {
      if (!userMarker) {
        userMarker = L.circleMarker([state.nearMe.lat, state.nearMe.lng], {
          radius: 9,
          color: "#1a5276",
          fillColor: "#3498db",
          fillOpacity: 0.9,
          weight: 2,
        }).addTo(map);
        userMarker.bindPopup("Your location (this visit only)");
      } else {
        userMarker.setLatLng([state.nearMe.lat, state.nearMe.lng]);
      }
      map.setView([state.nearMe.lat, state.nearMe.lng], 13);
    }

    mappable.forEach((service) => {
      const dist = distanceKmToService(service);
      const nearby = state.nearMe && dist != null && dist <= nearMeRadiusKm;
      const marker = L.circleMarker([service.lat, service.lng], {
        radius: nearby ? 9 : 7,
        color: nearby ? "#60164c" : "#888",
        fillColor: nearby ? "#ce2026" : "#bbb",
        fillOpacity: nearby ? 0.9 : 0.55,
        weight: nearby ? 2 : 1,
      });
      const distLabel =
        dist != null ? `<br><span>${dist.toFixed(1)} km away</span>` : "";
      marker.bindPopup(`<strong>${esc(service.name)}</strong>${distLabel}`);
      marker.addTo(markerLayer);
      markersById.set(service.id, marker);
    });
    setTimeout(() => map.invalidateSize(), 0);
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
      state.nearMe = null;
      if (showMapCheckbox) showMapCheckbox.checked = false;
      if (nearMeStatus) {
        nearMeStatus.hidden = true;
        nearMeStatus.textContent = "";
      }
      searchInput.value = "";
      setView("browse");
    } else {
      state.mode = null;
      state.activeNeeds.clear();
      state.activeCommunityFilters.clear();
      state.search = "";
      state.showMap = false;
      state.nearMe = null;
      if (showMapCheckbox) showMapCheckbox.checked = false;
      if (nearMeStatus) {
        nearMeStatus.hidden = true;
        nearMeStatus.textContent = "";
      }
      searchInput.value = "";
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
    if (mode && demoQuery.demo && browseLayout === "three-column") {
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
          `No listings with a map location within ${nearMeRadiusKm} km — try clearing filters or turning off near-me.`;
      } else {
        statusLine.textContent =
          "Nothing found — try another topic or search.";
      }
      resultsEl.innerHTML =
        '<p class="empty-state">We couldn’t find anything. Try clearing your choices or using a wider search.</p>';
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

  showMapCheckbox.addEventListener("change", () => {
    state.showMap = showMapCheckbox.checked;
    refresh();
  });

  if (demoLayoutSelect) {
    demoLayoutSelect.addEventListener("change", () => {
      const next = normalizeBrowseLayout(demoLayoutSelect.value);
      browseLayout = applyBrowseLayout(next);
      const layoutParam = next === "default" ? null : next;
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
      setTimeout(() => {
        if (map) map.invalidateSize();
      }, 0);
    });
  }

  if (findNearMeBtn) {
    findNearMeBtn.addEventListener("click", () => {
      if (!demoQuery.demo) return;
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
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          state.nearMe = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          };
          state.showMap = true;
          if (showMapCheckbox) showMapCheckbox.checked = true;
          if (nearMeStatus) {
            nearMeStatus.textContent = `Showing places within ${nearMeRadiusKm} km of you. Location is not saved.`;
          }
          refresh();
        },
        (err) => {
          state.nearMe = null;
          const msg =
            err.code === err.PERMISSION_DENIED
              ? "Location was blocked. You can still browse and use Show map."
              : "We couldn’t get your location. Try again or browse without near-me.";
          if (nearMeStatus) {
            nearMeStatus.hidden = false;
            nearMeStatus.textContent = msg;
          }
          refresh();
        },
        { enableHighAccuracy: false, timeout: 12000, maximumAge: 60000 }
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

  searchInput.addEventListener("input", () => {
    state.search = searchInput.value;
    refresh();
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
