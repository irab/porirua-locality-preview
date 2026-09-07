/**
 * Apply committed Directus workspace config against a running instance:
 * collections/field Interfaces, Editor role, presets, and Flows.
 *
 *   DIRECTUS_URL=http://127.0.0.1:18055 \
 *   DATABASE_URL=postgres://porirua:porirua@127.0.0.1:54341/porirua_directus \
 *   node scripts/directus/bootstrap.mjs
 */

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { stringify as stringifyYaml } from "../../directus/yaml-stringify.mjs";
import { resolveDirectusCredentials } from "./local-credentials.mjs";

const { Client } = pg;

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DIRECTUS_DIR = path.join(ROOT, "directus");
const FLOWS_DIR = path.join(DIRECTUS_DIR, "flows");
const SNAPSHOT_PATH = path.join(DIRECTUS_DIR, "snapshot.yaml");
const VIEW_SQL_PATH = path.join(DIRECTUS_DIR, "pending-review.sql");

const localCreds = resolveDirectusCredentials();
export const DIRECTUS_URL = localCreds.url;
export const ADMIN_EMAIL = localCreds.adminEmail;
export const ADMIN_PASSWORD = localCreds.adminPassword;
export const EDITOR_EMAIL = localCreds.editorEmail;
export const EDITOR_PASSWORD = localCreds.editorPassword;
export const DIRECTUS_DATABASE_URL =
  process.env.DIRECTUS_DATABASE_URL ||
  process.env.DATABASE_URL ||
  "postgres://porirua:porirua@127.0.0.1:54341/porirua_directus";

const HIDDEN_ORG_FIELDS = [
  "cluster_key",
  "sort_key",
  "merged_into",
  "merge_reason",
  "duplicate_of",
  "created_at",
  "updated_at",
  "published_at",
  "community_meta",
];

const HIDDEN_SERVICE_FIELDS = [
  "sort_key",
  "duplicate_of",
  "raw_import",
  "created_at",
  "updated_at",
  "fsd_legacy_id",
];

const EDITOR_ORG_UPDATE_FIELDS = [
  "name",
  "description",
  "phone",
  "url",
  "email",
  "address",
  "lat",
  "lng",
  "org_type",
  "community_filters",
  "status",
  "source_primary",
  // service_lines is a read-only O2M alias — omitted so Editors cannot re-parent.
];

const EDITOR_SERVICE_UPDATE_FIELDS = [
  "title",
  "service_name",
  "description",
  "phone",
  "url",
  "address",
  "lat",
  "lng",
  "categories",
  "badges",
  "status",
];

export const EDITOR_FORBIDDEN_FIELDS = ["public_id", "render_grain"];

