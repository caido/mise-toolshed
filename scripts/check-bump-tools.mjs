import { existsSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function choiceOptions(text, inputName) {
  const lines = text.split("\n");
  let inputIndent = -1;
  let inputLine = -1;
  const inputPattern = new RegExp(`^(\\s*)${inputName}:\\s*$`);
  for (let index = 0; index < lines.length; index += 1) {
    const match = inputPattern.exec(lines[index]);
    if (match === null) continue;
    if (inputLine !== -1) throw new Error(`duplicate ${inputName} input`);
    inputIndent = match[1].length;
    inputLine = index;
  }
  if (inputLine === -1) throw new Error(`missing ${inputName} input`);

  let optionsIndent = -1;
  let optionsLine = -1;
  for (let index = inputLine + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.trim() === "") continue;
    const indent = leadingIndent(line);
    if (indent <= inputIndent) break;
    const match = /^(\s*)options:\s*$/.exec(line);
    if (match === null) continue;
    optionsIndent = match[1].length;
    optionsLine = index;
    break;
  }
  if (optionsLine === -1) throw new Error(`missing ${inputName} options`);

  const values = [];
  for (let index = optionsLine + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.trim() === "") continue;
    if (leadingIndent(line) <= optionsIndent) break;
    const match = /^\s*-\s+([A-Za-z0-9-]+)\s*$/.exec(line);
    if (match === null) throw new Error(`invalid ${inputName} option line: ${line}`);
    values.push(match[1]);
  }
  return values;
}

export function versionedTools(root) {
  const packages = path.join(root, "packages");
  const names = [];
  for (const entry of readdirSync(packages, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const manifestPath = path.join(packages, entry.name, "package.json");
    if (!existsSync(manifestPath)) continue;
    const raw = JSON.parse(readFileSync(manifestPath, "utf8"));
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) continue;
    if (typeof raw.version !== "string") continue;
    names.push(entry.name);
  }
  names.sort(compareNames);
  return names;
}

export function checkBumpTools(root) {
  const workflowPath = path.join(root, ".github", "workflows", "bump-version.yml");
  const text = readFileSync(workflowPath, "utf8");
  const tools = choiceOptions(text, "tool");
  const parts = choiceOptions(text, "part");
  const packages = versionedTools(root);
  const failures = [];

  if (parts.join(",") !== "major,minor,patch") {
    failures.push("bump workflow part choices must be major, minor, patch");
  }
  if (new Set(tools).size !== tools.length) {
    failures.push("bump workflow tool choices must be unique");
  }

  const chosen = [...tools].sort(compareNames);
  for (const name of packages) {
    if (!chosen.includes(name)) failures.push(`tool missing from bump workflow choices: ${name}`);
  }
  for (const name of chosen) {
    if (!packages.includes(name)) {
      failures.push(`bump workflow choice has no versioned package: ${name}`);
    }
  }

  const releasePath = path.join(root, ".github", "workflows", "release.yml");
  if (existsSync(releasePath)) {
    const releaseTools = [...choiceOptions(readFileSync(releasePath, "utf8"), "tool")].sort(
      compareNames,
    );
    if (releaseTools.join(",") !== chosen.join(",")) {
      failures.push("release workflow tool choices do not match bump workflow tool choices");
    }
  }

  if (failures.length > 0) {
    throw new Error(failures.join("\n"));
  }
  return packages;
}

function compareNames(left, right) {
  return left.localeCompare(right);
}

function leadingIndent(line) {
  const match = /^\s*/.exec(line);
  return match === null ? 0 : match[0].length;
}

function invokedAsCli() {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return import.meta.url === pathToFileURL(realpathSync(entry)).href;
  } catch {
    return false;
  }
}

if (invokedAsCli()) {
  const root = process.argv[2] === undefined ? scriptRoot : path.resolve(process.argv[2]);
  try {
    const tools = checkBumpTools(root);
    process.stdout.write(`${tools.join("\n")}\n`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  }
}
