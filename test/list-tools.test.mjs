import assert from "node:assert/strict";
import test from "node:test";
import { mise, must, withPlugin } from "./plugin/support.mjs";

const names = [
  "get-skills",
  "check-exact-versions",
  "check-lockfiles",
  "check-minimum-release-age",
];

test("mise search lists get-skills beside the released tools", async () => {
  await withPlugin(({ env, project }) => {
    const listed = must(
      mise(env, project, ["search", "toolshed:", "--match-type", "contains", "--no-header"]),
      "search",
    );
    const found = names.map((name) => listed.indexOf(`toolshed:${name}`));
    assert.ok(
      found.every((index) => index >= 0),
      listed,
    );
    for (let index = 1; index < found.length; index += 1) {
      assert.ok((found[index - 1] ?? -1) < (found[index] ?? -1), listed);
    }
  });
});
