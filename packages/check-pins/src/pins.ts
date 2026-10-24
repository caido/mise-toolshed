export type PinSite =
  | DependencySite
  | ToolSite
  | PluginSite
  | ActionSite
  | ImageSite
  | InstallSite
  | UnreadableSite;

type Site = { readonly path: string; readonly line: number };

export type DependencySite = Site & {
  readonly kind: "dependency";
  readonly family: "npm" | "package-manager" | "python";
  readonly name: string;
  readonly spec: string;
};

export type ToolSite = Site & {
  readonly kind: "tool";
  readonly name: string;
  readonly value: StringOrTable;
};

export type PluginSite = Site & {
  readonly kind: "plugin";
  readonly name: string;
  readonly value: StringOrTable;
};

export type ActionSite = Site & {
  readonly kind: "action";
  readonly uses: string;
  readonly comment: string;
};

export type ImageSite = Site & {
  readonly kind: "image";
  readonly origin: "dockerfile" | "workflow" | "docker-uses";
  readonly reference: string;
  readonly priorStageNames: readonly string[];
};

export type InstallSite = Site & {
  readonly kind: "install-command";
  readonly tool: "uv" | "pnpm";
  readonly command: string;
  readonly scopedEnv: readonly EnvPair[];
  readonly scriptLocked: boolean;
  readonly honorMiseEnv: boolean;
};

export type UnreadableSite = Site & {
  readonly kind: "unreadable";
  readonly format: Exclude<FileKind, "skip">;
};

export type StringOrTable =
  | { readonly shape: "string"; readonly text: string }
  | { readonly shape: "table" };

export type EnvPair = { readonly name: string; readonly value: string };

export type Finding = {
  readonly path: string;
  readonly line: number;
  readonly message: string;
};

export type ScanFacts = {
  readonly miseUvLocked: boolean;
  readonly npmrcFrozen: boolean;
};

export type FileKind =
  | "package-json"
  | "pyproject"
  | "mise"
  | "dockerfile"
  | "workflow"
  | "npmrc"
  | "skip";

export type ParsedFile = {
  readonly sites: readonly PinSite[];
  readonly miseUvLocked: boolean;
  readonly npmrcFrozen: boolean;
};

const SEMVER =
  "(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)(?:-[0-9A-Za-z.-]+)?(?:\\+[0-9A-Za-z.-]+)?";
const npmExact = new RegExp(`^=?${SEMVER}$`);
const packageManagerExact = new RegExp(`^pnpm@${SEMVER}$`);
const toolExact = /^(0|[1-9]\d*)\.(0|[1-9]\d*)(\.(0|[1-9]\d*))?$/;
const hex40 = /^[0-9a-fA-F]{40}$/;
const versionComment = /(?:^|\s)v?\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?(?:\s|$)/;

export function skipDirectory(name: string): boolean {
  return name === "node_modules" || name === ".git" || name === "dist";
}

export function classify(relativePath: string): FileKind {
  const parts = relativePath.split("/");
  const base = parts[parts.length - 1] ?? "";
  const parent = parts[parts.length - 2] ?? "";
  const grandparent = parts[parts.length - 3] ?? "";
  if (base === "package.json") return "package-json";
  if (base === "pyproject.toml") return "pyproject";
  if (base === "mise.toml") return "mise";
  if (parent === ".mise" && base.endsWith(".toml")) return "mise";
  if (base.startsWith("Dockerfile")) return "dockerfile";
  if (base === ".npmrc") return "npmrc";
  if (
    grandparent === ".github" &&
    parent === "workflows" &&
    (base.endsWith(".yml") || base.endsWith(".yaml"))
  ) {
    return "workflow";
  }
  return "skip";
}

export function parseFile(kind: FileKind, relativePath: string, text: string): ParsedFile {
  switch (kind) {
    case "package-json":
      return parsePackageJson(relativePath, text);
    case "pyproject":
      return parsePyproject(relativePath, text);
    case "mise":
      return parseMise(relativePath, text);
    case "dockerfile":
      return parseDockerfile(relativePath, text);
    case "workflow":
      return parseWorkflow(relativePath, text);
    case "npmrc":
      return { sites: [], miseUvLocked: false, npmrcFrozen: parseNpmrc(text) };
    case "skip":
      return { sites: [], miseUvLocked: false, npmrcFrozen: false };
    default: {
      const neverKind: never = kind;
      return neverKind;
    }
  }
}

export function scanFacts(files: readonly ParsedFile[]): ScanFacts {
  return {
    miseUvLocked: files.some((file) => file.miseUvLocked),
    npmrcFrozen: files.some((file) => file.npmrcFrozen),
  };
}

export function decide(site: PinSite, facts: ScanFacts): readonly Finding[] {
  switch (site.kind) {
    case "dependency":
      return decideDependency(site);
    case "tool":
      return decideTool(site);
    case "plugin":
      return decidePlugin(site);
    case "action":
      return decideAction(site);
    case "image":
      return decideImage(site);
    case "install-command":
      return decideInstall(site, facts);
    case "unreadable":
      return [finding(site, `${site.format} is not valid`)];
    default: {
      const neverSite: never = site;
      return neverSite;
    }
  }
}

