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

/**
 * Connections Map chrome (org type, Assembly themes, initiatives, label chips)
 * belongs on the community browse path only — not on Find support popups.
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
  const meta = service.communityMeta;

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

  if (showCommunity && meta?.themes) {
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

  if (showCommunity && meta?.initiatives) {
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

  if (showCommunity && meta?.labels) {
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
