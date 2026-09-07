/** Shared paths and URLs for porirua_directory data pipeline. */

import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(__dirname, "../..");
export const CONNECTIONS_MAP_DIR = path.join(REPO_ROOT, "porirua_connections_map");

/** Same live sheet as porirua_connections_map/config.js */
export const GOOGLE_SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/1xKFgoYtjND3mfgojyddnq2zyKkxH7NXNGejDzFKQP7I/export?format=csv&gid=0";

export const CONNECTIONS_CSV_FALLBACK = path.join(
  CONNECTIONS_MAP_DIR,
  "data/organisations.csv"
);

export const FSD_CSV_URL =
  process.env.FSD_CSV_URL ||
  "https://catalogue.data.govt.nz/dataset/3e967faa-c44b-4f64-989d-2df574b3adf3/resource/35de6bf8-b254-4025-89f5-da9eb6adf9a0/download/fsd_provider_dia_rpt.csv";

export const DATA_DIR =
  process.env.DATA_DIR || path.join(REPO_ROOT, "porirua_directory", "data");
export const FSD_RAW_JSON = path.join(DATA_DIR, "fsd-porirua.raw.json");
/** Rows rejected by Porirua geo filter; written on `import:fsd` for audit (gitignored). */
export const FSD_EXCLUDED_JSON = path.join(DATA_DIR, "fsd-porirua-excluded.json");
/** Included FSD rows with suspicious LATITUDE/LONGITUDE; audit only (gitignored). */
export const FSD_GEOCODE_FLAGS_JSON = path.join(
  DATA_DIR,
  "fsd-porirua-geocode-flags.json"
);
export const SERVICES_JSON = path.join(DATA_DIR, "services.json");
export const OVERRIDES_JSON = path.join(DATA_DIR, "overrides.json");

/** Postgres connection string. Required for bootstrap, publish, and the catalog API. */
export const DATABASE_URL = process.env.DATABASE_URL || "";

export const TEST_DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgres://porirua:porirua@127.0.0.1:54329/porirua_test";

function catalogCurrentTtlMs(raw = process.env.CATALOG_CURRENT_TTL_MS) {
  if (raw == null || raw === "") return 30_000;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return 30_000;
  return n;
}

/** How often the API re-checks `catalog_snapshots.is_current`. Envelope bodies stay cached by version. */
export const CATALOG_CURRENT_TTL_MS = catalogCurrentTtlMs();
