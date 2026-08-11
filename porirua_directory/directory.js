import { loadServices } from "./directory-data.js";
import { formatDescription } from "./format-description.mjs";
import {
  buildOrgFromMembers,
  expandNeedFilterLines,
  groupCatalogForDisplay,
  groupForDisplay,
  groupServicesByOrg,
  lineMatchesNeed,
  lineMatchesSearch,
  organizationEntryToDisplayOrg,
} from "./group-services.mjs";
import {
  buildMapPopup,
  buildMapPopupForOrg,
} from "./map-popup.mjs";
import {
  cardFooterHtml,
  telHrefFromPhone,
  websiteLinkHtml,
} from "./contact-links.mjs";
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
  const hay = [
    service.name,
    service.serviceName,
    service.title,
    service.description,
    service.address,
  ]
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
      list = expandNeedFilterLines(list, state.activeNeeds);
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

const needLabelById = Object.fromEntries(
  needCategories.map((n) => [n.id, n.label])
);

function renderCard(service, favoriteIds) {
  const badges = (service.badges ?? [])
    .map((b) => `<span class="badge">${esc(b)}</span>`)
    .join("");
  const orgType = service.orgType
    ? `<span class="badge badge--type">${esc(service.orgType)}</span>`
    : "";
  const callFooter = cardFooterHtml(service.phone, service.url);
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
    ${address}
    ${callFooter}
  </article>`;
}

function serviceLineFields(line) {
  const svc = line.service ?? line;
  return {
    description: svc.description ?? line.description ?? "",
    phone: String(svc.phone ?? line.phone ?? "").trim(),
    url: String(svc.url ?? line.url ?? "").trim(),
  };
}

function serviceRowDetailId(lineId) {
  return `service-detail-${lineId.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
}

function renderServiceRowDetail(line, org) {
  const { description, phone, url } = serviceLineFields(line);
  const orgPhone = String(org.phone ?? "").trim();
  const orgUrl = String(org.url ?? "").trim();
  const showPhone = phone && phone !== orgPhone;
  const showUrl = url && url !== orgUrl;

  const descBlock = description
    ? `<div class="service-row__detail-desc">${formatDescription(description)}</div>`
    : `<p class="service-row__detail-empty">No additional description for this service.</p>`;

  const contactParts = [];
  if (showPhone) {
    contactParts.push(
      `<a href="${esc(telHrefFromPhone(phone))}">${esc(phone)}</a>`
    );
  }
  if (showUrl) {
    contactParts.push(websiteLinkHtml(url));
  }
  const contactBlock = contactParts.length
    ? `<p class="service-row__detail-contact">${contactParts.join(" · ")}</p>`
    : "";

  const catLabels = (line.categories ?? [])
    .map((id) => needLabelById[id])
    .filter(Boolean);
  const catBlock = catLabels.length
    ? `<p class="service-row__detail-cats"><span class="service-row__detail-label">Categories:</span> ${catLabels.map((l) => esc(l)).join(", ")}</p>`
    : "";

  return `${descBlock}${contactBlock}${catBlock}`;
}

function renderServiceRow(line, org, highlight) {
  const needOn = highlight.activeNeeds.size > 0;
  const searchOn = Boolean(highlight.search.trim());
  const matchSearch = lineMatchesSearch(line, org, highlight.search);
  const orgNameMatch =
    searchOn &&
    org.name.toLowerCase().includes(highlight.search.trim().toLowerCase());
  const matchRow = searchOn && (matchSearch || orgNameMatch);
  const dim = searchOn && !matchRow;

  let rowClass = "service-row";
  if (matchRow) rowClass += " service-row--match is-highlighted";
  else if (dim) rowClass += " service-row--dim";

  const catBadges = (line.categories ?? [])
    .map((id) => {
      const label = needLabelById[id];
      if (!label) return "";
      const pillMatch =
        needOn && highlight.activeNeeds.has(id) ? " badge--need-match" : "";
      return `<span class="badge badge--need${pillMatch}">${esc(label)}</span>`;
    })
    .join("");
  const extraBadges = (line.badges ?? [])
    .map((b) => `<span class="badge">${esc(b)}</span>`)
    .join("");

  const ariaCurrent = matchRow ? ' aria-current="true"' : "";
  const detailId = serviceRowDetailId(line.lineId);
  const detailHtml = renderServiceRowDetail(line, org);

  return `<li class="${rowClass}" data-line-id="${esc(line.lineId)}"${ariaCurrent}>
    <button type="button" class="service-row__toggle" aria-expanded="false" aria-controls="${esc(detailId)}" aria-label="${esc(`${line.title} — show details`)}">
      <span class="service-row__main">
        <span class="service-row__title">${esc(line.title)}</span>
        <span class="service-row__meta">${catBadges}${extraBadges}</span>
      </span>
      <span class="service-row__chevron" aria-hidden="true"></span>
    </button>
    <div id="${esc(detailId)}" class="service-row__detail" hidden>${detailHtml}</div>
  </li>`;
}

function toggleServiceRow(toggle) {
  const row = toggle.closest(".service-row");
  const detail = row?.querySelector(".service-row__detail");
  if (!row || !detail) return;
  const expanded = toggle.getAttribute("aria-expanded") === "true";
  const next = !expanded;
  toggle.setAttribute("aria-expanded", next ? "true" : "false");
  row.classList.toggle("service-row--expanded", next);
  if (next) detail.removeAttribute("hidden");
  else detail.setAttribute("hidden", "");
}

function handleServiceRowInteraction(e) {
  const toggle = e.target.closest(".service-row__toggle");
  if (!toggle) return false;
  if (e.type === "click") {
    toggleServiceRow(toggle);
    return true;
  }
  if (e.type === "keydown" && (e.key === " " || e.key === "Enter")) {
    e.preventDefault();
    toggleServiceRow(toggle);
    return true;
  }
  return false;
}

function renderOrgCard(org, favoriteIds, highlight) {
  const orgType = org.orgType
    ? `<span class="badge badge--type">${esc(org.orgType)}</span>`
    : "";
  const orgBadges = (org.badges ?? [])
    .map((b) => `<span class="badge">${esc(b)}</span>`)
    .join("");
  const callFooter = cardFooterHtml(org.phone, org.url);
  const address = org.address
    ? `<p class="card__contact">${esc(org.address)}</p>`
    : "";
  const onList = favoriteIds.has(org.orgId);
  const favAria = onList
    ? `Remove ${org.name} from your list`
    : `Add ${org.name} to your list`;
  const favInner = onList
    ? `${FAV_TRASH_ICON}<span class="card__fav-text">Remove</span>`
    : `<span class="card__fav-text">Add to your list</span>`;
  const favBtn = `<button type="button" class="card__fav${onList ? " is-on-list" : ""}" data-fav-toggle="${esc(org.orgId)}" aria-pressed="${onList ? "true" : "false"}" aria-label="${esc(favAria)}">${favInner}</button>`;

  const rows = org.services
    .map((line) => renderServiceRow(line, org, highlight))
    .join("");

  const safeDomId = org.orgId.replace(/[^a-zA-Z0-9_-]/g, "_");

  return `<article class="card card--org" id="org-${esc(safeDomId)}" data-org-id="${esc(org.orgId)}" data-id="${esc(org.orgId)}">
    <div class="card__head">
      <h3 class="card__title">${esc(org.name)}</h3>
      ${favBtn}
    </div>
    <div class="card__meta">${orgBadges}${orgType}</div>
    ${address}
    <ul class="service-rows" aria-label="Services offered">${rows}</ul>
    ${callFooter}
  </article>`;
}

function renderDisplayItem(item, favoriteIds, highlight) {
  if (item.type === "org") return renderOrgCard(item.org, favoriteIds, highlight);
  return renderCard(item.service, favoriteIds);
}

function focusOrgInResults(orgId) {
  const safeDomId = orgId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const el =
    document.getElementById(`org-${safeDomId}`) ||
    document.querySelector(`[data-org-id="${CSS.escape(orgId)}"]`);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "nearest" });
  el.classList.add("card--focus-ring");
  window.setTimeout(() => el.classList.remove("card--focus-ring"), 2400);
  if (typeof el.focus === "function") {
    if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "-1");
    el.focus({ preventScroll: true });
  }
}

