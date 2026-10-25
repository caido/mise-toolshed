import type {
  DependencySite,
  Finding,
  ImageSite,
  PinSite,
  PluginSite,
  Site,
  ToolSite,
} from "../../shared/src/types.js";

const SEMVER =
  "(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)(?:-[0-9A-Za-z.-]+)?(?:\\+[0-9A-Za-z.-]+)?";
const npmExact = new RegExp(`^=?${SEMVER}$`);
const packageManagerExact = new RegExp(`^pnpm@${SEMVER}$`);
const toolExact = /^(0|[1-9]\d*)\.(0|[1-9]\d*)(\.(0|[1-9]\d*))?$/;
const toolPatch = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const rustNightly = /^nightly-\d{4}-\d{2}-\d{2}$/;
const githubTag = /^[A-Za-z][A-Za-z0-9._-]*-v?(0|[1-9]\d*)\.(0|[1-9]\d*)(?:\.(0|[1-9]\d*))?$/;
const hex40 = /^[0-9a-fA-F]{40}$/;

export function decide(site: PinSite): readonly Finding[] {
  switch (site.kind) {
    case "dependency":
      return decideDependency(site);
    case "tool":
      return decideTool(site);
    case "plugin":
      return decidePlugin(site);
    case "action":
    case "install-command":
      return [];
    case "image":
      return decideImage(site);
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
  if (requirement.includes(" @ "))
    return [finding(site, `dependency ${site.name} is not an exact version`)];
  if (pythonExact(requirement)) return [];
  return [finding(site, `dependency ${site.name} is not an exact version`)];
}

function decideTool(site: ToolSite): readonly Finding[] {
  if (toolVersionExact(site.name, site.value.text)) return [];
  return [finding(site, `tool ${site.name} is not an exact version`)];
}

function toolVersionExact(name: string, text: string): boolean {
  if (name === "rust") return toolPatch.test(text) || rustNightly.test(text);
  if (name.startsWith("github:")) return toolExact.test(text) || githubReleaseTag(text);
  return toolExact.test(text);
}

function githubReleaseTag(text: string): boolean {
  if (text.startsWith("v") && toolExact.test(text.slice(1))) return true;
  return githubTag.test(text);
}

function decidePlugin(site: PluginSite): readonly Finding[] {
  if (site.value.shape === "string" && /#[0-9a-fA-F]{40}$/.test(site.value.text)) return [];
  return [finding(site, `plugin ${site.name} must end in a 40-hex pin`)];
}

function decideImage(site: ImageSite): readonly Finding[] {
  if (site.origin === "dockerfile") {
    if (site.reference === "scratch") return [];
    if (site.priorStageNames.includes(site.reference)) return [];
  }
  if (site.reference.includes("@sha256:")) return [];
  return [finding(site, `image ${site.reference} must contain @sha256:`)];
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
