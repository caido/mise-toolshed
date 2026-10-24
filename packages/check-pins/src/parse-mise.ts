import { braceDelta, readTomlString, tomlAssignment, tomlHeader, unquoteTomlKey } from "./toml-scan.js";
import type { ParsedFile, PinSite, PluginSite, ToolSite } from "./types.js";

export function parseMise(relativePath: string, text: string): ParsedFile {
  const sites: PinSite[] = [];
  let section: "tools" | "plugins" | "env" | "other" = "other";
  let subtable = false;
  let braceDepth = 0;
  let multiline: '"' | "'" | null = null;
  let miseUvLocked = false;
  const tableNames = new Set<string>();
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    const lineNo = index + 1;
    if (multiline) {
      if (line.includes(multiline === '"' ? '"""' : "'''")) multiline = null;
      continue;
    }
    if (braceDepth > 0) {
      braceDepth += braceDelta(line);
      if (braceDepth < 0) braceDepth = 0;
      continue;
    }
    const header = tomlHeader(line);
    if (header !== undefined) {
      const parsed = miseHeader(header);
      section = parsed.section;
      subtable = parsed.name !== undefined;
      if ((section === "tools" || section === "plugins") && parsed.name !== undefined && !tableNames.has(`${section}\0${parsed.name}`)) {
        tableNames.add(`${section}\0${parsed.name}`);
        sites.push(tableSite(section, parsed.name, relativePath, lineNo));
      }
      continue;
    }
    if (subtable || section === "other") continue;
    const assignment = tomlAssignment(line);
    if (assignment === undefined) continue;
    if (section === "env") {
      if (assignment.key === "UV_LOCKED") {
        const value = miseScalar(assignment.value);
        miseUvLocked = value === "1";
      }
      continue;
    }
    if (assignment.key.includes(".")) {
      const name = assignment.key.split(".")[0] ?? assignment.key;
      if (!tableNames.has(`${section}\0${name}`)) {
        tableNames.add(`${section}\0${name}`);
        sites.push(tableSite(section, name, relativePath, lineNo));
      }
      continue;
    }
    const opened = openMultiline(assignment.value);
    if (opened) {
      sites.push(stringSite(section, assignment.key, "", relativePath, lineNo));
      multiline = opened;
      continue;
    }
    const value = classifyMiseValue(assignment.value);
    if (value.shape === "table") {
      sites.push(tableSite(section, assignment.key, relativePath, lineNo));
      if (value.depth > 0) braceDepth = value.depth;
      continue;
    }
    sites.push(stringSite(section, assignment.key, value.text, relativePath, lineNo));
  }
  return { sites, miseUvLocked, npmrcFrozen: false };
}

function tableSite(
  section: "tools" | "plugins",
  name: string,
  relativePath: string,
  line: number,
): ToolSite | PluginSite {
  if (section === "tools") {
    return { kind: "tool", name, value: { shape: "table" }, path: relativePath, line };
  }
  return { kind: "plugin", name, value: { shape: "table" }, path: relativePath, line };
}

function stringSite(
  section: "tools" | "plugins",
  name: string,
  text: string,
  relativePath: string,
  line: number,
): ToolSite | PluginSite {
  if (section === "tools") {
    return { kind: "tool", name, value: { shape: "string", text }, path: relativePath, line };
  }
  return { kind: "plugin", name, value: { shape: "string", text }, path: relativePath, line };
}

function miseHeader(header: string): { section: "tools" | "plugins" | "env" | "other"; name?: string } {
  for (const section of ["tools", "plugins", "env"] as const) {
    if (header === section) return { section };
    if (header.startsWith(`${section}.`)) {
      return { section, name: unquoteTomlKey(header.slice(section.length + 1).trim()) };
    }
  }
  return { section: "other" };
}

function openMultiline(value: string): '"' | "'" | null {
  const trimmed = value.trimStart();
  if (trimmed.startsWith('"""')) return trimmed.slice(3).includes('"""') ? null : '"';
  if (trimmed.startsWith("'''")) return trimmed.slice(3).includes("'''") ? null : "'";
  return null;
}

function classifyMiseValue(value: string): { shape: "string"; text: string } | { shape: "table"; depth: number } {
  const trimmed = value.trimStart();
  if (trimmed.startsWith("{")) {
    const depth = braceDelta(value);
    return { shape: "table", depth: depth > 0 ? depth : 0 };
  }
  return { shape: "string", text: miseScalar(value) };
}

function miseScalar(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith('"') || trimmed.startsWith("'")) {
    const text = readTomlString(trimmed);
    if (text !== undefined) return text;
  }
  const hash = trimmed.indexOf("#");
  const raw = (hash === -1 ? trimmed : trimmed.slice(0, hash)).trim();
  return raw;
}
