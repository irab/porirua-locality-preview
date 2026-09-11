import test from "node:test";
import assert from "node:assert/strict";
import {
  listingCountFromCounts,
  listingCountLabel,
  publishVersionDto,
} from "../editor-core/publish-versions.mjs";
import { switchPublishedVersion } from "../scripts/publish-versions.mjs";

test("publish version rows stay readable and do not send the catalog envelope", () => {
  const dto = publishVersionDto({
    version: 13,
    generated_at: "2026-09-11T00:42:00.000Z",
    is_current: true,
    counts: { published: 531, organizations: 140 },
    envelope: { services: [{ id: "secret" }] },
  });
  assert.equal(dto.version, 13);
  assert.equal(dto.isCurrent, true);
  assert.equal(dto.listingCount, 531);
  assert.equal(dto.listingCountLabel, "531 listings");
  assert.equal(dto.currentLabel, "On the site now");
  assert.equal(dto.switchLabel, "Put this version on the site");
  assert.match(dto.publishedAtLabel, /September 2026/);
  assert.equal("envelope" in dto, false);
  assert.equal(listingCountFromCounts({ organizations: 2 }), 2);
  assert.equal(listingCountLabel(1), "1 listing");
});

test("switching versions refuses a missing pick, the current version, and a stale tab", async () => {
  const db = {
    async query() {
      return {
        rows: [
          {
            version: 13,
            envelope: { services: [] },
            counts: { published: 1 },
            generated_at: new Date("2026-09-11T00:00:00.000Z"),
            published_by: "moana",
            is_current: true,
          },
        ],
      };
    },
  };

  await assert.rejects(
    () => switchPublishedVersion({ db, version: "nope" }),
    (error) => error.statusCode === 400 && /Choose one published version/.test(error.message)
  );
  await assert.rejects(
    () => switchPublishedVersion({ db, version: 13 }),
    (error) => error.statusCode === 400 && /already on the public site/.test(error.message)
  );
  await assert.rejects(
    () => switchPublishedVersion({ db, version: 12, expectedVersion: 12 }),
    (error) => error.statusCode === 409 && /Someone else has published since/.test(error.message)
  );
});
