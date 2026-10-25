import { spawnSync } from "node:child_process";
import {
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  readSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { TOOL_NAME, TOOL_VERSION } from "#tool-version";

const MANIFEST_NAME = ".toolshed-get-skills";
const DEFAULT_REPO_URL = "https://github.com/caido/ai-ops";
const skillNamePattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const releaseLabel = `${TOOL_NAME}@${TOOL_VERSION}`;

class Stop extends Error {
  readonly code: number;

  constructor(code: number) {
    super("stop");
    this.name = "Stop";
    this.code = code;
  }
}

function prefix(): string {
  return `toolshed:${TOOL_NAME}`;
}

function die(message: string): never {
  process.stderr.write(`${prefix()}: ${message}\n`);
  throw new Stop(1);
}

function isEnoent(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

function keepBundledVersion(): void {
  // The package build rejects a bundle that does not contain the version string.
  if (process.env.TOOLSHED_GET_SKILLS_BUILD_ID === releaseLabel) {
    process.stderr.write(`${prefix()}: ${releaseLabel}\n`);
  }
}

function commandOutput(command: string, args: readonly string[]): string {
  const result = spawnSync(command, args, { encoding: "utf8" });
  if (result.error) {
    process.stderr.write(`${result.error.message}\n`);
    throw new Stop(127);
  }
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) throw new Stop(result.status ?? 1);
  return result.stdout.replace(/\n+$/, "");
}

function gitStatus(args: readonly string[], discard: boolean): number {
  const result = spawnSync("git", args, {
    encoding: "utf8",
    stdio: ["inherit", discard ? "ignore" : "pipe", discard ? "ignore" : "inherit"],
  });
  if (!discard && result.stdout) process.stderr.write(result.stdout);
  if (result.error) {
    process.stderr.write(`${result.error.message}\n`);
    return 127;
  }
  return result.status ?? 1;
}

function runGit(args: readonly string[]): void {
  const status = gitStatus(args, false);
  if (status !== 0) throw new Stop(status);
}

function readChoice(): string | undefined {
  const bytes: number[] = [];
  const buf = Buffer.alloc(1);
  for (;;) {
    let count = 0;
    try {
      count = readSync(0, buf, 0, 1, null);
    } catch {
      return undefined;
    }
    if (count === 0) return undefined;
    const byte = buf[0];
    if (byte === undefined) return undefined;
    if (byte === 10) break;
    bytes.push(byte);
  }
  let line = Buffer.from(bytes).toString("utf8");
  if (line.endsWith("\r")) line = line.slice(0, -1);
  return line;
}

function installDirForChoice(choice: string): string {
  const home = process.env.HOME;
  if (home === undefined || home === "") die("HOME is unset or empty");
  if (choice === "1") return path.join(home, ".cursor/skills");
  if (choice === "2") return path.join(home, ".claude/skills");
  if (choice === "3") return path.join(home, ".agents/skills");
  die("expected 1, 2, or 3");
}

function promptInstallDir(): string {
  const first = installDirForChoice("1");
  const second = installDirForChoice("2");
  const third = installDirForChoice("3");
  process.stderr.write(`${prefix()}: install ai-ops skills into which folder?\n`);
  process.stderr.write(`  1) ${first}\n`);
  process.stderr.write(`  2) ${second}\n`);
  process.stderr.write(`  3) ${third}\n`);
  process.stderr.write(`${prefix()}: choice [1-3]:\n`);
  const choice = readChoice();
  if (choice === undefined) die("expected 1, 2, or 3");
  return installDirForChoice(choice);
}

function parseArgs(argv: readonly string[]): string {
  let repoUrl = "";
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === undefined) continue;
    if (arg === "--url") {
      repoUrl = argv[index + 1] ?? "";
      index += 1;
      continue;
    }
    die(`unknown argument: ${arg}`);
  }
  if (repoUrl === "") return DEFAULT_REPO_URL;
  return repoUrl;
}

function manifestLines(text: string): string[] {
  if (text.length === 0) return [];
  const lines = text.split("\n");
  if (lines.at(-1) === "") lines.pop();
  return lines;
}

