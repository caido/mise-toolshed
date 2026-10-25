import { readdirSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const requiredRunsOn = "ubuntu-latest";

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

export function checkWorkflows(workflows, io) {
  const failures = [];
  for (const workflow of workflows) {
    const lines = workflow.text.split("\n");
    for (let index = 0; index < lines.length; index += 1) {
      const match = /^(\s*)runs-on\s*:\s*(.*)$/.exec(lines[index]);
      if (match === null) continue;
      const value = scalarValue(match[2]);
      if (value === requiredRunsOn) continue;
      failures.push(`${workflow.path}:${index + 1}: runs-on must be ${requiredRunsOn}`);
    }
  }
  if (failures.length > 0) {
    for (const failure of failures) io.stderr.write(`${failure}\n`);
    throw new Error(failures.join("\n"));
  }
  io.stdout.write(`${requiredRunsOn}\n`);
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
