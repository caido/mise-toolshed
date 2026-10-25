import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { repoRoot, run } from "./run.ts";

const stageScript = path.join(repoRoot, "scripts/stage-release.sh");
const bundle = path.join(repoRoot, "packages/check-exact-versions/dist/check-exact-versions.mjs");
const usage = "usage: stage-release.sh <tool> <dest>\n";

await test("stage-release copies check-exact-versions and writes SHA256SUMS", async () => {
  const built = run("node", [path.join(repoRoot, "scripts/build-package.mjs")], {
    cwd: path.join(repoRoot, "packages/check-exact-versions"),
    env: process.env,
  });
  assert.equal(built.status, 0, `${built.stdout}${built.stderr}`);
  const dest = await mkdtemp(path.join(tmpdir(), "stage-release-"));
  const result = run("sh", [stageScript, "check-exact-versions", dest], { env: process.env });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual((await readdir(dest)).toSorted(), ["SHA256SUMS", "check-exact-versions.mjs"]);
  const source = await readFile(bundle);
  const staged = await readFile(path.join(dest, "check-exact-versions.mjs"));
  const digest = createHash("sha256").update(source).digest("hex");
  assert.equal(createHash("sha256").update(staged).digest("hex"), digest);
  assert.equal(staged.equals(source), true);
  assert.equal(
    await readFile(path.join(dest, "SHA256SUMS"), "utf8"),
    `${digest}  check-exact-versions.mjs\n`,
  );
});

await test("stage-release rejects a wrong argument count", () => {
  const cases: readonly (readonly string[])[] = [
    [],
    ["only-tool"],
    ["check-pins", path.join(tmpdir(), "unused"), "extra"],
  ];
  for (const args of cases) {
    const result = run("sh", [stageScript, ...args], { env: process.env });
    assert.equal(result.status, 1);
    assert.equal(result.stdout, "");
    assert.equal(result.stderr, usage);
  }
});

await test("stage-release names the missing path for an unknown tool", () => {
  const dest = path.join(tmpdir(), "stage-release-missing");
  const result = run("sh", [stageScript, "not-a-tool", dest], { env: process.env });
  const missing = path.join(repoRoot, "packages/not-a-tool/dist/not-a-tool.mjs");
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.equal(result.stderr, `missing ${missing}\n`);
});
