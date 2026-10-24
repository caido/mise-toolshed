import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { TOOL_NAME, TOOL_VERSION } from "#tool-version";
import { classify, decide, parseFile, scanFacts, skipDirectory } from "./pins.js";
import type { Finding, ParsedFile } from "./pins.js";

type Io = {
  readonly stdout: { write(chunk: string): void };
  readonly stderr: { write(chunk: string): void };
};

function run(argv: readonly string[], cwd: string, io: Io): number {
  if (argv.length === 1 && argv[0] === "--version") {
    io.stdout.write(`${TOOL_VERSION}\n`);
    return 0;
  }
  if (argv.length !== 0) {
    io.stderr.write(`usage: ${TOOL_NAME} --version\n`);
    return 1;
  }
  const findings = scan(cwd);
  for (const found of findings) {
    io.stdout.write(`${found.path}:${found.line}: ${found.message}\n`);
  }
  return findings.length === 0 ? 0 : 1;
}

function scan(cwd: string): readonly Finding[] {
  const parsed = walk(cwd, cwd);
  const facts = scanFacts(parsed);
  const findings = parsed.flatMap((file) => file.sites.flatMap((site) => decide(site, facts)));
  return findings.toSorted((left, right) => {
    if (left.path !== right.path) return left.path < right.path ? -1 : 1;
    if (left.line !== right.line) return left.line - right.line;
    if (left.message !== right.message) return left.message < right.message ? -1 : 1;
    return 0;
  });
}

function walk(cwd: string, directory: string): readonly ParsedFile[] {
  const entries = readdirSync(directory, { withFileTypes: true }).toSorted((left, right) =>
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
    const kind = classify(relative);
    if (kind === "skip") return [];
    try {
      return [parseFile(kind, relative, readFileSync(full, "utf8"))];
    } catch {
      const unreadable: ParsedFile = {
        sites: [{ kind: "unreadable", format: kind, path: relative, line: 1 }],
        miseUvLocked: false,
        npmrcFrozen: false,
      };
      return [unreadable];
    }
  });
}

process.exit(run(process.argv.slice(2), process.cwd(), { stdout: process.stdout, stderr: process.stderr }));
