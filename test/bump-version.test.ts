import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { repoRoot, run } from "./run.ts";

const bumpScript = path.join(repoRoot, "scripts/bump-version.sh");
const pushScript = path.join(repoRoot, "scripts/push-bump.sh");
const checkScript = path.join(repoRoot, "scripts/check-bump-tools.mjs");
const sourceManifest = path.join(repoRoot, "packages/check-exact-versions/package.json");
const tool = "check-exact-versions";

const workflow = `name: Bump version
on:
  workflow_dispatch:
    inputs:
      tool:
        description: Workspace package directory under packages/
        required: true
        type: choice
        options:
          - check-exact-versions
          - check-lockfiles
      part:
        description: Semver part
        required: true
        type: choice
        options:
          - major
          - minor
          - patch
`;

await test("bump patch, minor, and major on a temp package copy", async () => {
  const original = await readFile(sourceManifest, "utf8");
  const oddlySpaced = original.replace('"name": "', '"name":  "');
  const cases = [
    { part: "patch", version: "1.0.1" },
    { part: "minor", version: "1.1.0" },
    { part: "major", version: "2.0.0" },
  ] as const;

  for (const item of cases) {
    const root = await packageCopy(oddlySpaced);
    const manifest = path.join(root, "packages", tool, "package.json");
    const before = await readFile(manifest);
    const result = run("sh", [bumpScript, root, tool, item.part], { env: process.env });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, `${item.version}\n`);
    const after = await readFile(manifest);
    assert.equal(
      after.toString("utf8"),
      before.toString("utf8").replace('"1.0.0"', `"${item.version}"`),
    );
    assert.equal(await readFile(sourceManifest, "utf8"), original);
  }
});

await test("bump patch keeps the rest of package.json when the version grows", async () => {
  const original = await readFile(sourceManifest, "utf8");
  const seeded = original.replace('"version": "1.0.0"', '"version": "1.2.9"');
  const root = await packageCopy(seeded);
  const manifest = path.join(root, "packages", tool, "package.json");
  const result = run("sh", [bumpScript, root, tool, "patch"], { env: process.env });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "1.2.10\n");
  assert.equal(await readFile(manifest, "utf8"), seeded.replace('"1.2.9"', '"1.2.10"'));
});

await test("unknown tool exits non-zero and does not write", async () => {
  const original = await readFile(sourceManifest);
  const root = await packageCopy(original.toString("utf8"));
  const manifest = path.join(root, "packages", tool, "package.json");
  const before = await readFile(manifest);
  const names = ["not-a-tool", "Check", "../check-exact-versions", "shared"];
  for (const name of names) {
    const result = run("sh", [bumpScript, root, name, "patch"], { env: process.env });
    assert.notEqual(result.status, 0, name);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /unknown tool:/);
    assert.deepEqual(await readFile(manifest), before);
    assert.deepEqual(await readFile(sourceManifest), original);
  }
  assert.deepEqual(await readdir(path.join(root, "packages")), [tool]);
});

await test("invalid version exits non-zero and does not write", async () => {
  const versions = ["1.2", "01.2.3", "1.2.3-rc.1", "v1.2.3", "", "1.2.3+build"];
  for (const version of versions) {
    const root = await packageCopy(
      `{\n  "name": "check-exact-versions",\n  "version": "${version}"\n}\n`,
    );
    const manifest = path.join(root, "packages", tool, "package.json");
    const before = await readFile(manifest);
    const result = run("sh", [bumpScript, root, tool, "patch"], { env: process.env });
    assert.notEqual(result.status, 0, version);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /invalid version/);
    assert.deepEqual(await readFile(manifest), before);
  }

  const missing = await packageCopy('{\n  "name": "check-exact-versions"\n}\n');
  const missingManifest = path.join(missing, "packages", tool, "package.json");
  const missingBefore = await readFile(missingManifest);
  const missingResult = run("sh", [bumpScript, missing, tool, "patch"], { env: process.env });
  assert.notEqual(missingResult.status, 0);
  assert.equal(missingResult.stdout, "");
  assert.match(missingResult.stderr, /version is missing/);
  assert.deepEqual(await readFile(missingManifest), missingBefore);

  const numeric = await packageCopy('{\n  "name": "check-exact-versions",\n  "version": 1\n}\n');
  const numericManifest = path.join(numeric, "packages", tool, "package.json");
  const numericBefore = await readFile(numericManifest);
  const numericResult = run("sh", [bumpScript, numeric, tool, "patch"], { env: process.env });
  assert.notEqual(numericResult.status, 0);
  assert.equal(numericResult.stdout, "");
  assert.match(numericResult.stderr, /invalid version/);
  assert.deepEqual(await readFile(numericManifest), numericBefore);
});

