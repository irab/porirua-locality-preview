/**
 * Sticky curation: an editor save on an FSD record becomes one overrides patch
 * row. Editors never type JSON — this module diffs ordinary fields.
 */

const SERVICE_COLLECTION = "services";
const ORGANIZATION_COLLECTION = "organizations";

const CURATED_FIELDS = [
  "address",
  "lat",
  "lng",
  "phone",
  "url",
  "email",
  "description",
  "title",
  "service_name",
  "name",
  "categories",
  "community_filters",
];

function targetTypeFor(collection) {
  if (collection === SERVICE_COLLECTION) return "service";
  if (collection === ORGANIZATION_COLLECTION) return "organization";
  return null;
}

function asComparable(value) {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) {
    const n = Number(value);
    if (String(value).trim() !== String(n) && !/^-?\d+(\.\d+)?$/.test(value.trim())) {
      return value;
    }
    return n;
  }
  return value;
}

function valuesEqual(left, right) {
  return JSON.stringify(asComparable(left)) === JSON.stringify(asComparable(right));
}

function patchFromPayload(payload = {}, baseline = {}) {
  const patch = {};
  for (const field of CURATED_FIELDS) {
    if (!Object.hasOwn(payload, field)) continue;
    if (valuesEqual(payload[field], baseline[field])) continue;
    patch[field] = payload[field];
  }
  return patch;
}

function overrideId(targetType, targetId) {
  return `patch:${targetType}:${targetId}`;
}

async function loadService(db, id) {
  const result = await db.query(`SELECT source, raw_import FROM services WHERE id = $1`, [id]);
  return result.rows[0] ?? null;
}

async function loadOrganization(db, id) {
  const result = await db.query(`SELECT source_primary FROM organizations WHERE id = $1`, [id]);
  return result.rows[0] ?? null;
}

export async function upsertStickyOverride({ db, collection, key, payload, createdBy, reason } = {}) {
  if (!db) throw new Error("upsertStickyOverride requires db");
  const targetType = targetTypeFor(collection);
  if (!targetType || !key) return null;

  let baseline = {};
  if (collection === SERVICE_COLLECTION) {
    const service = await loadService(db, key);
    if (!service || service.source !== "fsd") return null;
    baseline = service.raw_import && typeof service.raw_import === "object" ? service.raw_import : {};
  } else if (collection === ORGANIZATION_COLLECTION) {
    const organization = await loadOrganization(db, key);
    if (!organization || organization.source_primary !== "fsd") return null;
  }

  const patch = patchFromPayload(payload, baseline);
  if (Object.keys(patch).length === 0) return null;

  const result = await db.query(
    `INSERT INTO overrides (id, target_type, target_id, action, patch, reason, status, created_by)
     VALUES ($1, $2, $3, 'patch', $4::jsonb, $5, 'open', $6)
     ON CONFLICT (target_type, target_id, action)
     DO UPDATE SET
       patch = COALESCE(overrides.patch, '{}'::jsonb) || EXCLUDED.patch,
       status = 'open'
     RETURNING id, target_type, target_id, action, patch, reason, status, created_by`,
    [overrideId(targetType, key), targetType, key, JSON.stringify(patch), reason ?? null, createdBy ?? null]
  );
  return result.rows[0];
}
