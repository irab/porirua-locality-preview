import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { catalogToRows } from "../scripts/catalog-rows.mjs";
import { orgClusterKey } from "../scripts/lib/org-cluster.mjs";
import {
  disambiguatePublicIds,
  seedRawImport,
} from "../scripts/lib/catalog-bootstrap.mjs";

const dataDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../data");

function sha256Prefix4(value) {
  return createHash("sha256").update(value).digest("hex").slice(0, 4);
}

function shuffle(items, seed) {
  const out = [...items];
  let n = seed;
  for (let i = out.length - 1; i > 0; i -= 1) {
    n = (n * 1664525 + 1013904223) >>> 0;
    const j = n % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function prepareRows(envelope) {
  const rows = catalogToRows(envelope, {});
  return disambiguatePublicIds(rows.organizations, rows.services);
}

test("colliding public ids are disambiguated by line count then cluster_key", async () => {
  const envelope = JSON.parse(await fs.readFile(path.join(dataDir, "services.json"), "utf8"));
  const { organizations } = prepareRows(envelope);

  const teWaka = organizations.filter((org) =>
    org.public_id.startsWith("org-te-waka-whaiora-trust")
  );
  assert.equal(teWaka.length, 2);
  const teWakaWinner = teWaka.find((org) => org.public_id === "org-te-waka-whaiora-trust");
  const teWakaLoser = teWaka.find((org) => org.public_id !== "org-te-waka-whaiora-trust");
  assert.ok(teWakaWinner, "four-line card keeps the bare public_id");
  assert.equal(teWakaWinner.phone, "04 237 9608");
  const truancyKey = orgClusterKey({
    name: "Te Waka Whaiora Trust",
    phone: "0800 826 428",
    address: "1 Walton Leigh Avenue, Porirua City Centre, Porirua, 5022",
    lat: -41.137747,
    lng: 174.841918,
  });
  assert.equal(teWakaLoser.public_id, `org-te-waka-whaiora-trust-${sha256Prefix4(truancyKey)}`);
  assert.equal(teWakaLoser.phone, "0800 826 428");
  assert.equal(teWakaLoser.cluster_key, truancyKey);

  const community = organizations.filter((org) =>
    org.public_id.startsWith("community-te-wahi-tiaki-tatou")
  );
  assert.equal(community.length, 2);
  const avenue = community.find((org) => org.address === "1 Walton Leigh Avenue, Porirua");
  const level1 = community.find(
    (org) => org.address === "Level 1, 1 Walton Leigh Ave, Porirua CBD, Porirua 5022"
  );
  assert.equal(avenue.public_id, "community-te-wahi-tiaki-tatou");
  assert.equal(
    level1.public_id,
    `community-te-wahi-tiaki-tatou-${sha256Prefix4(orgClusterKey(level1))}`
  );
});

test("disambiguated ids are stable when envelope order is shuffled", async () => {
  const envelope = JSON.parse(await fs.readFile(path.join(dataDir, "services.json"), "utf8"));
  const first = prepareRows(envelope);
  const shuffled = prepareRows({
    ...envelope,
    services: shuffle(envelope.services, 20260908),
  });

  const firstIds = first.organizations
    .filter(
      (org) =>
        org.public_id.startsWith("org-te-waka-whaiora-trust") ||
        org.public_id.startsWith("community-te-wahi-tiaki-tatou")
    )
    .map((org) => org.public_id)
    .sort();
  const shuffledIds = shuffled.organizations
    .filter(
      (org) =>
        org.public_id.startsWith("org-te-waka-whaiora-trust") ||
        org.public_id.startsWith("community-te-wahi-tiaki-tatou")
    )
    .map((org) => org.public_id)
    .sort();

  assert.deepEqual(shuffledIds, firstIds);
  assert.deepEqual(
    shuffled.organizations.map((org) => org.id).sort(),
    first.organizations.map((org) => org.id).sort()
  );
});

test("raw_import is seeded for every FSD-sourced line and no community line", async () => {
  const envelope = JSON.parse(await fs.readFile(path.join(dataDir, "services.json"), "utf8"));
  const rows = catalogToRows(envelope, {});
  const disambiguated = disambiguatePublicIds(rows.organizations, rows.services);
  const seeded = seedRawImport(disambiguated.organizations, disambiguated.services);

  const fsd = seeded.filter((service) => service.source === "fsd");
  const community = seeded.filter((service) => service.source === "community");
  assert.equal(fsd.length, 162);
  assert.ok(fsd.every((service) => service.raw_import && typeof service.raw_import === "object"));
  assert.ok(community.every((service) => service.raw_import == null));
  const sample = fsd[0];
  const org = disambiguated.organizations.find((row) => row.id === sample.organization_id);
  assert.equal(sample.raw_import.name, org.name);
  assert.equal(sample.raw_import.serviceName, sample.service_name);
  assert.equal(sample.raw_import.fsd_service_id, sample.fsd_service_id);
});
