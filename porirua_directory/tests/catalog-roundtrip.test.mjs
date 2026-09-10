import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { catalogToRows } from "../scripts/catalog-rows.mjs";
import { buildCatalogEnvelope } from "../scripts/catalog-envelope.mjs";

const dataDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../data");

function withoutGeneratedAt(envelope) {
  const { generatedAt, ...rest } = envelope;
  return rest;
}

test("round-trip of committed catalog is lossless except generatedAt", async () => {
  const envelope = JSON.parse(await fs.readFile(path.join(dataDir, "services.json"), "utf8"));
  const overrides = JSON.parse(await fs.readFile(path.join(dataDir, "overrides.json"), "utf8"));

  const rebuilt = buildCatalogEnvelope(catalogToRows(envelope, overrides));

  assert.deepEqual(withoutGeneratedAt(rebuilt), withoutGeneratedAt(envelope));
});

/**
 * Known upstream data defect — not mapping design intent.
 *
 * `org-te-waka-whaiora-trust`: two org cards for the same trust at the same
 * address. Names, address strings, and `dedupeKey` geo (lat/lng rounded to
 * three decimals → `-41.138|174.842`) are identical. The split is the
 * published phone — `04 237 9608` on the four-line card, `0800 826 428` on
 * the South Wairarapa Truancy Service card — because `orgClusterKey`
 * includes phone. `orgIdForCluster` slugs both to the same id, so five
 * services sit 4 and 1 across two cards that share one public id. Dropping
 * phone from `orgClusterKey` merges exactly one group in the published
 * catalog: this one.
 *
 * `community-te-wahi-tiaki-tatou`: the same organisation entered twice in
 * the Connections Map sheet at slightly different addresses. Duplicate card
 * id and duplicate line id.
 *
 * Do not merge or renumber the cards in this mapping layer. A later unique
 * constraint on `public_id` should fail this test and inspect the catalog.
 */
test("committed catalog keeps two distinct rows when public_id collides", async () => {
  const envelope = JSON.parse(await fs.readFile(path.join(dataDir, "services.json"), "utf8"));
  const colliding = ["org-te-waka-whaiora-trust", "community-te-wahi-tiaki-tatou"];

  for (const publicId of colliding) {
    const cards = envelope.services.filter((entry) => entry.id === publicId);
    assert.equal(cards.length, 2, `${publicId} is two catalog cards in the committed file`);
  }

  const rows = catalogToRows(envelope, {});
  const rebuilt = buildCatalogEnvelope(rows);

  const orgCards = envelope.services.filter((entry) => entry.id === "org-te-waka-whaiora-trust");
  assert.deepEqual(
    orgCards.map((card) => card.services.map((line) => line.id)),
    [
      ["fsd-32213", "fsd-32212", "fsd-32214", "fsd-32216"],
      ["fsd-3331"],
    ]
  );

  for (const publicId of colliding) {
    const organizations = rows.organizations.filter((org) => org.public_id === publicId);
    assert.equal(organizations.length, 2);
    assert.notEqual(organizations[0].id, organizations[1].id);
    assert.equal(rebuilt.services.filter((entry) => entry.id === publicId).length, 2);
  }
});