await test("versioned packages match the bump and release workflow choices", () => {
  const result = run("node", [checkScript], { env: process.env });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "check-exact-versions\ncheck-lockfiles\ncheck-minimum-release-age\n");
});

await test("a versioned package missing from the bump workflow choice list fails", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "bump-choices-"));
  await writePackage(root, "check-exact-versions", packageText("check-exact-versions", "1.0.0"));
  await writePackage(root, "new-tool", packageText("new-tool", "1.0.0"));
  await mkdir(path.join(root, ".github", "workflows"), { recursive: true });
  await writeFile(path.join(root, ".github", "workflows", "bump-version.yml"), workflow);
  const result = run("node", [checkScript, root], { env: process.env });
  assert.notEqual(result.status, 0);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /tool missing from bump workflow choices: new-tool/);
  assert.equal(
    await readFile(path.join(root, "packages/new-tool/package.json"), "utf8"),
    packageText("new-tool", "1.0.0"),
  );
});

await test("push-bump publishes only the version change on a branch", async () => {
  const remote = await mkdtemp(path.join(tmpdir(), "bump-remote-"));
  const work = await mkdtemp(path.join(tmpdir(), "bump-work-"));
  execFileSync("git", ["init", "--bare", "-b", "main", remote], { stdio: "ignore" });
  execFileSync("git", ["init", "-b", "main", work], { stdio: "ignore" });
  execFileSync("git", ["-C", work, "config", "user.name", "Test"], { stdio: "ignore" });
  execFileSync("git", ["-C", work, "config", "user.email", "test@example.com"], {
    stdio: "ignore",
  });
  const original = await readFile(sourceManifest, "utf8");
  await writePackage(work, tool, original);
  execFileSync("git", ["-C", work, "add", "--", `packages/${tool}/package.json`], {
    stdio: "ignore",
  });
  execFileSync("git", ["-C", work, "commit", "-m", "initial"], { stdio: "ignore" });
  execFileSync("git", ["-C", work, "remote", "add", "origin", remote], { stdio: "ignore" });
  execFileSync("git", ["-C", work, "push", "origin", "main"], { stdio: "ignore" });
  const before = execFileSync("git", ["-C", work, "rev-parse", "HEAD"], { encoding: "utf8" });

  const bumped = run("sh", [bumpScript, work, tool, "patch"], { cwd: work, env: process.env });
  assert.equal(bumped.status, 0, bumped.stderr);
  const pushed = run("sh", [pushScript], {
    cwd: work,
    env: {
      ...process.env,
      TOOL: tool,
      DEFAULT_BRANCH: "main",
      GITHUB_REF: "refs/heads/main",
      BUMP_REMOTE: "origin",
      GH_TOKEN: "dummy-token",
    },
  });
  assert.equal(pushed.status, 0, pushed.stderr);
  assert.equal(pushed.stdout, "pushed bump/check-exact-versions-v1.0.1\n");

  const author = execFileSync(
    "git",
    ["--git-dir", remote, "log", "-1", "--format=%an %ae", "bump/check-exact-versions-v1.0.1"],
    { encoding: "utf8" },
  );
  assert.equal(
    author,
    "github-actions[bot] 41898282+github-actions[bot]@users.noreply.github.com\n",
  );
  const diff = execFileSync(
    "git",
    ["--git-dir", remote, "diff", "main", "bump/check-exact-versions-v1.0.1"],
    { encoding: "utf8" },
  );
  const changed = diff
    .split("\n")
    .filter((line) => /^[+-]/.test(line) && !line.startsWith("+++") && !line.startsWith("---"));
  assert.deepEqual(changed, ['-  "version": "1.0.0",', '+  "version": "1.0.1",']);

  const head = execFileSync("git", ["-C", work, "rev-parse", "HEAD"], { encoding: "utf8" });
  assert.notEqual(head, before);
  const refused = run("sh", [pushScript], {
    cwd: work,
    env: {
      ...process.env,
      TOOL: tool,
      DEFAULT_BRANCH: "main",
      GITHUB_REF: "refs/heads/other",
      GH_TOKEN: "",
    },
  });
  assert.notEqual(refused.status, 0);
  assert.match(refused.stderr, /refusing dispatch from refs\/heads\/other/);
  assert.equal(execFileSync("git", ["-C", work, "rev-parse", "HEAD"], { encoding: "utf8" }), head);
});

