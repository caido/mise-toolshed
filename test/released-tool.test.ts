import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { access, chmod, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { repoRoot, run, type RunResult } from "./run.ts";

function stripTrailingNewlines(value: string): string {
  let end = value.length;
  while (end > 0 && (value[end - 1] === "\n" || value[end - 1] === "\r")) {
    end -= 1;
  }
  return value.slice(0, end);
}

function sha256(body: string): string {
  return createHash("sha256").update(body).digest("hex");
}

function gitEnv(work: string): NodeJS.ProcessEnv {
  return {
    ...process.env,
    GIT_CONFIG_GLOBAL: path.join(work, "gitconfig"),
    GIT_CONFIG_SYSTEM: "/dev/null",
    GIT_AUTHOR_NAME: "toolshed",
    GIT_AUTHOR_EMAIL: "toolshed@example.com",
    GIT_COMMITTER_NAME: "toolshed",
    GIT_COMMITTER_EMAIL: "toolshed@example.com",
    GIT_TERMINAL_PROMPT: "0",
  };
}

function must(result: RunResult, label: string): string {
  assert.equal(result.status, 0, `${label}\n${result.stderr}${result.stdout}`);
  return result.stdout;
}

async function writeBundle(dir: string, version: string): Promise<void> {
  await mkdir(dir, { recursive: true });
  const body = `#!/usr/bin/env node
if (process.argv.length === 3 && process.argv[2] === "--version") {
  process.stdout.write("${version}\\n");
  process.exit(0);
}
process.stderr.write("usage: check-pins --version\\n");
process.exit(1);
`;
  const file = path.join(dir, "check-pins.mjs");
  await writeFile(file, body);
  await chmod(file, 0o755);
}

async function filesNamed(dir: string, name: string): Promise<string[]> {
  const found: string[] = [];
  async function walk(current: string): Promise<void> {
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.name === name) {
        found.push(full);
      }
    }
  }
  await walk(dir);
  return found;
}

async function assertMissing(file: string): Promise<void> {
  try {
    await access(file);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return;
    }
    throw error;
  }
  assert.fail(`${file} exists`);
}

