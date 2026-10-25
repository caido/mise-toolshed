import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { registerFixtures } from "../../shared/test-support/register-fixtures.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(here, "..");
const repoRoot = path.resolve(packageRoot, "../..");
const pkg = JSON.parse(readFileSync(path.join(packageRoot, "package.json"), "utf8"));
const bundle = path.join(packageRoot, "dist", `${pkg.name}.mjs`);
const cases = JSON.parse(readFileSync(path.join(here, "cases.json"), "utf8"));

registerFixtures([bundle], cases);

test("the repo root is clean", () => {
  const result = spawnSync(process.execPath, [bundle], { cwd: repoRoot, encoding: "utf8" });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(result.stdout, "");
  assert.equal(result.stderr, "");
});
