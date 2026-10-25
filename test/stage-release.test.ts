import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { repoRoot, run } from "./run.ts";

const stageScript = path.join(repoRoot, "scripts/stage-release.sh");
const usage = "usage: stage-release.sh <tool> <dest>\n";

for (const tool of ["check-exact-versions", "get-skills"]) {
  await test(`stage-release copies ${tool} and writes SHA256SUMS`, async () => {
    const built = run("node", [path.join(repoRoot, "scripts/build-package.mjs")], {
      cwd: path.join(repoRoot, "packages", tool),
      env: process.env,
    });
    assert.equal(built.status, 0, `${built.stdout}${built.stderr}`);
    const dest = await mkdtemp(path.join(tmpdir(), "stage-release-"));
    const result = run("sh", [stageScript, tool, dest], { env: process.env });
    assert.equal(result.status, 0, result.stderr);
    const asset = `${tool}.mjs`;
    assert.deepEqual((await readdir(dest)).toSorted(), ["SHA256SUMS", asset]);
    const source = await readFile(path.join(repoRoot, "packages", tool, "dist", asset));
    const staged = await readFile(path.join(dest, asset));
    const digest = createHash("sha256").update(source).digest("hex");
    assert.equal(createHash("sha256").update(staged).digest("hex"), digest);
    assert.equal(staged.equals(source), true);
    assert.equal(await readFile(path.join(dest, "SHA256SUMS"), "utf8"), `${digest}  ${asset}\n`);
  });
}

await test("stage-release rejects a wrong argument count", () => {
  const cases: readonly (readonly string[])[] = [
    [],
    ["only-tool"],
    ["get-skills", path.join(tmpdir(), "unused"), "extra"],
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
