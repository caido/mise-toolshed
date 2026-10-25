import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import esbuild from "esbuild";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { registerFixtures, test } from "../test-support/register-fixtures.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(here, "..");
const bundleDir = mkdtempSync(path.join(tmpdir(), "shared-sites-"));
const outfile = path.join(bundleDir, "report-sites.mjs");

await esbuild.build({
  absWorkingDir: packageRoot,
  entryPoints: ["test-support/report-sites.ts"],
  outfile,
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node24",
  packages: "bundle",
  logLevel: "warning",
});

process.on("exit", () => {
  rmSync(bundleDir, { recursive: true, force: true });
});

const cases = JSON.parse(readFileSync(path.join(here, "cases.json"), "utf8"));
registerFixtures([outfile], cases);

test("symlinks are not followed", async ({ fixtureDir }) => {
  const outside = await mkdtemp(path.join(tmpdir(), "shared-sites-outside-"));
  try {
    await writeFile(
      path.join(outside, "package.json"),
      `{
  "dependencies": {
    "left-pad": "^1.0.0"
  }
}
`,
    );
    await symlink(outside, path.join(fixtureDir, "linked"));
    await symlink(path.join(outside, "package.json"), path.join(fixtureDir, "package.json"));
    const result = spawnSync(process.execPath, [outfile], { cwd: fixtureDir, encoding: "utf8" });
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.equal(result.stdout, "");
    assert.equal(result.stderr, "");
  } finally {
    await rm(outside, { recursive: true, force: true });
  }
});