await test("mise installs check-pins only when SHA256SUMS matches", async (t) => {
  const mise = spawnSync("mise", ["--version"], { encoding: "utf8" });
  assert.equal(mise.status, 0, "mise is required on PATH");
  const sha = spawnSync("sha256sum", ["--version"], { encoding: "utf8" });
  assert.equal(sha.status, 0, "sha256sum is required on PATH");
  const work = await mkdtemp(path.join(tmpdir(), "released-tool-"));
  t.after(() => rm(work, { recursive: true, force: true }));

  const env = gitEnv(work);
  await writeFile(env.GIT_CONFIG_GLOBAL ?? "", "");
  const origin = path.join(work, "origin.git");
  const wt = path.join(work, "fixture");
  must(run("git", ["init", "--bare", "-q", "-b", "main", origin], { env }), "git init bare");
  await mkdir(wt);
  must(run("git", ["-C", wt, "init", "-q", "-b", "main"], { env }), "git init");
  await writeFile(path.join(wt, "readme"), "noise\n");
  must(run("git", ["-C", wt, "add", "readme"], { env }), "git add");
  must(run("git", ["-C", wt, "commit", "-m", "tags"], { env }), "git commit");
  for (const tag of [
    "check-pins-v1.0.0",
    "check-pins-v1.1.0",
    "get-skills-v1.0.0",
    "get-skills-v2.0.0",
  ]) {
    must(run("git", ["-C", wt, "tag", tag], { env }), `git tag ${tag}`);
  }
  must(run("git", ["-C", wt, "remote", "add", "origin", origin], { env }), "git remote");
  must(run("git", ["-C", wt, "push", "-q", "origin", "HEAD:refs/heads/main"], { env }), "git push");
  must(run("git", ["-C", wt, "push", "-q", "origin", "--tags"], { env }), "git push tags");

  const releases = path.join(work, "releases");
  await writeBundle(path.join(releases, "check-pins-v1.0.0"), "1.0.0");
  await writeBundle(path.join(releases, "check-pins-v1.1.0"), "1.1.0");
  for (const version of ["1.0.0", "1.1.0"]) {
    const dir = path.join(releases, `check-pins-v${version}`);
    const body = await readFile(path.join(dir, "check-pins.mjs"));
    await writeFile(
      path.join(dir, "SHA256SUMS"),
      `${sha256(body.toString("utf8"))}  check-pins.mjs\n`,
    );
  }

  const tamperDir = path.join(releases, "check-pins-v9.9.9");
  await writeBundle(tamperDir, "9.9.9");
  const tamperFile = path.join(tamperDir, "check-pins.mjs");
  const beforeTamper = await readFile(tamperFile, "utf8");
  const expectedHash = sha256(beforeTamper);
  await writeFile(path.join(tamperDir, "SHA256SUMS"), `${expectedHash}  check-pins.mjs\n`);
  const tampered = `${beforeTamper}\n/* tampered */\n`;
  await writeFile(tamperFile, tampered);
  const actualHash = sha256(tampered);

  const missingDir = path.join(releases, "check-pins-v9.8.0");
  await writeBundle(missingDir, "9.8.0");
  await writeFile(
    path.join(missingDir, "SHA256SUMS"),
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef  other.txt\n",
  );

  const home = path.join(work, "home");
  const project = path.join(home, "project");
  await mkdir(path.join(home, "data"), { recursive: true });
  await mkdir(path.join(home, "cache"), { recursive: true });
  await mkdir(path.join(home, "config"), { recursive: true });
  await mkdir(path.join(home, "state"), { recursive: true });
  await mkdir(project, { recursive: true });
  const miseEnv: NodeJS.ProcessEnv = {
    ...env,
    MISE_DATA_DIR: path.join(home, "data"),
    MISE_CACHE_DIR: path.join(home, "cache"),
    MISE_CONFIG_DIR: path.join(home, "config"),
    MISE_STATE_DIR: path.join(home, "state"),
    MISE_GLOBAL_CONFIG_FILE: path.join(home, "config/config.toml"),
    MISE_SYSTEM_CONFIG_FILE: path.join(home, "config/system.toml"),
    MISE_YES: "1",
    TOOLSHED_RELEASE_REMOTE: `file://${origin}`,
    TOOLSHED_RELEASE_BASE_URL: `file://${releases}`,
  };
  await writeFile(miseEnv.MISE_GLOBAL_CONFIG_FILE ?? "", "");
  await writeFile(miseEnv.MISE_SYSTEM_CONFIG_FILE ?? "", "");
  must(
    run("mise", ["plugin", "link", "--force", "toolshed", repoRoot], {
      cwd: project,
      env: miseEnv,
    }),
    "plugin link",
  );

  await t.test("ls-remote prints 1.0.0 then 1.1.0", () => {
    const listed = run("mise", ["ls-remote", "toolshed:check-pins"], {
      cwd: project,
      env: miseEnv,
    });
    assert.equal(listed.status, 0, listed.stderr);
    assert.equal(listed.stdout, "1.0.0\n1.1.0\n");
  });

  await t.test("unknown tool fails", () => {
    const unknown = run("mise", ["ls-remote", "toolshed:not-a-tool"], {
      cwd: project,
      env: miseEnv,
    });
    assert.notEqual(unknown.status, 0);
  });

  await t.test("installs 1.0.0 on PATH", async () => {
    await writeFile(path.join(project, "mise.toml"), '[tools]\n"toolshed:check-pins" = "1.0.0"\n');
    must(run("mise", ["install"], { cwd: project, env: miseEnv }), "mise install");
    const where = stripTrailingNewlines(
      must(
        run("mise", ["where", "toolshed:check-pins"], { cwd: project, env: miseEnv }),
        "mise where",
      ),
    );
    const bin = path.join(where, "bin", "check-pins");
    await access(bin, constants.X_OK);
    await assertMissing(path.join(where, "bin", "check-pins.mjs"));
    const resolved = stripTrailingNewlines(
      must(
        run("mise", ["exec", "--", "sh", "-c", "command -v check-pins"], {
          cwd: project,
          env: miseEnv,
        }),
        "command -v",
      ),
    );
    assert.equal(resolved.startsWith(`${where}${path.sep}`), true, resolved);
    const version = stripTrailingNewlines(
      must(
        run("mise", ["exec", "--", "check-pins", "--version"], { cwd: project, env: miseEnv }),
        "version",
      ),
    );
    assert.equal(version, "1.0.0");
  });

  await t.test("tampered download fails and leaves no binary", async () => {
    const tamper = run("mise", ["install", "toolshed:check-pins@9.9.9"], {
      cwd: project,
      env: miseEnv,
    });
    assert.notEqual(tamper.status, 0);
    assert.ok(tamper.stderr.includes("check-pins.mjs checksum mismatch for tag check-pins-v9.9.9"));
    assert.ok(tamper.stderr.includes(expectedHash));
    assert.ok(tamper.stderr.includes(actualHash));
    const left = await filesNamed(miseEnv.MISE_DATA_DIR ?? "", "check-pins");
    assert.equal(
      left.some((file) => file.includes(`${path.sep}9.9.9${path.sep}`)),
      false,
      left.join("\n"),
    );
  });

  await t.test("missing checksum entry fails and leaves no binary", async () => {
    const missing = run("mise", ["install", "toolshed:check-pins@9.8.0"], {
      cwd: project,
      env: miseEnv,
    });
    assert.notEqual(missing.status, 0);
    assert.ok(
      missing.stderr.includes("SHA256SUMS has no check-pins.mjs line for tag check-pins-v9.8.0"),
    );
    const left = await filesNamed(miseEnv.MISE_DATA_DIR ?? "", "check-pins");
    assert.equal(
      left.some((file) => file.includes(`${path.sep}9.8.0${path.sep}`)),
      false,
      left.join("\n"),
    );
  });
});