await test("push-bump commits only package.json when the lockfile is also modified", async () => {
  const { remote, work } = await initPushRepo();
  const bumped = run("sh", [bumpScript, work, tool, "patch"], { cwd: work, env: process.env });
  assert.equal(bumped.status, 0, bumped.stderr);
  await writeFile(path.join(work, ".mise/mise.lock"), "rewritten lockfile\n");
  const before = execFileSync("git", ["-C", work, "rev-parse", "HEAD"], { encoding: "utf8" });

  const pushed = runPush(work);
  assert.equal(pushed.status, 0, pushed.stderr);
  assert.equal(pushed.stdout, "pushed bump/check-exact-versions-v1.0.1\n");

  const committed = execFileSync(
    "git",
    [
      "--git-dir",
      remote,
      "diff-tree",
      "--no-commit-id",
      "--name-only",
      "-r",
      "bump/check-exact-versions-v1.0.1",
    ],
    { encoding: "utf8" },
  );
  assert.equal(committed, "packages/check-exact-versions/package.json\n");
  assert.equal(
    execFileSync("git", ["-C", work, "show", "HEAD:.mise/mise.lock"], { encoding: "utf8" }),
    "lockfile\n",
  );
  assert.equal(await readFile(path.join(work, ".mise/mise.lock"), "utf8"), "rewritten lockfile\n");
  assert.equal(
    execFileSync("git", ["-C", work, "status", "--porcelain"], { encoding: "utf8" }),
    " M .mise/mise.lock\n",
  );
  assert.notEqual(
    execFileSync("git", ["-C", work, "rev-parse", "HEAD"], { encoding: "utf8" }),
    before,
  );
});

await test("push-bump exits non-zero without committing when package.json is unchanged", async () => {
  const { work } = await initPushRepo();
  await writeFile(path.join(work, ".mise/mise.lock"), "rewritten lockfile\n");
  const before = execFileSync("git", ["-C", work, "rev-parse", "HEAD"], { encoding: "utf8" });
  const statusBefore = execFileSync("git", ["-C", work, "status", "--porcelain"], {
    encoding: "utf8",
  });

  const pushed = runPush(work);
  assert.notEqual(pushed.status, 0);
  assert.equal(pushed.stdout, "");
  assert.match(
    pushed.stderr,
    /refusing to commit unchanged packages\/check-exact-versions\/package.json/,
  );
  assert.equal(
    execFileSync("git", ["-C", work, "rev-parse", "HEAD"], { encoding: "utf8" }),
    before,
  );
  assert.equal(
    execFileSync("git", ["-C", work, "status", "--porcelain"], { encoding: "utf8" }),
    statusBefore,
  );
  assert.equal(
    execFileSync("git", ["-C", work, "rev-list", "--count", "HEAD"], { encoding: "utf8" }),
    "1\n",
  );
});

async function initPushRepo(): Promise<{ remote: string; work: string }> {
  const remote = await mkdtemp(path.join(tmpdir(), "bump-remote-"));
  const work = await mkdtemp(path.join(tmpdir(), "bump-work-"));
  execFileSync("git", ["init", "--bare", "-b", "main", remote], { stdio: "ignore" });
  execFileSync("git", ["init", "-b", "main", work], { stdio: "ignore" });
  execFileSync("git", ["-C", work, "config", "user.name", "Test"], { stdio: "ignore" });
  execFileSync("git", ["-C", work, "config", "user.email", "test@example.com"], {
    stdio: "ignore",
  });
  await writePackage(work, tool, await readFile(sourceManifest, "utf8"));
  await mkdir(path.join(work, ".mise"), { recursive: true });
  await writeFile(path.join(work, ".mise/mise.lock"), "lockfile\n");
  execFileSync(
    "git",
    ["-C", work, "add", "--", `packages/${tool}/package.json`, ".mise/mise.lock"],
    { stdio: "ignore" },
  );
  execFileSync("git", ["-C", work, "commit", "-m", "initial"], { stdio: "ignore" });
  execFileSync("git", ["-C", work, "remote", "add", "origin", remote], { stdio: "ignore" });
  execFileSync("git", ["-C", work, "push", "origin", "main"], { stdio: "ignore" });
  return { remote, work };
}

function runPush(work: string): ReturnType<typeof run> {
  return run("sh", [pushScript], {
    cwd: work,
    env: {
      ...process.env,
      TOOL: tool,
      DEFAULT_BRANCH: "main",
      GITHUB_REF: "refs/heads/main",
      BUMP_REMOTE: "origin",
      GH_TOKEN: "dummy-token",
    },
  });
}

async function packageCopy(text: string): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "bump-package-"));
  await writePackage(root, tool, text);
  return root;
}

async function writePackage(root: string, name: string, text: string): Promise<void> {
  const manifest = path.join(root, "packages", name, "package.json");
  await mkdir(path.dirname(manifest), { recursive: true });
  await writeFile(manifest, text);
}

function packageText(name: string, version: string): string {
  return `{\n  "name": "${name}",\n  "version": "${version}"\n}\n`;
}
