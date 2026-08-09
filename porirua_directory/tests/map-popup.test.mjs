import test from "node:test";
import assert from "node:assert/strict";
import {
  buildMapPopup,
  mapPopupShowsCommunityChrome,
} from "../map-popup.mjs";

const communityListing = {
  name: "Porirua Kai Collective",
  source: "community",
  orgType: "Social Enterprise",
  categories: ["food"],
  communityFilters: ["other_community"],
  communityMeta: {
    themes: "How We Roll, Te Taiao",
    initiatives: "Planting | Weeding",
    labels: "Kai",
  },
  description: "Community food initiative.",
  address: "1 Main St, Porirua",
};

test("mapPopupShowsCommunityChrome is false on support path even for community source", () => {
  assert.equal(mapPopupShowsCommunityChrome(communityListing, "support"), false);
  assert.equal(mapPopupShowsCommunityChrome(communityListing, "community"), true);
});

test("support path popup omits Connections Map org type and theme pills", () => {
  const html = buildMapPopup(communityListing, null, "support");
  assert.match(html, /map-popup__title/);
  assert.doesNotMatch(html, /map-popup__pill--type/);
  assert.doesNotMatch(html, /Social Enterprise/);
  assert.doesNotMatch(html, /How We Roll/);
  assert.doesNotMatch(html, /map-popup__pill--theme/);
  assert.doesNotMatch(html, /Key initiatives/);
  assert.doesNotMatch(html, /map-popup__label-chip/);
});

test("community path popup keeps org type, themes, and initiatives", () => {
  const html = buildMapPopup(communityListing, null, "community");
  assert.match(html, /map-popup__pill--type/);
  assert.match(html, /Social Enterprise/);
  assert.match(html, /How We Roll/);
  assert.match(html, /Key initiatives/);
});

test("FSD listing on support keeps need category pills only", () => {
  const fsd = {
    name: "Little People of New Zealand",
    source: "fsd",
    categories: ["support", "health"],
    badges: [],
    orgType: "",
    communityFilters: [],
    description: "Support network.",
  };
  const html = buildMapPopup(fsd, null, "support");
  assert.match(html, /Support/);
  assert.doesNotMatch(html, /map-popup__pill--theme/);
});
