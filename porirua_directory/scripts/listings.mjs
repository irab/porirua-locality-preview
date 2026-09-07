/**
 * Editor listing writes. Creates are published rows with no review_queue_items.
 * The public site still serves the last catalog snapshot until Publish.
 */

import { communityFilters, needCategories } from "../config-directory.js";
import {
  findOrganisationNameMatches,
  findServiceLineNameMatches,
} from "./lib/name-match.mjs";
import {
  mintCommunityOrganizationIdentity,
  mintCommunityServiceLineIdentity,
} from "./lib/listing-identity.mjs";
import { withTransaction } from "./lib/db.mjs";
import { upsertStickyOverride } from "./directus/sticky-curation.mjs";
import { formHighlightFields } from "../editor-core/form-highlight.mjs";
import { queueItemDto, recentQueueItemDto, statusLabel } from "../editor-core/queue-dto.mjs";
import { undoPublishAvailability } from "../editor-core/undo-publish.mjs";
import {
  lastEventForAvailability,
  loadLatestPublishEvent,
} from "./catalog-publish-events.mjs";
import { buildCatalogEnvelope } from "./catalog-envelope.mjs";
import {
  getCurrentSnapshot,
  loadPublishedRows,
  loadSourceCounts,
} from "./publish-catalog.mjs";

const NEED_IDS = new Set(needCategories.map((item) => item.id));
const COMMUNITY_IDS = new Set(communityFilters.map((item) => item.id));

export class ListingError extends Error {
  constructor(statusCode, message, extra = {}) {
    super(message);
    this.name = "ListingError";
    this.statusCode = statusCode;
    this.extra = extra;
  }
}

function asJson(value) {
  return JSON.stringify(value ?? null);
}

function closedList(values, allowed, label) {
  const list = Array.isArray(values) ? values.map(String) : [];
  const unknown = list.filter((id) => !allowed.has(id));
  if (unknown.length) {
    throw new ListingError(400, `Unknown ${label}: ${unknown.join(", ")}`);
  }
  return list;
}

function listingFields(payload = {}) {
  return {
    name: String(payload.name ?? "").trim(),
    title: String(payload.title ?? payload.serviceName ?? payload.service_name ?? payload.name ?? "").trim(),
    serviceName: String(payload.serviceName ?? payload.service_name ?? payload.title ?? "").trim(),
    description: String(payload.description ?? ""),
    phone: String(payload.phone ?? ""),
    url: String(payload.url ?? ""),
    email: String(payload.email ?? ""),
    address: String(payload.address ?? ""),
    lat: payload.lat == null || payload.lat === "" ? null : Number(payload.lat),
    lng: payload.lng == null || payload.lng === "" ? null : Number(payload.lng),
    categories: closedList(payload.categories ?? [], NEED_IDS, "Help type"),
    communityFilters: closedList(
      payload.communityFilters ?? payload.community_filters ?? [],
      COMMUNITY_IDS,
      "community group"
    ),
    organizationId: payload.organizationId ?? payload.organization_id ?? null,
    confirmCreateAnyway: payload.confirmCreateAnyway === true,
  };
}

async function loadOrganizations(db) {
  const result = await db.query(
    `SELECT id, public_id, name, address, phone, status, merged_into
     FROM organizations`
  );
  return result.rows;
}

async function loadServicesForOrg(db, organizationId) {
  const result = await db.query(
    `SELECT id, organization_id, line_id, title, service_name, status
     FROM services WHERE organization_id = $1`,
    [organizationId]
  );
  return result.rows;
}

export async function nameMatches({ db, name, organizationId } = {}) {
  if (!db) throw new Error("nameMatches requires db");
  const queryName = String(name ?? "").trim();
  const withStatus = (matches) =>
    matches.map((row) => ({ ...row, statusLabel: statusLabel(row.status) }));
  if (organizationId) {
    const services = await loadServicesForOrg(db, organizationId);
    return { matches: withStatus(findServiceLineNameMatches(queryName, services)) };
  }
  const organizations = await loadOrganizations(db);
  return { matches: withStatus(findOrganisationNameMatches(queryName, organizations)) };
}

async function insertOrganization(tx, org) {
  await tx.query(
    `INSERT INTO organizations (
       id, public_id, render_grain, name, description, phone, url, email,
       address, lat, lng, community_filters, source_primary, status,
       cluster_key, published_at, updated_at
     ) VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, 'community',
       'published', $13, now(), now()
     )`,
    [
      org.id,
      org.public_id,
      org.render_grain,
      org.name,
      org.description,
      org.phone,
      org.url,
      org.email,
      org.address,
      org.lat,
      org.lng,
      asJson(org.community_filters),
      org.cluster_key,
    ]
  );
}