async function request(url, { token, method = "GET", body, headers } = {}) {
  const response = await fetch(url, {
    method,
    headers: {
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (!response.ok) {
    const detail = typeof data === "string" ? data : JSON.stringify(data);
    const error = new Error(`${method} ${url} → ${response.status} ${detail}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

export async function login(email, password, url = DIRECTUS_URL) {
  const data = await request(`${url}/auth/login`, {
    method: "POST",
    body: { email, password },
  });
  return data.data.access_token;
}

export async function waitForDirectus({ url = DIRECTUS_URL, timeoutMs = 90_000 } = {}) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(`${url}/server/health`);
      if (response.ok) return true;
    } catch {
      /* still booting */
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Directus did not become ready at ${url}`);
}

async function applyPendingReviewView() {
  const sql = await fs.readFile(VIEW_SQL_PATH, "utf8");
  const client = new Client({ connectionString: DIRECTUS_DATABASE_URL });
  await client.connect();
  try {
    await client.query(sql);
  } finally {
    await client.end();
  }
}

async function dropAccidentalEntityIdForeignKey() {
  const client = new Client({ connectionString: DIRECTUS_DATABASE_URL });
  await client.connect();
  try {
    await client.query(
      `ALTER TABLE review_queue_items DROP CONSTRAINT IF EXISTS review_queue_items_entity_id_foreign`
    );
  } finally {
    await client.end();
  }
}

async function adoptCollectionMeta(collection, meta) {
  const client = new Client({ connectionString: DIRECTUS_DATABASE_URL });
  await client.connect();
  try {
    await client.query(
      `INSERT INTO directus_collections (
         collection, icon, note, display_template, hidden, singleton,
         archive_field, archive_value, unarchive_value, sort_field, accountability
       ) VALUES ($1, $2, $3, $4, $5, false, $6, $7, $8, $9, $10)
       ON CONFLICT (collection) DO UPDATE SET
         icon = EXCLUDED.icon,
         note = EXCLUDED.note,
         display_template = EXCLUDED.display_template,
         hidden = EXCLUDED.hidden,
         archive_field = EXCLUDED.archive_field,
         archive_value = EXCLUDED.archive_value,
         unarchive_value = EXCLUDED.unarchive_value,
         sort_field = EXCLUDED.sort_field,
         accountability = EXCLUDED.accountability`,
      [
        collection,
        meta.icon ?? null,
        meta.note ?? null,
        meta.display_template ?? null,
        meta.hidden ?? false,
        meta.archive_field ?? null,
        meta.archive_value ?? null,
        meta.unarchive_value ?? null,
        meta.sort_field ?? null,
        meta.accountability ?? "all",
      ]
    );
  } finally {
    await client.end();
  }
}

async function ensureCollection(token, collection, meta, { existingRelation = false } = {}) {
  try {
    await request(`${DIRECTUS_URL}/collections/${collection}`, { token });
    await request(`${DIRECTUS_URL}/collections/${collection}`, {
      token,
      method: "PATCH",
      body: { meta },
    });
    return;
  } catch (error) {
    if (error.status !== 403 && error.status !== 404) throw error;
  }
  if (existingRelation) {
    await adoptCollectionMeta(collection, meta);
    return;
  }
  try {
    await request(`${DIRECTUS_URL}/collections`, {
      token,
      method: "POST",
      body: { collection, schema: {}, meta },
    });
  } catch (error) {
    if (/already exists/i.test(String(error.message))) {
      await adoptCollectionMeta(collection, meta);
      return;
    }
    throw error;
  }
}

async function patchField(token, collection, field, meta) {
  try {
    await request(`${DIRECTUS_URL}/fields/${collection}/${field}`, {
      token,
      method: "PATCH",
      body: { meta },
    });
  } catch (error) {
    if (error.status !== 404) throw error;
  }
}

async function ensureAliasField(token, collection, field, meta) {
  const body = {
    type: "alias",
    schema: null,
    meta: { field, collection, ...meta },
  };
  try {
    await request(`${DIRECTUS_URL}/fields/${collection}/${field}`, {
      token,
      method: "PATCH",
      body,
    });
  } catch (error) {
    if (error.status !== 404) throw error;
    await request(`${DIRECTUS_URL}/fields/${collection}`, {
      token,
      method: "POST",
      body: { field, type: "alias", schema: null, meta },
    });
  }
}

async function ensureRelation(token, relation) {
  let current = null;
  try {
    const existing = await request(
      `${DIRECTUS_URL}/relations/${relation.collection}/${relation.field}`,
      { token }
    );
    current = existing.data ?? existing;
  } catch (error) {
    if (error.status !== 403 && error.status !== 404) throw error;
  }
  if (current?.meta?.one_field && current.meta.one_field === relation.meta?.one_field) {
    return;
  }
  if (current) {
    // Schema-only FKs already appear on GET /relations (meta: null). POST then
    // 400s. PATCH must send top-level collection/field — otherwise Directus
    // inserts directus_relations with many_collection null.
    await request(`${DIRECTUS_URL}/relations/${relation.collection}/${relation.field}`, {
      token,
      method: "PATCH",
      body: {
        collection: relation.collection,
        field: relation.field,
        related_collection: relation.related_collection,
        meta: relation.meta,
      },
    });
    return;
  }
  try {
    await request(`${DIRECTUS_URL}/relations`, { token, method: "POST", body: relation });
  } catch (error) {
    if (!/already exists|duplicate|associated relationship/i.test(String(error.message))) throw error;
  }
}

async function ensureOrganizationServiceLines(token) {
  await ensureRelation(token, {
    collection: "services",
    field: "organization_id",
    related_collection: "organizations",
    meta: {
      one_field: "service_lines",
      one_deselect_action: "nullify",
      sort_field: "sort_key",
    },
  });
  await ensureAliasField(token, "organizations", "service_lines", {
    special: ["o2m"],
    interface: "list-o2m",
    options: { template: "{{title}}" },
    display: "related-values",
    display_options: { template: "{{title}}" },
    readonly: true,
    hidden: false,
    sort: 30,
    width: "full",
    note: "Related service lines. Open a line to edit it. Editors cannot re-parent from this form.",
  });
}

async function findByName(token, path, name) {
  const data = await request(`${DIRECTUS_URL}/${path}?limit=-1`, { token });
  return (data.data ?? []).find((row) => row.name === name) ?? null;
}

async function ensureRole(token, { name, icon, description }) {
  const existing = await findByName(token, "roles", name);
  if (existing) return existing;
  const created = await request(`${DIRECTUS_URL}/roles`, {
    token,
    method: "POST",
    body: { name, icon, description },
  });
  return created.data;
}

async function ensurePolicy(token, { name, icon, description, appAccess, adminAccess }) {
  const existing = await findByName(token, "policies", name);
  if (existing) return existing;
  const created = await request(`${DIRECTUS_URL}/policies`, {
    token,
    method: "POST",
    body: {
      name,
      icon,
      description,
      app_access: appAccess,
      admin_access: adminAccess,
    },
  });
  return created.data;
}

async function ensureAccess(token, { role, policy }) {
  const existing = await request(
    `${DIRECTUS_URL}/access?filter[role][_eq]=${role}&filter[policy][_eq]=${policy}`,
    { token }
  );
  if ((existing.data ?? []).length > 0) return existing.data[0];
  const created = await request(`${DIRECTUS_URL}/access`, {
    token,
    method: "POST",
    body: { role, policy },
  });
  return created.data;
}

async function replacePolicyPermissions(token, policyId, permissions) {
  const existing = await request(
    `${DIRECTUS_URL}/permissions?filter[policy][_eq]=${policyId}&limit=-1`,
    { token }
  );
  for (const row of existing.data ?? []) {
    await request(`${DIRECTUS_URL}/permissions/${row.id}`, { token, method: "DELETE" });
  }
  for (const permission of permissions) {
    await request(`${DIRECTUS_URL}/permissions`, {
      token,
      method: "POST",
      body: { ...permission, policy: policyId },
    });
  }
}

async function ensureUser(token, { email, password, role, firstName }) {
  const existing = await request(
    `${DIRECTUS_URL}/users?filter[email][_eq]=${encodeURIComponent(email)}`,
    { token }
  );
  if ((existing.data ?? []).length > 0) {
    await request(`${DIRECTUS_URL}/users/${existing.data[0].id}`, {
      token,
      method: "PATCH",
      body: { role, password, last_page: "/directory" },
    });
    return existing.data[0];
  }
  const created = await request(`${DIRECTUS_URL}/users`, {
    token,
    method: "POST",
    body: {
      email,
      password,
      role,
      first_name: firstName,
      status: "active",
      last_page: "/directory",
    },
  });
  return created.data;
}

async function setEditorLandingPage(token, editorRoleId) {
  const users = await request(
    `${DIRECTUS_URL}/users?filter[role][_eq]=${encodeURIComponent(editorRoleId)}&limit=-1`,
    { token }
  );
  for (const user of users.data ?? []) {
    if (user.last_page === "/directory") continue;
    await request(`${DIRECTUS_URL}/users/${user.id}`, {
      token,
      method: "PATCH",
      body: { last_page: "/directory" },
    });
  }
}

async function ensurePreset(token, preset) {
  const filter = new URLSearchParams({
    "filter[bookmark][_eq]": preset.bookmark,
    limit: "5",
  });
  if (preset.role) filter.set("filter[role][_eq]", preset.role);
  const existing = await request(`${DIRECTUS_URL}/presets?${filter}`, { token });
  const rows = existing.data ?? [];
  const match = rows.find((row) => row.collection === preset.collection) ?? rows[0];
  if (match) {
    await request(`${DIRECTUS_URL}/presets/${match.id}`, {
      token,
      method: "PATCH",
      body: preset,
    });
    return match;
  }
  const created = await request(`${DIRECTUS_URL}/presets`, {
    token,
    method: "POST",
    body: preset,
  });
  return created.data;
}

async function removePendingReviewCollection(token) {
  const presets = await request(
    `${DIRECTUS_URL}/presets?filter[collection][_eq]=pending_review&limit=-1`,
    { token }
  );
  for (const row of presets.data ?? []) {
    await request(`${DIRECTUS_URL}/presets/${row.id}`, { token, method: "DELETE" });
  }
  try {
    await request(`${DIRECTUS_URL}/collections/pending_review`, { token, method: "DELETE" });
  } catch (error) {
    if (error.status === 404) return;
    try {
      await request(`${DIRECTUS_URL}/collections/pending_review`, {
        token,
        method: "PATCH",
        body: { meta: { hidden: true } },
      });
    } catch (hideError) {
      if (hideError.status !== 403 && hideError.status !== 404) throw hideError;
    }
    if (error.status !== 403) throw error;
  }
}

async function importFlows(token) {
  const names = (await fs.readdir(FLOWS_DIR)).filter((name) => name.endsWith(".json"));
  const created = [];
  for (const name of names) {
    const flow = JSON.parse(await fs.readFile(path.join(FLOWS_DIR, name), "utf8"));
    const existing = await findByName(token, "flows", flow.name);
    const { operations = [], ...flowFields } = flow;
    let flowId;
    if (existing) {
      await request(`${DIRECTUS_URL}/flows/${existing.id}`, {
        token,
        method: "PATCH",
        body: {
          status: flowFields.status,
          icon: flowFields.icon,
          color: flowFields.color,
          description: flowFields.description,
          trigger: flowFields.trigger,
          options: flowFields.options,
          accountability: flowFields.accountability,
        },
      });
      const ops = await request(
        `${DIRECTUS_URL}/operations?filter[flow][_eq]=${existing.id}&limit=-1`,
        { token }
      );
      const byKey = Object.fromEntries((ops.data ?? []).map((op) => [op.key, op]));
      for (const operation of operations) {
        if (byKey[operation.key]) {
          await request(`${DIRECTUS_URL}/operations/${byKey[operation.key].id}`, {
            token,
            method: "PATCH",
            body: { options: operation.options },
          });
        }
      }
      created.push({ name: flow.name, id: existing.id });
      continue;
    } else {
      const result = await request(`${DIRECTUS_URL}/flows`, {
        token,
        method: "POST",
        body: {
          name: flowFields.name,
          icon: flowFields.icon,
          color: flowFields.color,
          description: flowFields.description,
          status: flowFields.status,
          trigger: flowFields.trigger,
          options: flowFields.options,
          accountability: flowFields.accountability,
        },
      });
      flowId = result.data.id;
    }

    const keyToId = {};
    for (const operation of operations) {
      const createdOp = await request(`${DIRECTUS_URL}/operations`, {
        token,
        method: "POST",
        body: {
          flow: flowId,
          key: operation.key,
          name: operation.name,
          type: operation.type,
          position_x: operation.position_x,
          position_y: operation.position_y,
          options: operation.options,
        },
      });
      keyToId[operation.key] = createdOp.data.id;
    }
    for (const operation of operations) {
      const patch = {};
      if (operation.resolve && keyToId[operation.resolve]) patch.resolve = keyToId[operation.resolve];
      if (operation.reject && keyToId[operation.reject]) patch.reject = keyToId[operation.reject];
      if (Object.keys(patch).length > 0) {
        await request(`${DIRECTUS_URL}/operations/${keyToId[operation.key]}`, {
          token,
          method: "PATCH",
          body: patch,
        });
      }
    }
    if (flowFields.operation && keyToId[flowFields.operation]) {
      await request(`${DIRECTUS_URL}/flows/${flowId}`, {
        token,
        method: "PATCH",
        body: { operation: keyToId[flowFields.operation] },
      });
    }
    created.push({ name: flow.name, id: flowId });
  }
  return created;
}

async function configureCollections(token) {
  await ensureCollection(token, "organizations", {
    icon: "apartment",
    display_template: "{{name}}",
    archive_field: "status",
    archive_value: "hidden",
    unarchive_value: "published",
    sort_field: "sort_key",
    accountability: "all",
    hidden: true,
    singleton: false,
    translations: null,
    note: "Providers. Edited through the Directory module, not this collection.",
  });
  await ensureCollection(token, "services", {
    icon: "handshake",
    display_template: "{{title}}",
    archive_field: "status",
    archive_value: "hidden",
    unarchive_value: "published",
    hidden: true,
    note: "Service lines. Edited through the Directory module, not this collection.",
  });
  await ensureCollection(token, "review_queue_items", {
    icon: "rate_review",
    display_template: "{{kind}} — {{change_summary}}",
    hidden: true,
    note: "FSD inbox. Editors use the Directory module Review tab.",
  });
  await ensureCollection(token, "catalog_snapshots", {
    icon: "history",
    display_template: "v{{version}}",
    hidden: true,
    note: "Published envelopes. Editors use Directory → Publish.",
  });
  await ensureCollection(token, "overrides", {
    icon: "edit_note",
    hidden: true,
    note: "Written by Flows. Editors never see or type patch JSON.",
  });
  await ensureCollection(token, "public_id_aliases", {
    icon: "alternate_email",
    hidden: true,
    note: "Admin grain / public_id changes only.",
  });
  await ensureCollection(token, "import_runs", {
    icon: "sync",
    hidden: true,
  });

  await patchField(token, "organizations", "status", {
    interface: "select-dropdown",
    options: {
      choices: [
        { text: "Draft", value: "draft" },
        { text: "Published", value: "published" },
        { text: "Hidden", value: "hidden" },
      ],
    },
    display: "labels",
    width: "full",
    required: true,
    sort: 1,
    translations: null,
    note: "Status is prominent. Changing it does not go public until Publish directory runs.",
  });
  await patchField(token, "organizations", "public_id", {
    interface: "input",
    readonly: false,
    width: "half",
    note: "Public URL id. Read-only for Editors. Changing it breaks saved My list entries unless an alias is written.",
  });
  await patchField(token, "organizations", "render_grain", {
    interface: "select-dropdown",
    options: {
      choices: [
        { text: "Flat listing", value: "flat" },
        { text: "Organisation card", value: "organization" },
      ],
    },
    readonly: false,
    width: "half",
    note: "Admin only. 44 of 76 org cards have one line — flipping grain changes the public id.",
  });
  await patchField(token, "organizations", "name", { interface: "input", width: "full", required: true });
  await patchField(token, "organizations", "description", { interface: "input-multiline", width: "full" });
  for (const field of HIDDEN_ORG_FIELDS) {
    await patchField(token, "organizations", field, { hidden: true });
  }

  await patchField(token, "services", "status", {
    interface: "select-dropdown",
    options: {
      choices: [
        { text: "Draft", value: "draft" },
        { text: "Published", value: "published" },
        { text: "Hidden", value: "hidden" },
        { text: "Pending review", value: "pending_review" },
      ],
    },
    width: "full",
  });
  for (const field of HIDDEN_SERVICE_FIELDS) {
    await patchField(token, "services", field, { hidden: true });
  }

  await patchField(token, "services", "organization_id", {
    interface: "select-dropdown-m2o",
    special: ["m2o"],
    options: { template: "{{name}}" },
    width: "full",
    note: "Parent organisation. Open it to edit related lines together.",
  });
  await ensureOrganizationServiceLines(token);
  await configureReviewQueueFields(token);
  await dropAccidentalEntityIdForeignKey();
  await removePendingReviewCollection(token);
}

async function configureReviewQueueFields(token) {
  await ensureRelation(token, {
    collection: "review_queue_items",
    field: "entity_id",
    related_collection: "services",
    schema: null,
    meta: {
      one_deselect_action: "nullify",
    },
  });
  await patchField(token, "review_queue_items", "kind", {
    interface: "select-dropdown",
    options: {
      choices: [
        { text: "New", value: "new" },
        { text: "Changed", value: "changed" },
        { text: "Removed", value: "removed" },
        { text: "Geocode flag", value: "geocode_flag" },
      ],
    },
    display: "labels",
    width: "half",
    readonly: true,
    sort: 1,
  });
  await patchField(token, "review_queue_items", "entity_id", {
    interface: "select-dropdown-m2o",
    special: ["m2o"],
    options: { template: "{{title}} · {{organization_id.name}}" },
    display: "related-values",
    display_options: { template: "{{title}} · {{organization_id.name}}" },
    width: "full",
    readonly: true,
    sort: 2,
    note: "The listing this queue item is about.",
  });
  await patchField(token, "review_queue_items", "change_summary", {
    interface: "input-multiline",
    readonly: true,
    width: "full",
    sort: 3,
    note: "What changed, in words. The raw proposal stays on the item for Edit-and-approve.",
  });
  await patchField(token, "review_queue_items", "status", {
    interface: "select-dropdown",
    options: {
      choices: [
        { text: "Pending", value: "pending" },
        { text: "Accepted", value: "accepted" },
        { text: "Rejected", value: "rejected" },
      ],
    },
    display: "labels",
    readonly: true,
    width: "half",
    sort: 4,
  });
  await patchField(token, "review_queue_items", "created_at", {
    interface: "datetime",
    readonly: true,
    width: "half",
    sort: 5,
  });
  await patchField(token, "review_queue_items", "proposed", {
    interface: "input-code",
    options: { language: "json" },
    display: "formatted-json-value",
    readonly: true,
    width: "full",
    sort: 20,
    note: "Raw proposal. Use Edit-and-approve to change fields, not this JSON.",
  });
  for (const field of ["import_run_id", "entity_type", "updated_at"]) {
    await patchField(token, "review_queue_items", field, { hidden: true, readonly: true });
  }
}

export function editorPermissions(policyNote) {
  return [
    {
      collection: "organizations",
      action: "read",
      fields: ["*"],
      permissions: {},
      validation: {},
    },
    {
      collection: "organizations",
      action: "update",
      fields: EDITOR_ORG_UPDATE_FIELDS,
      permissions: {},
      validation: {},
    },
    {
      collection: "services",
      action: "read",
      fields: ["*"],
      permissions: {},
      validation: {},
    },
    {
      collection: "services",
      action: "update",
      fields: EDITOR_SERVICE_UPDATE_FIELDS,
      permissions: {},
      validation: {},
    },
    {
      collection: "directus_files",
      action: "read",
      fields: ["*"],
      permissions: {},
      validation: {},
    },
  ].map((row) => ({ ...row, policy: policyNote }));
}

async function configureRoles(token) {
  const editorRole = await ensureRole(token, {
    name: "Editor",
    icon: "edit",
    description: "Locality editors. Cannot change public_id or render_grain.",
  });
  const editorPolicy = await ensurePolicy(token, {
    name: "Editor",
    icon: "edit",
    description: "App access without admin. public_id and render_grain are omitted from update fields.",
    appAccess: true,
    adminAccess: false,
  });
  await ensureAccess(token, { role: editorRole.id, policy: editorPolicy.id });
  await replacePolicyPermissions(token, editorPolicy.id, editorPermissions(editorPolicy.id));
  const editorUser = await ensureUser(token, {
    email: EDITOR_EMAIL,
    password: EDITOR_PASSWORD,
    role: editorRole.id,
    firstName: "Locality",
  });
  return { editorRole, editorPolicy, editorUser };
}

async function configurePresets(_token, _editorRoleId) {
  // Directory module owns Review and Listings. Do not bookmark raw collections for Editor.
}

async function exportWorkspace(token) {
  const snapshot = await request(`${DIRECTUS_URL}/schema/snapshot`, { token });
  const data = snapshot.data ?? snapshot;
  const [roles, policies, permissions, presets] = await Promise.all([
    request(`${DIRECTUS_URL}/roles?limit=-1`, { token }),
    request(`${DIRECTUS_URL}/policies?limit=-1`, { token }),
    request(`${DIRECTUS_URL}/permissions?limit=-1`, { token }),
    request(`${DIRECTUS_URL}/presets?limit=-1`, { token }),
  ]);
  const workspace = {
    ...data,
    roles: (roles.data ?? []).map((row) => ({
      name: row.name,
      icon: row.icon,
      description: row.description,
    })),
    policies: (policies.data ?? []).map((row) => ({
      name: row.name,
      icon: row.icon,
      description: row.description,
      app_access: row.app_access,
      admin_access: row.admin_access,
    })),
    permissions: (permissions.data ?? []).map((row) => ({
      collection: row.collection,
      action: row.action,
      fields: row.fields,
      permissions: row.permissions,
      policy: row.policy,
    })),
    presets: (presets.data ?? []).map((row) => ({
      bookmark: row.bookmark,
      collection: row.collection,
      layout: row.layout,
      layout_query: row.layout_query,
      filter: row.filter,
    })),
  };
  const yaml = stringifyYaml(workspace);
  const preferred =
    process.env.DIRECTUS_SNAPSHOT_OUT ||
    (process.env.NODE_TEST_CONTEXT ? path.join(os.tmpdir(), "directus-snapshot.yaml") : SNAPSHOT_PATH);
  try {
    await fs.writeFile(preferred, yaml);
    return preferred;
  } catch (error) {
    // The operations image copies /app/directus as root and runs as node.
    if (error?.code === "EACCES") {
      const fallback = path.join(os.tmpdir(), "directus-snapshot.yaml");
      await fs.writeFile(fallback, yaml);
      return fallback;
    }
    throw error;
  }
}

export async function bootstrapDirectus() {
  await waitForDirectus();
  await applyPendingReviewView();
  const token = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
  await configureCollections(token);
  const { editorRole, editorPolicy, editorUser } = await configureRoles(token);
  await configurePresets(token, editorRole.id);
  await setEditorLandingPage(token, editorRole.id);
  const flows = await importFlows(token);
  const snapshotPath = await exportWorkspace(token);
  return {
    editorRole,
    editorPolicy,
    editorUser,
    flows,
    snapshotPath,
  };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  bootstrapDirectus()
    .then((result) => {
      console.log(
        JSON.stringify(
          {
            editor: EDITOR_EMAIL,
            flows: result.flows.map((flow) => flow.name),
            snapshot: result.snapshotPath,
          },
          null,
          2
        )
      );
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
