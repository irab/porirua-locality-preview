import test from "node:test";
import assert from "node:assert/strict";
import { foldSearch } from "../editor-core/queue-dto.mjs";
import {
  LISTINGS_COPY,
  archiveDialogModel,
  createListingBody,
  existingListingId,
  listingFormFromOrganization,
  listingFormFromServiceLine,
  listingFormHighlight,
  listingFormTitle,
  listingVerificationSource,
  nameMatchesPath,
  updateListingBody,
  visibleListings,
} from "../editor-core/listings-view.mjs";

const listings = [
  { id: "b", name: "Porirua Whānau Centre", address: "Cannons Creek", status: "published", statusLabel: "On the site" },
  { id: "a", name: "Awatea Community Garden", address: "Awatea", status: "published", statusLabel: "On the site" },
  { id: "c", name: "Hidden Hub", address: "Titahi Bay", status: "hidden", statusLabel: "Not on the site" },
];

test("listings search is first: fold finds Whānau, A–Z sort, hidden rows stay off until asked", () => {
  assert.ok(foldSearch("Porirua Whānau Centre").includes("whanau"));
  const found = visibleListings(listings, { query: "Whanau" });
  assert.deepEqual(
    found.map((row) => row.id),
    ["b"]
  );
  assert.deepEqual(
    visibleListings(listings).map((row) => row.name),
    ["Awatea Community Garden", "Porirua Whānau Centre"]
  );
  const withHidden = visibleListings(listings, { showNotOnSite: true });
  assert.equal(withHidden.some((row) => row.id === "c"), true);
  assert.equal(withHidden.find((row) => row.id === "c").statusLabel, "Not on the site");
});

test("archive dialog asks about the organisation only when this is the last public line", () => {
  assert.equal(
    archiveDialogModel([
      { id: "1", status: "published" },
      { id: "2", status: "published" },
    ]).onlyPublicLine,
    false
  );
  assert.equal(archiveDialogModel([{ id: "1", status: "published" }]).onlyPublicLine, true);
  assert.equal(
    archiveDialogModel([
      { id: "1", status: "published" },
      { id: "2", status: "hidden" },
    ]).onlyPublicLine,
    true
  );
  assert.equal(LISTINGS_COPY.archiveTitle, "Take this service off the public site?");
  assert.equal(LISTINGS_COPY.archiveOnlyPublic, "This is the only public service. Also take the organisation off the site?");
});

test("create body never queues Review and update of a line does not rename the organisation", () => {
  const created = createListingBody(
    { name: "New Marae", description: "", address: "", phone: "", url: "", categories: ["food"], communityFilters: [] },
    { confirmCreateAnyway: true }
  );
  assert.equal(created.confirmCreateAnyway, true);
  assert.equal("kind" in created, false);
  assert.equal("review_queue_items" in created, false);
  assert.equal(created.publish, undefined);

  const line = createListingBody(
    { name: "Budgeting", description: "", address: "", phone: "", url: "", categories: ["money"], communityFilters: [] },
    { kind: "serviceLine", organizationId: "org-1", confirmCreateAnyway: false }
  );
  assert.equal(line.kind, "serviceLine");
  assert.equal(line.organizationId, "org-1");
  assert.equal(line.title, "Budgeting");
  assert.equal(line.confirmCreateAnyway, false);

  const edited = updateListingBody(
    { name: "Line title", description: "d", address: "a", phone: "p", url: "u", lat: 1, lng: 2, categories: ["food"], communityFilters: [] },
    { organizationId: "org-1", serviceId: "svc-1" }
  );
  assert.equal(edited.serviceId, "svc-1");
  assert.equal(edited.payload.title, "Line title");
  assert.equal("name" in edited.payload, false);

  const orgEdit = updateListingBody(
    { name: "Org", description: "", address: "", phone: "", url: "", communityFilters: ["marae_iwi"] },
    { organizationId: "org-1" }
  );
  assert.equal(orgEdit.payload.name, "Org");
  assert.equal("serviceId" in orgEdit, false);
});

test("shared form mapping keeps You set this earlier and the verification source", () => {
  const org = {
    name: "Ora Toa",
    address: "22 Ngāti Toa Street",
    phone: "04 237 7749",
    url: "https://oratoa.example",
    lat: -41.12,
    lng: 174.83,
    community_filters: ["marae_iwi"],
    youSetThis: [{ field: "address", label: "Address", mark: "You set this earlier" }],
  };
  const form = listingFormFromOrganization(org);
  assert.equal(form.name, "Ora Toa");
  assert.deepEqual(form.communityFilters, ["marae_iwi"]);
  const highlight = listingFormHighlight(org.youSetThis);
  assert.equal(highlight.youSetThis[0].mark, "You set this earlier");
  assert.deepEqual(highlight.changed, []);

  const lineForm = listingFormFromServiceLine(
    { title: "Nurse", categories: ["health"], address: "Clinic" },
    org
  );
  assert.equal(lineForm.name, "Nurse");
  assert.deepEqual(lineForm.categories, ["health"]);

  const verify = listingVerificationSource({ organization: org, services: [] });
  assert.equal(verify.listingUrl, "https://oratoa.example");
  assert.deepEqual(verify.pin, { lat: -41.12, lng: 174.83 });
  assert.equal(listingFormTitle("organization"), "Add organisation");
  assert.equal(listingFormTitle("serviceLine"), "Add a service line");
});

test("name-match path uses the sidecar matcher and opens the organisation, not a dead end", () => {
  assert.equal(nameMatchesPath("Whanau"), "/listings/name-matches?name=Whanau");
  assert.equal(
    nameMatchesPath("Budgeting", { formKind: "serviceLine", organizationId: "org-1" }),
    "/listings/name-matches?name=Budgeting&organizationId=org-1"
  );
  assert.equal(existingListingId({ id: "svc-1", organizationId: "org-1" }), "org-1");
  assert.equal(existingListingId({ id: "org-2" }), "org-2");
});