function resolveLegacyFavoriteId(favId, catalogEntries) {
  if (catalogEntries.some((e) => e.id === favId)) return favId;
  if (favId.startsWith("fsd-")) {
    const orgCandidate = `org-${favId.slice(4)}`;
    if (catalogEntries.some((e) => e.id === orgCandidate)) return orgCandidate;
  }
  for (const entry of catalogEntries) {
    if (entry.kind !== "organization") continue;
    if (entry.services?.some((s) => s.id === favId || s.lineId === favId)) {
      return entry.id;
    }
  }
  return favId;
}

function resolveFavoriteDisplayItems(catalogEntries, serviceLines, favoriteIds) {
  const ordered = [];
  const seen = new Set();
  for (let favId of favoriteIds) {
    favId = resolveLegacyFavoriteId(favId, catalogEntries);
    const orgEntry = catalogEntries.find(
      (e) => e.kind === "organization" && e.id === favId
    );
    if (orgEntry && !seen.has(favId)) {
      seen.add(favId);
      ordered.push({
        type: "org",
        org: organizationEntryToDisplayOrg(orgEntry),
      });
      continue;
    }
    const flat = catalogEntries.find((e) => e.kind !== "organization" && e.id === favId);
    if (flat && !seen.has(favId)) {
      seen.add(favId);
      ordered.push({ type: "card", service: flat });
      continue;
    }
    const rows = serviceLines.filter((s) => s.id === favId);
    if (rows.length > 1) {
      const org = buildOrgFromMembers(rows);
      if (!seen.has(org.orgId)) {
        ordered.push({ type: "org", org });
        seen.add(org.orgId);
      }
      continue;
    }
    if (rows.length === 1) {
      ordered.push({ type: "card", service: rows[0] });
      continue;
    }
    const org = groupServicesByOrg(serviceLines).find((o) => o.orgId === favId);
    if (org && !seen.has(org.orgId)) {
      ordered.push({ type: "org", org });
      seen.add(org.orgId);
    }
  }
  return ordered;
}

