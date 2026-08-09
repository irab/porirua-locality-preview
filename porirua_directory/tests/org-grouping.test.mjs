import test from "node:test";
import assert from "node:assert/strict";
import { mergeServices } from "../scripts/merge-services.mjs";
import {
  applyOrgGrouping,
  communityMatchesFsdCluster,
  orgClusterKey,
} from "../scripts/org-grouping.mjs";
import { mapFsdRowToService } from "../scripts/fsd-porirua-rules.mjs";

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

test("orgClusterKey clusters same site and name", () => {
  const a = fsdRow({ fsdServiceId: "1", serviceName: "A" });
  const b = fsdRow({ fsdServiceId: "2", serviceName: "B" });
  assert.equal(orgClusterKey(a), orgClusterKey(b));
});

test("applyOrgGrouping merges multi-row FSD cluster into organization", () => {
  const rows = [
    fsdRow({ fsdServiceId: "10", id: "fsd-10", serviceName: "Food bank" }),
    fsdRow({ fsdServiceId: "11", id: "fsd-11", serviceName: "Counselling" }),
  ];
  const { entries, stats } = applyOrgGrouping(rows);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].kind, "organization");
  assert.equal(entries[0].services.length, 2);
  assert.equal(stats.serviceLines, 2);
});

test("removing FSD row removes service line on regroup", () => {
  const three = [
    fsdRow({ fsdServiceId: "1", id: "fsd-1" }),
    fsdRow({ fsdServiceId: "2", id: "fsd-2" }),
    fsdRow({ fsdServiceId: "3", id: "fsd-3" }),
  ];
  assert.equal(applyOrgGrouping(three).entries[0].services.length, 3);
  assert.equal(applyOrgGrouping(three.slice(0, 2)).entries[0].services.length, 2);
});

test("community merges with FSD when normalised name and geo match", () => {
  const community = {
    id: "community-wesley",
    name: "Wesley Community Action",
    description: "Local kaupapa",
    source: "community",
    categories: ["food"],
    communityFilters: ["community_groups"],
    lat: -41.14,
    lng: 174.84,
    phone: "04 123 4567",
    address: "10 High St, Porirua",
    badges: [],
    orgType: "",
    url: "",
  };
  const fsd = fsdRow({
    name: "Wesley Community Action",
    fsdServiceId: "501",
    id: "fsd-501",
    lat: -41.14,
    lng: 174.84,
    phone: "04 123 4567",
    address: "10 High St, Porirua",
  });
  const { entries } = applyOrgGrouping([community, fsd]);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].id, "community-wesley");
  assert.equal(entries[0].services.length, 2);
});

test("community does not merge when name matches but site signals differ", () => {
  const community = {
    id: "community-a",
    name: "Shared Name Trust",
    source: "community",
    categories: [],
    communityFilters: ["other_community"],
    lat: -41.1,
    lng: 174.8,
    phone: "",
    address: "1 A St, Porirua",
    badges: [],
    orgType: "",
    url: "",
    description: "",
  };
  const fsd = fsdRow({
    name: "Shared Name Trust",
    fsdServiceId: "9",
    id: "fsd-9",
    lat: -41.2,
    lng: 174.9,
    phone: "04 999 8888",
    address: "99 B Rd, Porirua",
  });
  assert.equal(communityMatchesFsdCluster(community, [fsd]), false);
});

test("mapFsdRowToService uses stable id from SERVICE_ID when present", () => {
  const s = mapFsdRowToService({
    FSD_ID: "9001",
    SERVICE_ID: "9001-line-a",
    PROVIDER_NAME: "Salvation Army - Porirua",
    SERVICE_NAME: "Food bank",
    SERVICE_DETAIL: "Food help",
    PHYSICAL_DISTRICT: "Porirua",
  });
  assert.equal(s.id, "fsd-9001-line-a");
  assert.equal(s.fsdServiceId, "9001");
});

test("mergeServices applies org grouping in published output", () => {
  const shared = {
    name: "Test Provider Porirua",
    phone: "04 111 2222",
    address: "1 Main St, Porirua",
    lat: -41.13,
    lng: 174.84,
  };
  const out = mergeServices({
    community: [],
    fsd: [
      fsdRow({ ...shared, fsdServiceId: "a", id: "fsd-a" }),
      fsdRow({ ...shared, fsdServiceId: "b", id: "fsd-b" }),
    ],
  });
  assert.equal(out.counts.published, 1);
  assert.equal(out.services[0].kind, "organization");
});
