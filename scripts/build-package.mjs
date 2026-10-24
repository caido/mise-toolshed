import { spawnSync } from "node:child_process";
import { readFileSync, realpathSync } from "node:fs";
import { chmod, mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { builtinModules } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import esbuild from "esbuild";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const namePattern = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const versionPattern =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const shebang = "#!/usr/bin/env node\n";
const nodeBuiltins = new Set(
  builtinModules.flatMap((name) => (name.startsWith("node:") ? [name] : [name, `node:${name}`])),
);

class BuildPackageError extends Error {
  constructor(message) {
    super(message);
    this.name = "BuildPackageError";
  }
}

function toolVersionPlugin(name, version) {
  return {
    name: "tool-version",
    setup(build) {
      build.onResolve({ filter: /^#tool-version$/ }, () => ({
        path: "#tool-version",
        namespace: "tool-version",
      }));
      build.onLoad({ filter: /.*/, namespace: "tool-version" }, () => ({
        contents:
          `export const TOOL_NAME = ${JSON.stringify(name)};\n` +
          `export const TOOL_VERSION = ${JSON.stringify(version)};\n`,
        loader: "js",
      }));
    },
  };
}

async function readManifest(packageRoot) {
  const manifestPath = path.join(packageRoot, "package.json");
  let raw;
  try {
    raw = JSON.parse(await readFile(manifestPath, "utf8"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new BuildPackageError(message);
  }
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new BuildPackageError("package.json must be an object");
  }
  if (raw.private !== true) {
    throw new BuildPackageError("package.json private must be true");
  }
  if (raw.type !== "module") {
    throw new BuildPackageError('package.json type must be "module"');
  }
  if (typeof raw.name !== "string" || !namePattern.test(raw.name)) {
    throw new BuildPackageError(
      "package.json name must be lowercase words separated by single hyphens",
    );
  }
  if (path.basename(packageRoot) !== raw.name) {
    throw new BuildPackageError("directory name must match package.json name");
  }
  if (typeof raw.version !== "string" || !versionPattern.test(raw.version)) {
    throw new BuildPackageError("package.json version must be semver without a leading v");
  }
  return { name: raw.name, version: raw.version };
}

const compilerFlagTable = [
  ["target", "string"],
  ["module", "string"],
  ["moduleResolution", "string"],
  ["lib", "list"],
  ["strict", "boolean"],
  ["noEmit", "true"],
  ["types", "list"],
  ["typeRoots", "paths"],
  ["resolveJsonModule", "boolean"],
  ["verbatimModuleSyntax", "boolean"],
  ["allowImportingTsExtensions", "boolean"],
  ["skipLibCheck", "boolean"],
];

function readCompilerOptions(root) {
  const parsed = JSON.parse(readFileSync(path.join(root, "tsconfig.json"), "utf8"));
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new BuildPackageError("tsconfig.json must be an object");
  }
  for (const key of Object.keys(parsed)) {
    if (key !== "compilerOptions" && key !== "include") {
      throw new BuildPackageError(`tsconfig key ${key} is not mapped`);
    }
  }
  if (!Object.hasOwn(parsed, "compilerOptions") || !Object.hasOwn(parsed, "include")) {
    throw new BuildPackageError("tsconfig.json must set compilerOptions and include");
  }
  return parsed.compilerOptions;
}

export function compilerArgs(options, root) {
  if (options === null || typeof options !== "object" || Array.isArray(options)) {
    throw new BuildPackageError("compilerOptions must be an object");
  }
  const expected = new Set(compilerFlagTable.map(([key]) => key));
  for (const key of Object.keys(options)) {
    if (!expected.has(key)) {
      throw new BuildPackageError(`unknown compilerOption ${key}`);
    }
  }
  const args = [];
  for (const [key, kind] of compilerFlagTable) {
    if (!Object.hasOwn(options, key)) {
      throw new BuildPackageError(`missing compilerOption ${key}`);
    }
    const value = options[key];
    if (kind === "string") {
      if (typeof value !== "string" || value === "") {
        throw new BuildPackageError(`compilerOption ${key} must be a string`);
      }
      args.push(`--${key}`, value);
      continue;
    }
    if (kind === "list" || kind === "paths") {
      if (
        !Array.isArray(value) ||
        value.length === 0 ||
        value.some((item) => typeof item !== "string" || item === "")
      ) {
        throw new BuildPackageError(`compilerOption ${key} must be a non-empty list`);
      }
      const items = kind === "paths" ? value.map((item) => path.resolve(root, item)) : value;
      args.push(`--${key}`, items.join(","));
      continue;
    }
    if (typeof value !== "boolean") {
      throw new BuildPackageError(`compilerOption ${key} must be a boolean`);
    }
    if (kind === "true" && value !== true) {
      throw new BuildPackageError(`compilerOption ${key} must be true`);
    }
    if (value) {
      args.push(`--${key}`);
    } else {
      args.push(`--${key}`, "false");
    }
  }
  return args;
}