function displayItemsFromFiltered(catalogEntries, filteredLines) {
  if (catalogEntries.some((e) => e.kind === "organization")) {
    return groupCatalogForDisplay(catalogEntries, filteredLines);
  }
  return groupForDisplay(filteredLines);
}

function mapTargetsFromFiltered(catalogEntries, filtered, activeNeeds, browseMode) {
  const items = displayItemsFromFiltered(catalogEntries, filtered);
  const targets = [];
  for (const item of items) {
    if (item.type === "org") {
      const org = item.org;
      if (org.lat != null && org.lng != null) {
        targets.push({
          key: org.orgId,
          lat: org.lat,
          lng: org.lng,
          popupHtml: buildMapPopupForOrg(org, null, activeNeeds),
          popupFactory: (dist) =>
            buildMapPopupForOrg(org, dist, activeNeeds),
        });
      }
    } else {
      const service = item.service;
      if (service.lat != null && service.lng != null) {
        targets.push({
          key: service.id,
          lat: service.lat,
          lng: service.lng,
          popupHtml: buildMapPopup(service, null, browseMode),
          popupFactory: (dist) => buildMapPopup(service, dist, browseMode),
        });
      }
    }
  }
  return targets;
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
  const findNearMeBtn = document.getElementById("find-near-me");
  const nearMeStatus = document.getElementById("near-me-status");
  const demoTools = document.getElementById("demo-tools");
  const demoLayoutSelect = document.getElementById("demo-layout-select");
  const browseChromeExpand = document.getElementById("browse-chrome-expand");
  const browseSidebarBody = document.querySelector(".browse-sidebar__body");

  const BROWSE_CHROME_EXPAND_SCROLL_Y = 56;
  const BROWSE_CHROME_SCROLL_DELTA = 10;
  const BROWSE_CHROME_DURATION_MS = 360;
  const threeColumnDesktopMq = window.matchMedia("(min-width: 1024px)");
  const browseChromeMotionMq = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  );
  let browseChromeCollapsed = false;
  let browseChromeLastScrollY = 0;
  let browseChromeScrollScheduled = false;

  function isThreeColumnDesktopLayout() {
    return browseLayout === "three-column" && threeColumnDesktopMq.matches;
  }

  function isBrowseChromeScrollCollapseEnabled() {
    return !isThreeColumnDesktopLayout();
  }

  function syncBrowseChromeForViewport() {
    if (!isBrowseChromeScrollCollapseEnabled()) {
      setBrowseChromeCollapsed(false, { force: true });
    }
  }
  let mapResizeFrame = null;
  let mapTransitionResizeHandler = null;

  const demoQuery = parseDemoQuery();
  let browseLayout = applyBrowseLayout(demoQuery.layout);

  const state = {
    mode: null,
    activeNeeds: new Set(),
    activeCommunityFilters: new Set(),
    search: "",
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

  let serviceLines = [];
  let catalogEntries = [];
  try {
    const loaded = await loadServices();
    serviceLines = loaded.serviceLines ?? loaded.services ?? [];
    catalogEntries = loaded.entries ?? serviceLines;
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

  function mapResizeAllowed() {
    if (!map || !mapBlock || mapBlock.hidden) return false;
    if (document.body.dataset.browseChrome === "collapsed") return false;
    return true;
  }

  function runMapResize() {
    mapResizeFrame = null;
    if (!mapResizeAllowed()) return;
    map.invalidateSize();
  }

  function clearMapResizeAfterTransition() {
    if (!mapTransitionResizeHandler) return;
    const { onEnd } = mapTransitionResizeHandler;
    mapBlock?.removeEventListener("transitionend", onEnd);
    browseSidebarBody?.removeEventListener("transitionend", onEnd);
    window.clearTimeout(mapTransitionResizeHandler.fallbackId);
    mapTransitionResizeHandler = null;
  }

  function isMapLayoutTransitionEnd(ev) {
    if (ev.propertyName !== "grid-template-rows") return false;
    const el = ev.target;
    if (el === browseSidebarBody) return true;
    if (!mapBlock?.contains(el)) return false;
    return el.classList.contains("map-block__panel");
  }

  function setMapPaintSuppressed(suppressed) {
    if (!mapBlock || mapBlock.hidden) return;
    mapBlock.classList.toggle("map-block--paint-suppressed", suppressed);
  }

  function finishBrowseChromeExpandLayout() {
    setMapPaintSuppressed(false);
    runMapResize();
  }

  function scheduleMapResize({ afterTransition = false } = {}) {
    if (!map) return;
    if (afterTransition && mapBlock) {
      clearMapResizeAfterTransition();
      const fallbackId = window.setTimeout(
        finishBrowseChromeExpandLayout,
        BROWSE_CHROME_DURATION_MS + 48
      );
      const onEnd = (ev) => {
        if (!isMapLayoutTransitionEnd(ev)) return;
        clearMapResizeAfterTransition();
        finishBrowseChromeExpandLayout();
      };
      mapTransitionResizeHandler = { onEnd, fallbackId };
      mapBlock.addEventListener("transitionend", onEnd);
      browseSidebarBody?.addEventListener("transitionend", onEnd);
      return;
    }
    if (mapResizeFrame != null) cancelAnimationFrame(mapResizeFrame);
    mapResizeFrame = requestAnimationFrame(runMapResize);
  }

  function syncMapLayoutForViewport() {
    if (isThreeColumnDesktopLayout() && map && mapBlock && !mapBlock.hidden) {
      scheduleMapResize({ afterTransition: true });
    }
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

  function distanceKmToTarget(target) {
    if (!state.nearMe || target.lat == null || target.lng == null) return null;
    return haversineKm(state.nearMe.lat, state.nearMe.lng, target.lat, target.lng);
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

  function mapPointsForView(targets) {
    const points = targets.map((t) => [t.lat, t.lng]);
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
    const targets = mapTargetsFromFiltered(
      catalogEntries,
      filtered,
      state.activeNeeds,
      state.mode
    );
    const hasMapData =
      state.nearMe || (filtered.length > 0 && targets.length > 0);
    setMapBlockVisible(hasMapData);

    if (!hasMapData) {
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

    targets.forEach((target) => {
      const dist = distanceKmToTarget(target);
      const nearby = state.nearMe && dist != null && dist <= nearMeRadiusKm;
      const marker = L.circleMarker([target.lat, target.lng], {
        radius: nearby ? 9 : 7,
        ...SERVICE_MARKER_STYLE,
      });
      marker.bindPopup(target.popupFactory(dist), { maxWidth: 320 });
      marker.addTo(markerLayer);
      markersById.set(target.key, marker);
    });

    requestAnimationFrame(() => {
      if (syncGen !== mapSyncGeneration || !map) return;
      scheduleMapResize({ afterTransition: true });
      const viewPoints = mapPointsForView(targets);
      if (viewPoints.length > 0) {
        fitMapToPoints(viewPoints);
      } else if (state.nearMe) {
        map.setView([state.nearMe.lat, state.nearMe.lng], 12);
      }
    });
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
    if (collapsed && !isBrowseChromeScrollCollapseEnabled()) return;
    if (!force && browseChromeCollapsed === collapsed) return;
    browseChromeCollapsed = collapsed;
    if (collapsed) {
      document.body.dataset.browseChrome = "collapsed";
      setMapPaintSuppressed(true);
      clearMapResizeAfterTransition();
      if (mapResizeFrame != null) {
        cancelAnimationFrame(mapResizeFrame);
        mapResizeFrame = null;
      }
    } else {
      delete document.body.dataset.browseChrome;
      if (browseChromeMotionMq.matches || force) {
        setMapPaintSuppressed(false);
      }
    }
    if (browseChromeExpand) {
      browseChromeExpand.hidden = !collapsed;
      browseChromeExpand.setAttribute(
        "aria-expanded",
        collapsed ? "false" : "true"
      );
    }
    if (
      !collapsed &&
      isBrowseChromeScrollCollapseEnabled() &&
      map &&
      mapBlock &&
      !mapBlock.hidden
    ) {
      if (browseChromeMotionMq.matches || force) {
        scheduleMapResize();
      } else {
        scheduleMapResize({ afterTransition: true });
      }
    }
  }

  function resetBrowseChrome() {
    browseChromeLastScrollY = window.scrollY;
    setBrowseChromeCollapsed(false, { force: true });
  }

  function updateBrowseChromeFromScroll() {
    browseChromeScrollScheduled = false;
    if (document.body.dataset.view !== "browse") return;
    if (!isBrowseChromeScrollCollapseEnabled()) {
      setBrowseChromeCollapsed(false);
      browseChromeLastScrollY = window.scrollY;
      return;
    }
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
  threeColumnDesktopMq.addEventListener("change", () => {
    syncBrowseChromeForViewport();
    syncMapLayoutForViewport();
  });
  syncBrowseChromeForViewport();
  syncMapLayoutForViewport();

  function setView(view) {
    document.body.dataset.view = view;
    const landing = view === "landing";
    const mylist = view === "mylist";
    viewLanding.hidden = !landing;
    viewLanding.setAttribute("aria-hidden", landing ? "false" : "true");
    viewBrowse.hidden = landing || mylist;
    if (viewMylist) viewMylist.hidden = !mylist;
    if (siteSubnav) {
      siteSubnav.hidden = true;
      siteSubnav.setAttribute("aria-hidden", "true");
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
    const highlight = {
      activeNeeds: new Set(),
      search: "",
    };
    const items = resolveFavoriteDisplayItems(
      catalogEntries,
      serviceLines,
      favoriteIds
    );
    const hasItems = items.length > 0;
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
        const n = items.length;
        mylistStatus.textContent = `${n} ${n === 1 ? "place" : "places"} saved for this visit`;
      }
      mylistResults.innerHTML = items
        .map((item) => renderDisplayItem(item, favoriteIds, highlight))
        .join("");
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
      clearNearMe();
      clearSearchField();
      closeSearch();
      setView("browse");
    } else {
      state.mode = null;
      state.activeNeeds.clear();
      state.activeCommunityFilters.clear();
      state.search = "";
      clearNearMe();
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
    if (mode) refresh();
  }

  function refresh() {
    if (!state.mode) return;

    let filtered = filterServices(serviceLines, state);
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
      const displayItems = displayItemsFromFiltered(catalogEntries, filtered);
      const highlight = {
        activeNeeds: state.activeNeeds,
        search: state.search,
      };
      let status;
      const matchingLineCount =
        state.activeNeeds.size > 0
          ? filtered.filter((s) => lineMatchesNeed(s, state.activeNeeds)).length
          : filtered.length;
      if (displayItems.length !== filtered.length) {
        status = `${displayItems.length} organisation${displayItems.length === 1 ? "" : "s"} (${matchingLineCount} matching service lines)`;
      } else {
        status = `${filtered.length} listing${filtered.length === 1 ? "" : "s"}`;
      }
      if (state.nearMe) {
        status += ` within ${nearMeRadiusKm} km`;
      }
      statusLine.textContent = status;
      resultsEl.innerHTML = displayItems
        .map((item) => renderDisplayItem(item, favoriteIds, highlight))
        .join("");
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

  window.addEventListener("resize", () => {
    syncBrowseChromeForViewport();
    syncMapLayoutForViewport();
    scheduleMapResize();
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
      refresh();
      setDemoChromeVisible();
      syncBrowseChromeForViewport();
      syncMapLayoutForViewport();
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
              ? "Location was blocked. You can still browse all listings and use the map when it is visible on screen."
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
    if (handleServiceRowInteraction(e)) return;
    if (e.target.closest(".card__call")) return;
    if (e.target.closest(".service-row")) return;
    const card = e.target.closest(".card");
    if (!card || !map) return;
    const marker = markersById.get(card.dataset.id);
    if (marker) {
      map.panTo(marker.getLatLng());
      marker.openPopup();
    }
  });

  document.addEventListener("click", (e) => {
    const scrollBtn = e.target.closest("[data-scroll-to-org]");
    if (!scrollBtn) return;
    e.preventDefault();
    focusOrgInResults(scrollBtn.dataset.scrollToOrg);
    if (map) map.closePopup();
  });

  if (mylistResults) {
    mylistResults.addEventListener("click", (e) => {
      if (handleFavClick(e)) return;
      handleServiceRowInteraction(e);
    });
    mylistResults.addEventListener("keydown", (e) => {
      handleServiceRowInteraction(e);
    });
  }

  resultsEl.addEventListener("keydown", (e) => {
    handleServiceRowInteraction(e);
  });

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
