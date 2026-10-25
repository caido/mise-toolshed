import assert from "node:assert/strict";
import { test } from "vitest";
import { fixtureTestOptions } from "../test-support/register-fixtures.mjs";

const mode = { mode: { "mise.toml": 0 } };

test("a mode case stays active when reads can be denied", () => {
  assert.deepEqual(fixtureTestOptions({ pending: undefined, ...mode }, true), {});
});

test("a mode case is skipped when reads cannot be denied", () => {
  assert.deepEqual(fixtureTestOptions(mode, false), {
    skip: "cannot deny file reads for this user or platform",
  });
});

test("a pending case stays a todo when it has no mode", () => {
  assert.deepEqual(fixtureTestOptions({ pending: "NON-139" }, false), { todo: true });
});

test("a pending mode case keeps its todo and records the skip", () => {
  assert.deepEqual(fixtureTestOptions({ pending: "NON-139", ...mode }, false), {
    todo: true,
    skip: "cannot deny file reads for this user or platform",
  });
});
