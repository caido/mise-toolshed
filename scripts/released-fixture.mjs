import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const luaPath = path.join(repoRoot, "lib/released_tool.lua");
const fixturePath = path.join(repoRoot, "test/fixtures/released-tools/mise.toml");
const exactVersion = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

export function releasedToolNames(luaSource) {
  const body = /local RELEASED = \{([^}]+)\}/.exec(luaSource);
  if (body === null) {
    throw new Error("RELEASED list is missing");
  }
  return [...body[1].matchAll(/"([a-z0-9-]+)"/g)].map((match) => match[1]);
}

export function toolshedPins(fixtureText) {
  const pins = new Map();
  let inTools = false;
  for (const line of fixtureText.split("\n")) {
    const section = /^\[([^\]]+)\]\s*$/.exec(line.trim());
    if (section !== null) {
      inTools = section[1] === "tools";
      continue;
    }
    if (!inTools) continue;
    const pin = /^"toolshed:([a-z0-9-]+)"\s*=\s*"([^"]*)"\s*$/.exec(line.trim());
    if (pin !== null) pins.set(pin[1], pin[2]);
  }
  return pins;
}

export function fixtureFailure(releasedNames, fixtureText) {
  const pins = toolshedPins(fixtureText);
  const missing = releasedNames.filter((name) => !pins.has(name));
  if (missing.length > 0) {
    return `released tool missing from the fixture: ${missing.join(", ")}`;
  }
  const derived = releasedNames.some((name) => !exactVersion.test(pins.get(name) ?? ""));
  if (derived) return "fixture is derived from the released list";
  return null;
}

export function derivedFixtureText(releasedNames) {
  const lines = ["[tools]"];
  for (const name of releasedNames) {
    lines.push(`"toolshed:${name}" = "latest"`);
  }
  return `${lines.join("\n")}\n`;
}

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}

function runInstalled(releasedNames, pins) {
  const env = {
    ...process.env,
    MISE_CEILING_PATHS: process.env.MISE_CEILING_PATHS || repoRoot,
  };
  const cwd = path.dirname(fixturePath);
  for (const name of releasedNames) {
    const version = pins.get(name);
    const result = spawnSync("mise", ["exec", "--", name, "--version"], {
      cwd,
      env,
      encoding: "utf8",
    });
    const stdout = (result.stdout ?? "").trim();
    if (result.status !== 0 || stdout !== version) {
      fail(
        `${name} printed [${stdout}] exit ${result.status ?? "none"}\n${result.stderr ?? ""}${result.error?.message ?? ""}`,
      );
      return;
    }
    process.stdout.write(`${name} ${stdout}\n`);
  }
}

function invokedAsCli() {
  const entry = process.argv[1];
  if (!entry) return false;
  return path.resolve(entry) === fileURLToPath(import.meta.url);
}

if (invokedAsCli()) {
  const releasedNames = releasedToolNames(readFileSync(luaPath, "utf8"));
  const fixtureText = readFileSync(fixturePath, "utf8");
  const failure = fixtureFailure(releasedNames, fixtureText);
  if (failure !== null) {
    fail(failure);
  } else if (process.argv[2] === "--run") {
    runInstalled(releasedNames, toolshedPins(fixtureText));
  } else {
    process.stdout.write(`fixture covers ${releasedNames.join(", ")}\n`);
  }
}
