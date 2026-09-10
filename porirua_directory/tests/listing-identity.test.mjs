import test from "node:test";
import assert from "node:assert/strict";
import {
  mintCommunityOrganizationIdentity,
  mintCommunityServiceLineIdentity,
  publicServiceId,
} from "../scripts/lib/listing-identity.mjs";
import { slugId } from "../scripts/lib/normalize.mjs";
import { orgClusterKey } from "../scripts/lib/org-cluster.mjs";
import { publicIdSuffix } from "../scripts/lib/catalog-bootstrap.mjs";

test("new community org uses slugId and existing orgClusterKey", () => {
  const minted = mintCommunityOrganizationIdentity("Porirua Whānau Centre", {
    phone: "04 237 7749",
    address: "16 Bedford Court, Cannons Creek",
    lat: -41.148,
    lng: 174.852,
  });
  assert.equal(minted.id, "community-porirua-whanau-centre");
  assert.equal(minted.public_id, minted.id);
  assert.equal(minted.render_grain, "flat");
  assert.equal(
    minted.cluster_key,
    orgClusterKey({
      name: "Porirua Whānau Centre",
      phone: "04 237 7749",
      address: "16 Bedford Court, Cannons Creek",
      lat: -41.148,
      lng: 174.852,
    })
  );
  assert.equal(slugId("Porirua Whanau Centre", "community-"), minted.public_id);
});

test("public_id collision gets a cluster_key suffix, not a rewrite of cluster_key", () => {
  const extras = {
    phone: "04 111 2222",
    address: "1 Example Street",
    existingPublicIds: ["community-example-hub"],
  };
  const minted = mintCommunityOrganizationIdentity("Example Hub", extras);
  const expectedKey = orgClusterKey({
    name: "Example Hub",
    phone: extras.phone,
    address: extras.address,
  });
  assert.equal(minted.cluster_key, expectedKey);
  assert.equal(minted.public_id, `community-example-hub-${publicIdSuffix(expectedKey)}`);
});

test("extra service line ids stay under the parent organisation", () => {
  const minted = mintCommunityServiceLineIdentity({
    organizationId: "org-porirua-whanau-centre",
    title: "Holiday programme",
  });
  assert.equal(minted.id, minted.line_id);
  assert.ok(minted.id.startsWith("org-porirua-whanau-centre:"));
});

test("publicServiceId matches the weekly FSD runner", () => {
  assert.equal(publicServiceId({ SERVICE_ID: "32213" }), "fsd-32213");
  assert.equal(publicServiceId({ id: "fsd-custom", SERVICE_ID: "1" }), "fsd-custom");
  assert.equal(publicServiceId({ name: "Provider" }), slugId("Provider", "fsd-"));
});
