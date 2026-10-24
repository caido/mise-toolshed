import type { FileKind } from "./types.js";

export function skipDirectory(name: string): boolean {
  return name === "node_modules" || name === ".git" || name === "dist";
}

export function classify(relativePath: string): FileKind {
  const parts = relativePath.split("/");
  const base = parts[parts.length - 1] ?? "";
  const parent = parts[parts.length - 2] ?? "";
  const grandparent = parts[parts.length - 3] ?? "";
  if (base === "package.json") return "package-json";
  if (base === "pyproject.toml") return "pyproject";
  if (base === "mise.toml") return "mise";
  if (parent === ".mise" && base.endsWith(".toml")) return "mise";
  if (base.startsWith("Dockerfile")) return "dockerfile";
  if (base === ".npmrc") return "npmrc";
  if (
    grandparent === ".github" &&
    parent === "workflows" &&
    (base.endsWith(".yml") || base.endsWith(".yaml"))
  ) {
    return "workflow";
  }
  return "skip";
}
