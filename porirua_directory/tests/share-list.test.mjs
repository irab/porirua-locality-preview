import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import {
  buildShareCodebook,
  buildShareUrl,
  decodeShareParam,
  encodeShareCodes,
  parseShareParamFromHash,
  shortCode,
} from "../share-list.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const servicesPath = path.join(__dirname, "../data/services.json");

function loadCatalogIds() {
  const raw = JSON.parse(readFileSync(servicesPath, "utf8"));
  const entries = raw.services ?? raw;
  return entries.map((e) => e.id).filter(Boolean);
}

const SAMPLE_IDS = [
  "org-child-adolescent-mental-health-services-capital-coast-dhb",
  "fsd-2964",
  "community-porirua-city-council-community-waste-minimisation-grants-scheme",
  "community-awatea-community-garden",
];

test("shortCode is lowercase base36 of the requested length", () => {
  const code = shortCode("org-example", 6);
  assert.equal(code.length, 6);
  assert.match(code, /^[0-9a-z]+$/);
  assert.equal(shortCode("org-example", 6), code);
});

test("encode then decode round-trips real-shaped slugs", () => {
  const codebook = buildShareCodebook(SAMPLE_IDS);
  const codes = encodeShareCodes(SAMPLE_IDS, codebook);
  assert.equal(codes.length, codebook.length * SAMPLE_IDS.length);
  const { ids, unknownCount } = decodeShareParam(codes, codebook);
  assert.deepEqual(ids, SAMPLE_IDS);
  assert.equal(unknownCount, 0);
});

test("codebook is unique across the published catalog", () => {
  const catalogIds = [...new Set(loadCatalogIds())];
  assert.ok(catalogIds.length > 50);
  const codebook = buildShareCodebook(catalogIds);
  assert.ok(codebook.length >= 6 && codebook.length <= 8);
  assert.equal(codebook.encode.size, catalogIds.length);
  assert.equal(codebook.decode.size, catalogIds.length);
  const seen = new Set();
  for (const id of catalogIds) {
    const code = codebook.encode.get(id);
    assert.ok(code, id);
    assert.equal(code.length, codebook.length);
    assert.equal(seen.has(code), false, `collision ${code} for ${id}`);
    seen.add(code);
  }
});

test("decode ignores junk and leftover characters", () => {
  const codebook = buildShareCodebook(SAMPLE_IDS);
  const codes = encodeShareCodes(SAMPLE_IDS.slice(0, 2), codebook);
  const { ids, unknownCount } = decodeShareParam(
    `!!${codes}xyz`,
    codebook
  );
  assert.deepEqual(ids, SAMPLE_IDS.slice(0, 2));
  assert.equal(unknownCount, 0);
});

test("decode counts unknown codes and skips them", () => {
  const codebook = buildShareCodebook(SAMPLE_IDS);
  const known = codebook.encode.get(SAMPLE_IDS[0]);
  const fake = "zzzzzz".slice(0, codebook.length);
  const { ids, unknownCount } = decodeShareParam(known + fake, codebook);
  assert.deepEqual(ids, [SAMPLE_IDS[0]]);
  assert.equal(unknownCount, 1);
});

test("buildShareUrl is origin + path + hash and has no query string", () => {
  const url = buildShareUrl({
    origin: "https://directory.bsky.nz",
    pathname: "/index.html",
    codes: "abc123def456",
  });
  assert.equal(
    url,
    "https://directory.bsky.nz/index.html#mylist?s=abc123def456"
  );
  assert.equal(new URL(url).search, "");
});

test("parseShareParamFromHash reads s= after mylist", () => {
  assert.equal(parseShareParamFromHash("#mylist?s=abc123"), "abc123");
  assert.equal(parseShareParamFromHash("#MYLIST?s=AbC123"), "abc123");
  assert.equal(parseShareParamFromHash("#mylist"), "");
  assert.equal(parseShareParamFromHash("#support?s=abc123"), "");
});
