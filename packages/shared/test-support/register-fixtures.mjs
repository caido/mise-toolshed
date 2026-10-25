import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test as base } from "vitest";

const pendingIssues = new Set(["NON-139", "NON-142", "NON-135"]);
const canDenyRead = process.platform !== "win32" && process.getuid?.() !== 0;

export const test = base.extend({
  fixtureDir: async ({ task: _task }, use) => {
    const dir = await mkdtemp(path.join(tmpdir(), "toolshed-fixture-"));
    try {
      await use(dir);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  },
});

export function fixtureTestOptions(item, readsCanBeDenied = canDenyRead) {
  const options = item.pending === undefined ? {} : { todo: true };
  if (Object.keys(item.mode ?? {}).length > 0 && !readsCanBeDenied) {
    options.skip = "cannot deny file reads for this user or platform";
  }
  return options;
}

function assertCase(item) {
  assert.equal(typeof item.name, "string");
  assert.equal(item.name.length > 0, true);
  assert.equal(item.pending === undefined || pendingIssues.has(item.pending), true);
  if (item.pending !== undefined) {
    assert.equal(item.name.startsWith(`pending ${item.pending}:`), true);
  }
  assert.ok(item.files !== null && typeof item.files === "object" && !Array.isArray(item.files));
  for (const [rel, text] of Object.entries(item.files)) {
    assert.equal(typeof text, "string", rel);
    assert.equal(safeRelative(rel), true, rel);
  }
  const mode = item.mode ?? {};
  assert.ok(mode !== null && typeof mode === "object" && !Array.isArray(mode));
  for (const [rel, bits] of Object.entries(mode)) {
    assert.equal(typeof item.files[rel], "string", rel);
    assert.equal(bits, 0, rel);
  }
  assert.ok(item.status === 0 || item.status === 1);
  assert.equal(item.stdout === undefined || typeof item.stdout === "string", true);
  assert.equal(typeof item.stderr, "string");
  const args = item.args ?? [];
  assert.ok(Array.isArray(args));
  for (const arg of args) assert.equal(typeof arg, "string");
}

function safeRelative(rel) {
  if (rel.length === 0 || path.isAbsolute(rel)) return false;
  const parts = rel.split("/");
  return parts.every((part) => part.length > 0 && part !== "." && part !== "..");
}

async function scanIn(fixtureDir, command, item) {
  for (const [rel, text] of Object.entries(item.files)) {
    const full = path.join(fixtureDir, rel);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, text);
    if (item.mode?.[rel] === 0) await chmod(full, 0);
  }
  const result = spawnSync(process.execPath, [...command, ...(item.args ?? [])], {
    cwd: fixtureDir,
    encoding: "utf8",
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

function assertResult(item, result) {
  assert.equal(result.stderr, item.stderr);
  assert.equal(result.status, item.status, result.stdout + result.stderr);
  if (item.stdout !== undefined) assert.equal(result.stdout, item.stdout);
}

export function registerFixtures(command, cases) {
  const names = new Set();
  for (const item of cases) {
    assertCase(item);
    assert.equal(names.has(item.name), false, item.name);
    names.add(item.name);
    const options = fixtureTestOptions(item);
    if (typeof options.skip === "string") {
      test.skip(item.name, options.skip);
    } else if (options.todo) {
      test.todo(item.name);
    } else {
      test(item.name, async ({ fixtureDir }) => {
        assertResult(item, await scanIn(fixtureDir, command, item));
      });
    }
  }
}
