import { parseYamlKey, yamlScalar } from "../../shared/src/yaml-scan.js";
import {
  braceDelta,
  readTomlString,
  tomlAssignment,
  tomlHeader,
  unquoteTomlKey,
} from "../../shared/src/toml-scan.js";
import type { Finding } from "../../shared/src/types.js";
import { parseMiseAge, SEVEN_DAYS_MS } from "./duration.js";

const PNPM_MINUTES = 10080;
const PNPM_NOT_SET = "minimumReleaseAge is not set";
const PNPM_TOO_LOW = "minimumReleaseAge must be at least 10080 minutes";
const MISE_NOT_SET = "minimum_release_age is not set";
const MISE_TOO_LOW = "minimum_release_age must be at least 7d";

type PnpmAge =
  | { readonly kind: "missing" }
  | { readonly kind: "set"; readonly line: number; readonly minutes: number | undefined };

type MiseSetting = { readonly line: number; readonly value: string | undefined };

export function judgePnpmWorkspace(relativePath: string, text: string): readonly Finding[] {
  const age = readPnpmAge(text);
  if (age.kind === "missing") return [finding(relativePath, 1, PNPM_NOT_SET)];
  if (age.minutes === undefined || age.minutes < PNPM_MINUTES) {
    return [finding(relativePath, age.line, PNPM_TOO_LOW)];
  }
  return [];
}

export function judgeMise(relativePath: string, text: string): readonly Finding[] {
  const setting = readMiseSetting(text);
  if (setting === undefined) return [finding(relativePath, 1, MISE_NOT_SET)];
  if (setting.value === undefined) return [finding(relativePath, setting.line, MISE_TOO_LOW)];
  const age = parseMiseAge(setting.value);
  if (age.kind === "duration" && age.milliseconds >= SEVEN_DAYS_MS) return [];
  return [finding(relativePath, setting.line, MISE_TOO_LOW)];
}

function readPnpmAge(text: string): PnpmAge {
  let found: { line: number; minutes: number | undefined } | undefined;
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    const parsed = parseYamlKey(line);
    if (parsed === undefined || parsed.indent !== 0 || parsed.key !== "minimumReleaseAge") continue;
    found = { line: index + 1, minutes: plainMinutes(yamlScalar(parsed.value).value) };
  }
  if (found === undefined) return { kind: "missing" };
  return { kind: "set", line: found.line, minutes: found.minutes };
}

function plainMinutes(scalar: string): number | undefined {
  if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(scalar)) return undefined;
  const minutes = Number(scalar);
  return Number.isFinite(minutes) ? minutes : undefined;
}

function readMiseSetting(text: string): MiseSetting | undefined {
  let section: "root" | "settings" | "other" = "root";
  let braceDepth = 0;
  let multiline: '"' | "'" | null = null;
  let seen: MiseSetting | undefined;
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
      const name = unquoteTomlKey(header);
      section = name === "settings" ? "settings" : "other";
      continue;
    }
    const assignment = tomlAssignment(line);
    if (assignment === undefined) continue;
    const selected =
      (section === "root" && assignment.key === "settings.minimum_release_age") ||
      (section === "settings" && assignment.key === "minimum_release_age");
    const opened = openMultiline(assignment.value);
    if (opened) {
      if (selected) seen = { line: lineNo, value: undefined };
      multiline = opened;
      continue;
    }
    if (selected) seen = { line: lineNo, value: tomlString(assignment.value) };
    const depth = braceDelta(assignment.value);
    if (depth > 0) braceDepth = depth;
  }
  return seen;
}

function openMultiline(value: string): '"' | "'" | null {
  const trimmed = value.trimStart();
  if (trimmed.startsWith('"""')) return trimmed.slice(3).includes('"""') ? null : '"';
  if (trimmed.startsWith("'''")) return trimmed.slice(3).includes("'''") ? null : "'";
  return null;
}

function tomlString(value: string): string | undefined {
  const trimmed = value.trim();
  if (trimmed.startsWith('"""') || trimmed.startsWith("'''")) {
    const quote = trimmed.slice(0, 3);
    const end = trimmed.indexOf(quote, 3);
    if (end === -1) return undefined;
    return trimmed.slice(3, end).trim();
  }
  if (!trimmed.startsWith('"') && !trimmed.startsWith("'")) return undefined;
  return readTomlString(trimmed)?.trim();
}

function finding(path: string, line: number, message: string): Finding {
  return { path, line, message };
}
