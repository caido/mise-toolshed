import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "../../shared/test-support/register-fixtures.mjs";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(packageRoot, "../..");
const bundlePath = path.join(packageRoot, "dist", "check-exact-versions.mjs");

function scan(cwd, args = []) {
  return spawnSync(process.execPath, [bundlePath, ...args], { cwd, encoding: "utf8" });
}

function expectClean(result) {
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(result.stdout, "");
  assert.equal(result.stderr, "");
}

function packageJson(section, spec) {
  return `{
  "${section}": {
    "left-pad": ${JSON.stringify(spec)}
  }
}
`;
}

test("a piped scan returns every finding line", async ({ fixtureDir }) => {
  const deps = Array.from({ length: 2000 }, (_, index) => `    "pkg${index}": "^1.0.0"`).join(
    ",\n",
  );
  await writeFile(
    path.join(fixtureDir, "package.json"),
    `{
  "dependencies": {
${deps}
  }
}
`,
  );
  const result = scan(fixtureDir);
  const lines = result.stdout.split("\n").filter((line) => line.length > 0);
  assert.equal(result.status, 1);
  assert.equal(lines.length, 2000);
  assert.equal(lines[0], "package.json:3: dependency pkg0 is not an exact version");
  assert.equal(lines[1999], "package.json:2002: dependency pkg1999 is not an exact version");
});

test("the repo root is clean", () => {
  expectClean(scan(repoRoot));
});

test("symlinks are not followed", async ({ fixtureDir }) => {
  const outside = await mkdtemp(path.join(tmpdir(), "exact-versions-link-"));
  try {
    await writeFile(path.join(outside, "package.json"), packageJson("dependencies", "^1.0.0"));
    await symlink(outside, path.join(fixtureDir, "linked"));
    await symlink(path.join(outside, "package.json"), path.join(fixtureDir, "package.json"));
    expectClean(scan(fixtureDir));
  } finally {
    await rm(outside, { recursive: true, force: true });
  }
});
