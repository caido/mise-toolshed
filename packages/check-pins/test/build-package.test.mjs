import assert from "node:assert/strict";
import { realpathSync } from "node:fs";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { buildPackage } from "../../../scripts/build-package.mjs";

async function writeTool(name, { version = "1.2.3", source } = {}) {
  const root = path.join(await mkdtemp(path.join(tmpdir(), "toolshed-build-")), name);
  await mkdir(path.join(root, "src"), { recursive: true });
  await writeFile(
    path.join(root, "package.json"),
    JSON.stringify({ name, version, private: true, type: "module" }),
  );
  await writeFile(
    path.join(root, "src", "main.ts"),
    source ??
      `import { TOOL_NAME, TOOL_VERSION } from "#tool-version";\n` +
        `process.stdout.write(TOOL_NAME + " " + TOOL_VERSION + "\\n");\n`,
  );
  return root;
}

test("build inlines the manifest version into one file", async () => {
  const root = await writeTool("widget", { version: "9.8.7" });
  try {
    const built = await buildPackage(root);
    assert.equal(built.version, "9.8.7");
    assert.equal(built.outfile, path.join(realpathSync(root), "dist", "widget.mjs"));
    const text = await readFile(built.outfile, "utf8");
    assert.equal(text.startsWith("#!/usr/bin/env node\n"), true);
    assert.match(text, /"9\.8\.7"/);
    assert.equal(text.includes('"private"'), false);
    const again = await buildPackage(root);
    assert.equal(await readFile(again.outfile, "utf8"), text);
  } finally {
    await rm(path.dirname(root), { recursive: true, force: true });
  }
});

test("a non-semver version fails and writes nothing", async () => {
  const root = await writeTool("widget", { version: "latest" });
  try {
    await assert.rejects(buildPackage(root), /semver/);
    await assert.rejects(readFile(path.join(root, "dist", "widget.mjs")));
  } finally {
    await rm(path.dirname(root), { recursive: true, force: true });
  }
});

test("a package tsconfig does not override the builder", async () => {
  const root = await writeTool("widget");
  try {
    await writeFile(path.join(root, "tsconfig.json"), '{"compilerOptions":{"strict":true}}\n');
    const built = await buildPackage(root);
    assert.equal((await readFile(built.outfile, "utf8")).includes('"1.2.3"'), true);
  } finally {
    await rm(path.dirname(root), { recursive: true, force: true });
  }
});

test("a source shebang is rejected", async () => {
  const root = await writeTool("widget", {
    source:
      `#!/usr/bin/env node\n` +
      `import { TOOL_VERSION } from "#tool-version";\n` +
      `process.stdout.write(TOOL_VERSION + "\\n");\n`,
  });
  try {
    await assert.rejects(buildPackage(root), /second shebang/);
  } finally {
    await rm(path.dirname(root), { recursive: true, force: true });
  }
});

test("node builtins stay external", async () => {
  const root = await writeTool("widget", {
    source:
      `import { readFileSync } from "node:fs";\n` +
      `import { existsSync } from "fs";\n` +
      `import { TOOL_VERSION } from "#tool-version";\n` +
      `process.stdout.write(TOOL_VERSION + String(readFileSync.length + existsSync.length));\n`,
  });
  try {
    const built = await buildPackage(root);
    const text = await readFile(built.outfile, "utf8");
    assert.match(text, /from "node:fs"/);
    assert.match(text, /from "fs"/);
  } finally {
    await rm(path.dirname(root), { recursive: true, force: true });
  }
});

test("importing package.json fails the build", async () => {
  const root = await writeTool("widget", {
    source:
      `import pkg from "../package.json" with { type: "json" };\n` +
      `import { TOOL_VERSION } from "#tool-version";\n` +
      `process.stdout.write(String(pkg.version) + TOOL_VERSION);\n`,
  });
  try {
    await assert.rejects(buildPackage(root), /package\.json/);
  } finally {
    await rm(path.dirname(root), { recursive: true, force: true });
  }
});
