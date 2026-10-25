import {
  braceDelta,
  readTomlString,
  tomlAssignment,
  tomlHeader,
  unquoteTomlKey,
} from "./toml-scan.js";
import type { ParsedFile, PinSite, PluginSite, ToolSite } from "./types.js";

type ToolRow = {
  name: string;
  headerLine: number;
  version?: { text: string; line: number };
  hanging: boolean;
};

type ToolHit = { readonly text: string; readonly line: number };

export function parseMise(relativePath: string, text: string): ParsedFile {
  const sites: PinSite[] = [];
  let section: "tools" | "plugins" | "env" | "other" = "other";
  let skipKeys = false;
  let braceDepth = 0;
  let multiline: '"' | "'" | null = null;
  let miseUvLocked = false;
  let row: ToolRow | undefined;
  const pluginNames = new Set<string>();
  const toolSeen = new Set<string>();
  const dottedPending = new Map<string, number>();
  const lines = text.split(/\r?\n/);

  const sawTool = (name: string): void => {
    toolSeen.add(name);
    dottedPending.delete(name);
  };

  const flushDotted = (): void => {
    for (const [name, line] of dottedPending) {
      sites.push(stringSite("tools", name, "", relativePath, line));
    }
    dottedPending.clear();
  };

  const flushRow = (): void => {
    if (!row) return;
    sawTool(row.name);
    sites.push(
      stringSite(
        "tools",
        row.name,
        row.version?.text ?? "",
        relativePath,
        row.version?.line ?? row.headerLine,
      ),
    );
    row = undefined;
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
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
      flushRow();
      const parsed = miseHeader(header.name);
      if (parsed.section !== "tools") flushDotted();
      section = parsed.section;
      skipKeys = parsed.name !== undefined && section !== "tools";
      if (section === "tools" && parsed.name !== undefined) {
        row = { name: parsed.name, headerLine: lineNo, hanging: false };
        continue;
      }
      if (section === "plugins" && parsed.name !== undefined) {
        if (header.array || !pluginNames.has(parsed.name)) {
          if (!header.array) pluginNames.add(parsed.name);
          sites.push(pluginTable(parsed.name, relativePath, lineNo));
        }
      }
      continue;
    }
    if (row) {
      if (row.hanging) {
        row.hanging = false;
        if (tomlAssignment(line) === undefined && line.trim() !== "") {
          row.version = { text: miseScalar(line), line: lineNo };
          continue;
        }
      }
      const assignment = tomlAssignment(line);
      if (assignment) {
        const opened = openMultiline(assignment.value);
        if (opened) {
          if (assignment.key === "version" && !row.version) {
            row.version = { text: "", line: lineNo };
          }
          multiline = opened;
          continue;
        }
        if (assignment.key === "version" && !row.version) {
          if (assignment.value.trim() === "") row.hanging = true;
          else row.version = { text: miseScalar(assignment.value), line: lineNo };
        }
      }
      continue;
    }
    if (skipKeys || section === "other") continue;
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
      const dot = assignment.key.indexOf(".");
      const name = assignment.key.slice(0, dot);
      const field = assignment.key.slice(dot + 1);
      if (section === "plugins" && !pluginNames.has(name)) {
        pluginNames.add(name);
        sites.push(pluginTable(name, relativePath, lineNo));
      }
      if (section === "tools" && field === "version") {
        const opened = openMultiline(assignment.value);
        sawTool(name);
        if (opened) {
          sites.push(stringSite("tools", name, "", relativePath, lineNo));
          multiline = opened;
        } else {
          sites.push(stringSite("tools", name, miseScalar(assignment.value), relativePath, lineNo));
        }
      } else if (section === "tools" && !toolSeen.has(name) && !dottedPending.has(name)) {
        dottedPending.set(name, lineNo);
      }
      continue;
    }
    const opened = openMultiline(assignment.value);
    if (opened) {
      sites.push(stringSite(section, assignment.key, "", relativePath, lineNo));
      multiline = opened;
      continue;
    }
    if (section === "plugins") {
      const trimmed = assignment.value.trimStart();
      if (trimmed.startsWith("{")) {
        sites.push(pluginTable(assignment.key, relativePath, lineNo));
        const depth = braceDelta(assignment.value);
        if (depth > 0) braceDepth = depth;
        continue;
      }
      sites.push(
        stringSite("plugins", assignment.key, miseScalar(assignment.value), relativePath, lineNo),
      );
      continue;
    }
    const inline = inlineToolHits(lines, index, assignment.value);
    if (inline) {
      sawTool(assignment.key);
      const hits =
        inline.hits.length > 0
          ? inline.hits
          : [{ text: miseScalar(assignment.value), line: lineNo }];
      for (const hit of hits) {
        sites.push(stringSite("tools", assignment.key, hit.text, relativePath, hit.line));
      }
      index = inline.end;
      continue;
    }
    sawTool(assignment.key);
    sites.push(
      stringSite("tools", assignment.key, miseScalar(assignment.value), relativePath, lineNo),
    );
  }
  flushRow();
  flushDotted();
  return { sites, miseUvLocked, npmrcFrozen: false };
}

