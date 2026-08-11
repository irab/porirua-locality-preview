import test from "node:test";
import assert from "node:assert/strict";
import {
  buildMapPopup,
  buildMapPopupForOrg,
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

test("community path popup keeps org type, omits themes and initiatives", () => {
  const html = buildMapPopup(communityListing, null, "community");
  assert.match(html, /map-popup__pill--type/);
  assert.match(html, /Social Enterprise/);
  assert.doesNotMatch(html, /How We Roll/);
  assert.doesNotMatch(html, /map-popup__pill--theme/);
  assert.doesNotMatch(html, /Key initiatives/);
  assert.doesNotMatch(html, /map-popup__label-chip/);
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

test("org popup omits teaser when service title duplicates org name", () => {
  const html = buildMapPopupForOrg(
    {
      orgId: "org-wellfed",
      name: "WELLfed",
      address: "1 Kai St, Porirua",
      phone: "",
      url: "https://www.wellfed.kiwi/",
      services: [{ title: "WELLfed", categories: ["food"] }],
    },
    null,
    new Set(["food"])
  );
  assert.match(html, /map-popup__title/);
  assert.match(html, />WELLfed</);
  assert.doesNotMatch(html, /map-popup__desc/);
  assert.match(html, /map-popup__contact-strip/);
  assert.match(html, /map-popup__website/);
  assert.match(html, /map-popup__view-in-list/);
  assert.doesNotMatch(html, /map-popup__scroll-to-list/);
});

test("org popup contact strip uses typographic website and phone links", () => {
  const html = buildMapPopupForOrg(
    {
      orgId: "org-x",
      name: "Example Org",
      phone: "04 123 4567",
      url: "https://example.org/",
      services: [{ title: "Youth programme", categories: ["youth"] }],
    },
    2.5,
    new Set()
  );
  assert.match(html, /map-popup__contact-sep/);
  assert.match(html, /map-popup__call/);
  assert.match(html, /2\.5 km away/);
  assert.match(html, /Youth programme/);
});
