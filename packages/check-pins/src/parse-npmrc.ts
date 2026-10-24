import { unquoteYaml } from "./yaml-scan.js";

export function parseNpmrc(text: string): boolean {
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
