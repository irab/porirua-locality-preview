import test from "node:test";
import assert from "node:assert/strict";
import {
  findOrganisationNameMatches,
  findServiceLineNameMatches,
  foldOrgName,
  namesNearMatch,
  preferMacronisedName,
} from "../scripts/lib/name-match.mjs";
import { slugId } from "../scripts/lib/normalize.mjs";

/** Live catalog cards — matcher is unfinished until all four pairs flag. */
const LIVE_ORGS = [
  {
    id: "org-te-waka-whaiora-trust",
    public_id: "org-te-waka-whaiora-trust",
    name: "Te Waka Whaiora Trust",
    address: "1 Walton Leigh Avenue, Porirua City Centre, Porirua, 5022",
    phone: "04 237 9608",
    status: "published",
  },
  {
    id: "org-te-waka-whaiora-trust-342f",
    public_id: "org-te-waka-whaiora-trust-342f",
    name: "Te Waka Whaiora Trust",
    address: "1 Walton Leigh Avenue, Porirua City Centre, Porirua, 5022",
    phone: "0800 826 428",
    status: "published",
  },
  {
    id: "community-te-wahi-tiaki-tatou",
    public_id: "community-te-wahi-tiaki-tatou",
    name: "Te Wāhi Tiaki Tātou",
    address: "1 Walton Leigh Avenue, Porirua",
    phone: "",
    status: "published",
  },
  {
    id: "community-te-wahi-tiaki-tatou-ea82",
    public_id: "community-te-wahi-tiaki-tatou-ea82",
    name: "Te Wāhi Tiaki Tātou",
    address: "Level 1, 1 Walton Leigh Ave, Porirua CBD, Porirua 5022",
    phone: "",
    status: "published",
  },
  {
    id: "community-porirua-whanau-centre",
    public_id: "community-porirua-whanau-centre",
    name: "Porirua Whānau Centre",
    address: "16 Bedford Court, Cannons Creek, Porirua",
    phone: "",
    status: "published",
  },
  {
    id: "org-porirua-whanau-centre",
    public_id: "org-porirua-whanau-centre",
    name: "Porirua Whanau Centre",
    address: "16 Bedford Court, Cannons Creek, Porirua, 5024",
    phone: "04 237 7749",
    status: "published",
  },
  {
    id: "community-te-runanga-o-toa-rangatira",
    public_id: "community-te-runanga-o-toa-rangatira",
    name: "Te Rūnanga O Toa Rangatira",
    address: "",
    phone: "",
    status: "published",
  },
  {
    id: "org-te-runanga-o-toa-rangatira",
    public_id: "org-te-runanga-o-toa-rangatira",
    name: "Te Runanga o Toa Rangatira",
    address: "2 Cobham Court, Porirua City Centre, Porirua, 5022",
    phone: "0800 862 672",
    status: "published",
  },
];

function matchIds(query) {
  return findOrganisationNameMatches(query, LIVE_ORGS)
    .map((row) => row.id)
    .sort();
}

test("foldOrgName NFD-folds te reo macrons the same way slugId does", () => {
  assert.equal(foldOrgName("Whāiora"), foldOrgName("Whaiora"));
  assert.equal(foldOrgName("Whānau"), foldOrgName("Whanau"));
  assert.equal(foldOrgName("Rūnanga"), foldOrgName("Runanga"));
  assert.equal(foldOrgName("Te Wāhi Tiaki Tātou"), foldOrgName("Te Wahi Tiaki Tatou"));
  assert.equal(
    slugId("Porirua Whānau Centre", "community-"),
    slugId("Porirua Whanau Centre", "community-")
  );
  assert.equal(slugId("Porirua Whānau Centre", "community-"), "community-porirua-whanau-centre");
});

test("foldOrgName strips punctuation, case, and legal suffixes for compare only", () => {
  assert.equal(foldOrgName("Te Waka Whaiora Trust."), foldOrgName("Te Waka Whaiora"));
  assert.equal(foldOrgName("Acme Incorporated"), foldOrgName("Acme Inc"));
  assert.equal(foldOrgName("Acme Limited"), foldOrgName("Acme Ltd"));
  assert.equal(foldOrgName("  TE   WAKA   WHAIORA  "), foldOrgName("te waka whaiora"));
});

test("foldOrgName does not strip te or ngāti", () => {
  assert.notEqual(foldOrgName("Te Waka"), foldOrgName("Waka"));
  assert.notEqual(foldOrgName("Ngāti Toa"), foldOrgName("Toa"));
  assert.equal(foldOrgName("Ngāti Toa"), foldOrgName("Ngati Toa"));
});

