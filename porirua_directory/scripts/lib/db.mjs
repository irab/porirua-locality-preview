/**
 * Pooled Postgres client. DATABASE_URL comes from config.mjs / the environment.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { DATABASE_URL } from "../config.mjs";

const { Pool } = pg;

export const SCHEMA_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../db-schema.sql"
);

let pool = null;

export function getDatabaseUrl() {
  return process.env.DATABASE_URL || DATABASE_URL;
}

export function getPool(connectionString = getDatabaseUrl()) {
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  if (!pool) {
    pool = new Pool({ connectionString });
  }
  return pool;
}

export async function query(text, params) {
  return getPool().query(text, params);
}

function isPool(db) {
  return Boolean(db && typeof db.connect === "function" && typeof db.totalCount === "number");
}

export async function withTransaction(fn, db = null) {
  if (isPool(db) || db == null) {
    const client = await (db ?? getPool()).connect();
    try {
      await client.query("BEGIN");
      const result = await fn(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch {
        /* keep the original error */
      }
      throw error;
    } finally {
      client.release();
    }
  }

  await db.query("BEGIN");
  try {
    const result = await fn(db);
    await db.query("COMMIT");
    return result;
  } catch (error) {
    try {
      await db.query("ROLLBACK");
    } catch {
      /* keep the original error */
    }
    throw error;
  }
}

export async function closePool() {
  if (!pool) return;
  await pool.end();
  pool = null;
}

export async function applySchema(executor = getPool()) {
  const sql = await fs.readFile(SCHEMA_PATH, "utf8");
  await executor.query(sql);
}

export function asNumber(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function mapOrganizationRow(row) {
  return {
    id: row.id,
    public_id: row.public_id,
    render_grain: row.render_grain,
    name: row.name,
    description: row.description,
    phone: row.phone,
    url: row.url,
    email: row.email,
    address: row.address,
    lat: asNumber(row.lat),
    lng: asNumber(row.lng),
    org_type: row.org_type,
    community_filters: row.community_filters ?? [],
    community_meta: row.community_meta,
    source_primary: row.source_primary,
    status: row.status,
    duplicate_of: row.duplicate_of,
    merged_into: row.merged_into,
    merge_reason: row.merge_reason,
    cluster_key: row.cluster_key,
    sort_key: Number(row.sort_key ?? 0),
  };
}

export function mapServiceRow(row) {
  return {
    id: row.id,
    organization_id: row.organization_id,
    line_id: row.line_id,
    title: row.title,
    service_name: row.service_name,
    description: row.description,
    phone: row.phone,
    url: row.url,
    address: row.address,
    lat: asNumber(row.lat),
    lng: asNumber(row.lng),
    categories: row.categories ?? [],
    badges: row.badges ?? [],
    source: row.source,
    fsd_service_id: row.fsd_service_id,
    fsd_legacy_id: row.fsd_legacy_id,
    status: row.status,
    duplicate_of: row.duplicate_of,
    raw_import: row.raw_import,
    sort_key: Number(row.sort_key ?? 0),
  };
}
