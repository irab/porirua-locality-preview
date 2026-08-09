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

export const DATA_DIR = path.join(REPO_ROOT, "porirua_directory", "data");
export const FSD_RAW_JSON = path.join(DATA_DIR, "fsd-porirua.raw.json");
/** Rows rejected by Porirua geo filter; written on `import:fsd` for audit (gitignored). */
export const FSD_EXCLUDED_JSON = path.join(DATA_DIR, "fsd-porirua-excluded.json");
export const SERVICES_JSON = path.join(DATA_DIR, "services.json");
export const OVERRIDES_JSON = path.join(DATA_DIR, "overrides.json");
