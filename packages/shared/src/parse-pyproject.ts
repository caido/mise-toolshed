import { scanToml, tomlAssignment, tomlHeader } from "./toml-scan.js";
import type { DependencySite, ParsedFile, PinSite } from "./types.js";
import { unreadable } from "./unreadable-file.js";

export function parsePyproject(relativePath: string, text: string): ParsedFile {
  const sites: PinSite[] = [];
  let table = "";
  let depth = 0;
  let emitting = false;
  const lines = text.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const lineNo = index + 1;
    if (depth > 0) {
      const scanned = scanToml(line, depth);
      if (emitting && (scanned.broken || scanned.sawTable))
        return unreadable(relativePath, "pyproject");
      if (emitting) {
        for (const spec of scanned.strings) {
          sites.push(pythonSite(relativePath, lineNo, spec));
        }
      }
      depth = scanned.depth;
      if (depth === 0) emitting = false;
      continue;
    }
    const header = tomlHeader(line);
    if (header !== undefined) {
      table = header;
      continue;
    }
    const assignment = tomlAssignment(line);
    if (assignment === undefined || !pyprojectArray(table, assignment.key)) continue;
    const scanned = scanToml(assignment.value, 0);
    if (scanned.broken || scanned.sawTable) return unreadable(relativePath, "pyproject");
    for (const spec of scanned.strings) {
      sites.push(pythonSite(relativePath, lineNo, spec));
    }
    depth = scanned.depth;
    emitting = depth > 0;
  }
  if (depth > 0) return unreadable(relativePath, "pyproject");
  return { sites, miseUvLocked: false, npmrcFrozen: false };
}

function pythonSite(relativePath: string, line: number, spec: string): DependencySite {
  return {
    kind: "dependency",
    family: "python",
    name: pythonPackageName(spec),
    spec,
    path: relativePath,
    line,
  };
}

function pyprojectArray(table: string, key: string): boolean {
  if (table === "project" && key === "dependencies") return true;
  if (table === "project.optional-dependencies") return true;
  if (table === "dependency-groups") return true;
  return false;
}

function pythonPackageName(spec: string): string {
  const splitAt = spec.indexOf(";");
  const left = (splitAt === -1 ? spec : spec.slice(0, splitAt)).trim();
  const at = left.indexOf(" @ ");
  const head = (at === -1 ? left : left.slice(0, at)).trim();
  const match = /^([A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?)/.exec(head);
  return match?.[1] ?? head;
}
