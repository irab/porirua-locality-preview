import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { expandServiceLines } from "../scripts/org-grouping.mjs";
import {
  buildOrgFromMembers,
  expandNeedFilterLines,
  groupCatalogForDisplay,
  groupForDisplay,
  groupServicesByOrg,
  orgClusterKey,
  orgServiceLinesForDisplay,
  serviceLineTitle,
} from "../group-services.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const servicesPath = path.join(__dirname, "../data/services.json");

function loadCatalog() {
  const raw = JSON.parse(readFileSync(servicesPath, "utf8"));
  return raw.services ?? raw;
}

const flatMemberFixture = () => [
  {
    id: "fsd-a",
    name: "The Salvation Army - Porirua",
    phone: "04 235 6266",
    address: "89 Warspite Avenue, Cannons Creek, Porirua, 5024",
    lat: -41.13684,
    lng: 174.872683,
    description: "Line A",
    source: "fsd",
    categories: ["housing"],
  },
  {
    id: "fsd-b",
    name: "The Salvation Army - Porirua",
    phone: "04 235 6266",
    address: "89 Warspite Avenue, Cannons Creek, Porirua, 5024",
    lat: -41.13684,
    lng: 174.872683,
    description: "Line B",
    source: "fsd",
    categories: ["food"],
  },
];

test("orgClusterKey groups flat FSD rows at the same site", () => {
  const members = flatMemberFixture();
  const keys = new Set(members.map(orgClusterKey));
  assert.equal(keys.size, 1);
});

test("buildOrgFromMembers assigns unique line ids", () => {
  const members = flatMemberFixture();
  const org = buildOrgFromMembers(members);
  assert.equal(org.services.length, 2);
  const lineIds = new Set(org.services.map((l) => l.lineId));
  assert.equal(lineIds.size, 2);
});

test("groupForDisplay collapses legacy flat duplicates into one org card", () => {
  const members = flatMemberFixture();
  const items = groupForDisplay(members);
  assert.equal(items.length, 1);
  assert.equal(items[0].type, "org");
  assert.equal(items[0].org.services.length, 2);
});

test("published catalog includes multi-line Salvation Army organization", () => {
  const catalog = loadCatalog();
  const sa = catalog.find(
    (e) =>
      e.kind === "organization" &&
      String(e.name ?? "").includes("Salvation Army")
  );
  assert.ok(sa, "expected Salvation Army organization entry");
  assert.ok(sa.services.length >= 2);
  const lineIds = new Set(sa.services.map((s) => s.lineId));
  assert.equal(lineIds.size, sa.services.length);
});

test("groupCatalogForDisplay yields one org card for filtered org lines", () => {
  const catalog = loadCatalog();
  const sa = catalog.find(
    (e) =>
      e.kind === "organization" &&
      String(e.name ?? "").includes("Salvation Army")
  );
  assert.ok(sa);
  const lines = expandServiceLines(catalog).filter((l) => l.orgId === sa.id);
  assert.ok(lines.length >= 2);
  const items = groupCatalogForDisplay(catalog, lines);
  assert.equal(items.length, 1);
  assert.equal(items[0].type, "org");
  assert.equal(items[0].org.services.length, sa.services.length);
});

test("groupCatalogForDisplay yields org card when one org line matches need", () => {
  const catalog = loadCatalog();
  const sa = catalog.find(
    (e) =>
      e.kind === "organization" &&
      String(e.name ?? "").includes("Salvation Army")
  );
  assert.ok(sa);
  const lines = expandServiceLines(catalog);
  const foodOnly = lines.filter(
    (l) =>
      l.orgId === sa.id &&
      l.categories?.some((c) => c === "food")
  );
  assert.ok(foodOnly.length >= 1);
  const items = groupCatalogForDisplay(catalog, foodOnly);
  assert.equal(items.length, 1);
  assert.equal(items[0].org.services.length, sa.services.length);
});

test("orgServiceLinesForDisplay shows all lines without need filter", () => {
  const org = buildOrgFromMembers(flatMemberFixture());
  assert.equal(orgServiceLinesForDisplay(org, new Set()).length, 2);
});

test("orgServiceLinesForDisplay hides non-matching lines when need filter active", () => {
  const org = buildOrgFromMembers(flatMemberFixture());
  const visible = orgServiceLinesForDisplay(org, new Set(["food"]));
  assert.equal(visible.length, 1);
  assert.ok(visible[0].categories.includes("food"));
});

test("groupServicesByOrg clusters legacy flat rows", () => {
  const members = flatMemberFixture();
  const orgs = groupServicesByOrg(members);
  assert.equal(orgs.length, 1);
  assert.equal(orgs[0].services.length, 2);
});

test("expandNeedFilterLines includes org siblings when one line matches need", () => {
  const members = flatMemberFixture();
  const expanded = expandNeedFilterLines(members, new Set(["food"]));
  assert.equal(expanded.length, 2);
  assert.ok(expanded.some((s) => s.id === "fsd-a"));
  assert.ok(expanded.some((s) => s.id === "fsd-b"));
});

test("serviceLineTitle uses first description line", () => {
  const title = serviceLineTitle({
    name: "Test Org",
    description: "First line here\nSecond line",
  });
  assert.equal(title, "First line here");
});
