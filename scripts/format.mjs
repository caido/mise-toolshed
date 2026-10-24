import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { listShellFiles } from "./shell-files.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mode = process.argv[2];

if (mode !== "check" && mode !== "write") {
  process.stderr.write("usage: format.mjs check|write\n");
  process.exit(1);
}

function run(command, args) {
  const result = spawnSync(command, args, { cwd: repoRoot, stdio: "inherit" });
  if (result.error) {
    process.stderr.write(`${result.error.message}\n`);
    return false;
  }
  return result.status === 0;
}

let shellFiles = [];
try {
  shellFiles = listShellFiles(repoRoot);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

const commands = [
  mode === "check" ? ["pnpm", ["exec", "oxfmt", "--check", "."]] : ["pnpm", ["exec", "oxfmt", "."]],
  shellFiles.length === 0
    ? null
    : mode === "check"
      ? ["shfmt", ["-d", ...shellFiles]]
      : ["shfmt", ["-w", ...shellFiles]],
  mode === "check" ? ["stylua", ["--check", "."]] : ["stylua", ["."]],
].filter((command) => command !== null);

let failed = false;
for (const [command, args] of commands) {
  if (!run(command, args)) failed = true;
}

if (failed) process.exit(1);
