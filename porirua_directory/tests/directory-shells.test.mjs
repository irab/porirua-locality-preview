import test from "node:test";
import assert from "node:assert/strict";
import { formHighlightFields, SHARED_FORM_FIELDS } from "../editor-core/form-highlight.mjs";
import { directoryTabsModel, DIRECTORY_TAB_ORDER } from "../editor-core/directory-tabs.mjs";
import { statusBandFromPublishStatus, statusBandModel } from "../editor-core/status-band.mjs";
import { verificationBarModel } from "../editor-core/verification-bar.mjs";
import { foldSearch, needsConfirmationTabLabel } from "../editor-core/queue-dto.mjs";
import { foldSearch as moduleFoldSearch } from "../directus/extensions/directory-editor/src/module/copy.js";
import { helpTypeOptions, communityGroupOptions } from "../editor-core/fields.mjs";

test("shared form fields stay in the accepted design order", () => {
  assert.deepEqual(SHARED_FORM_FIELDS, [
    "name",
    "description",
    "address",
    "phone",
    "url",
    "categories",
    "communityFilters",
  ]);
  assert.ok(helpTypeOptions().length > 0);
  assert.ok(communityGroupOptions().length > 0);
});

test("shared form marks changed and curated fields with text, not colour alone", () => {
  const highlight = formHighlightFields({
    before: { address: "22 Ngāti Toa Street", phone: "04 1" },
    after: { address: "FSD third street", phone: "04 1" },
    locked: ["address"],
  });
  assert.equal(highlight.changed[0].mark, "Changed in this update");
  assert.equal(highlight.youSetThis[0].mark, "You set this earlier");
  assert.equal(highlight.focusField, "address");
});

test("three Directory tabs stay Needs confirmation, Review, Listings with counts when non-zero", () => {
  assert.deepEqual(DIRECTORY_TAB_ORDER, ["needs", "review", "listings"]);
  const empty = directoryTabsModel({ deferredCount: 0, reviewCount: 0 });
  assert.deepEqual(
    empty.map((tab) => tab.label),
    ["Needs confirmation", "Review", "Listings"]
  );
  const busy = directoryTabsModel({ deferredCount: 2, reviewCount: 4 });
  assert.equal(busy[0].label, needsConfirmationTabLabel(2));
  assert.equal(busy[1].label, "Review (4)");
  assert.equal(busy[2].label, "Listings");
});

test("status band uses role=status and publish-status counts", () => {
  const band = statusBandFromPublishStatus(
    { unpublishedCount: 2, canUndoPublish: true },
    { reviewCount: 4 }
  );
  assert.equal(band.role, "status");
  assert.equal(band.review.label, "4 changes to review");
  assert.equal(band.review.disabled, false);
  assert.equal(band.waiting.label, "2 unpublished");
  assert.equal(band.waiting.disabled, false);
  assert.equal(band.undo.visible, true);
  assert.equal(band.undo.label, "Undo last publish");

  const quiet = statusBandModel({});
  assert.equal(quiet.review.disabled, true);
  assert.equal(quiet.waiting.disabled, true);
  assert.equal(quiet.undo.visible, false);

  const otherHost = statusBandFromPublishStatus(
    { unpublishedCount: 2, canUndoPublish: true, thisHostCanPublish: false },
    { reviewCount: 0 }
  );
  assert.equal(otherHost.waiting.label, "2 unpublished");
  assert.equal(otherHost.waiting.disabled, true);
  assert.equal(otherHost.undo.visible, false);
});

test("verification bar opens the website in a new tab and hides it from the tab order without a URL", () => {
  const withSite = verificationBarModel({
    governmentUrl: "https://oratoa.example",
    listingUrl: "https://old.example",
    phone: "04 237 7749",
    address: "22 Ngāti Toa Street",
    addressNote: "On the site now",
    pin: { lat: -41.12, lng: 174.83 },
    showMap: true,
  });
  assert.equal(withSite.websiteHref, "https://oratoa.example");
  assert.equal(withSite.websiteHidden, false);
  assert.equal(withSite.websiteTarget, "_blank");
  assert.equal(withSite.websiteTabIndex, 0);
  assert.equal(withSite.telHref, "tel:04 237 7749");

  const noSite = verificationBarModel({ phone: "04 1" });
  assert.equal(noSite.websiteHidden, true);
  assert.equal(noSite.websiteTabIndex, -1);
  assert.equal(noSite.websiteHref, "");
});

test("search folding lives in editor-core so Payload does not take a third copy", () => {
  assert.equal(foldSearch("Porirua Whānau Centre"), moduleFoldSearch("Porirua Whānau Centre"));
  assert.ok(foldSearch("Porirua Whānau Centre").includes("whanau"));
});