async function insertCommunityService(tx, service) {
  await tx.query(
    `INSERT INTO services (
       id, organization_id, line_id, title, service_name, description,
       phone, url, address, lat, lng, categories, badges, source, status,
       sort_key, updated_at
     ) VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, '[]'::jsonb,
       'community', 'published', 0, now()
     )`,
    [
      service.id,
      service.organization_id,
      service.line_id,
      service.title,
      service.service_name,
      service.description,
      service.phone,
      service.url,
      service.address,
      service.lat,
      service.lng,
      asJson(service.categories),
    ]
  );
}

async function createOrganizationListing(tx, fields) {
  if (!fields.name) throw new ListingError(400, "Name is required");
  const matches = findOrganisationNameMatches(fields.name, await loadOrganizations(tx));
  if (matches.length && !fields.confirmCreateAnyway) {
    throw new ListingError(409, "An organisation with a similar name is already in the directory", {
      matches,
    });
  }
  const existing = await tx.query(`SELECT public_id FROM organizations`);
  const identity = mintCommunityOrganizationIdentity(fields.name, {
    phone: fields.phone,
    address: fields.address,
    lat: fields.lat,
    lng: fields.lng,
    existingPublicIds: existing.rows.map((row) => row.public_id),
  });
  await insertOrganization(tx, {
    ...identity,
    name: fields.name,
    description: fields.description,
    phone: fields.phone,
    url: fields.url,
    email: fields.email,
    address: fields.address,
    lat: fields.lat,
    lng: fields.lng,
    community_filters: fields.communityFilters,
  });
  await insertCommunityService(tx, {
    id: identity.id,
    organization_id: identity.id,
    line_id: identity.id,
    title: fields.title || fields.name,
    service_name: fields.serviceName || fields.title || fields.name,
    description: fields.description,
    phone: fields.phone,
    url: fields.url,
    address: fields.address,
    lat: fields.lat,
    lng: fields.lng,
    categories: fields.categories,
  });
  return { organizationId: identity.id, serviceId: identity.id, publicId: identity.public_id };
}

async function createServiceLineListing(tx, fields) {
  if (!fields.organizationId) throw new ListingError(400, "organisation is required");
  if (!fields.title && !fields.name) throw new ListingError(400, "Service name is required");
  const org = await tx.query(`SELECT * FROM organizations WHERE id = $1`, [fields.organizationId]);
  if (org.rowCount === 0) throw new ListingError(404, "Organisation not found");
  const title = fields.title || fields.name;
  const existingLines = await loadServicesForOrg(tx, fields.organizationId);
  const matches = findServiceLineNameMatches(title, existingLines);
  if (matches.length && !fields.confirmCreateAnyway) {
    throw new ListingError(409, `This organisation already has a service called ${title}`, {
      matches,
    });
  }
  const identity = mintCommunityServiceLineIdentity({
    organizationId: fields.organizationId,
    title,
    existingIds: existingLines.map((row) => row.id),
  });
  await insertCommunityService(tx, {
    id: identity.id,
    organization_id: fields.organizationId,
    line_id: identity.line_id,
    title,
    service_name: fields.serviceName || title,
    description: fields.description,
    phone: fields.phone || org.rows[0].phone,
    url: fields.url || org.rows[0].url,
    address: fields.address || org.rows[0].address,
    lat: fields.lat ?? org.rows[0].lat,
    lng: fields.lng ?? org.rows[0].lng,
    categories: fields.categories,
  });
  const publicCount = await tx.query(
    `SELECT count(*)::int AS n FROM services
     WHERE organization_id = $1 AND status = 'published'`,
    [fields.organizationId]
  );
  if (org.rows[0].render_grain === "flat" && publicCount.rows[0].n >= 2) {
    await tx.query(
      `UPDATE organizations SET render_grain = 'organization', updated_at = now() WHERE id = $1`,
      [fields.organizationId]
    );
  }
  return {
    organizationId: fields.organizationId,
    serviceId: identity.id,
    publicId: org.rows[0].public_id,
  };
}

export async function createListing({ db, payload } = {}) {
  if (!db) throw new Error("createListing requires db");
  const fields = listingFields(payload);
  const kind = payload?.kind === "serviceLine" ? "serviceLine" : "organization";
  return withTransaction(async (tx) => {
    const created =
      kind === "serviceLine"
        ? await createServiceLineListing(tx, fields)
        : await createOrganizationListing(tx, fields);
    return { ok: true, ...created };
  }, db);
}

