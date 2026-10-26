import { readFileSync, writeFileSync } from "node:fs";

type Part = "major" | "minor" | "patch";

const semver = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/;

const manifest = process.argv[2];
const partArg = process.argv[3];
if (manifest === undefined || manifest.length === 0 || partArg === undefined) {
  process.stderr.write("usage: bump-package-version.ts <package.json> <major|minor|patch>\n");
  process.exit(1);
}

const part = parsePart(partArg);
const text = readFileSync(manifest, "utf8");
const current = readVersion(text);
const next = bump(current, part);
const updated = replaceVersion(text, current, next);
if (replaceVersion(updated, next, current) !== text) {
  process.stderr.write("package.json version is missing\n");
  process.exit(1);
}

writeFileSync(manifest, updated);
process.stdout.write(`${next}\n`);

function parsePart(value: string): Part {
  if (value === "major" || value === "minor" || value === "patch") return value;
  process.stderr.write(`invalid part: ${value}\n`);
  process.exit(1);
}

function readVersion(text: string): string {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    process.stderr.write("invalid version\n");
    process.exit(1);
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw) || !("version" in raw)) {
    process.stderr.write("package.json version is missing\n");
    process.exit(1);
  }
  const version = raw.version;
  if (typeof version !== "string" || semver.test(version) === false) {
    process.stderr.write(`invalid version: ${String(version)}\n`);
    process.exit(1);
  }
  const match = semver.exec(version);
  if (match === null || !componentsMatch(match)) {
    process.stderr.write(`invalid version: ${version}\n`);
    process.exit(1);
  }
  return version;
}

function componentsMatch(match: RegExpExecArray): boolean {
  return [match[1], match[2], match[3]].every((component) => {
    if (component === undefined) return false;
    const value = Number(component);
    return Number.isSafeInteger(value) && String(value) === component;
  });
}

function bump(version: string, part: Part): string {
  const match = semver.exec(version);
  if (match === null) {
    process.stderr.write(`invalid version: ${version}\n`);
    process.exit(1);
  }
  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = Number(match[3]);
  const next =
    part === "major"
      ? { major: major + 1, minor: 0, patch: 0 }
      : part === "minor"
        ? { major, minor: minor + 1, patch: 0 }
        : { major, minor, patch: patch + 1 };
  if (
    !Number.isSafeInteger(next.major) ||
    !Number.isSafeInteger(next.minor) ||
    !Number.isSafeInteger(next.patch)
  ) {
    process.stderr.write(`invalid version: ${version}\n`);
    process.exit(1);
  }
  return `${next.major}.${next.minor}.${next.patch}`;
}

function replaceVersion(text: string, current: string, next: string): string {
  const matches = [...text.matchAll(/"version"\s*:\s*"([^"\\]*)"/g)];
  const match = matches[0];
  if (
    matches.length !== 1 ||
    match === undefined ||
    match.index === undefined ||
    match[1] !== current
  ) {
    process.stderr.write("package.json version is missing\n");
    process.exit(1);
  }
  const full = match[0];
  const value = `"${current}"`;
  const valueStart = full.lastIndexOf(value);
  if (valueStart < 0) {
    process.stderr.write("package.json version is missing\n");
    process.exit(1);
  }
  const updated = `${full.slice(0, valueStart)}"${next}"${full.slice(valueStart + value.length)}`;
  return `${text.slice(0, match.index)}${updated}${text.slice(match.index + full.length)}`;
}
