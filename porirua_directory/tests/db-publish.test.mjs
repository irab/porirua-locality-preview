import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bootstrapFromJson } from "../scripts/db-import-from-json.mjs";
import {
  getCurrentSnapshot,
  publishCatalog,
  rollbackCatalog,
} from "../scripts/publish-catalog.mjs";
import { orgClusterKey } from "../scripts/lib/org-cluster.mjs";
import { withTestDatabase } from "./helpers/postgres.mjs";

const dataDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../data");

function withoutGeneratedAt(envelope) {
  const { generatedAt, ...rest } = envelope;
  return rest;
}

function sha256Prefix4(value) {
  return createHash("sha256").update(value).digest("hex").slice(0, 4);
}

function rewriteCollisionIds(envelope) {
  return {
    ...envelope,
    services: envelope.services.map((entry) => {
      if (entry.id.startsWith("org-te-waka-whaiora-trust-")) {
        return { ...entry, id: "org-te-waka-whaiora-trust" };
      }
      if (entry.id.startsWith("community-te-wahi-tiaki-tatou-")) {
        return { ...entry, id: "community-te-wahi-tiaki-tatou" };
      }
      return entry;
    }),
  };
}

async function loadCommitted() {
  return {
    envelope: JSON.parse(await fs.readFile(path.join(dataDir, "services.json"), "utf8")),
    overrides: JSON.parse(await fs.readFile(path.join(dataDir, "overrides.json"), "utf8")),
  };
}

test("bootstrap then publish reproduces the committed catalog except generatedAt and two disambiguated ids", async (t) => {
  await withTestDatabase(t, async (client) => {
    const { envelope, overrides } = await loadCommitted();
    await bootstrapFromJson({ envelope, overrides, db: client });
    const { envelope: published } = await publishCatalog({ db: client, publishedBy: "test" });

    const truancyKey = orgClusterKey({
      name: "Te Waka Whaiora Trust",
      phone: "0800 826 428",
      address: "1 Walton Leigh Avenue, Porirua City Centre, Porirua, 5022",
      lat: -41.137747,
      lng: 174.841918,
    });
    const level1Key = orgClusterKey({
      name: "Te Wāhi Tiaki Tātou",
      phone: "",
      address: "Level 1, 1 Walton Leigh Ave, Porirua CBD, Porirua 5022",
      lat: -41.1355,
      lng: 174.8423,
    });
    const teWakaSuffix = `org-te-waka-whaiora-trust-${sha256Prefix4(truancyKey)}`;
    const communitySuffix = `community-te-wahi-tiaki-tatou-${sha256Prefix4(level1Key)}`;

    assert.equal(
      published.services.filter((entry) => entry.id === "org-te-waka-whaiora-trust").length,
      1
    );
    assert.equal(published.services.filter((entry) => entry.id === teWakaSuffix).length, 1);
    assert.equal(
      published.services.filter((entry) => entry.id === "community-te-wahi-tiaki-tatou").length,
      1
    );
    assert.equal(published.services.filter((entry) => entry.id === communitySuffix).length, 1);

    assert.deepEqual(
      withoutGeneratedAt(rewriteCollisionIds(published)),
      withoutGeneratedAt(envelope)
    );
  });
});

test("draft, hidden, pending_review, and merged_into content never reach a snapshot", async (t) => {
  await withTestDatabase(t, async (client) => {
    const { envelope, overrides } = await loadCommitted();
    await bootstrapFromJson({ envelope, overrides, db: client });

    await client.query(
      `INSERT INTO organizations (id, public_id, render_grain, name, cluster_key, status, sort_key)
       VALUES
         ('org-draft', 'org-draft', 'flat', 'Draft Only', 'draft-key', 'draft', 9000),
         ('org-hidden', 'org-hidden', 'flat', 'Hidden Only', 'hidden-key', 'hidden', 9001),
         ('org-merged', 'org-merged', 'flat', 'Merged Away', 'merged-key', 'published', 9002)`
    );
    await client.query(
      `UPDATE organizations SET merged_into = 'org-draft' WHERE id = 'org-merged'`
    );
    await client.query(
      `INSERT INTO services (id, organization_id, line_id, title, source, status)
       VALUES
         ('svc-draft', 'org-draft', 'svc-draft', 'Draft line', 'fsd', 'published'),
         ('svc-hidden', 'org-hidden', 'svc-hidden', 'Hidden line', 'fsd', 'published'),
         ('svc-merged', 'org-merged', 'svc-merged', 'Merged line', 'fsd', 'published')`
    );
    await client.query(
      `UPDATE services SET status = 'pending_review' WHERE id = 'fsd-2964'`
    );

    const { envelope: published } = await publishCatalog({ db: client });
    const ids = published.services.map((entry) => entry.id);
    assert.equal(ids.includes("org-draft"), false);
    assert.equal(ids.includes("org-hidden"), false);
    assert.equal(ids.includes("org-merged"), false);
    assert.equal(ids.includes("fsd-2964"), false);
    assert.ok(published.services.every((entry) => entry.name !== "Draft Only"));
  });
});

test("publish is atomic with one is_current snapshot and rollback restores the older envelope", async (t) => {
  await withTestDatabase(t, async (client) => {
    const { envelope, overrides } = await loadCommitted();
    await bootstrapFromJson({ envelope, overrides, db: client });

    const first = await publishCatalog({ db: client, publishedBy: "v1" });
    await client.query(`UPDATE organizations SET name = 'Renamed For Snapshot Two' WHERE public_id = 'fsd-2964'`);
    const second = await publishCatalog({ db: client, publishedBy: "v2" });

    const currentCount = await client.query(
      `SELECT count(*)::int AS n FROM catalog_snapshots WHERE is_current`
    );
    assert.equal(currentCount.rows[0].n, 1);
    assert.notEqual(first.version, second.version);
    assert.ok(
      second.envelope.services.some((entry) => entry.name === "Renamed For Snapshot Two")
    );

    const rolled = await rollbackCatalog({ db: client, version: first.version });
    const current = await getCurrentSnapshot(client);
    assert.equal(Number(current.version), first.version);
    assert.deepEqual(withoutGeneratedAt(rolled.envelope), withoutGeneratedAt(first.envelope));
    assert.equal(
      current.envelope.services.some((entry) => entry.name === "Renamed For Snapshot Two"),
      false
    );
  });
});
