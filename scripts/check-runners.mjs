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

function normalizedLines(text) {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
}

const jobsHeader = /^jobs:\s*(?:(?:[&*][^\s#]+)\s*)?(?:#.*)?$/;
const jobHeader = /^  \S.*:\s*(?:(?:[&*][^\s#]+)\s*)?(?:#.*)?$/;

function isCommentOrBlank(line) {
  const trimmed = line.trim();
  return trimmed === "" || trimmed.startsWith("#");
}

function jobBodies(text) {
  const lines = normalizedLines(text);
  let jobsAt = -1;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.startsWith("jobs:")) continue;
    if (!jobsHeader.test(line)) {
      throw new Error(`line ${index + 1}: cannot parse jobs:`);
    }
    jobsAt = index;
    break;
  }
  if (jobsAt === -1) {
    throw new Error("jobs: is missing");
  }
  const bodies = [];
  let current = null;
  for (let index = jobsAt + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (isCommentOrBlank(line)) {
      if (current !== null) current.push({ number: index + 1, text: line });
      continue;
    }
    if (/^[^ \t]/.test(line)) break;
    if (/^  \S/.test(line)) {
      if (!jobHeader.test(line)) {
        throw new Error(`line ${index + 1}: cannot parse job header`);
      }
      if (current !== null) bodies.push(current);
      current = [];
      continue;
    }
    if (current === null) {
      throw new Error(`line ${index + 1}: cannot parse job header`);
    }
    current.push({ number: index + 1, text: line });
  }
  if (current !== null) bodies.push(current);
  return bodies;
}

function leadingIndent(line) {
  const match = /^( *)\S/.exec(line);
  return match === null ? null : match[1].length;
}

function mappingKey(line) {
  const match = /^(\s*)([A-Za-z_][A-Za-z0-9_-]*):\s*(.*)$/.exec(line);
  if (match === null) return null;
  return { indent: match[1].length, name: match[2], rest: match[3] };
}

function listValues(lines, index, keyIndent) {
  const bracket = /^\s*[A-Za-z_][A-Za-z0-9_-]*:\s*\[(.*)\]\s*(?:#.*)?$/.exec(lines[index]);
  if (bracket !== null) {
    return bracket[1]
      .split(",")
      .map((item) => scalarValue(item))
      .filter((item) => item !== "");
  }
  const values = [];
  for (let next = index + 1; next < lines.length; next += 1) {
    const line = lines[next];
    if (line.trim() === "" || line.trim().startsWith("#")) continue;
    const item = /^(\s*)-\s*(.*)$/.exec(line);
    if (item === null || item[1].length <= keyIndent) break;
    const value = scalarValue(item[2]);
    if (value !== "") values.push(value);
  }
  return values;
}

function matrixValues(jobText, key) {
  const lines = jobText.split("\n");
  let strategyIndent = null;
  let strategyAt = -1;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.trim() === "" || line.trim().startsWith("#")) continue;
    const parsed = mappingKey(line);
    if (parsed !== null && parsed.name === "strategy") {
      strategyIndent = parsed.indent;
      strategyAt = index;
      break;
    }
  }
  if (strategyIndent === null) return null;
  let matrixIndent = null;
  let matrixAt = -1;
  for (let index = strategyAt + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.trim() === "" || line.trim().startsWith("#")) continue;
    const indent = leadingIndent(line);
    if (indent === null || indent <= strategyIndent) break;
    const parsed = mappingKey(line);
    if (parsed !== null && parsed.name === "matrix") {
      matrixIndent = parsed.indent;
      matrixAt = index;
      break;
    }
  }
  if (matrixIndent === null) return null;
  let values = null;
  for (let index = matrixAt + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.trim() === "" || line.trim().startsWith("#")) continue;
    const indent = leadingIndent(line);
    if (indent === null || indent <= matrixIndent) break;
    const parsed = mappingKey(line);
    if (parsed === null || parsed.indent !== matrixIndent + 2) continue;
    if (parsed.name === "include" || parsed.name === "exclude") return false;
    if (parsed.name !== key) continue;
    values = listValues(lines, index, parsed.indent);
  }
  return values;
}

function runsOnAllowed(value, jobText) {
  if (allowedRunsOn.includes(value)) return true;
  const matrixKey = /^\$\{\{\s*matrix\.([A-Za-z_][A-Za-z0-9_]*)\s*\}\}$/.exec(value);
  if (matrixKey === null) return false;
  const values = matrixValues(jobText, matrixKey[1]);
  return (
    values !== null &&
    values !== false &&
    values.length > 0 &&
    values.every((item) => allowedRunsOn.includes(item))
  );
}

export function checkWorkflows(workflows, io) {
  const failures = [];
  for (const workflow of workflows) {
    let bodies;
    try {
      bodies = jobBodies(workflow.text);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push(`${workflow.path}: ${message}`);
      continue;
    }
    for (const body of bodies) {
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
