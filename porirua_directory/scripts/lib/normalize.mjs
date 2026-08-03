/** Normalisation helpers for merge and dedupe. */

export function normalizeName(name) {
  return String(name ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

export function slugId(name, prefix = "") {
  const base = normalizeName(name)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  const slug = base || "unknown";
  return prefix ? `${prefix}${slug}` : slug;
}

export function normalizePhone(phone) {
  const raw = String(phone ?? "").trim();
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 0) return raw;
  if (digits.startsWith("64") && digits.length >= 10) {
    const local = digits.slice(2);
    if (local.startsWith("0")) return local;
    return `0${local}`;
  }
  if (!digits.startsWith("0") && digits.length >= 8 && digits.length <= 9) {
    return `0${digits}`;
  }
  return raw;
}

export function normalizeUrl(url) {
  const raw = String(url ?? "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("//")) return `https:${raw}`;
  return `https://${raw}`;
}

export function parseCoord(value) {
  if (value == null || value === "") return null;
  const n = Number(String(value).trim());
  return Number.isFinite(n) ? n : null;
}

/** Dedupe key: normalised name + lat/lng rounded to 3 decimals. */
export function dedupeKey(name, lat, lng) {
  const n = normalizeName(name).toLowerCase();
  const rLat =
    lat != null && Number.isFinite(lat) ? Math.round(lat * 1000) / 1000 : "";
  const rLng =
    lng != null && Number.isFinite(lng) ? Math.round(lng * 1000) / 1000 : "";
  return `${n}|${rLat}|${rLng}`;
}
