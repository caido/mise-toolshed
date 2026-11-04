import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  derivedFixtureText,
  fixtureFailure,
  releasedToolNames,
  toolshedPins,
} from "../scripts/released-fixture.mjs";

const luaSource = readFileSync(new URL("../lib/released_tool.lua", import.meta.url), "utf8");
const fixtureText = readFileSync(
  new URL("./fixtures/released-tools/mise.toml", import.meta.url),
  "utf8",
);
const released = releasedToolNames(luaSource);

test("the fixture pins every released tool", () => {
  assert.equal(fixtureFailure(released, fixtureText), null);
  const pins = toolshedPins(fixtureText);
  assert.deepEqual([...pins.keys()], released);
});

test("a released tool missing from the fixture fails", () => {
  const withoutLocks = fixtureText.replace('"toolshed:check-lockfiles" = "1.0.1"\n', "");
  assert.equal(
    fixtureFailure(released, withoutLocks),
    "released tool missing from the fixture: check-lockfiles",
  );
  assert.match(
    fixtureFailure([...released, "check-new"], fixtureText) ?? "",
    /released tool missing from the fixture: check-new/,
  );
});

test("a fixture derived from the released list fails", () => {
  assert.equal(
    fixtureFailure(released, derivedFixtureText(released)),
    "fixture is derived from the released list",
  );
});

test("the fixture checker does not write the fixture", () => {
  const source = readFileSync(new URL("../scripts/released-fixture.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(source, /writeFile/);
});
