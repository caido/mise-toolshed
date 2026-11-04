import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { access, chmod, mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { repoRoot, run, type RunResult } from "./run.ts";
import { startMirror } from "./support/release-mirror.mjs";

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

function must(result: RunResult, label: string): string {
  assert.equal(result.status, 0, `${label}\n${result.stderr}${result.stdout}`);
  return result.stdout;
}

function bundleBody(version: string): string {
  return `#!/usr/bin/env node
if (process.argv.length === 3 && process.argv[2] === "--version") {
  process.stdout.write("${version}\\n");
  process.exit(0);
}
process.stderr.write("usage: check-exact-versions --version\\n");
process.exit(1);
`;
}

async function writeBundle(dir: string, version: string): Promise<string> {
  await mkdir(dir, { recursive: true });
  const body = bundleBody(version);
  const file = path.join(dir, "check-exact-versions.mjs");
  await writeFile(file, body);
  await chmod(file, 0o755);
  return body;
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

await test("mise installs check-exact-versions only when SHA256SUMS matches", async (t) => {
  const mise = spawnSync("mise", ["--version"], { encoding: "utf8" });
  assert.equal(mise.status, 0, "mise is required on PATH");
  const sha = spawnSync("sha256sum", ["--version"], { encoding: "utf8" });
  assert.equal(sha.status, 0, "sha256sum is required on PATH");
  const work = await mkdtemp(path.join(tmpdir(), "released-tool-"));
  t.after(() => rm(work, { recursive: true, force: true }));

  const releases = path.join(work, "releases");
  const toolRoot = path.join(releases, "check-exact-versions");
  const good = await writeBundle(path.join(toolRoot, "1.0.0"), "1.0.0");
  await writeFile(
    path.join(toolRoot, "1.0.0", "SHA256SUMS"),
    `${sha256(good)}  check-exact-versions.mjs\n`,
  );
  const newer = await writeBundle(path.join(toolRoot, "1.1.0"), "1.1.0");
  await writeFile(
    path.join(toolRoot, "1.1.0", "SHA256SUMS"),
    `${sha256(newer)}  check-exact-versions.mjs\n`,
  );

  const tamperDir = path.join(toolRoot, "9.9.9");
  const beforeTamper = await writeBundle(tamperDir, "9.9.9");
  const expectedHash = sha256(beforeTamper);
  await writeFile(
    path.join(tamperDir, "SHA256SUMS"),
    `${expectedHash}  check-exact-versions.mjs\n`,
  );
  const tampered = `${beforeTamper}\n/* tampered */\n`;
  await writeFile(path.join(tamperDir, "check-exact-versions.mjs"), tampered);
  const actualHash = sha256(tampered);

  const missingDir = path.join(toolRoot, "9.8.0");
  await writeBundle(missingDir, "9.8.0");
  await writeFile(
    path.join(missingDir, "SHA256SUMS"),
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef  other.txt\n",
  );

  const duplicateDir = path.join(toolRoot, "9.7.0");
  const duplicateBody = await writeBundle(duplicateDir, "9.7.0");
  const duplicateHash = sha256(duplicateBody);
  await writeFile(
    path.join(duplicateDir, "SHA256SUMS"),
    `${duplicateHash}  check-exact-versions.mjs\n${duplicateHash}  check-exact-versions.mjs\n`,
  );

  const versions = ["1.0.0", "1.1.0", "9.8.0", "9.7.0", "9.9.9"].map((version, index) => ({
    version,
    created_at: `2024-0${index + 1}-01T00:00:00Z`,
  }));
  await writeFile(path.join(toolRoot, "index.json"), `${JSON.stringify({ versions }, null, 2)}\n`);

  const mirror = await startMirror(releases);
  t.after(() => mirror.close());
  const home = path.join(work, "home");
  const project = path.join(home, "project");
  await mkdir(path.join(home, "data"), { recursive: true });
  await mkdir(path.join(home, "cache"), { recursive: true });
  await mkdir(path.join(home, "config"), { recursive: true });
  await mkdir(path.join(home, "state"), { recursive: true });
  await mkdir(project, { recursive: true });
  const miseEnv: NodeJS.ProcessEnv = {
    ...process.env,
    MISE_DATA_DIR: path.join(home, "data"),
    MISE_CACHE_DIR: path.join(home, "cache"),
    MISE_CONFIG_DIR: path.join(home, "config"),
    MISE_STATE_DIR: path.join(home, "state"),
    MISE_GLOBAL_CONFIG_FILE: path.join(home, "config/config.toml"),
    MISE_SYSTEM_CONFIG_FILE: path.join(home, "config/system.toml"),
    MISE_YES: "1",
  };
  await writeFile(miseEnv.MISE_GLOBAL_CONFIG_FILE ?? "", "");
  await writeFile(miseEnv.MISE_SYSTEM_CONFIG_FILE ?? "", "");
  await writeFile(
    path.join(project, "mise.toml"),
    `[tools]\n"toolshed:check-exact-versions" = { version = "1.0.0", mirror = "${mirror.url}" }\n`,
  );
  must(
    run("mise", ["plugin", "link", "--force", "toolshed", repoRoot], {
      cwd: project,
      env: miseEnv,
    }),
    "plugin link",
  );

  await t.test("ls-remote prints the mirror index oldest first", () => {
    const listed = run("mise", ["ls-remote", "toolshed:check-exact-versions"], {
      cwd: project,
      env: miseEnv,
    });
    assert.equal(listed.status, 0, listed.stderr);
    assert.equal(listed.stdout, "1.0.0\n1.1.0\n9.8.0\n9.7.0\n9.9.9\n");
  });

  await t.test("unknown tool fails", () => {
    const unknown = run("mise", ["ls-remote", "toolshed:not-a-tool"], {
      cwd: project,
      env: miseEnv,
    });
    assert.notEqual(unknown.status, 0);
  });

  await t.test("installs 1.0.0 on PATH", async () => {
    must(run("mise", ["install"], { cwd: project, env: miseEnv }), "mise install");
    const where = stripTrailingNewlines(
      must(
        run("mise", ["where", "toolshed:check-exact-versions"], { cwd: project, env: miseEnv }),
        "mise where",
      ),
    );
    const bin = path.join(where, "bin", "check-exact-versions");
    await access(bin, constants.X_OK);
    await assertMissing(path.join(where, "bin", "check-exact-versions.mjs"));
    const resolved = stripTrailingNewlines(
      must(
        run("mise", ["exec", "--", "sh", "-c", "command -v check-exact-versions"], {
          cwd: project,
          env: miseEnv,
        }),
        "command -v",
      ),
    );
    assert.equal(resolved.startsWith(`${where}${path.sep}`), true, resolved);
    const version = stripTrailingNewlines(
      must(
        run("mise", ["exec", "--", "check-exact-versions", "--version"], {
          cwd: project,
          env: miseEnv,
        }),
        "version",
      ),
    );
    assert.equal(version, "1.0.0");
  });

  await t.test("tampered download fails and leaves no binary", async () => {
    const tamper = run("mise", ["install", "toolshed:check-exact-versions@9.9.9"], {
      cwd: project,
      env: miseEnv,
    });
    assert.notEqual(tamper.status, 0);
    assert.ok(
      tamper.stderr.includes(
        "check-exact-versions.mjs checksum mismatch for tag check-exact-versions-v9.9.9",
      ),
    );
    assert.ok(tamper.stderr.includes(expectedHash));
    assert.ok(tamper.stderr.includes(actualHash));
    const left = await filesNamed(miseEnv.MISE_DATA_DIR ?? "", "check-exact-versions");
    assert.equal(
      left.some((file) => file.includes(`${path.sep}9.9.9${path.sep}`)),
      false,
      left.join("\n"),
    );
  });

  await t.test("missing checksum entry fails and leaves no binary", async () => {
    const missing = run("mise", ["install", "toolshed:check-exact-versions@9.8.0"], {
      cwd: project,
      env: miseEnv,
    });
    assert.notEqual(missing.status, 0);
    assert.ok(
      missing.stderr.includes(
        "SHA256SUMS has no check-exact-versions.mjs line for tag check-exact-versions-v9.8.0",
      ),
    );
    const left = await filesNamed(miseEnv.MISE_DATA_DIR ?? "", "check-exact-versions");
    assert.equal(
      left.some((file) => file.includes(`${path.sep}9.8.0${path.sep}`)),
      false,
      left.join("\n"),
    );
  });

  await t.test("two checksum lines fail and leave no binary", async () => {
    const duplicate = run("mise", ["install", "toolshed:check-exact-versions@9.7.0"], {
      cwd: project,
      env: miseEnv,
    });
    assert.notEqual(duplicate.status, 0);
    assert.match(duplicate.stderr, /SHA256SUMS has two hashes for check-exact-versions\.mjs/);
    const left = await filesNamed(miseEnv.MISE_DATA_DIR ?? "", "check-exact-versions");
    assert.equal(
      left.some((file) => file.includes(`${path.sep}9.7.0${path.sep}`)),
      false,
      left.join("\n"),
    );
  });

  await t.test("check-pins execs an existing install and does not install", async () => {
    const install = run("mise", ["install", "toolshed:check-pins@1.0.0"], {
      cwd: project,
      env: miseEnv,
    });
    assert.notEqual(install.status, 0);
    assert.match(install.stderr, /check-pins is not installable/);
    const leaked = await filesNamed(miseEnv.MISE_DATA_DIR ?? "", "check-pins");
    assert.deepEqual(leaked, []);

    const exactWhere = stripTrailingNewlines(
      must(
        run("mise", ["where", "toolshed:check-exact-versions"], { cwd: project, env: miseEnv }),
        "mise where exact",
      ),
    );
    const legacyWhere = path.join(
      path.dirname(path.dirname(exactWhere)),
      "toolshed-check-pins",
      "1.0.0",
    );
    const binDir = path.join(legacyWhere, "bin");
    await mkdir(binDir, { recursive: true });
    const bin = path.join(binDir, "check-pins");
    await writeFile(bin, "#!/bin/sh\nprintf '1.0.0\\n'\n");
    await chmod(bin, 0o755);
    await writeFile(path.join(project, "mise.toml"), '[tools]\n"toolshed:check-pins" = "1.0.0"\n');
    const version = stripTrailingNewlines(
      must(
        run("mise", ["exec", "--", "check-pins", "--version"], { cwd: project, env: miseEnv }),
        "legacy exec",
      ),
    );
    assert.equal(version, "1.0.0");
  });
});

await test("a draft and a prerelease are not listed and are not latest", async (t) => {
  const mise = spawnSync("mise", ["--version"], { encoding: "utf8" });
  assert.equal(mise.status, 0, "mise is required on PATH");
  const sha = spawnSync("sha256sum", ["--version"], { encoding: "utf8" });
  assert.equal(sha.status, 0, "sha256sum is required on PATH");
  const work = await mkdtemp(path.join(tmpdir(), "released-draft-"));
  t.after(() => rm(work, { recursive: true, force: true }));

  const releases = [
    {
      tag_name: "check-lockfiles-v9.9.9",
      draft: true,
      prerelease: false,
      published_at: "2026-11-01T00:00:00Z",
    },
    {
      tag_name: "check-lockfiles-v9.8.0",
      draft: false,
      prerelease: true,
      published_at: "2026-10-28T00:00:00Z",
    },
    {
      tag_name: "check-lockfiles-v1.0.1",
      draft: false,
      prerelease: false,
      published_at: "2026-10-26T19:14:55Z",
    },
    {
      tag_name: "check-lockfiles-v1.0.0",
      draft: false,
      prerelease: false,
      published_at: "2026-10-26T01:19:24Z",
    },
  ];
  await writeFile(path.join(work, "releases.json"), `${JSON.stringify(releases)}\n`);
  const mirror = await startMirror(work);
  t.after(() => mirror.close());

  const home = path.join(work, "home");
  const project = path.join(home, "project");
  await mkdir(path.join(home, "data"), { recursive: true });
  await mkdir(path.join(home, "cache"), { recursive: true });
  await mkdir(path.join(home, "config"), { recursive: true });
  await mkdir(path.join(home, "state"), { recursive: true });
  await mkdir(project, { recursive: true });
  const miseEnv: NodeJS.ProcessEnv = {
    ...process.env,
    MISE_DATA_DIR: path.join(home, "data"),
    MISE_CACHE_DIR: path.join(home, "cache"),
    MISE_CONFIG_DIR: path.join(home, "config"),
    MISE_STATE_DIR: path.join(home, "state"),
    MISE_GLOBAL_CONFIG_FILE: path.join(home, "config/config.toml"),
    MISE_SYSTEM_CONFIG_FILE: path.join(home, "config/system.toml"),
    MISE_YES: "1",
  };
  await writeFile(miseEnv.MISE_GLOBAL_CONFIG_FILE ?? "", "");
  await writeFile(miseEnv.MISE_SYSTEM_CONFIG_FILE ?? "", "");
  await writeFile(
    path.join(project, "mise.toml"),
    `[tools]\n"toolshed:check-lockfiles" = { version = "1.0.1", releases_url = "${mirror.url}/releases.json" }\n`,
  );
  must(
    run("mise", ["plugin", "link", "--force", "toolshed", repoRoot], {
      cwd: project,
      env: miseEnv,
    }),
    "plugin link",
  );

  const listed = run("mise", ["ls-remote", "toolshed:check-lockfiles"], {
    cwd: project,
    env: miseEnv,
  });
  assert.equal(listed.status, 0, listed.stderr);
  assert.equal(listed.stdout, "1.0.0\n1.0.1\n");

  must(
    run("mise", ["install", "toolshed:check-lockfiles@latest"], { cwd: project, env: miseEnv }),
    "install latest",
  );
  const version = stripTrailingNewlines(
    must(
      run(
        "mise",
        ["exec", "toolshed:check-lockfiles@latest", "--", "check-lockfiles", "--version"],
        {
          cwd: project,
          env: miseEnv,
        },
      ),
      "latest version",
    ),
  );
  assert.equal(version, "1.0.1");
});
