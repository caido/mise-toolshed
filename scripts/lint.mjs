import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkWorkflows, workflowSources } from "./check-runners.mjs";
import { listShellFiles } from "./shell-files.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function run(command, args) {
  const result = spawnSync(command, args, { cwd: repoRoot, stdio: "inherit" });
  if (result.error) {
    process.stderr.write(`${result.error.message}\n`);
    return false;
  }
  return result.status === 0;
}

let failed = false;

if (!run("pnpm", ["exec", "oxlint", "--type-aware", "--deny-warnings", "."])) {
  failed = true;
}

let shellFiles = [];
try {
  shellFiles = listShellFiles(repoRoot);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  failed = true;
}
if (shellFiles.length > 0 && !run("shellcheck", shellFiles)) {
  failed = true;
}

if (!run("zizmor", ["--offline", "."])) {
  failed = true;
}

try {
  checkWorkflows(workflowSources(repoRoot), {
    stdout: process.stdout,
    stderr: process.stderr,
  });
} catch {
  failed = true;
}

if (failed) process.exit(1);