function decideDependency(site: DependencySite): readonly Finding[] {
  switch (site.family) {
    case "package-manager":
      if (packageManagerExact.test(site.spec)) return [];
      return [finding(site, "packageManager is not an exact pnpm version")];
    case "npm":
      return decideNpm(site);
    case "python":
      return decidePython(site);
    default: {
      const neverFamily: never = site.family;
      return neverFamily;
    }
  }
}

function decideNpm(site: DependencySite): readonly Finding[] {
  if (
    site.spec.startsWith("workspace:") ||
    site.spec.startsWith("file:") ||
    site.spec.startsWith("link:") ||
    site.spec.startsWith("catalog:")
  ) {
    return [];
  }
  if (isGitSpec(site.spec)) {
    if (hex40.test(committish(site.spec))) return [];
    return [finding(site, `dependency ${site.name} git pin is not 40 hex`)];
  }
  if (npmExact.test(site.spec)) return [];
  return [finding(site, `dependency ${site.name} is not an exact version`)];
}

function decidePython(site: DependencySite): readonly Finding[] {
  // A marker after the first ";" can contain ">=" and is not the version pin.
  const splitAt = site.spec.indexOf(";");
  const requirement = (splitAt === -1 ? site.spec : site.spec.slice(0, splitAt)).trim();
  const revision = pythonGitRevision(requirement);
  if (revision !== undefined) {
    if (hex40.test(revision)) return [];
    return [finding(site, `dependency ${site.name} git pin is not 40 hex`)];
  }
  if (requirement.includes(" @ ")) return [finding(site, `dependency ${site.name} is not an exact version`)];
  if (pythonExact(requirement)) return [];
  return [finding(site, `dependency ${site.name} is not an exact version`)];
}

function decideTool(site: ToolSite): readonly Finding[] {
  if (site.value.shape === "table") return [finding(site, `tool ${site.name} must be a string`)];
  if (!toolExact.test(site.value.text)) return [finding(site, `tool ${site.name} is not an exact version`)];
  return [];
}

