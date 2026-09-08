/**
 * Realistic FSD CSV-shaped rows that share SERVICE_ID.
 * Field names match what mapFsdRowToService reads.
 */
import { mapFsdRowToService } from "../../scripts/fsd-porirua-rules.mjs";

/** Same SERVICE_ID listed under two FSD category rows — typical DIA feed duplication. */
export const SALVATION_ARMY_EMERGENCY_HOUSING = [
  {
    FSD_ID: "40002",
    SERVICE_ID: "37470",
    PROVIDER_NAME: "The Salvation Army - Porirua",
    PROVIDER_WEBSITE_1:
      "https://www.salvationarmy.org.nz/find-churchcentre/new-zealand/lower-north-island/porirua/porirua-corps",
    PUBLISHED_PHONE_1: "04 235 6266",
    PHYSICAL_REGION: "Wellington",
    PHYSICAL_DISTRICT: "Porirua City",
    PHYSICAL_ADDRESS: "89 Warspite Avenue, Cannons Creek, Porirua, 5024",
    SERVICE_NAME: "Accommodation: Emergency",
    SERVICE_DETAIL:
      "We offer emergency housing in this area. Please contact our Porirua office to see how we might help you with this service.",
    LATITUDE: "-41.13684",
    LONGITUDE: "174.872683",
    LEVEL_1_CATEGORY: "Housing",
    LEVEL_2_CATEGORY: "Emergency housing",
  },
  {
    FSD_ID: "40001",
    SERVICE_ID: "37470",
    PROVIDER_NAME: "The Salvation Army - Porirua",
    PROVIDER_WEBSITE_1: "",
    PUBLISHED_PHONE_1: "",
    PHYSICAL_REGION: "Wellington",
    PHYSICAL_DISTRICT: "Porirua City",
    PHYSICAL_ADDRESS: "",
    SERVICE_NAME: "Accommodation: Emergency",
    SERVICE_DETAIL: "",
    LATITUDE: "",
    LONGITUDE: "",
    LEVEL_1_CATEGORY: "Support",
    LEVEL_2_CATEGORY: "",
  },
];

/** Equal sparsity; only FSD_ID (and CSV order) can break the tie. */
export const SPARSE_EQUAL_SERVICE = [
  {
    FSD_ID: "8802",
    SERVICE_ID: "8800-line",
    PROVIDER_NAME: "Sparse Trust",
    PHYSICAL_DISTRICT: "Porirua City",
    SERVICE_NAME: "",
    SERVICE_DETAIL: "",
    LATITUDE: "",
    LONGITUDE: "",
  },
  {
    FSD_ID: "8801",
    SERVICE_ID: "8800-line",
    PROVIDER_NAME: "Sparse Trust",
    PHYSICAL_DISTRICT: "Porirua City",
    SERVICE_NAME: "",
    SERVICE_DETAIL: "",
    LATITUDE: "",
    LONGITUDE: "",
  },
];

/** Same richness; marine vs in-bounds Porirua coords (Ora Toa-style QA). */
export const ORA_TOA_GEOCODE_TIEBREAK = [
  {
    FSD_ID: "4690",
    SERVICE_ID: "4690-support",
    PROVIDER_NAME: "Porirua Respiritory Support group - Ora Toa",
    SERVICE_NAME: "Support group - Ora Toa",
    SERVICE_DETAIL: "Respiratory support group.",
    PUBLISHED_PHONE_1: "04 237 6892",
    PHYSICAL_DISTRICT: "Porirua City",
    PHYSICAL_ADDRESS: "",
    LATITUDE: "-41.080194",
    LONGITUDE: "174.760239",
    LEVEL_1_CATEGORY: "Health",
  },
  {
    FSD_ID: "4691",
    SERVICE_ID: "4690-support",
    PROVIDER_NAME: "Porirua Respiritory Support group - Ora Toa",
    SERVICE_NAME: "Support group - Ora Toa",
    SERVICE_DETAIL: "Respiratory support group.",
    PUBLISHED_PHONE_1: "04 237 6892",
    PHYSICAL_DISTRICT: "Porirua City",
    PHYSICAL_ADDRESS: "",
    LATITUDE: "-41.1248",
    LONGITUDE: "174.835605",
    LEVEL_1_CATEGORY: "Health",
  },
];

export const SINGLETON_FOODBANK = {
  FSD_ID: "9001",
  SERVICE_ID: "9001-line-a",
  PROVIDER_NAME: "Test Provider",
  SERVICE_NAME: "Food bank",
  SERVICE_DETAIL: "Help with food",
  PUBLISHED_PHONE_1: "04 123 4567",
  PHYSICAL_ADDRESS: "1 Main St, Porirua",
  PHYSICAL_DISTRICT: "Porirua",
  LATITUDE: "-41.13",
  LONGITUDE: "174.84",
  LEVEL_1_CATEGORY: "Food",
};

/** Attach SERVICE_ID / FSD_ID so collapse can group without reading FSD_ID as the public key. */
export function mapFsdFixtureRow(row) {
  return {
    ...mapFsdRowToService(row),
    SERVICE_ID: String(row.SERVICE_ID ?? "").trim(),
    FSD_ID: String(row.FSD_ID ?? "").trim(),
    LATITUDE: row.LATITUDE,
    LONGITUDE: row.LONGITUDE,
  };
}
