import { needCategories } from "./config-directory.js";
import { lineMatchesNeed } from "./group-services.mjs";

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

function orgPopupTeaserLines(org, activeNeeds) {
  const lines = org.services.map((l) => l.title);
  if (activeNeeds.size > 0) {
    const matching = org.services
      .filter((l) => lineMatchesNeed(l, activeNeeds))
      .map((l) => l.title);
    if (matching.length) return matching.slice(0, 2);
  }
  return lines.slice(0, 2);
}

/** Compact org pin popup — no Connections Map org-type or theme pills. */
export function buildMapPopupForOrg(org, distKm, activeNeeds) {
  const n = org.services.length;
  let html = '<div class="map-popup map-popup--org">';
  html += `<div class="map-popup__title">${esc(org.name)}</div>`;
  html += `<div class="map-popup__count">${n} service${n === 1 ? "" : "s"} at this location</div>`;

  if (org.address) {
    html += `<div class="map-popup__location">${esc(org.address)}</div>`;
  }

  const teasers = orgPopupTeaserLines(org, activeNeeds);
  if (teasers.length) {
    html += `<p class="map-popup__desc">${esc(teasers.join(" · "))}</p>`;
  }

  if (org.phone) {
    const tel = org.phone.replace(/\s/g, "");
    html += `<p class="map-popup__phone"><a href="tel:${esc(tel)}">${esc(org.phone)}</a></p>`;
  }

  html += `<button type="button" class="map-popup__scroll-to-list" data-scroll-to-org="${esc(org.orgId)}">View in list</button>`;

  if (org.url) {
    html += `<a class="map-popup__link" href="${esc(org.url)}" target="_blank" rel="noopener noreferrer">Visit website →</a>`;
  }

  if (distKm != null) {
    html += `<div class="map-popup__distance">${distKm.toFixed(1)} km away</div>`;
  }

  html += "</div>";
  return html;
}