async function writeHideOverride(tx, { entityType, entityId, createdBy }) {
  await tx.query(
    `INSERT INTO overrides (id, target_type, target_id, action, patch, status, created_by)
     VALUES ($1, $2, $3, 'hide', NULL, 'open', $4)
     ON CONFLICT (target_type, target_id, action)
     DO UPDATE SET status = 'open'`,
    [`hide:${entityType}:${entityId}`, entityType, entityId, createdBy ?? null]
  );
}

export async function archiveListing({
  db,
  serviceId,
  alsoArchiveOrganization = false,
  createdBy,
} = {}) {
  if (!db) throw new Error("archiveListing requires db");
  if (!serviceId) throw new ListingError(400, "serviceId is required");
  return withTransaction(async (tx) => {
    const service = await tx.query(`SELECT * FROM services WHERE id = $1`, [serviceId]);
    if (service.rowCount === 0) throw new ListingError(404, "Service not found");
    const row = service.rows[0];
    await tx.query(`UPDATE services SET status = 'hidden', updated_at = now() WHERE id = $1`, [
      serviceId,
    ]);
    await writeHideOverride(tx, {
      entityType: "service",
      entityId: serviceId,
      createdBy,
    });
    const remaining = await tx.query(
      `SELECT count(*)::int AS n FROM services
       WHERE organization_id = $1 AND status = 'published'`,
      [row.organization_id]
    );
    let organizationArchived = false;
    if (alsoArchiveOrganization || remaining.rows[0].n === 0) {
      if (alsoArchiveOrganization) {
        await tx.query(
          `UPDATE organizations SET status = 'hidden', updated_at = now() WHERE id = $1`,
          [row.organization_id]
        );
        await writeHideOverride(tx, {
          entityType: "organization",
          entityId: row.organization_id,
          createdBy,
        });
        organizationArchived = true;
      }
    }
    return {
      ok: true,
      serviceId,
      organizationId: row.organization_id,
      onlyPublicLine: remaining.rows[0].n === 0,
      organizationArchived,
    };
  }, db);
}

export async function restoreListing({ db, serviceId } = {}) {
  if (!db) throw new Error("restoreListing requires db");
  if (!serviceId) throw new ListingError(400, "serviceId is required");
  return withTransaction(async (tx) => {
    const service = await tx.query(`SELECT * FROM services WHERE id = $1`, [serviceId]);
    if (service.rowCount === 0) throw new ListingError(404, "Service not found");
    await tx.query(
      `UPDATE services SET status = 'published', updated_at = now() WHERE id = $1`,
      [serviceId]
    );
    await tx.query(
      `UPDATE overrides SET status = 'closed' WHERE target_type = 'service' AND target_id = $1 AND action = 'hide'`,
      [serviceId]
    );
    await tx.query(
      `UPDATE organizations SET status = 'published', updated_at = now()
       WHERE id = $1 AND status = 'hidden'`,
      [service.rows[0].organization_id]
    );
    return { ok: true, serviceId, organizationId: service.rows[0].organization_id };
  }, db);
}

export async function queueItemCount(db) {
  const result = await db.query(`SELECT count(*)::int AS n FROM review_queue_items`);
  return result.rows[0].n;
}

const ORG_UPDATE_FIELDS = [
  "name",
  "description",
  "phone",
  "url",
  "email",
  "address",
  "lat",
  "lng",
  "community_filters",
];

const SERVICE_UPDATE_FIELDS = [
  "title",
  "service_name",
  "description",
  "phone",
  "url",
  "address",
  "lat",
  "lng",
  "categories",
];

function pickUpdates(payload, allowed) {
  const updates = {};
  for (const field of allowed) {
    const snake = field;
    const camel = field.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    if (Object.hasOwn(payload, snake)) updates[field] = payload[snake];
    else if (Object.hasOwn(payload, camel)) updates[field] = payload[camel];
  }
  if (Object.hasOwn(updates, "community_filters")) {
    updates.community_filters = closedList(updates.community_filters, COMMUNITY_IDS, "community group");
  }
  if (Object.hasOwn(updates, "categories")) {
    updates.categories = closedList(updates.categories, NEED_IDS, "Help type");
  }
  return updates;
}