test("namesNearMatch rejects empty and unrelated names", () => {
  assert.equal(namesNearMatch("", ""), false);
  assert.equal(namesNearMatch("Wesley Community Action", "Porirua Whānau Centre"), false);
  assert.equal(namesNearMatch("Te Rūnanga o Toa Rangatira", "Te Waka Whaiora Trust"), false);
});

test("matcher flags both Te Waka Whaiora cards including macronised typing", () => {
  const expected = [
    "org-te-waka-whaiora-trust",
    "org-te-waka-whaiora-trust-342f",
  ];
  assert.deepEqual(matchIds("Te Waka Whaiora Trust"), expected);
  assert.deepEqual(matchIds("Te Waka Whāiora Trust"), expected);
  assert.deepEqual(matchIds("Te Waka Whāiora"), expected);
});

test("matcher flags both Te Wāhi Tiaki Tātou cards", () => {
  const expected = [
    "community-te-wahi-tiaki-tatou",
    "community-te-wahi-tiaki-tatou-ea82",
  ];
  assert.deepEqual(matchIds("Te Wāhi Tiaki Tātou"), expected);
  assert.deepEqual(matchIds("Te Wahi Tiaki Tatou"), expected);
});

test("matcher flags Whānau / Whanau Centre pair", () => {
  const expected = [
    "community-porirua-whanau-centre",
    "org-porirua-whanau-centre",
  ];
  assert.deepEqual(matchIds("Porirua Whānau Centre"), expected);
  assert.deepEqual(matchIds("Porirua Whanau Centre"), expected);
});

test("matcher flags Rūnanga / Runanga pair", () => {
  const expected = [
    "community-te-runanga-o-toa-rangatira",
    "org-te-runanga-o-toa-rangatira",
  ];
  assert.deepEqual(matchIds("Te Rūnanga o Toa Rangatira"), expected);
  assert.deepEqual(matchIds("Te Runanga o Toa Rangatira"), expected);
  assert.deepEqual(matchIds("Te Rūnanga O Toa Rangatira"), expected);
});

test("hidden organisations are still matches", () => {
  const orgs = [
    {
      id: "community-hidden-hub",
      public_id: "community-hidden-hub",
      name: "Cannons Creek Hub",
      address: "1 Bedford Court",
      phone: "",
      status: "hidden",
    },
  ];
  const matches = findOrganisationNameMatches("Cannons Creek Hub", orgs);
  assert.equal(matches.length, 1);
  assert.equal(matches[0].status, "hidden");
  assert.equal(matches[0].id, "community-hidden-hub");
});

test("merged_into follow returns the merge target", () => {
  const orgs = [
    {
      id: "org-old-name",
      public_id: "org-old-name",
      name: "Old Whānau Centre",
      status: "hidden",
      merged_into: "org-survivor",
    },
    {
      id: "org-survivor",
      public_id: "org-survivor",
      name: "Porirua Whānau Centre",
      address: "16 Bedford Court",
      phone: "04 237 7749",
      status: "published",
    },
  ];
  const matches = findOrganisationNameMatches("Old Whanau Centre", orgs);
  assert.equal(matches.length, 1);
  assert.equal(matches[0].id, "org-survivor");
  assert.equal(matches[0].name, "Porirua Whānau Centre");
  assert.deepEqual(matches[0].viaMergedFrom, {
    id: "org-old-name",
    publicId: "org-old-name",
    name: "Old Whānau Centre",
  });
});

test("service-line matcher is scoped to the lines it is given, including hidden", () => {
  const lines = [
    {
      id: "line-a",
      organization_id: "org-te-waka-whaiora-trust",
      title: "Whānau support",
      status: "published",
    },
    {
      id: "line-hidden",
      organization_id: "org-te-waka-whaiora-trust",
      title: "Whanau support",
      status: "hidden",
    },
    {
      id: "line-other",
      organization_id: "org-te-waka-whaiora-trust",
      title: "Truancy",
      status: "published",
    },
  ];
  const matches = findServiceLineNameMatches("Whānau support", lines);
  assert.deepEqual(
    matches.map((row) => row.id).sort(),
    ["line-a", "line-hidden"]
  );
  assert.equal(
    findServiceLineNameMatches("Budgeting", lines).length,
    0
  );
});

test("preferMacronisedName keeps the form with diacritics", () => {
  assert.equal(
    preferMacronisedName("Porirua Whanau Centre", "Porirua Whānau Centre"),
    "Porirua Whānau Centre"
  );
  assert.equal(
    preferMacronisedName("Te Runanga o Toa Rangatira", "Te Rūnanga o Toa Rangatira"),
    "Te Rūnanga o Toa Rangatira"
  );
  assert.equal(
    preferMacronisedName("Porirua Whānau Centre", "Porirua Whanau Centre"),
    "Porirua Whānau Centre"
  );
});
