import { run } from "../src/run.js";
import type { PinSite } from "../src/types.js";

function describe(site: PinSite): string {
  switch (site.kind) {
    case "dependency":
      return `dependency ${site.family} ${site.name} ${site.spec}`;
    case "tool":
      return site.value.shape === "string"
        ? `tool ${site.name} ${site.value.text}`
        : `tool ${site.name} table`;
    case "plugin":
      return site.value.shape === "string"
        ? `plugin ${site.name} ${site.value.text}`
        : `plugin ${site.name} table`;
    case "action":
      return `action ${site.uses}`;
    case "image":
      return `image ${site.origin} ${site.reference}`;
    case "install-command":
      return `install ${site.tool} ${site.command}`;
    case "unreadable":
      return `unreadable ${site.format}`;
    default: {
      const neverSite: never = site;
      return neverSite;
    }
  }
}

process.exitCode = run(
  { name: "shared-sites", version: "0.0.0" },
  process.argv.slice(2),
  process.cwd(),
  { stdout: process.stdout, stderr: process.stderr },
  (site) => [{ path: site.path, line: site.line, message: describe(site) }],
);
