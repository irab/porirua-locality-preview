import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DIRECTORY_EDITOR_PROXIED_ROUTES } from "../editor-core/operations-proxy.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PAYLOAD = join(ROOT, "payload");

function walk(dir) {
  const files = [];
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next") continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) files.push(...walk(path));
    else files.push(path);
  }
  return files;
}

test("Payload imports editor-core instead of a third copy dictionary", () => {
  const files = walk(join(PAYLOAD, "src"));
  assert.equal(
    files.some((file) => /(^|\/)copy\.(js|ts)$/.test(file)),
    false,
    "do not add payload/src/**/copy.js"
  );
  const sources = files
    .filter((file) => /\.(ts|tsx|js|mjs)$/.test(file))
    .map((file) => readFileSync(file, "utf8"))
    .join("\n");
  assert.match(sources, /editor-core\/operations-proxy/);
  assert.match(sources, /editor-core\/client/);
  assert.match(sources, /editor-core\/directory-tabs|editor-core\/status-band|editor-core\/queue-dto/);
});

test("Payload registers health plus every proxied sidecar route", () => {
  const source = readFileSync(join(PAYLOAD, "src/directory/endpoints.ts"), "utf8");
  assert.match(source, /\/directory-editor\/health/);
  assert.match(source, /DIRECTORY_EDITOR_PROXIED_ROUTES/);
  assert.match(source, /identityFromPayloadUser/);
  assert.match(source, /handleDirectoryEditorRequest/);
  assert.equal(DIRECTORY_EDITOR_PROXIED_ROUTES.length, 20);
});

test("Payload image copies editor-core so the proxy can stay shared", () => {
  const dockerfile = readFileSync(join(ROOT, "Dockerfile.payload"), "utf8");
  assert.match(dockerfile, /COPY editor-core/);
  assert.match(dockerfile, /COPY config-directory\.js/);
  assert.ok(existsSync(join(PAYLOAD, "src/directory/SharedListingForm.tsx")));
  assert.ok(existsSync(join(PAYLOAD, "src/directory/ListingsPanel.tsx")));
  assert.ok(existsSync(join(PAYLOAD, "src/directory/ReviewPanel.tsx")));
  assert.ok(existsSync(join(PAYLOAD, "src/directory/StatusBand.tsx")));
  assert.ok(existsSync(join(PAYLOAD, "src/directory/VerificationBar.tsx")));
  assert.ok(existsSync(join(PAYLOAD, "src/directory/DirectoryTabs.tsx")));
  assert.equal(existsSync(join(PAYLOAD, "src/directory/copy.js")), false);
});

test("Listings panel uses the shared form and proxied listings routes, not a second catalog", () => {
  const home = readFileSync(join(PAYLOAD, "src/directory/DirectoryHome.tsx"), "utf8");
  const panel = readFileSync(join(PAYLOAD, "src/directory/ListingsPanel.tsx"), "utf8");
  assert.match(home, /ListingsPanel/);
  assert.match(panel, /SharedListingForm/);
  assert.match(panel, /\/listings\/name-matches|nameMatchesPath/);
  assert.match(panel, /\/listings\/update/);
  assert.match(panel, /\/listings\/archive/);
  assert.match(panel, /\/listings\/restore/);
  assert.match(panel, /confirmCreateAnyway/);
  assert.match(panel, /helpTypeOptions|communityGroupOptions/);
  assert.doesNotMatch(panel, /review_queue_items/);
  assert.doesNotMatch(panel, /["']\/publish["']/);
  assert.doesNotMatch(panel, /HELP_TYPES|COMMUNITY_GROUPS/);
});

test("Review panel uses the shared form and government-queue routes, not the pending_review view", () => {
  const home = readFileSync(join(PAYLOAD, "src/directory/DirectoryHome.tsx"), "utf8");
  const panel = readFileSync(join(PAYLOAD, "src/directory/ReviewPanel.tsx"), "utf8");
  const view = readFileSync(join(ROOT, "editor-core/review-view.mjs"), "utf8");
  assert.match(home, /ReviewPanel/);
  assert.match(panel, /SharedListingForm/);
  assert.match(panel, /VerificationBar/);
  assert.match(panel, /REVIEW_ROUTES/);
  assert.match(panel, /reviewActionButtons/);
  assert.match(panel, /reviewUndo|review-undo/);
  assert.match(view, /\/approve/);
  assert.match(view, /\/keep-curation/);
  assert.match(view, /\/hide/);
  assert.match(view, /\/reject/);
  assert.match(view, /\/edit-and-approve/);
  assert.match(view, /\/defer/);
  assert.match(view, /\/keep-community/);
  assert.match(view, /\/review-undo/);
  assert.match(panel, /role="status"/);
  assert.doesNotMatch(panel, /pending_review/);
  assert.doesNotMatch(view, /pending_review/);
  assert.doesNotMatch(panel, /["']\/publish["']/);
  assert.doesNotMatch(panel, /HELP_TYPES|COMMUNITY_GROUPS/);
  assert.match(panel, /helpTypeOptions|communityGroupOptions/);
});