async function applyColumnUpdates(tx, table, id, updates) {
  const entries = Object.entries(updates);
  if (entries.length === 0) return;
  const sets = ["updated_at = now()"];
  const values = [id];
  for (const [column, value] of entries) {
    values.push(column === "categories" || column === "community_filters" ? asJson(value) : value);
    const cast = column === "categories" || column === "community_filters" ? "::jsonb" : "";
    sets.push(`${column} = $${values.length}${cast}`);
  }
  await tx.query(`UPDATE ${table} SET ${sets.join(", ")} WHERE id = $1`, values);
}

export async function listListings({ db } = {}) {
  if (!db) throw new Error("listListings requires db");
  const result = await db.query(
    `SELECT o.id, o.public_id, o.name, o.address, o.phone, o.status, o.render_grain,
            o.source_primary, o.merged_into,
            (SELECT count(*)::int FROM services s
              WHERE s.organization_id = o.id AND s.status = 'published') AS public_line_count
       FROM organizations o
      ORDER BY o.name ASC, o.id ASC`
  );
  return {
    listings: result.rows.map((row) => ({
      ...row,
      statusLabel: statusLabel(row.status),
    })),
  };
}

function lockedFieldsFromPatches(rows = []) {
  const fields = [];
  for (const row of rows) {
    const patch = row.patch && typeof row.patch === "object" ? row.patch : {};
    fields.push(...Object.keys(patch));
  }
  return [...new Set(fields)];
}

function youSetThisFromPatches(rows = []) {
  return formHighlightFields({
    locked: lockedFieldsFromPatches(rows),
    alwaysMarkLocked: true,
  }).youSetThis;
}

async function openPatchOverridesByTarget(db, targetIds) {
  const ids = targetIds.filter(Boolean);
  if (!ids.length) return new Map();
  const result = await db.query(
    `SELECT target_id, patch FROM overrides
      WHERE status = 'open' AND action = 'patch' AND target_id = ANY($1::text[])`,
    [ids]
  );
  const byTarget = new Map();
  for (const row of result.rows) {
    const list = byTarget.get(row.target_id) || [];
    list.push(row);
    byTarget.set(row.target_id, list);
  }
  return byTarget;
}

export async function getListing({ db, organizationId } = {}) {
  if (!db) throw new Error("getListing requires db");
  if (!organizationId) throw new ListingError(400, "organizationId is required");
  const org = await db.query(`SELECT * FROM organizations WHERE id = $1`, [organizationId]);
  if (org.rowCount === 0) throw new ListingError(404, "Organisation not found");
  const services = await db.query(
    `SELECT * FROM services WHERE organization_id = $1 ORDER BY sort_key ASC, title ASC`,
    [organizationId]
  );
  const patches = await openPatchOverridesByTarget(db, [
    organizationId,
    ...services.rows.map((row) => row.id),
  ]);
  return {
    organization: {
      ...org.rows[0],
      statusLabel: statusLabel(org.rows[0].status),
      youSetThis: youSetThisFromPatches(patches.get(organizationId) || []),
    },
    services: services.rows.map((row) => ({
      ...row,
      statusLabel: statusLabel(row.status),
      youSetThis: youSetThisFromPatches(patches.get(row.id) || []),
    })),
  };
}

export async function updateListing({ db, organizationId, serviceId, payload = {}, createdBy } = {}) {
  if (!db) throw new Error("updateListing requires db");
  if (!organizationId && !serviceId) throw new ListingError(400, "organizationId or serviceId is required");
  return withTransaction(async (tx) => {
    let orgId = organizationId;
    if (serviceId) {
      const service = await tx.query(`SELECT * FROM services WHERE id = $1`, [serviceId]);
      if (service.rowCount === 0) throw new ListingError(404, "Service not found");
      orgId = orgId || service.rows[0].organization_id;
      const serviceUpdates = pickUpdates(payload, SERVICE_UPDATE_FIELDS);
      await applyColumnUpdates(tx, "services", serviceId, serviceUpdates);
      if (service.rows[0].source === "fsd" && Object.keys(serviceUpdates).length) {
        await upsertStickyOverride({
          db: tx,
          collection: "services",
          key: serviceId,
          payload: serviceUpdates,
          createdBy,
        });
      }
    }
    if (orgId) {
      const org = await tx.query(`SELECT * FROM organizations WHERE id = $1`, [orgId]);
      if (org.rowCount === 0) throw new ListingError(404, "Organisation not found");
      const orgUpdates = pickUpdates(payload, ORG_UPDATE_FIELDS);
      await applyColumnUpdates(tx, "organizations", orgId, orgUpdates);
      if (org.rows[0].source_primary === "fsd" && Object.keys(orgUpdates).length) {
        await upsertStickyOverride({
          db: tx,
          collection: "organizations",
          key: orgId,
          payload: orgUpdates,
          createdBy,
        });
      }
    }
    return getListing({ db: tx, organizationId: orgId });
  }, db);
}

