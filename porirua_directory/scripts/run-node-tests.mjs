/**
 * Split the node:test suite so files that share one Directus / Postgres
 * cannot bootstrap or truncate under each other.
 *
 *   node --test tests/*.test.mjs          # parallel — races the shared stack
 *   npm test                              # unit (parallel) then this list (serial)
 */
import { spawn } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const testsDir = join(root, "tests");

/** Same files as `npm run test:directus`. Keep that script and this list in sync. */
export const DIRECTUS_TEST_FILES = [
  "tests/edge-cache.test.mjs",
  "tests/publish-preflight.test.mjs",
  "tests/sticky-curation.test.mjs",
  "tests/approve-review.test.mjs",
  "tests/public-id-alias.test.mjs",
  "tests/db-publish-purge.test.mjs",
  "tests/directus-permissions.test.mjs",
  "tests/directus-service-lines.test.mjs",
  "tests/directus-flows.test.mjs",
  "tests/operations-bulk.test.mjs",
  "tests/directus-review-inbox.test.mjs",
  "tests/listings.test.mjs",
  "tests/review-actions.test.mjs",
  "tests/undo-publish-db.test.mjs",
  "tests/directory-editor-auth.test.mjs",
  "tests/directus-editor-session.test.mjs",
];

const SHARED_STACK = /bootstrapDirectus|withDirectusDatabase|\bprobeDirectus\b/;

export function listTestFiles() {
  return readdirSync(testsDir)
    .filter((name) => name.endsWith(".test.mjs"))
    .map((name) => `tests/${name}`)
    .sort();
}

export function partitionTestFiles(files = listTestFiles()) {
  const sequential = new Set(DIRECTUS_TEST_FILES);
  return {
    unit: files.filter((file) => !sequential.has(file)),
    directus: DIRECTUS_TEST_FILES.filter((file) => files.includes(file)),
  };
}

export function assertSharedStackIsSequential(files = listTestFiles()) {
  const sequential = new Set(DIRECTUS_TEST_FILES);
  const leaked = [];
  for (const file of files) {
    if (sequential.has(file)) continue;
    const text = readFileSync(join(root, file), "utf8");
    if (SHARED_STACK.test(text)) leaked.push(file);
  }
  if (leaked.length) {
    throw new Error(
      `These tests use the shared Directus stack but are not in the sequential list: ${leaked.join(", ")}`
    );
  }
}

function runNodeTest(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--test", ...args], {
      cwd: root,
      stdio: "inherit",
    });
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (signal) reject(new Error(`node --test killed by ${signal}`));
      else if (code === 0) resolve();
      else reject(Object.assign(new Error(`node --test exited ${code}`), { exitCode: code }));
    });
  });
}

async function main() {
  assertSharedStackIsSequential();
  const mode = process.argv[2] || "all";
  const { unit, directus } = partitionTestFiles();
  if (mode === "unit" || mode === "all") {
    await runNodeTest(unit);
  }
  if (mode === "directus" || mode === "all") {
    await runNodeTest(["--test-concurrency=1", ...directus]);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    if (error.exitCode) process.exit(error.exitCode);
    console.error(error.message);
    process.exit(1);
  });
}
