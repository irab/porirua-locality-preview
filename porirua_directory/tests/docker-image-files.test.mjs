import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const IMPORT_RE = /(?:from|import)\s+["'](\.\.?\/[^"']+)["']/g;

function resolveImport(fromFile, spec) {
  const raw = resolve(dirname(fromFile), spec);
  const candidates = [
    raw,
    `${raw}.mjs`,
    `${raw}.js`,
    join(raw, "index.mjs"),
    join(raw, "index.js"),
  ];
  return candidates.find((path) => existsSync(path) && statSync(path).isFile());
}

function walkImports(entry) {
  const seen = new Set();
  const queue = [resolve(ROOT, entry)];
  while (queue.length) {
    const file = queue.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    const text = readFileSync(file, "utf8");
    for (const match of text.matchAll(IMPORT_RE)) {
      const resolved = resolveImport(file, match[1]);
      assert.ok(resolved, `${entry} imports missing file ${match[1]} from ${relative(ROOT, file)}`);
      queue.push(resolved);
    }
  }
  return [...seen].map((file) => relative(ROOT, file)).sort();
}

function copiedSources(dockerfile) {
  const sources = [];
  for (const line of readFileSync(join(ROOT, dockerfile), "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("COPY ")) continue;
    const parts = trimmed
      .slice(5)
      .trim()
      .split(/\s+/)
      .filter((part) => !part.startsWith("--"));
    if (parts.length < 2) continue;
    sources.push(...parts.slice(0, -1));
  }
  return sources;
}

function isCopied(relPath, sources) {
  return sources.some((source) => relPath === source || relPath.startsWith(`${source.replace(/\/$/, "")}/`));
}

function assertImageCovers(dockerfile, entry) {
  const sources = copiedSources(dockerfile);
  const missing = walkImports(entry).filter((file) => !isCopied(file, sources));
  assert.deepEqual(
    missing,
    [],
    `${dockerfile} does not copy modules imported by ${entry}: ${missing.join(", ")}`
  );
}

test("operations image copies every module the sidecar imports", () => {
  assertImageCovers("Dockerfile.operations", "directus/operations/server.mjs");
  assertImageCovers("Dockerfile.operations", "scripts/directus/bootstrap.mjs");
  assertImageCovers("Dockerfile.operations", "scripts/db-import-from-json.mjs");
  assertImageCovers("Dockerfile.operations", "scripts/publish-catalog.mjs");
});

test("sync image copies every module the weekly runner imports", () => {
  assertImageCovers("Dockerfile.sync", "scripts/fsd-sync-run.mjs");
});
