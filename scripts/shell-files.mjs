import { spawnSync } from "node:child_process";

const dropped = new Set(["node_modules", "dist", ".git"]);

export function shellPaths(shfmtFindOutput) {
  const paths = [];
  for (const line of shfmtFindOutput.split("\n")) {
    if (line === "") continue;
    const normalized = line.startsWith("./") ? line.slice(2) : line;
    if (normalized.split("/").some((segment) => dropped.has(segment))) continue;
    paths.push(normalized);
  }
  return paths;
}

export function listShellFiles(repoRoot) {
  const result = spawnSync("shfmt", ["-f", "."], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    const detail = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
    throw new Error(detail || "shfmt -f failed");
  }
  return shellPaths(result.stdout ?? "");
}
