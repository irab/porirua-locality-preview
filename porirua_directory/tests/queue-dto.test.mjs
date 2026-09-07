import test from "node:test";
import assert from "node:assert/strict";
import { primaryActionLabel, queueItemDto } from "../editor-core/queue-dto.mjs";

test("removed items use Take it off the site, not Accept", () => {
  assert.equal(primaryActionLabel("removed"), "Take it off the site");
  assert.equal(primaryActionLabel("changed"), "Accept");
  assert.equal(queueItemDto({ kind: "removed", id: "q1" }).primaryActionLabel, "Take it off the site");
});

test("queue DTO exposes you-set-this on reviewable locked fields", () => {
  const dto = queueItemDto({
    id: "q2",
    kind: "changed",
    entity_id: "fsd-1",
    proposed: {
      locked_fields: ["address", "phone"],
      reviewable_fields: ["address"],
      before: { address: "Old" },
      after: { address: "New government" },
    },
  });
  assert.deepEqual(dto.youSetThis, [{ field: "address", label: "Address" }]);
  assert.equal(dto.name, "");
  assert.equal(dto.after.address, "New government");
});
