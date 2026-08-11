import { needCategories } from "./config-directory.js";
import { lineMatchesNeed } from "./group-services.mjs";
import {
  mapPopupContactStripHtml,
} from "./contact-links.mjs";

const needLabelById = Object.fromEntries(
  needCategories.map((n) => [n.id, n.label])
);

const MAP_POPUP_DESC_MAX = 280;

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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

/**
 * Community browse path shows org-type pill (and filter/category pills in badges).
 * Assembly themes, initiatives, and label chips stay in data only — not in popups.
 */
export function mapPopupShowsCommunityChrome(service, browseMode) {
  if (browseMode !== "community") return false;
  return (
    service.source === "community" ||
    (service.communityFilters?.length ?? 0) > 0
  );
}

export function buildMapPopup(service, distKm, browseMode = "support") {
  const showCommunity = mapPopupShowsCommunityChrome(service, browseMode);

  let html = '<div class="map-popup">';

  if (showCommunity && service.orgType) {
    html += `<div class="map-popup__pills"><span class="map-popup__pill map-popup__pill--type">${esc(service.orgType)}</span></div>`;
  }

  html += `<div class="map-popup__title">${esc(service.name)}</div>`;

  const categoryLabels = (service.categories ?? [])
    .map((id) => needLabelById[id])
    .filter(Boolean);
  const badgeItems = showCommunity
    ? [...(service.badges ?? []), ...categoryLabels]
    : service.source === "fsd"
      ? [...(service.badges ?? []), ...categoryLabels]
      : [...categoryLabels];
  if (badgeItems.length) {
    html += '<div class="map-popup__pills">';
    badgeItems.forEach((label) => {
      html += `<span class="map-popup__pill">${esc(label)}</span>`;
    });
    html += "</div>";
  }

  if (service.address) {
    html += `<div class="map-popup__location">${esc(service.address)}</div>`;
  }

  const desc = truncatePlain(service.description);
  if (desc) {
    html += `<p class="map-popup__desc">${esc(desc)}</p>`;
  }

  html += mapPopupContactStripHtml(service.phone, service.url);

  if (distKm != null) {
    html += `<div class="map-popup__distance">${distKm.toFixed(1)} km away</div>`;
  }

  html += "</div>";
  return html;
}

function titleDuplicatesOrgName(title, orgName) {
  const t = String(title ?? "").trim().toLowerCase();
  const n = String(orgName ?? "").trim().toLowerCase();
  return t && n && t === n;
}

function orgPopupTeaserLines(org, activeNeeds) {
  const pick = (titles) =>
    titles
      .filter((title) => !titleDuplicatesOrgName(title, org.name))
      .slice(0, 2);

  if (activeNeeds.size > 0) {
    const matching = org.services
      .filter((l) => lineMatchesNeed(l, activeNeeds))
      .map((l) => l.title);
    const filtered = pick(matching);
    if (filtered.length) return filtered;
  }
  return pick(org.services.map((l) => l.title));
}

/** Compact org pin popup — no Connections Map org-type or theme pills. */
export function buildMapPopupForOrg(org, distKm, activeNeeds) {
  let html = '<div class="map-popup map-popup--org">';
  html += `<div class="map-popup__title">${esc(org.name)}</div>`;

  if (org.address) {
    html += `<div class="map-popup__location">${esc(org.address)}</div>`;
  }

  const teasers = orgPopupTeaserLines(org, activeNeeds);
  if (teasers.length) {
    html += `<p class="map-popup__desc">${esc(teasers.join(" · "))}</p>`;
  }

  html += mapPopupContactStripHtml(org.phone, org.url);

  html += `<p class="map-popup__actions"><button type="button" class="map-popup__view-in-list" data-scroll-to-org="${esc(org.orgId)}">View in list</button></p>`;

  if (distKm != null) {
    html += `<div class="map-popup__distance">${distKm.toFixed(1)} km away</div>`;
  }

  html += "</div>";
  return html;
}
