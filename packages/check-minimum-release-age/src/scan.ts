import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { classify, skipDirectory } from "../../shared/src/classify-path.js";
import type { Finding } from "../../shared/src/types.js";
import { judgeMise, judgePnpmWorkspace } from "./judge.js";

const PNPM_WORKSPACE = "pnpm-workspace.yaml";

export function scan(cwd: string): readonly Finding[] {
  return walk(cwd, cwd).toSorted(byFinding);
}

function walk(cwd: string, directory: string): readonly Finding[] {
  let entries;
  try {
    entries = readdirSync(directory, { withFileTypes: true });
  } catch {
    const relative = path.relative(cwd, directory).split(path.sep).join("/") || ".";
    return [{ path: relative, line: 1, message: "directory is not readable" }];
  }
  entries = entries.toSorted((left, right) =>
    left.name < right.name ? -1 : left.name > right.name ? 1 : 0,
  );
  return entries.flatMap((entry) => {
    if (entry.isSymbolicLink()) return [];
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (skipDirectory(entry.name)) return [];
      return walk(cwd, full);
    }
    if (!entry.isFile()) return [];
    const relative = path.relative(cwd, full).split(path.sep).join("/");
    if (entry.name !== PNPM_WORKSPACE && classify(relative) !== "mise") return [];
    try {
      const text = readFileSync(full, "utf8");
      if (entry.name === PNPM_WORKSPACE) return judgePnpmWorkspace(relative, text);
      return judgeMise(relative, text);
    } catch {
      const message =
        entry.name === PNPM_WORKSPACE ? "pnpm-workspace is not valid" : "mise is not valid";
      return [{ path: relative, line: 1, message }];
    }
  });
}

function byFinding(left: Finding, right: Finding): number {
  if (left.path !== right.path) return left.path < right.path ? -1 : 1;
  if (left.line !== right.line) return left.line - right.line;
  if (left.message !== right.message) return left.message < right.message ? -1 : 1;
  return 0;
}
