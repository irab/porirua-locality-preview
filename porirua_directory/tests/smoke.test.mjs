import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("Dockerfile copies every module directory.js imports", () => {
  const js = readFileSync(join(root, "directory.js"), "utf8");
  const dockerfile = readFileSync(join(root, "Dockerfile"), "utf8");
  const imports = [...js.matchAll(/from\s+["']\.\/([^"']+)["']/g)].map((m) => m[1]);
  assert.ok(imports.length > 0, "directory.js should import browser modules");
  for (const rel of imports) {
    assert.match(
      dockerfile,
      new RegExp(rel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
      `Dockerfile must COPY ${rel} (imported by directory.js)`
    );
  }
});
