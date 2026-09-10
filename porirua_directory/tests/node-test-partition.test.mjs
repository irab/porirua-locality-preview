import test from "node:test";
import assert from "node:assert/strict";
import {
  DIRECTUS_TEST_FILES,
  assertSharedStackIsSequential,
  partitionTestFiles,
} from "../scripts/run-node-tests.mjs";

test("shared Directus stack tests stay on the sequential npm test path", () => {
  assert.doesNotThrow(() => assertSharedStackIsSequential());
  const { unit, directus } = partitionTestFiles();
  assert.deepEqual(directus, DIRECTUS_TEST_FILES);
  assert.ok(unit.includes("tests/directus-snapshot.test.mjs"));
  assert.ok(!unit.includes("tests/directus-review-inbox.test.mjs"));
  assert.ok(!unit.includes("tests/directus-flows.test.mjs"));
});
