/** Compact My list share codes — hash-only, no server. */

const BASE36 = "0123456789abcdefghijklmnopqrstuvwxyz";
const FNV_OFFSET = 2166136261;
const FNV_PRIME = 16777619;
const FNV_SEED_B = 0x811c9dc5 ^ 0xabcdef01;

export const SHARE_CODE_MIN_LENGTH = 6;
export const SHARE_CODE_MAX_LENGTH = 8;
export const SHARE_HASH_ROUTE = "mylist";

function fnv1a32(str, offset = FNV_OFFSET) {
  let hash = offset >>> 0;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, FNV_PRIME) >>> 0;
  }
  return hash;
}

function hashBits(id) {
  const a = fnv1a32(id);
  const b = fnv1a32(id, FNV_SEED_B >>> 0);
  return (BigInt(a) << 32n) | BigInt(b);
}

export function shortCode(id, length) {
  const nLen = Math.max(1, Number(length) || SHARE_CODE_MIN_LENGTH);
  let n = hashBits(String(id));
  let out = "";
  for (let i = 0; i < nLen; i++) {
    out = BASE36[Number(n % 36n)] + out;
    n /= 36n;
  }
  return out;
}

export function buildShareCodebook(ids) {
  const unique = [...new Set((ids ?? []).filter((id) => typeof id === "string" && id))];
  for (let length = SHARE_CODE_MIN_LENGTH; length <= SHARE_CODE_MAX_LENGTH; length++) {
    const encode = new Map();
    const decode = new Map();
    let collision = false;
    for (const id of unique) {
      const code = shortCode(id, length);
      const existing = decode.get(code);
      if (existing && existing !== id) {
        collision = true;
        break;
      }
      encode.set(id, code);
      decode.set(code, id);
    }
    if (!collision) return { length, encode, decode };
  }
  throw new Error("share codebook collision at maximum code length");
}

export function encodeShareCodes(ids, codebook) {
  if (!codebook) return "";
  return (ids ?? [])
    .map((id) => codebook.encode.get(id))
    .filter(Boolean)
    .join("");
}

export function decodeShareParam(s, codebook) {
  if (!codebook?.length) return { ids: [], unknownCount: 0 };
  const raw = String(s ?? "")
    .toLowerCase()
    .replace(/[^0-9a-z]/g, "");
  const len = codebook.length;
  const complete = Math.floor(raw.length / len) * len;
  const ids = [];
  let unknownCount = 0;
  for (let i = 0; i < complete; i += len) {
    const code = raw.slice(i, i + len);
    const id = codebook.decode.get(code);
    if (id) ids.push(id);
    else unknownCount += 1;
  }
  return { ids, unknownCount };
}

export function buildShareUrl({ origin, pathname, codes }) {
  const base = `${String(origin ?? "").replace(/\/$/, "")}${pathname ?? "/"}`;
  const param = String(codes ?? "");
  return `${base}#${SHARE_HASH_ROUTE}?s=${param}`;
}

export function parseShareParamFromHash(hash) {
  const raw = String(hash ?? "").replace(/^#/, "");
  const split = raw.search(/[?&]/);
  if (split < 0) return "";
  const route = raw.slice(0, split).toLowerCase();
  if (route !== SHARE_HASH_ROUTE) return "";
  const query = raw.slice(split + 1);
  const params = new URLSearchParams(query);
  return String(params.get("s") ?? "").toLowerCase();
}

export function favoritableIdsFromEntries(entries) {
  return (entries ?? []).map((e) => e?.id).filter((id) => typeof id === "string" && id);
}