function typecheck(packageRoot) {
  const tsc = path.join(repoRoot, "node_modules/typescript/lib/tsc.js");
  const result = spawnSync(
    process.execPath,
    [
      tsc,
      ...compilerArgs(readCompilerOptions(repoRoot), repoRoot),
      "--ignoreConfig",
      path.join(packageRoot, "src/main.ts"),
      path.join(repoRoot, "scripts/tool-version.d.ts"),
    ],
    { encoding: "utf8", cwd: packageRoot },
  );
  if (result.status !== 0) {
    const detail = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
    throw new BuildPackageError(detail || "tsc failed");
  }
}

function assertClosure(metafile, name, version, text) {
  const outputKey = Object.keys(metafile.outputs).find((key) => key.endsWith(`dist/${name}.mjs`));
  if (outputKey === undefined) {
    throw new BuildPackageError(`esbuild did not record dist/${name}.mjs`);
  }
  const output = metafile.outputs[outputKey];
  for (const imported of output.imports) {
    if (!imported.external || !nodeBuiltins.has(imported.path)) {
      throw new BuildPackageError(`bundle imports ${imported.path}`);
    }
  }
  if (text.split("\n")[1]?.startsWith("#!")) {
    throw new BuildPackageError("bundle has a second shebang");
  }
  const inputs = Object.keys(metafile.inputs);
  if (!inputs.some((key) => key.includes("#tool-version"))) {
    throw new BuildPackageError("bundle must read #tool-version");
  }
  if (inputs.some((key) => key.endsWith("package.json"))) {
    throw new BuildPackageError("bundle must not include package.json");
  }
  if (!text.startsWith(shebang)) {
    throw new BuildPackageError("bundle must start with #!/usr/bin/env node");
  }
  if (!text.includes(JSON.stringify(version))) {
    throw new BuildPackageError("bundle must contain the package version");
  }
}

async function commitBundle(outfile, text) {
  const directory = path.dirname(outfile);
  await mkdir(directory, { recursive: true });
  const temporary = `${outfile}.tmp`;
  await writeFile(temporary, text, "utf8");
  await rename(temporary, outfile);
  await chmod(outfile, 0o755);
  const entries = await readdir(directory);
  await Promise.all(
    entries
      .filter((entry) => entry !== path.basename(outfile))
      .map((entry) => rm(path.join(directory, entry), { recursive: true, force: true })),
  );
}

export async function buildPackage(packageRoot) {
  const root = realpathSync(packageRoot);
  const manifest = await readManifest(root);
  const entry = path.join(root, "src", "main.ts");
  try {
    await readFile(entry);
  } catch {
    throw new BuildPackageError("src/main.ts is missing");
  }
  typecheck(root);
  const result = await esbuild.build({
    absWorkingDir: root,
    entryPoints: ["src/main.ts"],
    outfile: `dist/${manifest.name}.mjs`,
    bundle: true,
    format: "esm",
    platform: "node",
    target: "node24",
    packages: "bundle",
    banner: { js: "#!/usr/bin/env node" },
    legalComments: "none",
    sourcemap: false,
    minify: false,
    charset: "utf8",
    metafile: true,
    write: false,
    logLevel: "warning",
    plugins: [toolVersionPlugin(manifest.name, manifest.version)],
  });
  if (result.outputFiles.length !== 1) {
    throw new BuildPackageError("esbuild must emit one file");
  }
  const text = result.outputFiles[0].text;
  assertClosure(result.metafile, manifest.name, manifest.version, text);
  const outfile = path.join(root, "dist", `${manifest.name}.mjs`);
  await commitBundle(outfile, text);
  return { name: manifest.name, version: manifest.version, outfile };
}

function invokedAsCli() {
  const entry = process.argv[1];
  if (!entry) {
    return false;
  }
  try {
    return import.meta.url === pathToFileURL(realpathSync(entry)).href;
  } catch {
    return false;
  }
}

if (invokedAsCli()) {
  if (process.argv.length > 2) {
    process.stderr.write("build-package: no arguments\n");
    process.exit(1);
  }
  try {
    await buildPackage(process.cwd());
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`build-package: ${message}\n`);
    process.exit(1);
  }
}
