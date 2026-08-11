export const EXTERNAL_LINK_ICON = `<svg class="link-external-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`;

export const PHONE_ICON = `<svg class="link-phone-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`;

const SOCIAL_ICON_CLASS = "link-social-icon";

const FACEBOOK_ICON = `<svg class="${SOCIAL_ICON_CLASS} ${SOCIAL_ICON_CLASS}--facebook" width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><path d="M24 12.073c0-6.627-5.373-12-12-12S0 5.446 0 12.073c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>`;

const INSTAGRAM_ICON = `<svg class="${SOCIAL_ICON_CLASS} ${SOCIAL_ICON_CLASS}--instagram" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>`;

const LINKEDIN_ICON = `<svg class="${SOCIAL_ICON_CLASS} ${SOCIAL_ICON_CLASS}--linkedin" width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>`;

const X_ICON = `<svg class="${SOCIAL_ICON_CLASS} ${SOCIAL_ICON_CLASS}--x" width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>`;

/** @type {{ id: string, label: string, icon: string, match: (host: string) => boolean }[]} */
export const SOCIAL_PLATFORMS = [
  {
    id: "facebook",
    label: "Facebook page",
    icon: FACEBOOK_ICON,
    match: (host) => {
      const h = host.toLowerCase();
      return h === "facebook.com" || h === "fb.com" || h.endsWith(".facebook.com");
    },
  },
  {
    id: "instagram",
    label: "Instagram",
    icon: INSTAGRAM_ICON,
    match: (host) => {
      const h = host.toLowerCase();
      return h === "instagram.com" || h.endsWith(".instagram.com");
    },
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    icon: LINKEDIN_ICON,
    match: (host) => {
      const h = host.toLowerCase();
      return h === "linkedin.com" || h.endsWith(".linkedin.com");
    },
  },
  {
    id: "x",
    label: "X",
    icon: X_ICON,
    match: (host) => {
      const h = host.toLowerCase();
      return (
        h === "twitter.com" ||
        h.endsWith(".twitter.com") ||
        h === "x.com" ||
        h.endsWith(".x.com")
      );
    },
  },
];

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function telHrefFromPhone(phone) {
  return `tel:${String(phone).replace(/\s/g, "")}`;
}

/** Hostname without www. Empty string if URL cannot be parsed. */
export function websiteHostname(url) {
  const raw = String(url ?? "").trim();
  if (!raw) return "";
  try {
    const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
    return new URL(withScheme).hostname.replace(/^www\./i, "");
  } catch {
    return "";
  }
}

export function socialPlatformForHost(host) {
  const h = String(host ?? "").trim();
  if (!h) return null;
  return SOCIAL_PLATFORMS.find((p) => p.match(h)) ?? null;
}

export function socialPlatformForUrl(url) {
  const host = websiteHostname(url);
  return host ? socialPlatformForHost(host) : null;
}

/** FSD placeholder URLs (`https://0`) parse as 0.0.0.0 — omit website control. */
export function isUnusableWebsiteUrl(url) {
  const host = websiteHostname(url);
  if (!host) return true;
  return host === "0.0.0.0";
}

/**
 * Short visible label for website links (buttons and inline).
 * Social hosts use branded labels; other URLs show base domain only (no path).
 */
export function websiteDisplayLabel(url) {
  const host = websiteHostname(url);
  if (!host || isUnusableWebsiteUrl(url)) return "";
  const social = socialPlatformForHost(host);
  if (social) return social.label;
  return host;
}

export function websiteLinkAriaLabel(url) {
  return String(url ?? "").trim();
}

function websiteLinkInnerHtml(urlTrimmed) {
  const host = websiteHostname(urlTrimmed);
  const social = host ? socialPlatformForHost(host) : null;
  const display = websiteDisplayLabel(urlTrimmed);
  if (social) {
    return `${social.icon}${esc(display)}`;
  }
  return `${esc(display)}${EXTERNAL_LINK_ICON}`;
}

export function websiteAnchorHtml(url, { className = "" } = {}) {
  const urlTrimmed = String(url ?? "").trim();
  if (!urlTrimmed || isUnusableWebsiteUrl(urlTrimmed)) return "";
  const aria = websiteLinkAriaLabel(urlTrimmed);
  const classAttr = className ? ` class="${esc(className)}"` : "";
  return `<a${classAttr} href="${esc(urlTrimmed)}" target="_blank" rel="noopener noreferrer" title="${esc(urlTrimmed)}" aria-label="${esc(aria)}">${websiteLinkInnerHtml(urlTrimmed)}</a>`;
}

export function websiteLinkHtml(url) {
  return websiteAnchorHtml(url);
}

/**
 * Website · phone row shared by cards and map popups.
 * @param {{ strip?: string, website?: string, call?: string, sep?: string }} [classes]
 */
export function contactStripHtml(phone, url, classes = {}) {
  const stripClass = classes.strip ?? "card__footer card__contact-strip";
  const websiteClass = classes.website ?? "card__website";
  const callClass = classes.call ?? "card__call";
  const sepClass = classes.sep ?? "card__contact-sep";

  const phoneTrimmed = String(phone ?? "").trim();
  const urlTrimmed = String(url ?? "").trim();
  const hasWebsite = urlTrimmed && !isUnusableWebsiteUrl(urlTrimmed);
  if (!phoneTrimmed && !hasWebsite) return "";
  const websiteBtn = hasWebsite
    ? websiteAnchorHtml(urlTrimmed, { className: websiteClass })
    : "";
  const callBtn = phoneTrimmed
    ? `<a class="${esc(callClass)}" href="${esc(telHrefFromPhone(phoneTrimmed))}" aria-label="${esc(phoneTrimmed)}">${PHONE_ICON}${esc(phoneTrimmed)}</a>`
    : "";
  const sep =
    websiteBtn && callBtn
      ? `<span class="${esc(sepClass)}" aria-hidden="true">·</span>`
      : "";
  return `<div class="${esc(stripClass)}">${websiteBtn}${sep}${callBtn}</div>`;
}

export function mapPopupContactStripHtml(phone, url) {
  return contactStripHtml(phone, url, {
    strip: "map-popup__contact-strip",
    website: "map-popup__website",
    call: "map-popup__call",
    sep: "map-popup__contact-sep",
  });
}

export function cardFooterHtml(phone, url) {
  return contactStripHtml(phone, url);
}
