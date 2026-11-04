import { readdirSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { LineCounter, parseDocument } from "yaml";

const allowedRunsOn = ["ubuntu-latest", "macos-latest", "windows-latest"];

function lineOf(lineCounter, node) {
  const start = node?.range?.[0];
  if (typeof start !== "number") return 1;
  return lineCounter.linePos(start).line;
}

function nodeText(node) {
  const value = node !== null && typeof node === "object" && "value" in node ? node.value : node;
  if (typeof value !== "string") return null;
  return value.trim();
}

function nodeItems(node) {
  if (node !== null && typeof node === "object" && Array.isArray(node.items)) return node.items;
  return null;
}

function matrixValues(matrix, key) {
  if (matrix === undefined || matrix === null || typeof matrix.has !== "function") return null;
  if (matrix.has("include") || matrix.has("exclude")) return false;
  const node = matrix.get(key, true);
  const items = nodeItems(node);
  if (items === null) return null;
  return items.map((item) => nodeText(item));
}

function runsOnAllowed(value, job) {
  if (allowedRunsOn.includes(value)) return true;
  const matrixKey = /^\$\{\{\s*matrix\.([A-Za-z_][A-Za-z0-9_]*)\s*\}\}$/.exec(value);
  if (matrixKey === null || typeof job?.get !== "function") return false;
  const strategy = job.get("strategy", true);
  const matrix = strategy?.get?.("matrix", true);
  const values = matrixValues(matrix, matrixKey[1]);
  return (
    values !== null &&
    values !== false &&
    values.length > 0 &&
    values.every((item) => item !== null && allowedRunsOn.includes(item))
  );
}

function jobRunsOn(job) {
  if (typeof job?.get !== "function") return [];
  const node = job.get("runs-on", true);
  if (node === undefined || node === null) return [];
  const items = nodeItems(node);
  if (items !== null) return items;
  return [node];
}

export function checkWorkflows(workflows, io) {
  const failures = [];
  for (const workflow of workflows) {
    const lineCounter = new LineCounter();
    let document;
    try {
      document = parseDocument(workflow.text, { lineCounter, uniqueKeys: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push(`${workflow.path}: ${message}`);
      continue;
    }
    if (document.errors.length > 0) {
      failures.push(`${workflow.path}: ${document.errors[0].message}`);
      continue;
    }
    const jobs = document.get("jobs", true);
    if (jobs === undefined || jobs === null || typeof jobs.items === "undefined") {
      failures.push(`${workflow.path}: jobs: is missing`);
      continue;
    }
    for (const item of jobs.items) {
      const job = item.value;
      for (const runsOn of jobRunsOn(job)) {
        const text = nodeText(runsOn) ?? "";
        if (runsOnAllowed(text, job)) continue;
        const line = lineOf(lineCounter, runsOn);
        failures.push(`${workflow.path}:${line}: runs-on must be ${allowedRunsOn.join(" or ")}`);
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