function compareNames(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function sortedUnique(names: readonly string[]): string[] {
  return [...new Set(names)].sort(compareNames);
}

function duplicates(names: readonly string[]): string[] {
  const sorted = [...names].sort(compareNames);
  const found: string[] = [];
  for (let index = 1; index < sorted.length; index += 1) {
    const name = sorted[index];
    if (name !== undefined && name === sorted[index - 1] && found.at(-1) !== name) {
      found.push(name);
    }
  }
  return found;
}

function validSkillName(name: string): boolean {
  return skillNamePattern.test(name);
}

function existsOrLink(file: string): boolean {
  try {
    lstatSync(file);
    return true;
  } catch (error) {
    if (isEnoent(error)) return false;
    throw error;
  }
}

function readOwned(installDir: string): string[] {
  const manifest = path.join(installDir, MANIFEST_NAME);
  let info;
  try {
    info = lstatSync(manifest);
  } catch (error) {
    if (isEnoent(error)) return [];
    throw error;
  }
  if (info.isSymbolicLink() || !info.isFile()) die("manifest is not a file");
  const lines = manifestLines(readFileSync(manifest, "utf8"));
  for (const line of lines) {
    if (!validSkillName(line)) die(`illegal manifest name: ${line}`);
  }
  const repeated = duplicates(lines);
  if (repeated.length > 0) {
    process.stderr.write(`${prefix()}: duplicate manifest name\n`);
    for (const name of repeated) process.stderr.write(`${name}\n`);
    throw new Stop(1);
  }
  return sortedUnique(lines);
}

function listSourceNames(src: string): string[] {
  const names: string[] = [];
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
    if (!validSkillName(entry.name)) die(`illegal skill name: ${entry.name}`);
    names.push(entry.name);
  }
  return sortedUnique(names);
}

function writeOwned(dir: string, names: readonly string[]): void {
  const temporary = commandOutput("mktemp", [path.join(dir, `${MANIFEST_NAME}.XXXXXX`)]);
  const text = names.length === 0 ? "" : `${names.join("\n")}\n`;
  writeFileSync(temporary, text);
  renameSync(temporary, path.join(dir, MANIFEST_NAME));
}

function removeTree(dir: string, name: string): void {
  rmSync(path.join(dir, name), { recursive: true, force: true });
}

function copyRecursive(from: string, to: string): void {
  const result = spawnSync("cp", ["-R", from, to], { stdio: "inherit" });
  if (result.error) {
    process.stderr.write(`${result.error.message}\n`);
    throw new Stop(127);
  }
  if (result.status !== 0) throw new Stop(result.status ?? 1);
}

function shellPwd(dir: string): string {
  return commandOutput("sh", ["-c", 'CDPATH= cd -- "$1" && pwd', "canon", dir]);
}

function installSkills(src: string, installDir: string): void {
  let stage = "";
  let stageReady = false;
  try {
    const desired = listSourceNames(src);
    const owned = readOwned(installDir);
    const desiredSet = new Set(desired);
    const ownedSet = new Set(owned);
    for (const name of owned) {
      if (desiredSet.has(name)) continue;
      if (existsOrLink(path.join(src, name))) die(`${name} is not a skill directory`);
    }
    let blocked = false;
    for (const name of desired) {
      if (ownedSet.has(name)) continue;
      if (existsOrLink(path.join(installDir, name))) {
        process.stderr.write(`${prefix()}: ${name} already exists and is not owned\n`);
        blocked = true;
      }
    }
    if (blocked) throw new Stop(1);
    mkdirSync(installDir, { recursive: true });
    const install = shellPwd(installDir);
    stage = commandOutput("mktemp", ["-d", path.join(install, `${MANIFEST_NAME}.XXXXXX`)]);
    stageReady = true;
    for (const name of desired) {
      copyRecursive(path.join(src, name), path.join(stage, name));
    }
    let claimed = [...owned];
    for (const name of desired) {
      const dest = path.join(install, name);
      if (existsOrLink(dest)) {
        if (ownedSet.has(name)) removeTree(install, name);
        else die(`${name} already exists and is not owned`);
      }
      renameSync(path.join(stage, name), dest);
      if (ownedSet.has(name)) continue;
      claimed = sortedUnique([...claimed, name]);
      writeOwned(install, claimed);
    }
    for (const name of owned) {
      if (!desiredSet.has(name)) removeTree(install, name);
    }
    writeOwned(install, desired);
    process.stderr.write(`${prefix()}: synced ${src} to ${install}\n`);
  } finally {
    if (stageReady) rmSync(stage, { recursive: true, force: true });
  }
}