export async function listQueueItems({ db } = {}) {
  if (!db) throw new Error("listQueueItems requires db");
  const result = await db.query(
    `SELECT q.*,
            s.title,
            s.service_name,
            s.description AS service_description,
            s.phone AS service_phone,
            s.url AS service_url,
            s.address AS service_address,
            s.lat AS service_lat,
            s.lng AS service_lng,
            s.categories AS service_categories,
            o.name AS organization_name,
            o.description AS organization_description,
            o.phone AS organization_phone,
            o.url AS organization_url,
            o.address AS organization_address,
            o.lat AS organization_lat,
            o.lng AS organization_lng
       FROM review_queue_items q
       LEFT JOIN services s ON s.id = q.entity_id
       LEFT JOIN organizations o ON o.id = s.organization_id
      WHERE q.status = 'pending'
      ORDER BY q.created_at ASC`
  );
  const recent = await db.query(
    `SELECT q.id,
            q.kind,
            q.status,
            q.updated_at,
            q.proposed,
            q.entity_id,
            o.id AS organization_id,
            o.name AS organization_name
       FROM review_queue_items q
       LEFT JOIN services s ON s.id = q.entity_id
       LEFT JOIN organizations o ON o.id = s.organization_id
      WHERE q.status IN ('accepted', 'rejected')
      ORDER BY q.updated_at DESC
      LIMIT 20`
  );
  return {
    items: result.rows.map((row) => {
      const live = {
        name: row.organization_name,
        title: row.title,
        serviceName: row.service_name,
        description: row.service_description || row.organization_description,
        phone: row.service_phone || row.organization_phone,
        url: row.service_url || row.organization_url,
        address: row.service_address || row.organization_address,
        lat: row.service_lat ?? row.organization_lat,
        lng: row.service_lng ?? row.organization_lng,
        categories: row.service_categories ?? [],
      };
      const dto = queueItemDto(row, live);
      return {
        ...dto,
        name: row.organization_name || dto.name,
        title: row.title ?? "",
        websiteUrl: live.url || dto.after.url || "",
        phone: live.phone || dto.after.phone || "",
      };
    }),
    recent: recent.rows.map((row) => recentQueueItemDto(row)),
  };
}

export function unpublishedWork(currentBody, nextBody) {
  if (JSON.stringify(currentBody ?? null) === JSON.stringify(nextBody ?? null)) {
    return { unpublishedCount: 0, unpublishedNames: [] };
  }
  const previous = new Map((currentBody?.services ?? []).map((entry) => [entry.id, entry]));
  const names = [];
  const seen = new Set();
  const addName = (entry) => {
    const name = entry?.name || entry?.id;
    if (!name || seen.has(name)) return;
    seen.add(name);
    names.push(name);
  };
  for (const entry of nextBody?.services ?? []) {
    const before = previous.get(entry.id);
    if (!before || JSON.stringify(before) !== JSON.stringify(entry)) addName(entry);
    previous.delete(entry.id);
  }
  for (const gone of previous.values()) addName(gone);
  return { unpublishedCount: names.length, unpublishedNames: names };
}

export async function publishStatus({ db } = {}) {
  if (!db) throw new Error("publishStatus requires db");
  const current = await getCurrentSnapshot(db);
  const rows = await loadPublishedRows(db);
  const counts = await loadSourceCounts(db);
  const next = buildCatalogEnvelope({ ...rows, counts });
  const currentBody = current?.envelope ? { ...current.envelope } : null;
  if (currentBody) delete currentBody.generatedAt;
  const nextBody = { ...next };
  delete nextBody.generatedAt;
  const unpublished = JSON.stringify(currentBody) !== JSON.stringify(nextBody);
  const work = unpublishedWork(currentBody, nextBody);
  const availability = undoPublishAvailability({
    currentVersion: current?.version ?? null,
    lastEvent: lastEventForAvailability(await loadLatestPublishEvent(db)),
  });
  return {
    unpublished,
    unpublishedCount: work.unpublishedCount,
    unpublishedNames: work.unpublishedNames,
    currentVersion: current?.version ?? null,
    previousVersion: availability.previousVersion,
    publishedAt: current?.envelope?.generatedAt ?? null,
    canUndoPublish: availability.canUndoPublish,
    undoPublishVersion: availability.undoPublishVersion ?? null,
    nextCounts: next.counts,
  };
}
