import { readdirSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const allowedRunsOn = ["ubuntu-latest", "macos-latest", "windows-latest"];

function scalarValue(raw) {
  const comment = raw.indexOf(" #");
  const withoutComment = comment === -1 ? raw : raw.slice(0, comment);
  const trimmed = withoutComment.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'") && trimmed.length >= 2)
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function jobBodies(text) {
  const lines = text.split("\n");
  let jobsAt = -1;
  for (let index = 0; index < lines.length; index += 1) {
    if (lines[index] === "jobs:") {
      jobsAt = index;
      break;
    }
  }
  const bodies = [];
  let current = null;
  for (let index = jobsAt + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^[^ \t]/.test(line) && line.trim() !== "") break;
    if (/^  [^ \t].*:\s*$/.test(line)) {
      if (current !== null) bodies.push(current);
      current = [];
      continue;
    }
    if (current !== null) current.push({ number: index + 1, text: line });
  }
  if (current !== null) bodies.push(current);
  return bodies;
}

function matrixValues(jobText, key) {
  const lines = jobText.split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    const bracket = new RegExp(`^\\s*${key}\\s*:\\s*\\[(.*)\\]\\s*$`).exec(lines[index]);
    if (bracket !== null) {
      return bracket[1]
        .split(",")
        .map((item) => scalarValue(item))
        .filter((item) => item !== "");
    }
    const head = new RegExp(`^(\\s*)${key}\\s*:\\s*$`).exec(lines[index]);
    if (head === null) continue;
    const indent = head[1].length;
    const values = [];
    for (let next = index + 1; next < lines.length; next += 1) {
      const item = /^(\s*)-\s*(.*)$/.exec(lines[next]);
      if (item === null || item[1].length <= indent) break;
      const value = scalarValue(item[2]);
      if (value !== "") values.push(value);
    }
    return values;
  }
  return null;
}

function runsOnAllowed(value, jobText) {
  if (allowedRunsOn.includes(value)) return true;
  const matrixKey = /^\$\{\{\s*matrix\.([A-Za-z_][A-Za-z0-9_]*)\s*\}\}$/.exec(value);
  if (matrixKey === null) return false;
  const values = matrixValues(jobText, matrixKey[1]);
  return (
    values !== null && values.length > 0 && values.every((item) => allowedRunsOn.includes(item))
  );
}

export function checkWorkflows(workflows, io) {
  const failures = [];
  for (const workflow of workflows) {
    for (const body of jobBodies(workflow.text)) {
      const jobText = body.map((line) => line.text).join("\n");
      for (const line of body) {
        const match = /^(\s*)runs-on\s*:\s*(.*)$/.exec(line.text);
        if (match === null) continue;
        if (runsOnAllowed(scalarValue(match[2]), jobText)) continue;
        failures.push(
          `${workflow.path}:${line.number}: runs-on must be ${allowedRunsOn.join(" or ")}`,
        );
      }
    }
  }
  if (failures.length > 0) {
    for (const failure of failures) io.stderr.write(`${failure}\n`);
    throw new Error(failures.join("\n"));
  }
  io.stdout.write(`${allowedRunsOn.join("\n")}\n`);
}

export function workflowSources(root) {
  const directory = path.join(root, ".github", "workflows");
  return readdirSync(directory)
    .filter((name) => name.endsWith(".yml") || name.endsWith(".yaml"))
    .sort()
    .map((name) => {
      const file = path.join(directory, name);
      return {
        path: path.relative(root, file),
        text: readFileSync(file, "utf8"),
      };
    });
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
  try {
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
    checkWorkflows(workflowSources(root), {
      stdout: process.stdout,
      stderr: process.stderr,
    });
  } catch {
    process.exitCode = 1;
  }
}
