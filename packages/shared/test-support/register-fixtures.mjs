import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmod, mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

const pendingIssues = new Set(["NON-139", "NON-142", "NON-135"]);
const canDenyRead = process.platform !== "win32" && process.getuid?.() !== 0;

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
  assert.equal(typeof item.stdout, "string");
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

export async function scanCase(command, item) {
  const dir = await mkdtemp(path.join(tmpdir(), "toolshed-fixture-"));
  try {
    for (const [rel, text] of Object.entries(item.files)) {
      const full = path.join(dir, rel);
      await mkdir(path.dirname(full), { recursive: true });
      await writeFile(full, text);
      if (item.mode?.[rel] === 0) await chmod(full, 0);
    }
    const result = spawnSync(process.execPath, [...command, ...(item.args ?? [])], {
      cwd: dir,
      encoding: "utf8",
    });
    return { status: result.status, stdout: result.stdout, stderr: result.stderr };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export function registerFixtures(command, cases) {
  const names = new Set();
  for (const item of cases) {
    assertCase(item);
    assert.equal(names.has(item.name), false, item.name);
    names.add(item.name);
    test(item.name, fixtureTestOptions(item), async () => {
      const result = await scanCase(command, item);
      assert.equal(result.stderr, item.stderr);
      assert.equal(result.status, item.status, result.stdout + result.stderr);
      assert.equal(result.stdout, item.stdout);
    });
  }
}