function decidePlugin(site: PluginSite): readonly Finding[] {
  if (site.value.shape === "string" && /#[0-9a-fA-F]{40}$/.test(site.value.text)) return [];
  return [finding(site, `plugin ${site.name} must end in a 40-hex pin`)];
}

function decideAction(site: ActionSite): readonly Finding[] {
  if (site.uses.startsWith("./")) return [];
  if (/@[0-9a-fA-F]{40}$/.test(site.uses) && versionComment.test(site.comment)) return [];
  return [finding(site, `action ${site.uses} must be a 40-hex SHA with a version comment`)];
}

function decideImage(site: ImageSite): readonly Finding[] {
  if (site.origin === "dockerfile") {
    if (site.reference === "scratch") return [];
    if (site.priorStageNames.includes(site.reference)) return [];
  }
  if (site.reference.includes("@sha256:")) return [];
  return [finding(site, `image ${site.reference} must contain @sha256:`)];
}

function decideInstall(site: InstallSite, facts: ScanFacts): readonly Finding[] {
  if (site.tool === "uv") {
    const findings: Finding[] = [];
    if (site.command.includes("--frozen")) {
      findings.push(finding(site, "uv command must not contain --frozen"));
    }
    const locked =
      uvPrefixLocked(site.command) ||
      site.scriptLocked ||
      site.scopedEnv.some((pair) => pair.name === "UV_LOCKED" && pair.value === "1") ||
      (site.honorMiseEnv && facts.miseUvLocked);
    if (!locked) findings.push(finding(site, "uv command must set UV_LOCKED=1"));
    return findings;
  }
  if (!pnpmInstall(site.command)) return [];
  const frozen = pnpmFrozen(site.command);
  if (frozen === true || (frozen === undefined && facts.npmrcFrozen)) return [];
  return [finding(site, "pnpm install must pass --frozen-lockfile")];
}

function finding(site: Site, message: string): Finding {
  return { path: site.path, line: site.line, message };
}

function isGitSpec(spec: string): boolean {
  return (
    spec.startsWith("git+") ||
    spec.startsWith("git:") ||
    spec.startsWith("github:") ||
    spec.startsWith("gitlab:") ||
    spec.startsWith("bitbucket:")
  );
}

function committish(spec: string): string {
  const hash = spec.lastIndexOf("#");
  if (hash === -1) return "";
  return spec.slice(hash + 1);
}

function pythonGitRevision(requirement: string): string | undefined {
  const at = requirement.indexOf(" @ ");
  if (at === -1) return undefined;
  const url = requirement.slice(at + 3).trim();
  const direct =
    url.startsWith("git+") ||
    url.startsWith("git:") ||
    url.startsWith("github:") ||
    url.startsWith("gitlab:") ||
    url.startsWith("bitbucket:");
  if (!direct) return undefined;
  const last = requirement.lastIndexOf("@");
  const after = requirement.slice(last + 1);
  const hash = after.indexOf("#");
  return (hash === -1 ? after : after.slice(0, hash)).trim();
}

function pythonExact(requirement: string): boolean {
  if (/(!=|>=|<=|~=|>|<)/.test(requirement)) return false;
  const eq = requirement.indexOf("==");
  if (eq === -1) return false;
  const token = requirement.slice(eq + 2).trim();
  const version = token.split(/[\s,]/, 1)[0] ?? "";
  return version.length > 0 && !version.includes("*");
}

function pythonPackageName(spec: string): string {
  const splitAt = spec.indexOf(";");
  const left = (splitAt === -1 ? spec : spec.slice(0, splitAt)).trim();
  const at = left.indexOf(" @ ");
  const head = (at === -1 ? left : left.slice(0, at)).trim();
  const match = /^([A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?)/.exec(head);
  return match?.[1] ?? head;
}

function unreadable(relativePath: string, format: Exclude<FileKind, "skip">): ParsedFile {
  return {
    sites: [{ kind: "unreadable", format, path: relativePath, line: 1 }],
    miseUvLocked: false,
    npmrcFrozen: false,
  };
}

function parsePackageJson(relativePath: string, text: string): ParsedFile {
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
  for (const section of ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"]) {
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

class JsonStop extends Error {}

function jsonKeyLines(text: string): Map<string, number> | undefined {
  const state = { i: 0, line: 1, text };
  const lines = new Map<string, number>();
  try {
    skipJson(state);
    parseJsonValue(state, lines, "");
    skipJson(state);
  } catch (error) {
    if (error instanceof JsonStop) return undefined;
    throw error;
  }
  if (state.i !== text.length) return undefined;
  return lines;
}

function skipJson(state: { i: number; line: number; text: string }): void {
  while (state.i < state.text.length) {
    const ch = state.text[state.i];
    if (ch === "\n") {
      state.line += 1;
      state.i += 1;
      continue;
    }
    if (ch === " " || ch === "\t" || ch === "\r") {
      state.i += 1;
      continue;
    }
    return;
  }
}

function parseJsonValue(state: { i: number; line: number; text: string }, lines: Map<string, number>, path: string): void {
  const ch = state.text[state.i];
  if (ch === "{") {
    parseJsonObject(state, lines, path);
    return;
  }
  if (ch === "[") {
    parseJsonArray(state, lines, path);
    return;
  }
  if (ch === '"') {
    if (parseJsonString(state) === undefined) throw new JsonStop("string");
    return;
  }
  if (state.text.startsWith("true", state.i)) {
    state.i += 4;
    return;
  }
  if (state.text.startsWith("false", state.i)) {
    state.i += 5;
    return;
  }
  if (state.text.startsWith("null", state.i)) {
    state.i += 4;
    return;
  }
  const match = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(state.text.slice(state.i));
  if (match === null) throw new JsonStop("value");
  state.i += match[0].length;
}

function parseJsonObject(state: { i: number; line: number; text: string }, lines: Map<string, number>, path: string): void {
  if (state.text[state.i] !== "{") throw new JsonStop("object");
  state.i += 1;
  skipJson(state);
  if (state.text[state.i] === "}") {
    state.i += 1;
    return;
  }
  while (state.i < state.text.length) {
    skipJson(state);
    const keyLine = state.line;
    const key = parseJsonString(state);
    if (key === undefined) throw new JsonStop("key");
    const child = path === "" ? key : `${path}\0${key}`;
    lines.set(child, keyLine);
    skipJson(state);
    if (state.text[state.i] !== ":") throw new JsonStop("colon");
    state.i += 1;
    skipJson(state);
    parseJsonValue(state, lines, child);
    skipJson(state);
    if (state.text[state.i] === "}") {
      state.i += 1;
      return;
    }
    if (state.text[state.i] !== ",") throw new JsonStop("comma");
    state.i += 1;
  }
  throw new JsonStop("end");
}

function parseJsonArray(state: { i: number; line: number; text: string }, lines: Map<string, number>, path: string): void {
  if (state.text[state.i] !== "[") throw new JsonStop("array");
  state.i += 1;
  skipJson(state);
  if (state.text[state.i] === "]") {
    state.i += 1;
    return;
  }
  while (state.i < state.text.length) {
    skipJson(state);
    parseJsonValue(state, lines, path);
    skipJson(state);
    if (state.text[state.i] === "]") {
      state.i += 1;
      return;
    }
    if (state.text[state.i] !== ",") throw new JsonStop("comma");
    state.i += 1;
  }
  throw new JsonStop("end");
}

function parseJsonString(state: { i: number; line: number; text: string }): string | undefined {
  if (state.text[state.i] !== '"') return undefined;
  state.i += 1;
  let out = "";
  while (state.i < state.text.length) {
    const ch = state.text[state.i] ?? "";
    if (ch === '"') {
      state.i += 1;
      return out;
    }
    if (ch === "\n") return undefined;
    if (ch === "\\") {
      const esc = state.text[state.i + 1];
      if (esc === undefined) return undefined;
      state.i += 2;
      if (esc === "u") {
        const hex = state.text.slice(state.i, state.i + 4);
        if (!/^[0-9a-fA-F]{4}$/.test(hex)) return undefined;
        out += String.fromCharCode(Number.parseInt(hex, 16));
        state.i += 4;
        continue;
      }
      const mapped: Record<string, string> = {
        '"': '"',
        "\\": "\\",
        "/": "/",
        b: "\b",
        f: "\f",
        n: "\n",
        r: "\r",
        t: "\t",
      };
      const value = mapped[esc];
      if (value === undefined) return undefined;
      out += value;
      continue;
    }
    out += ch;
    state.i += 1;
  }
  return undefined;
}

function parsePyproject(relativePath: string, text: string): ParsedFile {
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
      if (emitting && (scanned.broken || scanned.sawTable)) return unreadable(relativePath, "pyproject");
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

function parseMise(relativePath: string, text: string): ParsedFile {
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

function parseDockerfile(relativePath: string, text: string): ParsedFile {
  const sites: PinSite[] = [];
  const stages: string[] = [];
  for (const instruction of dockerfileInstructions(text)) {
    const match = /^\s*(\S+)(?:\s+([\s\S]*))?$/.exec(instruction.text);
    if (match === null) continue;
    const word = (match[1] ?? "").toUpperCase();
    const rest = match[2] ?? "";
    if (word === "FROM") {
      const image = fromImage(rest.replace(/\s+/g, " ").trim());
      if (image === undefined) continue;
      sites.push({
        kind: "image",
        origin: "dockerfile",
        reference: image.reference,
        priorStageNames: [...stages],
        path: relativePath,
        line: instruction.line,
      });
      if (image.stage !== undefined) stages.push(image.stage);
      continue;
    }
    if (word !== "RUN" && word !== "CMD" && word !== "ENTRYPOINT") continue;
    const exec = rest.trimStart().startsWith("[") ? execForm(rest.trim()) : undefined;
    const command = exec ?? rest;
    for (const site of installSites(relativePath, instruction.line, command, [], false)) {
      const line = lineWithToken(instruction.parts, site.tool) ?? instruction.line;
      sites.push({ ...site, line });
    }
  }
  return { sites, miseUvLocked: false, npmrcFrozen: false };
}

function fromImage(args: string): { reference: string; stage?: string } | undefined {
  const tokens = args.split(/\s+/).filter((token) => token.length > 0);
  let index = 0;
  while (index < tokens.length && (tokens[index] ?? "").startsWith("--")) {
    const flag = tokens[index] ?? "";
    index += 1;
    if (!flag.includes("=")) index += 1;
  }
  const reference = tokens[index];
  if (reference === undefined || reference.toLowerCase() === "as") return undefined;
  index += 1;
  if ((tokens[index] ?? "").toLowerCase() === "as") {
    const stage = tokens[index + 1];
    if (stage !== undefined) return { reference, stage };
  }
  return { reference };
}

function execForm(text: string): string | undefined {
  try {
    const parsed: unknown = JSON.parse(text);
    if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === "string")) return undefined;
    return parsed.join(" ");
  } catch {
    return undefined;
  }
}

function dockerfileInstructions(text: string): { line: number; text: string; parts: { line: number; text: string }[] }[] {
  const instructions: { line: number; text: string; parts: { line: number; text: string }[] }[] = [];
  let parts: { line: number; text: string }[] = [];
  const lines = text.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index] ?? "";
    if (raw.trim() === "" || raw.trimStart().startsWith("#")) continue;
    const continued = raw.trimEnd().endsWith("\\");
    const piece = continued ? raw.trimEnd().slice(0, -1) : raw;
    parts.push({ line: index + 1, text: piece });
    if (continued) continue;
    instructions.push({
      line: parts[0]?.line ?? index + 1,
      text: parts.map((part) => part.text.trim()).join(" "),
      parts,
    });
    parts = [];
  }
  if (parts.length > 0) {
    instructions.push({
      line: parts[0]?.line ?? 1,
      text: parts.map((part) => part.text.trim()).join(" "),
      parts,
    });
  }
  return instructions;
}

function lineWithToken(parts: readonly { line: number; text: string }[], tool: "uv" | "pnpm"): number | undefined {
  for (const part of parts) {
    const tokens = shellTokens(part.text.replace(/[[\],]/g, " "));
    if (tool === "uv" && tokens.includes("uv")) return part.line;
    if (tool === "pnpm" && tokens.some((token) => token === "pnpm" || token.endsWith("/pnpm"))) return part.line;
  }
  return undefined;
}

type WorkflowRun = {
  readonly line: number;
  readonly command: string;
  readonly tool: "uv" | "pnpm";
  readonly job: number;
  readonly step: number;
  readonly scriptLocked: boolean;
  readonly honorMiseEnv: boolean;
};

function parseWorkflow(relativePath: string, text: string): ParsedFile {
  const sites: PinSite[] = [];
  const lines = text.split(/\r?\n/);
  const workflowEnv = new Map<string, string>();
  const jobs: { env: Map<string, string> }[] = [];
  const steps: { env: Map<string, string> }[] = [];
  const runs: WorkflowRun[] = [];
  let currentJob = -1;
  let currentStep = -1;
  let jobIndent = -1;
  let jobsKeyIndent = -1;
  let expectingJob = false;
  let stepsIndent = -1;
  let stepDashIndent = -1;
  let envTarget: "workflow" | "job" | "step" | null = null;
  let envIndent = -1;
  let envContentIndent = -1;
  let imageIndent = -1;
  const runAnchors = new Map<string, string>();

  const activeEnv = (): Map<string, string> => {
    if (envTarget === "step" && currentStep >= 0) return steps[currentStep]?.env ?? workflowEnv;
    if (envTarget === "job" && currentJob >= 0) return jobs[currentJob]?.env ?? workflowEnv;
    return workflowEnv;
  };

  const startJob = (): void => {
    currentJob = jobs.length;
    jobs.push({ env: new Map() });
    currentStep = -1;
    stepsIndent = -1;
    stepDashIndent = -1;
  };

  const takeCommand = (command: string, line: number): void => {
    for (const site of installSites(relativePath, line, command, [], false)) {
      runs.push({
        line: site.line,
        command: site.command,
        tool: site.tool,
        job: currentJob,
        step: currentStep,
        scriptLocked: site.scriptLocked,
        honorMiseEnv: site.honorMiseEnv,
      });
    }
  };

  const pushImage = (reference: string, lineNo: number, origin: ImageSite["origin"]): void => {
    sites.push({
      kind: "image",
      origin,
      reference,
      priorStageNames: [],
      path: relativePath,
      line: lineNo,
    });
  };

  const takeKey = (key: string, value: string, indent: number, lineNo: number, cursor: { i: number }): void => {
    const scalar = yamlScalar(value);
    const opened = structuralValue(scalar.value);
    if (key === "jobs" && opened === "" && currentJob < 0 && currentStep < 0) {
      expectingJob = true;
      jobsKeyIndent = indent;
      return;
    }
    if (key === "steps" && opened === "" && currentJob >= 0) {
      stepsIndent = indent;
      return;
    }
    if (key === "env" && opened === "" && !(imageIndent >= 0 && indent > imageIndent)) {
      envTarget = currentStep >= 0 ? "step" : currentJob >= 0 ? "job" : "workflow";
      envIndent = indent;
      envContentIndent = -1;
      return;
    }
    if (key === "uses") {
      const uses = unquoteYaml(scalar.value);
      if (uses.startsWith("docker://")) {
        pushImage(uses, lineNo, "docker-uses");
        return;
      }
      sites.push({ kind: "action", uses, comment: scalar.comment, path: relativePath, line: lineNo });
      return;
    }
    if ((key === "container" || key === "services") && currentJob >= 0 && currentStep < 0) {
      if (key === "container" && isBlockScalar(value)) {
        const physical = readBlock(lines, cursor, indent);
        const reference = (physical[0]?.text ?? "").trim();
        if (reference !== "") pushImage(reference, physical[0]?.line ?? lineNo, "workflow");
        return;
      }
      if (key === "container" && opened !== "" && !isBlockScalar(value)) {
        pushImage(unquoteYaml(opened), lineNo, "workflow");
        return;
      }
      if (opened === "") imageIndent = indent;
      return;
    }
    if (key === "image" && imageIndent >= 0 && indent > imageIndent) {
      pushImage(unquoteYaml(scalar.value), lineNo, "workflow");
      return;
    }
    if (key !== "run") return;
    const header = runHeader(scalar.value);
    if (header.alias !== undefined) {
      const aliased = runAnchors.get(header.alias);
      if (aliased === undefined) {
        sites.push({ kind: "unreadable", format: "workflow", path: relativePath, line: lineNo });
        return;
      }
      takeCommand(aliased, lineNo);
      return;
    }
    if (header.block !== undefined) {
      const folded = header.block.startsWith(">");
      const physical = readBlock(lines, cursor, indent, folded);
      if (folded) {
        const script = foldBlock(physical);
        if (header.anchor !== undefined) runAnchors.set(header.anchor, script.text);
        if (script.text !== "") takeCommand(script.text, script.line);
        return;
      }
      const scripts = joinContinuations(physical);
      if (header.anchor !== undefined) runAnchors.set(header.anchor, scripts.map((script) => script.text).join("\n"));
      for (const script of scripts) takeCommand(script.text, script.line);
      return;
    }
    const plain = unquoteYaml(header.plain);
    if (header.anchor !== undefined) runAnchors.set(header.anchor, plain);
    takeCommand(plain, lineNo);
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? "";
    if (line.trim() === "" || line.trimStart().startsWith("#")) continue;
    const indent = indentOf(line);
    if (imageIndent >= 0 && indent <= imageIndent) imageIndent = -1;
    if (envTarget !== null) {
      if (envContentIndent < 0) {
        if (indent > envIndent) envContentIndent = indent;
        else envTarget = null;
      }
      if (envTarget !== null && envContentIndent >= 0 && indent > envContentIndent) continue;
      if (envTarget !== null && envContentIndent >= 0 && indent === envContentIndent) {
        const kv = parseYamlKey(line);
        if (kv && kv.value.trim() !== "" && !isBlockScalar(kv.value)) {
          activeEnv().set(kv.key, unquoteYaml(splitYamlComment(kv.value).value));
        }
        continue;
      }
      if (envTarget !== null && indent <= envIndent) envTarget = null;
    }
    if (currentStep >= 0 && stepDashIndent >= 0 && indent <= stepDashIndent) currentStep = -1;
    if (currentJob >= 0 && jobIndent >= 0 && indent < jobIndent) {
      currentJob = -1;
      currentStep = -1;
      stepsIndent = -1;
      stepDashIndent = -1;
    }
    if (currentJob >= 0 && jobIndent >= 0 && indent === jobIndent) {
      currentStep = -1;
      stepsIndent = -1;
      stepDashIndent = -1;
    }
    const dash = /^(\s*)-\s*(.*)$/.exec(line);
    if (dash && stepsIndent >= 0 && indent >= stepsIndent) {
      currentStep = steps.length;
      steps.push({ env: new Map() });
      stepDashIndent = indent;
      const rest = dash[2] ?? "";
      if (rest.trim() !== "") {
        const kv = parseYamlKey(rest);
        if (kv) {
          const cursor = { i };
          takeKey(kv.key, kv.value, indent, i + 1, cursor);
          i = cursor.i;
        }
      }
      continue;
    }
    const kv = parseYamlKey(line);
    if (kv === undefined) continue;
    if (expectingJob && structuralValue(yamlScalar(kv.value).value) === "" && kv.indent > jobsKeyIndent) {
      expectingJob = false;
      jobIndent = kv.indent;
      startJob();
      continue;
    }
    if (jobIndent >= 0 && kv.indent === jobIndent && structuralValue(yamlScalar(kv.value).value) === "") {
      startJob();
      continue;
    }
    const cursor = { i };
    takeKey(kv.key, kv.value, kv.indent, i + 1, cursor);
    i = cursor.i;
  }

  for (const run of runs) {
    const map = new Map(workflowEnv);
    if (run.job >= 0) {
      for (const [name, value] of jobs[run.job]?.env ?? []) map.set(name, value);
    }
    if (run.step >= 0) {
      for (const [name, value] of steps[run.step]?.env ?? []) map.set(name, value);
    }
    const scopedEnv: EnvPair[] = [];
    for (const [name, value] of map) scopedEnv.push({ name, value });
    sites.push({
      kind: "install-command",
      tool: run.tool,
      command: run.command,
      scopedEnv,
      scriptLocked: run.scriptLocked,
      honorMiseEnv: run.honorMiseEnv,
      path: relativePath,
      line: run.line,
    });
  }
  return { sites, miseUvLocked: false, npmrcFrozen: false };
}

function parseNpmrc(text: string): boolean {
  let frozen = false;
  let seen = false;
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#") || trimmed.startsWith(";")) continue;
    const match = /^frozen-lockfile\s*=\s*([^#;]*)$/.exec(trimmed);
    if (match === null) continue;
    seen = true;
    frozen = unquoteYaml(match[1]?.trim() ?? "") === "true";
  }
  return seen && frozen;
}

function tomlHeader(line: string): string | undefined {
  const match = /^\s*\[([^[\]]+)\]\s*(?:#.*)?$/.exec(line);
  return match?.[1]?.trim();
}

function tomlAssignment(line: string): { key: string; value: string } | undefined {
  const quoted = /^\s*("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')\s*=\s*(.*)$/.exec(line);
  if (quoted) {
    const key = readTomlString(quoted[1] ?? "");
    if (key === undefined) return undefined;
    return { key, value: quoted[2] ?? "" };
  }
  const bare = /^\s*([A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*)\s*=\s*(.*)$/.exec(line);
  if (bare === null) return undefined;
  return { key: bare[1] ?? "", value: bare[2] ?? "" };
}

function unquoteTomlKey(key: string): string {
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    return readTomlString(key) ?? key.slice(1, -1);
  }
  return key;
}

function readTomlString(value: string): string | undefined {
  const quote = value[0];
  if (quote !== '"' && quote !== "'") return undefined;
  let out = "";
  for (let index = 1; index < value.length; index += 1) {
    const ch = value[index];
    if (ch === quote) return out;
    if (quote === '"' && ch === "\\") {
      const next = value[index + 1];
      if (next === undefined) return undefined;
      out += next === "n" ? "\n" : next === "t" ? "\t" : next;
      index += 1;
      continue;
    }
    out += ch ?? "";
  }
  return undefined;
}

function scanToml(text: string, startDepth: number): { strings: string[]; depth: number; broken: boolean; sawTable: boolean } {
  let depth = startDepth;
  let quote: '"' | "'" | null = null;
  let current = "";
  const strings: string[] = [];
  let broken = false;
  let sawTable = false;
  for (let index = 0; index < text.length; index += 1) {
    const ch = text[index] ?? "";
    if (quote) {
      if (quote === '"' && ch === "\\") {
        const next = text[index + 1];
        if (next === undefined) {
          broken = true;
          break;
        }
        current += next === "n" ? "\n" : next === "t" ? "\t" : next;
        index += 1;
        continue;
      }
      if (ch === quote) {
        if (depth > 0) strings.push(current);
        current = "";
        quote = null;
        continue;
      }
      current += ch;
      continue;
    }
    if (ch === "#") break;
    if (ch === '"' || ch === "'") {
      quote = ch;
      current = "";
      continue;
    }
    if (ch === "{") {
      sawTable = true;
      continue;
    }
    if (ch === "[") {
      depth += 1;
      continue;
    }
    if (ch === "]") {
      depth = Math.max(0, depth - 1);
    }
  }
  if (quote) broken = true;
  return { strings, depth, broken, sawTable };
}

function braceDelta(text: string): number {
  let depth = 0;
  let quote: '"' | "'" | null = null;
  for (let index = 0; index < text.length; index += 1) {
    const ch = text[index] ?? "";
    if (quote) {
      if (quote === '"' && ch === "\\") {
        index += 1;
        continue;
      }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === "#") break;
    if (ch === "{") depth += 1;
    if (ch === "}") depth -= 1;
  }
  return depth;
}

function indentOf(line: string): number {
  return /^\s*/.exec(line)?.[0].length ?? 0;
}

function parseYamlKey(line: string): { indent: number; key: string; value: string } | undefined {
  const match = /^(\s*)([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
  if (match === null) return undefined;
  return { indent: match[1]?.length ?? 0, key: match[2] ?? "", value: match[3] ?? "" };
}

function yamlScalar(text: string): { value: string; comment: string } {
  const trimmed = text.trim();
  if (trimmed === "" || trimmed.startsWith("#")) {
    return { value: "", comment: trimmed.startsWith("#") ? trimmed.slice(1).trim() : "" };
  }
  return splitYamlComment(text);
}

function splitYamlComment(text: string): { value: string; comment: string } {
  const index = text.indexOf(" #");
  if (index === -1) return { value: text.trim(), comment: "" };
  return { value: text.slice(0, index).trim(), comment: text.slice(index + 2).trim() };
}

function unquoteYaml(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
    (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function isBlockScalar(value: string): boolean {
  const flag = value.trim();
  return flag.startsWith("|") || flag.startsWith(">");
}

function structuralValue(value: string): string {
  if (/^&[A-Za-z_][A-Za-z0-9_-]*$/.test(value)) return "";
  return value;
}

function readBlock(
  lines: readonly string[],
  cursor: { i: number },
  indent: number,
  keepBlank = false,
): { line: number; text: string }[] {
  const physical: { line: number; text: string }[] = [];
  let next = cursor.i + 1;
  for (; next < lines.length; next += 1) {
    const blockLine = lines[next] ?? "";
    if (blockLine.trim() === "") {
      if (keepBlank) physical.push({ line: next + 1, text: "" });
      continue;
    }
    if (indentOf(blockLine) <= indent) break;
    physical.push({ line: next + 1, text: blockLine.trim() });
  }
  cursor.i = next - 1;
  return physical;
}

function foldBlock(parts: readonly { line: number; text: string }[]): { line: number; text: string } {
  let text = "";
  let line = 0;
  for (const part of parts) {
    if (part.text === "") {
      if (text !== "" && !text.endsWith("\n")) text += "\n";
      continue;
    }
    if (line === 0) line = part.line;
    if (text === "" || text.endsWith("\n")) text += part.text;
    else text += ` ${part.text}`;
  }
  return { line, text };
}

function runHeader(value: string): { anchor?: string; block?: string; alias?: string; plain: string } {
  let rest = value.trim();
  let anchor: string | undefined;
  const anchored = /^&([A-Za-z_][A-Za-z0-9_-]*)(?:\s+([\s\S]*))?$/.exec(rest);
  if (anchored) {
    anchor = anchored[1];
    rest = (anchored[2] ?? "").trim();
  }
  const alias = /^\*([A-Za-z_][A-Za-z0-9_-]*)$/.exec(rest);
  if (alias) return { anchor, alias: alias[1], plain: rest };
  if (rest.startsWith("|") || rest.startsWith(">")) return { anchor, block: rest, plain: rest };
  return { anchor, plain: rest };
}

function joinContinuations(parts: readonly { line: number; text: string }[]): { line: number; text: string }[] {
  const scripts: { line: number; text: string }[] = [];
  let text = "";
  let line = 0;
  let open = false;
  for (const part of parts) {
    const continued = part.text.endsWith("\\");
    const piece = continued ? part.text.slice(0, -1).trimEnd() : part.text;
    if (!open) {
      text = piece;
      line = part.line;
      open = true;
    } else {
      text = `${text} ${piece}`.trim();
    }
    if (continued) continue;
    scripts.push({ line, text });
    open = false;
  }
  if (open) scripts.push({ line, text });
  return scripts;
}

function installSites(
  relativePath: string,
  line: number,
  command: string,
  scopedEnv: readonly EnvPair[],
  honorMiseEnv: boolean,
): InstallSite[] {
  const sites: InstallSite[] = [];
  let priorLocked = false;
  for (const segment of splitShell(stripShellComment(command))) {
    const trimmed = segment.trim();
    if (trimmed === "") continue;
    const tokens = shellTokens(trimmed);
    const invokesMise = tokens.includes("mise");
    if (tokens.includes("uv")) {
      sites.push({
        kind: "install-command",
        tool: "uv",
        command: trimmed,
        scopedEnv,
        scriptLocked: priorLocked,
        honorMiseEnv: honorMiseEnv || invokesMise,
        path: relativePath,
        line,
      });
    }
    if (tokens.some((token) => token === "pnpm" || token.endsWith("/pnpm"))) {
      sites.push({
        kind: "install-command",
        tool: "pnpm",
        command: trimmed,
        scopedEnv,
        scriptLocked: false,
        honorMiseEnv: false,
        path: relativePath,
        line,
      });
    }
    const assigned = uvLockAssignment(tokens);
    if (assigned !== undefined) priorLocked = assigned;
  }
  return sites;
}

function uvPrefixLocked(command: string): boolean {
  const tokens = shellTokens(command);
  const uvAt = tokens.indexOf("uv");
  if (uvAt === -1) return false;
  for (let index = 0; index < uvAt; index += 1) {
    if (tokens[index] === "UV_LOCKED=1") return true;
  }
  return false;
}

function stripShellComment(command: string): string {
  let out = "";
  let quote: '"' | "'" | null = null;
  for (let index = 0; index < command.length; index += 1) {
    const ch = command[index] ?? "";
    if (quote) {
      out += ch;
      if (ch === "\\" && quote === '"') {
        const next = command[index + 1];
        if (next !== undefined) {
          out += next;
          index += 1;
        }
        continue;
      }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      out += ch;
      continue;
    }
    if (ch === "#" && commentStartsWord(out)) {
      while (index + 1 < command.length && command[index + 1] !== "\n") index += 1;
      continue;
    }
    out += ch;
  }
  return out;
}

function commentStartsWord(text: string): boolean {
  if (text.length === 0) return true;
  const prev = text[text.length - 1] ?? "";
  return prev === " " || prev === "\t" || prev === "\n" || prev === ";" || prev === "&" || prev === "|";
}

function uvLockAssignment(tokens: readonly string[]): boolean | undefined {
  let args = tokens;
  if (tokens[0] === "export") args = tokens.slice(1);
  else if (tokens[0] === "declare" && tokens[1] === "-x") args = tokens.slice(2);
  else return undefined;
  if (args.length === 0 || !args.every((token) => /^[A-Za-z_][A-Za-z0-9_]*=/.test(token))) return undefined;
  let assigned: boolean | undefined;
  for (const token of args) {
    if (!token.startsWith("UV_LOCKED=")) continue;
    assigned = token === "UV_LOCKED=1";
  }
  return assigned;
}

function splitShell(command: string): string[] {
  const segments: string[] = [];
  let current = "";
  let quote: '"' | "'" | null = null;
  for (let index = 0; index < command.length; index += 1) {
    const ch = command[index] ?? "";
    if (quote) {
      current += ch;
      if (ch === "\\" && quote === '"') {
        const next = command[index + 1];
        if (next !== undefined) {
          current += next;
          index += 1;
        }
        continue;
      }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      current += ch;
      continue;
    }
    if (ch === "\n") {
      segments.push(current);
      current = "";
      continue;
    }
    if ((ch === "&" && command[index + 1] === "&") || (ch === "|" && command[index + 1] === "|")) {
      segments.push(current);
      current = "";
      index += 1;
      continue;
    }
    if (ch === "&" || ch === "|" || ch === ";") {
      segments.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  segments.push(current);
  return segments;
}

function shellTokens(segment: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let quote: '"' | "'" | null = null;
  const push = (): void => {
    if (current.length === 0) return;
    tokens.push(current);
    current = "";
  };
  for (let index = 0; index < segment.length; index += 1) {
    const ch = segment[index] ?? "";
    if (quote) {
      if (ch === "\\" && quote === '"') {
        const next = segment[index + 1];
        if (next !== undefined) {
          current += next;
          index += 1;
        }
        continue;
      }
      if (ch === quote) {
        quote = null;
        continue;
      }
      current += ch;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === "\\") {
      const next = segment[index + 1];
      if (next !== undefined) {
        current += next;
        index += 1;
      }
      continue;
    }
    if (ch === " " || ch === "\t") {
      push();
      continue;
    }
    current += ch;
  }
  push();
  return tokens;
}

function pnpmInstall(command: string): boolean {
  const tokens = shellTokens(command);
  let seenPnpm = false;
  for (const token of tokens) {
    if (token === "pnpm" || token.endsWith("/pnpm")) {
      seenPnpm = true;
      continue;
    }
    if (seenPnpm && (token === "install" || token === "i")) return true;
  }
  return false;
}

function pnpmFrozen(command: string): boolean | undefined {
  let frozen: boolean | undefined;
  for (const token of shellTokens(command)) {
    if (token === "--frozen-lockfile" || token === "--frozen-lockfile=true") frozen = true;
    else if (
      token === "--no-frozen-lockfile" ||
      token === "--no-frozen-lockfile=true" ||
      token === "--frozen-lockfile=false"
    ) {
      frozen = false;
    }
  }
  return frozen;
}
