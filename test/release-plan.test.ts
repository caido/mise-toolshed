import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { repoRoot, run } from "./run.ts";

const planScript = path.join(repoRoot, "scripts/plan-release.sh");
const exportScript = path.join(repoRoot, "scripts/export-release-plan.sh");
const publishScript = path.join(repoRoot, "scripts/publish-release.sh");
const refuseDir = path.join(repoRoot, "test/fixtures/refuse");
const recordDir = path.join(repoRoot, "test/fixtures/record");

function refuseEnv(base: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  return {
    ...base,
    PATH: `${refuseDir}${path.delimiter}${base.PATH ?? ""}`,
  };
}

test("plan-release skips get-skills tags and does not call gh", async () => {
  const version = run("node", [path.join(repoRoot, "scripts/read-package-version.ts"), path.join(repoRoot, "packages/check-pins/package.json")], {
    env: process.env,
  });
  assert.equal(version.status, 0);
  const packageVersion = version.stdout;

  const tags = ["get-skills-v1.0.0", "get-skills-v1.2", "get-skills-v1.2-rc", "get-skills-v1.9", "get-skills-v1.10-rc"];
  for (const tag of tags) {
    const result = run("sh", [planScript, tag], { env: refuseEnv() });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, "skip\n");
    assert.match(result.stderr, new RegExp(`tag ${tag} has no packages/get-skills; publishing nothing`));
    assert.doesNotMatch(result.stderr, /gh invoked/);
  }

  const mismatch = run("sh", [planScript, "check-pins-v9.9.9"], { env: refuseEnv() });
  assert.notEqual(mismatch.status, 0);
  assert.equal(mismatch.stdout, "");
  assert.match(
    mismatch.stderr,
    new RegExp(`tag check-pins-v9.9.9 version 9.9.9 does not match packages/check-pins/package.json ${packageVersion}`),
  );
  assert.doesNotMatch(mismatch.stderr, /gh invoked/);

  const match = run("sh", [planScript, `check-pins-v${packageVersion}`], { env: refuseEnv() });
  assert.equal(match.status, 0, match.stderr);
  assert.equal(match.stdout, `publish check-pins ${packageVersion}\n`);
  assert.doesNotMatch(match.stderr, /gh invoked/);
});

test("export-release-plan writes skip and publish outputs", async () => {
  const work = await mkdtemp(path.join(tmpdir(), "release-plan-"));
  const output = path.join(work, "github-output");
  await writeFile(output, "");
  const skip = run("sh", [exportScript], {
    env: refuseEnv({
      ...process.env,
      GITHUB_OUTPUT: output,
      GITHUB_REF_NAME: "get-skills-v1.2",
    }),
  });
  assert.equal(skip.status, 0, skip.stderr);
  assert.match(skip.stdout, /::notice::tag get-skills-v1\.2 has no workspace package; publishing nothing/);
  assert.equal(await readFile(output, "utf8"), "action=skip\n");
  assert.doesNotMatch(skip.stderr, /gh invoked/);

  const version = run("node", [path.join(repoRoot, "scripts/read-package-version.ts"), path.join(repoRoot, "packages/check-pins/package.json")], {
    env: process.env,
  });
  assert.equal(version.status, 0);
  await writeFile(output, "");
  const publish = run("sh", [exportScript], {
    env: refuseEnv({
      ...process.env,
      GITHUB_OUTPUT: output,
      GITHUB_REF_NAME: `check-pins-v${version.stdout}`,
    }),
  });
  assert.equal(publish.status, 0, publish.stderr);
  assert.equal(await readFile(output, "utf8"), `action=publish\ntool=check-pins\n`);
});

test("publish-release creates a release and clobbers an existing one", async () => {
  const work = await mkdtemp(path.join(tmpdir(), "publish-release-"));
  const stage = path.join(work, "release");
  const record = path.join(work, "gh-record");
  await mkdir(stage);
  const bundle = path.join(stage, "check-pins.mjs");
  const sums = path.join(stage, "SHA256SUMS");
  await writeFile(bundle, "bundle\n");
  await writeFile(sums, "abc  check-pins.mjs\n");
  await writeFile(record, "");

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PATH: `${recordDir}${path.delimiter}${process.env.PATH ?? ""}`,
    GH_RECORD: record,
    GITHUB_REF_NAME: "check-pins-v0.0.0",
    TOOL: "check-pins",
    RUNNER_TEMP: work,
  };
  const created = run("sh", [publishScript], { env });
  assert.equal(created.status, 0, created.stderr);
  const createdLines = (await readFile(record, "utf8")).trimEnd().split("\n");
  assert.deepEqual(createdLines[0]?.split("\t"), ["release", "view", "check-pins-v0.0.0"]);
  assert.deepEqual(createdLines[1]?.split("\t"), [
    "release",
    "create",
    "check-pins-v0.0.0",
    bundle,
    sums,
    "--title",
    "check-pins-v0.0.0",
    "--notes",
    "",
    "--verify-tag",
  ]);

  await writeFile(record, "");
  const replaced = run("sh", [publishScript], { env: { ...env, GH_RELEASE_EXISTS: "1" } });
  assert.equal(replaced.status, 0, replaced.stderr);
  const replacedLines = (await readFile(record, "utf8")).trimEnd().split("\n");
  assert.deepEqual(replacedLines[1]?.split("\t"), [
    "release",
    "upload",
    "check-pins-v0.0.0",
    bundle,
    sums,
    "--clobber",
  ]);
});
