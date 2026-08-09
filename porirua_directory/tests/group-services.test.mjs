import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import {
  buildOrgFromMembers,
  groupForDisplay,
  groupServicesByOrg,
  orgClusterKey,
  serviceLineTitle,
} from "../group-services.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const servicesPath = path.join(__dirname, "../data/services.json");

function loadServices() {
  const raw = JSON.parse(readFileSync(servicesPath, "utf8"));
  return raw.services ?? raw;
}

test("orgClusterKey groups Salvation Army rows together", () => {
  const services = loadServices();
  const sa = services.filter((s) => s.id === "fsd-the-salvation-army-porirua");
  assert.ok(sa.length >= 2);
  const keys = new Set(sa.map(orgClusterKey));
  assert.equal(keys.size, 1);
});

test("buildOrgFromMembers assigns unique line ids", () => {
  const services = loadServices();
  const sa = services.filter((s) => s.id === "fsd-the-salvation-army-porirua");
  const org = buildOrgFromMembers(sa);
  assert.equal(org.orgId, "fsd-the-salvation-army-porirua");
  assert.equal(org.services.length, sa.length);
  const lineIds = new Set(org.services.map((l) => l.lineId));
  assert.equal(lineIds.size, sa.length);
});

test("groupForDisplay collapses multi-row FSD into one org card item", () => {
  const services = loadServices();
  const sa = services.filter((s) => s.id === "fsd-the-salvation-army-porirua");
  const items = groupForDisplay(sa);
  assert.equal(items.length, 1);
  assert.equal(items[0].type, "org");
  assert.equal(items[0].org.services.length, sa.length);
});

test("groupServicesByOrg returns fewer orgs than flat FSD rows", () => {
  const services = loadServices();
  const fsd = services.filter((s) => s.source === "fsd");
  const orgs = groupServicesByOrg(services);
  assert.ok(orgs.length < fsd.length);
});

test("serviceLineTitle uses first description line", () => {
  const title = serviceLineTitle({
    name: "Test Org",
    description: "First line here\nSecond line",
  });
  assert.equal(title, "First line here");
});
