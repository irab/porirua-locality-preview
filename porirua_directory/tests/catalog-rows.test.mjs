import test from "node:test";
import assert from "node:assert/strict";
import { catalogToRows } from "../scripts/catalog-rows.mjs";

const communityFlat = {
  id: "community-awatea-community-garden",
  name: "Awatea Community Garden",
  description: "Allotments in Rānui",
  phone: "",
  url: "https://example.org/garden",
  address: "Awatea Street, Rānui, Porirua",
  lat: -41.141543,
  lng: 174.847582,
  categories: [],
  communityFilters: ["community_groups", "kai_initiatives"],
  orgType: "Community Group",
  source: "community",
  badges: [],
  communityMeta: { theme: "Te Taiao", themes: "Te Taiao", initiatives: "", labels: "" },
};

const fsdFlat = {
  id: "fsd-2964",
  fsdServiceId: "4690",
  serviceName: "Support group - Ora Toa",
  name: "Porirua Respiritory Support group - Ora Toa",
  description: "See the website for more information",
  phone: "04 237 4520",
  url: "https://asthma.org.nz",
  address: "22 Ngāti Toa Street, Takapūwāhia, Porirua",
  lat: -41.1248,
  lng: 174.835605,
  categories: ["support", "health"],
  communityFilters: [],
  orgType: "",
  source: "fsd",
  badges: [],
};

const multiLineOrg = {
  kind: "organization",
  id: "org-little-shadow",
  name: "Little Shadow",
  description: "Parenting support",
  phone: "",
  url: "https://www.littleshadow.org.nz",
  address: "",
  lat: -41.10882,
  lng: 174.919308,
  orgType: "",
  source: "fsd",
  badges: [],
  communityFilters: [],
  categories: ["support"],
  services: [
    {
      lineId: "fsd-41716",
      id: "fsd-41716",
      serviceName: "He Waka Eke Noa",
      title: "He Waka Eke Noa",
      description: "Peer support",
      phone: "",
      url: "https://www.littleshadow.org.nz",
      categories: ["support"],
      badges: [],
      source: "fsd",
      fsdServiceId: "3092",
    },
    {
      lineId: "fsd-15904",
      id: "fsd-15904",
      serviceName: "Little Shadow Counsellors",
      title: "Little Shadow Counsellors",
      description: "Counselling",
      phone: "",
      url: "https://www.littleshadow.org.nz",
      categories: ["support"],
      badges: [],
      source: "fsd",
      fsdServiceId: "3092",
    },
  ],
};

const oneLineOrg = {
  kind: "organization",
  id: "org-capital-coast-dhb-rehabilitation-service",
  name: "Capital & Coast DHB Rehabilitation Service",
  description: "Community rehabilitation",
  phone: "04 385 5909",
  url: "https://www.ccdhb.org.nz",
  address: "45 Raiha Street, Kenepuru, Porirua, 5022",
  lat: -41.140082,
  lng: 174.829145,
  orgType: "",
  source: "fsd",
  badges: [],
  communityFilters: [],
  categories: ["support", "health"],
  services: [
    {
      lineId: "fsd-1956",
      id: "fsd-1956",
      serviceName: "Capital Coast Rehab (Community Rehabilitation Services)",
      title: "Capital Coast Rehab (Community Rehabilitation Services)",
      description: "Community rehabilitation",
      phone: "04 385 5909",
      url: "https://www.ccdhb.org.nz",
      categories: ["support", "health"],
      badges: [],
      source: "fsd",
      fsdServiceId: "2589",
    },
  ],
};

test("flat community entry becomes a flat-grain organization and one service", () => {
  const { organizations, services } = catalogToRows({ services: [communityFlat] }, {});
  assert.equal(organizations.length, 1);
  assert.equal(services.length, 1);
  assert.equal(organizations[0].render_grain, "flat");
  assert.equal(organizations[0].public_id, "community-awatea-community-garden");
  assert.equal(organizations[0].source_primary, "community");
  assert.deepEqual(organizations[0].community_filters, ["community_groups", "kai_initiatives"]);
  assert.deepEqual(organizations[0].community_meta, communityFlat.communityMeta);
  assert.equal(services[0].organization_id, organizations[0].id);
  assert.equal(services[0].line_id, "community-awatea-community-garden");
  assert.equal(services[0].fsd_service_id, null);
  assert.equal(services[0].fsd_legacy_id, null);
});

test("flat FSD entry stores SERVICE_ID and FSD_ID as separate columns", () => {
  const { organizations, services } = catalogToRows({ services: [fsdFlat] }, {});
  assert.equal(organizations[0].render_grain, "flat");
  assert.equal(organizations[0].public_id, "fsd-2964");
  assert.equal(services[0].line_id, "fsd-2964");
  assert.equal(services[0].fsd_service_id, "2964");
  assert.equal(services[0].fsd_legacy_id, "4690");
  assert.equal(services[0].service_name, "Support group - Ora Toa");
});

test("multi-line org card persists organization grain and one row per line", () => {
  const { organizations, services } = catalogToRows({ services: [multiLineOrg] }, {});
  assert.equal(organizations[0].render_grain, "organization");
  assert.equal(organizations[0].public_id, "org-little-shadow");
  assert.equal(services.length, 2);
  assert.deepEqual(
    services.map((s) => s.line_id),
    ["fsd-41716", "fsd-15904"]
  );
  assert.equal(services[0].fsd_service_id, "41716");
  assert.equal(services[0].fsd_legacy_id, "3092");
  assert.equal(services[1].fsd_service_id, "15904");
  assert.equal(services[1].fsd_legacy_id, "3092");
});

test("one-line org card keeps render_grain organization", () => {
  const { organizations, services } = catalogToRows({ services: [oneLineOrg] }, {});
  assert.equal(organizations[0].render_grain, "organization");
  assert.equal(organizations[0].public_id, "org-capital-coast-dhb-rehabilitation-service");
  assert.equal(services.length, 1);
  assert.equal(services[0].line_id, "fsd-1956");
  assert.equal(services[0].fsd_service_id, "1956");
  assert.equal(services[0].fsd_legacy_id, "2589");
});

// Synthetic twin of the committed-catalog collisions (see catalog-roundtrip.test.mjs).
test("duplicate public ids stay distinct organization rows", () => {
  const first = { ...oneLineOrg };
  const second = {
    ...oneLineOrg,
    services: [
      {
        ...oneLineOrg.services[0],
        lineId: "fsd-3331",
        id: "fsd-3331",
        serviceName: "Truancy",
        title: "Truancy",
        fsdServiceId: "5312",
      },
    ],
  };
  const { organizations, services } = catalogToRows({ services: [first, second] }, {});
  assert.equal(organizations.length, 2);
  assert.equal(organizations[0].public_id, organizations[1].public_id);
  assert.notEqual(organizations[0].id, organizations[1].id);
  assert.equal(services[0].organization_id, organizations[0].id);
  assert.equal(services[1].organization_id, organizations[1].id);
});

test("overrides decompose to hide and patch rows", () => {
  const { overrides } = catalogToRows(
    { services: [] },
    {
      hiddenIds: [],
      patches: {
        "fsd-2964": {
          address: "22 Ngāti Toa Street, Takapūwāhia, Porirua",
          lat: -41.1248,
          lng: 174.835605,
        },
      },
    }
  );
  assert.deepEqual(overrides, [
    {
      target_type: "service",
      target_id: "fsd-2964",
      action: "patch",
      patch: {
        address: "22 Ngāti Toa Street, Takapūwāhia, Porirua",
        lat: -41.1248,
        lng: 174.835605,
      },
      reason: null,
    },
  ]);
});
