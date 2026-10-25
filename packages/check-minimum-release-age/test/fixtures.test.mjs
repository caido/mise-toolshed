import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "vitest";
import { registerFixtures } from "../../shared/test-support/register-fixtures.mjs";

const canDenyRead = process.platform !== "win32" && process.getuid?.() !== 0;

const here = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(here, "..");
const repoRoot = path.resolve(packageRoot, "../..");
const pkg = JSON.parse(readFileSync(path.join(packageRoot, "package.json"), "utf8"));
const bundle = path.join(packageRoot, "dist", `${pkg.name}.mjs`);
const cases = JSON.parse(readFileSync(path.join(here, "cases.json"), "utf8"));

registerFixtures([bundle], cases);

test.skipIf(!canDenyRead)(
  "an unreadable directory is a finding and other findings remain",
  async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "release-age-dir-"));
    const hidden = path.join(dir, "hidden");
    try {
      await writeFile(path.join(dir, "pnpm-workspace.yaml"), "minimumReleaseAge: 10080\n");
      await writeFile(path.join(dir, "mise.toml"), '[settings]\nminimum_release_age = "6d"\n');
      await mkdir(hidden);
      await chmod(hidden, 0);
      const result = spawnSync(process.execPath, [bundle], { cwd: dir, encoding: "utf8" });
      assert.equal(result.stderr, "");
      assert.equal(result.status, 1, result.stdout + result.stderr);
      assert.equal(
        result.stdout,
        "hidden:1: directory is not readable\nmise.toml:2: minimum_release_age must be at least 7d\n",
      );
    } finally {
      await chmod(hidden, 0o755);
      await rm(dir, { recursive: true, force: true });
    }
  },
);

test("the repo root is clean", () => {
  const result = spawnSync(process.execPath, [bundle], { cwd: repoRoot, encoding: "utf8" });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(result.stdout, "");
  assert.equal(result.stderr, "");
});
