import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mergeServices, parseCommunityCsv } from "../scripts/merge-services.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test("community row wins description when duplicate detected", () => {
  const out = mergeServices({
    community: [
      {
        id: "c1",
        name: "Wesley Community Action",
        description: "Local kaupapa",
        source: "community",
        categories: ["food"],
        lat: -41.14,
        lng: 174.84,
      },
    ],
    fsd: [
      {
        id: "f1",
        name: "Wesley Community Action",
        description: "Generic gov text",
        source: "fsd",
        categories: ["food"],
        lat: -41.14,
        lng: 174.84,
      },
    ],
  });
  const published = out.services.filter((s) => !s.duplicateOf);
  assert.equal(published.length, 1);
  assert.equal(published[0].description, "Local kaupapa");
  assert.deepEqual(published[0].badges, []);
  assert.equal(out.counts.duplicatesHidden, 1);
});

test("hiddenIds removes services from output", () => {
  const out = mergeServices({
    community: [{ id: "hide-me", name: "X", source: "community", lat: null, lng: null }],
    fsd: [],
    hiddenIds: ["hide-me"],
  });
  assert.equal(out.services.length, 0);
});

test("patches replace FSD lat/lng and address at merge", () => {
  const out = mergeServices({
    community: [],
    fsd: [
      {
        id: "fsd-porirua-respiritory-support-group-ora-toa",
        name: "Porirua Respiritory Support group - Ora Toa",
        address: "",
        lat: -41.080194,
        lng: 174.760239,
        source: "fsd",
      },
    ],
    patches: {
      "fsd-porirua-respiritory-support-group-ora-toa": {
        address: "22 Ngāti Toa Street, Takapūwāhia, Porirua",
        lat: -41.1248,
        lng: 174.835605,
      },
    },
  });
  const row = out.services[0];
  assert.match(row.address, /Ngāti Toa Street/);
  assert.equal(row.lat, -41.1248);
  assert.equal(row.lng, 174.835605);
});

test("parseCommunityCsv maps fixture rows", async () => {
  const csv = await fs.readFile(
    path.join(__dirname, "fixtures/connections-sample.csv"),
    "utf8"
  );
  const rows = parseCommunityCsv(csv);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].source, "community");
  assert.deepEqual(rows[0].badges, []);
  assert.ok(rows[0].communityFilters.includes("marae_iwi"));
});
