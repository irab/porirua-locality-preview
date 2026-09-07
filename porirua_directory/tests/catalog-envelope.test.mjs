import test from "node:test";
import assert from "node:assert/strict";
import { catalogToRows } from "../scripts/catalog-rows.mjs";
import { buildCatalogEnvelope } from "../scripts/catalog-envelope.mjs";
import { mergeServices } from "../scripts/merge-services.mjs";

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

function fsdRow(overrides) {
  return {
    id: overrides.id ?? `fsd-${overrides.fsdServiceId ?? "x"}`,
    fsdServiceId: overrides.fsdServiceId ?? "100",
    serviceName: overrides.serviceName ?? "Counselling",
    name: overrides.name ?? "Test Provider Porirua",
    description: overrides.description ?? "Help text",
    phone: overrides.phone ?? "04 111 2222",
    address: overrides.address ?? "1 Main St, Porirua",
    lat: overrides.lat ?? -41.13,
    lng: overrides.lng ?? 174.84,
    categories: overrides.categories ?? ["support"],
    source: "fsd",
    badges: [],
    communityFilters: [],
    orgType: "",
    url: "",
  };
}

test("reconstructed rows rebuild the original flat and org entries", () => {
  const services = [communityFlat, fsdFlat, oneLineOrg, multiLineOrg];
  const rebuilt = buildCatalogEnvelope(catalogToRows({ services }, {}));
  assert.deepEqual(rebuilt.services, services);
});

test("one-line organization grain rebuilds as kind organization, not a flat row", () => {
  const rows = catalogToRows({ services: [oneLineOrg] }, {});
  assert.equal(rows.organizations[0].render_grain, "organization");
  assert.equal(rows.services.length, 1);

  const rebuilt = buildCatalogEnvelope(rows);
  assert.equal(rebuilt.services.length, 1);
  assert.equal(rebuilt.services[0].kind, "organization");
  assert.equal(rebuilt.services[0].id, "org-capital-coast-dhb-rehabilitation-service");
  assert.equal(rebuilt.services[0].services.length, 1);
  assert.equal(rebuilt.services[0].services[0].fsdServiceId, "2589");
});

test("counts match mergeServices including input community and fsd sizes", () => {
  const shared = {
    name: "Test Provider Porirua",
    phone: "04 111 2222",
    address: "1 Main St, Porirua",
    lat: -41.13,
    lng: 174.84,
  };
  const merged = mergeServices({
    community: [
      {
        id: "community-a",
        name: "Awatea Community Garden",
        description: "Local kaupapa",
        source: "community",
        categories: ["food"],
        communityFilters: ["kai_initiatives"],
        orgType: "Community Group",
        phone: "",
        url: "",
        address: "",
        lat: -41.14,
        lng: 174.84,
        badges: [],
      },
    ],
    fsd: [
      fsdRow({ ...shared, fsdServiceId: "a", id: "fsd-a", serviceName: "Food bank" }),
      fsdRow({ ...shared, fsdServiceId: "b", id: "fsd-b", serviceName: "Counselling" }),
      {
        id: "f-dup",
        name: "Awatea Community Garden",
        description: "Generic gov text",
        source: "fsd",
        categories: ["food"],
        lat: -41.14,
        lng: 174.84,
      },
    ],
  });

  const rebuilt = buildCatalogEnvelope(
    catalogToRows({ counts: merged.counts, services: merged.services }, {})
  );
  assert.deepEqual(rebuilt.counts, merged.counts);
  assert.equal(rebuilt.counts.community, 1);
  assert.equal(rebuilt.counts.fsd, 3);
  assert.equal(rebuilt.counts.duplicatesHidden, 1);
  assert.equal(rebuilt.counts.organizations, 1);
  assert.equal(rebuilt.counts.published, 2);
  assert.equal(rebuilt.counts.serviceLines, 3);
});

test("entry order and org line order survive the round trip", () => {
  const services = [communityFlat, multiLineOrg, fsdFlat, oneLineOrg];
  const rebuilt = buildCatalogEnvelope(catalogToRows({ services }, {}));
  assert.deepEqual(
    rebuilt.services.map((entry) => entry.id),
    ["community-awatea-community-garden", "org-little-shadow", "fsd-2964", "org-capital-coast-dhb-rehabilitation-service"]
  );
  assert.deepEqual(
    rebuilt.services[1].services.map((line) => line.id),
    ["fsd-41716", "fsd-15904"]
  );
});
