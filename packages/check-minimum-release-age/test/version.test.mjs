import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { cp, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "../../shared/test-support/register-fixtures.mjs";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(path.join(packageRoot, "package.json"), "utf8"));
const bundlePath = path.join(packageRoot, "dist", `${pkg.name}.mjs`);

function run(file, args) {
  return spawnSync(process.execPath, [file, ...args], { encoding: "utf8" });
}

test("bundle --version prints package.json version", () => {
  const result = run(bundlePath, ["--version"]);
  assert.equal(result.status, 0);
  assert.equal(result.stdout, `${pkg.version}\n`);
  assert.equal(result.stderr, "");
});

test("a lone copy of the bundle prints the version", async ({ fixtureDir }) => {
  const copy = path.join(fixtureDir, `${pkg.name}.mjs`);
  await cp(bundlePath, copy);
  assert.deepEqual(await readdir(fixtureDir), [`${pkg.name}.mjs`]);
  const result = run(copy, ["--version"]);
  assert.equal(result.status, 0);
  assert.equal(result.stdout, `${pkg.version}\n`);
  assert.equal(result.stderr, "");
});

test("any other argv exits 1", () => {
  for (const args of [["--help"], ["--version", "--version"]]) {
    const result = run(bundlePath, args);
    assert.equal(result.status, 1);
    assert.equal(result.stdout, "");
    assert.equal(result.stderr, `usage: ${pkg.name} --version\n`);
  }
});

test("a second build writes the same bytes", async () => {
  const before = await readFile(bundlePath);
  const result = spawnSync(
    process.execPath,
    [path.join(packageRoot, "../../scripts/build-package.mjs")],
    {
      cwd: packageRoot,
      encoding: "utf8",
    },
  );
  assert.equal(result.status, 0, result.stderr);
  const after = await readFile(bundlePath);
  assert.deepEqual(after, before);
  assert.equal(before.subarray(0, 20).toString("utf8"), "#!/usr/bin/env node\n");
});
