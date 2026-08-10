import test from "node:test";
import assert from "node:assert/strict";
import {
  websiteDisplayLabel,
  websiteHostname,
  websiteAnchorHtml,
  websiteLinkAriaLabel,
  cardFooterHtml,
  socialPlatformForUrl,
  isUnusableWebsiteUrl,
} from "../contact-links.mjs";

test("websiteHostname strips www and path", () => {
  assert.equal(websiteHostname("http://www.lpnz.org.nz/foo/bar"), "lpnz.org.nz");
  assert.equal(websiteHostname("https://example.org"), "example.org");
});

test("websiteDisplayLabel uses base domain for non-social URLs", () => {
  assert.equal(
    websiteDisplayLabel("https://example.org/foo/bar"),
    "example.org"
  );
  assert.equal(websiteDisplayLabel("http://www.lpnz.org.nz"), "lpnz.org.nz");
});

test("isUnusableWebsiteUrl rejects FSD placeholder host", () => {
  assert.equal(isUnusableWebsiteUrl("https://0"), true);
  assert.equal(isUnusableWebsiteUrl("https://example.org"), false);
});

test("websiteDisplayLabel uses branded labels for social hosts", () => {
  assert.equal(
    websiteDisplayLabel(
      "https://www.facebook.com/PukeruaBayCommunityGarden/"
    ),
    "Facebook page"
  );
  assert.equal(
    websiteDisplayLabel("https://www.instagram.com/porirua_council/"),
    "Instagram"
  );
  assert.equal(
    websiteDisplayLabel("https://www.linkedin.com/company/example/"),
    "LinkedIn"
  );
  assert.equal(
    websiteDisplayLabel("https://twitter.com/example/status/1"),
    "X"
  );
  assert.equal(websiteDisplayLabel("https://x.com/example"), "X");
});

test("socialPlatformForUrl detects known hosts", () => {
  assert.equal(socialPlatformForUrl("https://fb.com/page")?.id, "facebook");
  assert.equal(socialPlatformForUrl("https://example.org"), null);
});

test("websiteAnchorHtml keeps full URL in href and title", () => {
  const url = "https://www.facebook.com/groups/1055760224479856/about";
  const html = websiteAnchorHtml(url, { className: "card__website" });
  assert.match(html, new RegExp(`href="${url.replace(/\//g, "\\/")}"`));
  assert.match(html, /title="https:\/\/www\.facebook\.com/);
  assert.match(html, />Facebook page/);
  assert.match(html, /link-social-icon--facebook/);
  assert.doesNotMatch(html, />([^<]*\/groups\/)/);
  assert.doesNotMatch(html, /link-external-icon/);
});

test("websiteAnchorHtml uses external icon for generic domains", () => {
  const html = websiteAnchorHtml("https://example.org/path", {
    className: "card__website",
  });
  assert.match(html, />example\.org/);
  assert.match(html, /link-external-icon/);
  assert.match(html, /aria-label="https:\/\/example\.org\/path"/);
});

test("websiteLinkAriaLabel is the full URL", () => {
  assert.equal(
    websiteLinkAriaLabel("https://www.facebook.com/foo"),
    "https://www.facebook.com/foo"
  );
});

test("cardFooterHtml omits website for FSD placeholder URL", () => {
  const html = cardFooterHtml("021 111", "https://0");
  assert.doesNotMatch(html, /card__website/);
  assert.match(html, /card__call/);
});

test("cardFooterHtml shows domain label and phone with icon in footer", () => {
  const html = cardFooterHtml("021 130 9377", "http://www.lpnz.org.nz");
  assert.match(html, /class="card__website"[^>]*>lpnz\.org\.nz/);
  assert.match(html, /class="card__call"[^>]*>[\s\S]*021 130 9377/);
  assert.match(html, /link-external-icon/);
  assert.match(html, /link-phone-icon/);
  assert.doesNotMatch(html, />Call</);
});