function isDirectory(file: string): boolean {
  try {
    return statSync(file).isDirectory();
  } catch (error) {
    if (isEnoent(error)) return false;
    throw error;
  }
}

function cacheDir(): string {
  const override = process.env.AI_OPS_SKILLS_CACHE;
  if (override !== undefined && override !== "") return override;
  const xdg = process.env.XDG_CACHE_HOME;
  const base = xdg !== undefined && xdg !== "" ? xdg : `${process.env.HOME ?? ""}/.cache`;
  return `${base}/mise-toolshed/ai-ops`;
}

function ensureRepo(cache: string, repoUrl: string): void {
  if (isDirectory(path.join(cache, ".git"))) return;
  mkdirSync(path.dirname(cache), { recursive: true });
  process.stderr.write(`${prefix()}: cloning ${repoUrl} into ${cache}\n`);
  process.stderr.write(
    `${prefix()}: first run downloads the repo; --progress shows activity (large monorepos can take minutes).\n`,
  );
  runGit(["clone", "--progress", "--depth", "1", "--single-branch", repoUrl, cache]);
}

function syncRef(cache: string, target: string): void {
  if (target === "latest") {
    runGit(["-C", cache, "fetch", "origin"]);
    if (gitStatus(["-C", cache, "rev-parse", "--verify", "origin/main"], true) === 0) {
      runGit(["-C", cache, "checkout", "-B", "main", "origin/main"]);
      return;
    }
    if (gitStatus(["-C", cache, "rev-parse", "--verify", "origin/master"], true) === 0) {
      runGit(["-C", cache, "checkout", "-B", "master", "origin/master"]);
      return;
    }
    die("neither origin/main nor origin/master exists after fetch");
  }
  if (gitStatus(["-C", cache, "fetch", "origin", "--tags", "--prune"], true) !== 0) {
    gitStatus(["-C", cache, "fetch", "origin"], true);
  }
  if (gitStatus(["-C", cache, "rev-parse", "--verify", `${target}^{commit}`], true) === 0) {
    runGit(["-C", cache, "checkout", target]);
    return;
  }
  process.stderr.write(`${prefix()}: ref ${target} not found in ai-ops, using default branch\n`);
  syncRef(cache, "latest");
}

function skillsDir(cache: string): string {
  const src = path.join(cache, "skills");
  if (!isDirectory(src)) die(`missing ${src} after checkout (is the repo OK?)`);
  return src;
}

function gitOnPath(): boolean {
  const result = spawnSync("sh", ["-c", "command -v git >/dev/null 2>&1"]);
  return result.status === 0;
}

function main(): void {
  keepBundledVersion();
  const repoUrl = parseArgs(process.argv.slice(2));
  const installDir = promptInstallDir();
  if (!gitOnPath()) die("git is required but was not found on PATH");
  const cache = cacheDir();
  ensureRepo(cache, repoUrl);
  // Clone may prompt for credentials. Later fetch and checkout must fail fast.
  process.env.GIT_TERMINAL_PROMPT = "0";
  const ref = process.env.AI_OPS_SKILLS_REF;
  if (ref !== undefined && ref !== "") syncRef(cache, ref);
  else syncRef(cache, "latest");
  installSkills(skillsDir(cache), installDir);
}

try {
  main();
} catch (error) {
  if (error instanceof Stop) process.exit(error.code);
  throw error;
}
