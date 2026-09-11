import test from "node:test";
import assert from "node:assert/strict";
import {
  CATALOG_PUBLISHER_DIRECTUS,
  CATALOG_PUBLISHER_PAYLOAD,
  DEFAULT_CATALOG_PUBLISHER,
  annotatePublishStatus,
  catalogPublisherFromEnv,
  isPublishMutationPath,
  publishHostForbiddenMessage,
  resolveCatalogPublisher,
  thisHostCanPublish,
} from "../editor-core/catalog-publisher.mjs";
import {
  DEFAULT_CATALOG_PUBLISHER as directusDefault,
  isPublishMutationPath as directusIsPublish,
  publishHostForbiddenMessage as directusForbidden,
  resolveCatalogPublisher as directusResolve,
  thisHostCanPublish as directusCanPublish,
} from "../directus/extensions/directory-editor/src/endpoint/catalog-publisher.js";

test("directory-dev defaults to a single Payload publisher", () => {
  assert.equal(DEFAULT_CATALOG_PUBLISHER, CATALOG_PUBLISHER_PAYLOAD);
  assert.equal(resolveCatalogPublisher(undefined), "payload");
  assert.equal(resolveCatalogPublisher("directus"), "directus");
  assert.equal(catalogPublisherFromEnv({}), "payload");
  assert.equal(thisHostCanPublish("payload", "directus"), false);
  assert.equal(thisHostCanPublish("directus", "directus"), true);
  assert.equal(thisHostCanPublish("payload", "payload"), true);
  assert.equal(isPublishMutationPath("/publish"), true);
  assert.equal(isPublishMutationPath("/undo-publish"), true);
  assert.equal(isPublishMutationPath("/rollback"), true);
  assert.equal(isPublishMutationPath("/listings"), false);
  assert.match(publishHostForbiddenMessage("directus"), /admin-directory-dev\.bsky\.nz/);
});

test("publish-status annotation is host-local and does not invent unpublishedCount", () => {
  const annotated = annotatePublishStatus(
    { unpublishedCount: 2, canUndoPublish: true },
    { thisHost: CATALOG_PUBLISHER_PAYLOAD, catalogPublisher: CATALOG_PUBLISHER_DIRECTUS }
  );
  assert.equal(annotated.unpublishedCount, 2);
  assert.equal(annotated.canUndoPublish, true);
  assert.equal(annotated.catalogPublisher, "directus");
  assert.equal(annotated.thisHostCanPublish, false);
});

test("Directus publisher copy stays aligned with editor-core", () => {
  assert.equal(directusDefault, DEFAULT_CATALOG_PUBLISHER);
  assert.equal(directusResolve("payload"), resolveCatalogPublisher("payload"));
  assert.equal(directusCanPublish("directus", "payload"), false);
  assert.equal(directusIsPublish("/undo-publish"), true);
  assert.equal(directusForbidden("payload"), publishHostForbiddenMessage("payload"));
});