function pluginTable(name: string, relativePath: string, line: number): PluginSite {
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

function miseHeader(header: string): {
  section: "tools" | "plugins" | "env" | "other";
  name?: string;
} {
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

function inlineToolHits(
  lines: readonly string[],
  start: number,
  firstValue: string,
): { end: number; hits: ToolHit[] } | undefined {
  const trimmed = firstValue.trimStart();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return undefined;
  const array = trimmed.startsWith("[");
  let quote: '"' | "'" | null = null;
  let escape = false;
  let brace = 0;
  let bracket = 0;
  let mode: "scan" | "key" | "eq" | "value" | "hold" = "scan";
  let key = "";
  let capturing = false;
  let valueStarted = false;
  let valueQuoted = false;
  let scalarElement = false;
  let valueBuf = "";
  let valueLine = start + 1;
  let elementOpen = false;
  let elementLine = start + 1;
  let version: ToolHit | undefined;
  const hits: ToolHit[] = [];

  const atTop = (): boolean =>
    array ? brace === 1 && bracket === 1 : brace === 1 && bracket === 0;

  const finishValue = (): void => {
    if (capturing && valueStarted && !scalarElement) {
      version = { text: valueQuoted ? valueBuf : valueBuf.trim(), line: valueLine };
    }
    capturing = false;
    valueStarted = false;
    valueQuoted = false;
    valueBuf = "";
    mode = "scan";
    key = "";
  };

  const takeScalar = (): void => {
    if (!scalarElement) return;
    hits.push({ text: valueQuoted ? valueBuf : valueBuf.trim(), line: valueLine });
    scalarElement = false;
    capturing = false;
    valueStarted = false;
    valueQuoted = false;
    valueBuf = "";
    mode = "scan";
  };

  const emitElement = (): void => {
    hits.push(version ?? { text: "", line: elementLine });
    version = undefined;
    elementOpen = false;
  };

  for (let lineIndex = start; lineIndex < lines.length; lineIndex += 1) {
    const source = lineIndex === start ? firstValue : (lines[lineIndex] ?? "");
    if (lineIndex > start && mode === "value" && !valueStarted && !quote && !scalarElement) {
      const peek = source.trimStart();
      if (!peek.startsWith('"') && !peek.startsWith("'")) finishValue();
    }
    for (let i = 0; i < source.length; i += 1) {
      const ch = source[i] ?? "";
      if (quote) {
        if (escape) {
          escape = false;
          const decoded = ch === "n" ? "\n" : ch === "t" ? "\t" : ch;
          if (mode === "key") key += decoded;
          if (mode === "value" && capturing) valueBuf += decoded;
          continue;
        }
        if (ch === "\\" && quote === '"') {
          escape = true;
          continue;
        }
        if (ch === quote) {
          quote = null;
          if (mode === "key") mode = "eq";
          else if (scalarElement) mode = "hold";
          else if (mode === "value" && capturing) finishValue();
          continue;
        }
        if (mode === "key") key += ch;
        if (mode === "value" && capturing) valueBuf += ch;
        continue;
      }
      if (ch === "#") break;
      if (ch === "{") {
        if (mode === "value") finishValue();
        if (array && brace === 0 && bracket >= 1) {
          elementOpen = true;
          elementLine = lineIndex + 1;
          version = undefined;
        }
        brace += 1;
        mode = "scan";
        continue;
      }
      if (ch === "}") {
        if (mode === "value") finishValue();
        brace -= 1;
        if (array && elementOpen && brace === 0) emitElement();
        if (!array && brace === 0 && bracket === 0) {
          hits.push(version ?? { text: "", line: start + 1 });
          return { end: lineIndex, hits };
        }
        mode = "scan";
        continue;
      }
      if (ch === "[") {
        if (mode === "value") finishValue();
        bracket += 1;
        mode = "scan";
        continue;
      }
      if (ch === "]") {
        if (scalarElement) takeScalar();
        else if (mode === "value") finishValue();
        bracket -= 1;
        if (array && bracket === 0 && brace <= 0) {
          if (elementOpen) emitElement();
          return { end: lineIndex, hits };
        }
        mode = "scan";
        continue;
      }
      if (ch === ",") {
        if (scalarElement) takeScalar();
        else if (mode === "value") finishValue();
        else mode = "scan";
        continue;
      }
      if (ch === "=" && (mode === "eq" || mode === "key")) {
        mode = "value";
        capturing = key === "version" && atTop();
        valueStarted = false;
        valueQuoted = false;
        valueBuf = "";
        valueLine = lineIndex + 1;
        continue;
      }
      if (mode === "hold") {
        if (ch === " " || ch === "\t") continue;
        takeScalar();
        i -= 1;
        continue;
      }
      if (
        mode === "scan" &&
        array &&
        bracket === 1 &&
        brace === 0 &&
        ch !== "{" &&
        ch !== "[" &&
        ch !== "]"
      ) {
        if (ch === " " || ch === "\t") continue;
        scalarElement = true;
        mode = "value";
        capturing = true;
        valueStarted = true;
        valueQuoted = ch === '"' || ch === "'";
        valueBuf = valueQuoted ? "" : ch;
        valueLine = lineIndex + 1;
        if (ch === '"') quote = '"';
        else if (ch === "'") quote = "'";
        continue;
      }
      if (mode === "value") {
        if (!valueStarted) {
          if (ch === " " || ch === "\t") continue;
          if (ch === '"' || ch === "'") {
            quote = ch;
            valueStarted = true;
            valueQuoted = true;
            continue;
          }
          valueStarted = true;
        }
        if (capturing) valueBuf += ch;
        continue;
      }
      if (ch === " " || ch === "\t") {
        if (mode === "key") mode = "eq";
        continue;
      }
      if (mode === "scan" && atTop() && /[A-Za-z0-9_]/.test(ch)) {
        mode = "key";
        key = ch;
        continue;
      }
      if (ch === '"' || ch === "'") {
        if (mode === "scan" && atTop()) {
          mode = "key";
          key = "";
        }
        quote = ch;
        continue;
      }
      if (mode === "key" && /[A-Za-z0-9_-]/.test(ch)) {
        key += ch;
        continue;
      }
    }
    if (mode === "hold" || (scalarElement && mode === "value" && !quote && valueStarted))
      takeScalar();
    else if (mode === "value" && !quote && valueStarted) finishValue();
  }
  if (elementOpen) emitElement();
  if (!array && hits.length === 0) hits.push(version ?? { text: "", line: start + 1 });
  return { end: lines.length - 1, hits };
}
