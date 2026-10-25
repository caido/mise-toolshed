import { jsonKeyLines } from "./json-key-lines.js";
import { installSites } from "./shell-commands.js";
import type { ParsedFile, PinSite } from "./types.js";
import { unreadable } from "./unreadable-file.js";

export function parsePackageJson(relativePath: string, text: string): ParsedFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return unreadable(relativePath, "package-json");
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return unreadable(relativePath, "package-json");
  }
  const lines = jsonKeyLines(text);
  if (lines === undefined) return unreadable(relativePath, "package-json");
  const record = parsed as Record<string, unknown>;
  if ("packageManager" in record && typeof record.packageManager !== "string") {
    return unreadable(relativePath, "package-json");
  }
  const sites: PinSite[] = [];
  for (const section of [
    "dependencies",
    "devDependencies",
    "optionalDependencies",
    "peerDependencies",
  ]) {
    const value = record[section];
    if (value === null || typeof value !== "object" || Array.isArray(value)) continue;
    for (const [name, spec] of Object.entries(value)) {
      if (typeof spec !== "string") continue;
      sites.push({
        kind: "dependency",
        family: "npm",
        name,
        spec,
        path: relativePath,
        line: lines.get(`${section}\0${name}`) ?? 1,
      });
    }
  }
  if (typeof record.packageManager === "string") {
    sites.push({
      kind: "dependency",
      family: "package-manager",
      name: "packageManager",
      spec: record.packageManager,
      path: relativePath,
      line: lines.get("packageManager") ?? 1,
    });
  }
  const scripts = record.scripts;
  if (scripts !== null && typeof scripts === "object" && !Array.isArray(scripts)) {
    for (const [name, command] of Object.entries(scripts)) {
      if (typeof command !== "string") continue;
      const line = lines.get(`scripts\0${name}`) ?? 1;
      sites.push(...installSites(relativePath, line, command, [], true));
    }
  }
  return { sites, miseUvLocked: false, npmrcFrozen: false };
}
