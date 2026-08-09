import { loadServices } from "./directory-data.js";
import {
  crisisLinks,
  needCategories,
  communityFilters,
  mapDefaults,
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

  if (state.mode === "help") {
    list = list.filter(
      (s) => s.source === "fsd" || (s.categories?.length ?? 0) > 0
    );
    if (state.activeNeeds.size > 0) {
      list = list.filter((s) =>
        s.categories?.some((c) => state.activeNeeds.has(c))
      );
    } else if (!state.search.trim()) {
      return [];
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

function renderCard(service) {
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

  return `<article class="card" data-id="${esc(service.id)}">
    <h3 class="card__title">${esc(service.name)}</h3>
    <div class="card__meta">${badges}${orgType}</div>
    ${service.description ? `<p class="card__desc">${esc(service.description)}</p>` : ""}
    ${address}${phone}${url}
  </article>`;
}

async function main() {
  const crisisEl = document.getElementById("crisis-strip");
  const helpFilters = document.getElementById("filters-help");
  const communityFiltersEl = document.getElementById("filters-community");
  const needChips = document.getElementById("need-chips");
  const communityChips = document.getElementById("community-chips");
  const searchInput = document.getElementById("search-input");
  const statusLine = document.getElementById("status-line");
  const resultsEl = document.getElementById("directory-results");
  const mapEl = document.getElementById("directory-map");

  const state = {
    mode: null,
    activeNeeds: new Set(),
    activeCommunityFilters: new Set(),
    search: "",
  };

  renderCrisis(crisisEl, false);
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
    statusLine.textContent = `Could not load services: ${err.message}`;
    return;
  }

  const L = await waitForLeaflet();
  const map = L.map(mapEl, { scrollWheelZoom: false }).setView(
    [mapDefaults.lat, mapDefaults.lng],
    mapDefaults.zoom
  );
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 18,
  }).addTo(map);

  const markerLayer = L.layerGroup().addTo(map);
  let markersById = new Map();

  function setMode(mode) {
    state.mode = mode;
    state.activeNeeds.clear();
    state.activeCommunityFilters.clear();
    document.querySelectorAll(".browse-entry__btn").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.mode === mode);
    });
    helpFilters.classList.toggle("filters--hidden", mode !== "help");
    communityFiltersEl.classList.toggle(
      "filters--hidden",
      mode !== "community"
    );
    renderCrisis(crisisEl, mode === "help");
    renderChips(needChips, needCategories, state.activeNeeds, "need");
    renderChips(
      communityChips,
      communityFilters,
      state.activeCommunityFilters,
      "community"
    );
    refresh();
  }

  function refresh() {
    const filtered = filterServices(services, state);
    markerLayer.clearLayers();
    markersById = new Map();

    filtered.forEach((service) => {
      if (service.lat == null || service.lng == null) return;
      const marker = L.circleMarker([service.lat, service.lng], {
        radius: 7,
        color: "#60174c",
        fillColor: "#cf2028",
        fillOpacity: 0.85,
        weight: 2,
      });
      marker.bindPopup(`<strong>${esc(service.name)}</strong>`);
      marker.addTo(markerLayer);
      markersById.set(service.id, marker);
    });

    if (filtered.length === 0) {
      if (!state.mode) {
        statusLine.textContent = "Choose how you would like to browse to see results.";
        resultsEl.innerHTML =
          '<p class="empty-state">Pick <strong>I need help</strong> or <strong>Connect with community</strong>, then choose a filter or search.</p>';
      } else if (state.mode === "help" && !state.search.trim() && state.activeNeeds.size === 0) {
        statusLine.textContent = "Choose a need category or type in the search box.";
        resultsEl.innerHTML =
          '<p class="empty-state">Select what you need help with, or search for a service name.</p>';
      } else {
        statusLine.textContent = "No matching services — try another filter or search.";
        resultsEl.innerHTML =
          '<p class="empty-state">Nothing matched. Try clearing filters or broadening your search.</p>';
      }
    } else {
      statusLine.textContent = `${filtered.length} result${filtered.length === 1 ? "" : "s"}`;
      resultsEl.innerHTML = filtered.map(renderCard).join("");
    }

    setTimeout(() => map.invalidateSize(), 0);
  }

  document.querySelectorAll(".browse-entry__btn").forEach((btn) => {
    btn.addEventListener("click", () => setMode(btn.dataset.mode));
  });

  needChips.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-need]");
    if (!btn) return;
    const id = btn.dataset.need;
    if (state.activeNeeds.has(id)) state.activeNeeds.delete(id);
    else state.activeNeeds.add(id);
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
    const card = e.target.closest(".card");
    if (!card) return;
    const marker = markersById.get(card.dataset.id);
    if (marker) {
      map.panTo(marker.getLatLng());
      marker.openPopup();
    }
  });

  refresh();
}

main();
