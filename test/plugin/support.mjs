import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export function trim(value) {
  return value.replace(/\r/g, "").replace(/\n+$/, "");
}

export function mise(env, cwd, args) {
  const result = spawnSync("mise", args, { cwd, env, encoding: "utf8" });
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: `${result.stderr ?? ""}${result.error?.message ?? ""}`,
  };
}

export function must(result, label) {
  if (result.status !== 0) {
    throw new Error(`${label}\n${result.stderr}${result.stdout}`);
  }
  return result.stdout;
}

export async function filesUnder(dir) {
  const found = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return found;
    throw error;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...(await filesUnder(full)));
    } else {
      found.push(full);
    }
  }
  return found;
}

export async function withPlugin(scenario, options = {}) {
  const dataDirName = options.dataDirName ?? "data";
  const cacheDirName = options.cacheDirName ?? "cache";
  const work = await mkdtemp(path.join(tmpdir(), "toolshed-plugin-"));
  const home = path.join(work, "home");
  const project = path.join(work, "project");
  await mkdir(path.join(home, dataDirName), { recursive: true });
  await mkdir(path.join(home, cacheDirName), { recursive: true });
  await mkdir(path.join(home, "config"), { recursive: true });
  await mkdir(path.join(home, "state"), { recursive: true });
  await mkdir(project, { recursive: true });
  const env = {
    ...process.env,
    MISE_DATA_DIR: path.join(home, dataDirName),
    MISE_CACHE_DIR: path.join(home, cacheDirName),
    MISE_CONFIG_DIR: path.join(home, "config"),
    MISE_STATE_DIR: path.join(home, "state"),
    MISE_GLOBAL_CONFIG_FILE: path.join(home, "config/config.toml"),
    MISE_SYSTEM_CONFIG_FILE: path.join(home, "config/system.toml"),
    MISE_YES: "1",
  };
  try {
    must(mise(env, project, ["plugin", "link", "--force", "toolshed", repoRoot]), "plugin link");
    await scenario({ env, project, dataDir: env.MISE_DATA_DIR });
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

export function pass(name) {
  process.stdout.write(`${name}: ok\n`);
}
