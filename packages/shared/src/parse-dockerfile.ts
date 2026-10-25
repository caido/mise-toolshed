import { installSites, shellTokens } from "./shell-commands.js";
import type { ParsedFile, PinSite } from "./types.js";

export function parseDockerfile(relativePath: string, text: string): ParsedFile {
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
    if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === "string"))
      return undefined;
    return parsed.join(" ");
  } catch {
    return undefined;
  }
}

function dockerfileInstructions(
  text: string,
): { line: number; text: string; parts: { line: number; text: string }[] }[] {
  const instructions: { line: number; text: string; parts: { line: number; text: string }[] }[] =
    [];
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

function lineWithToken(
  parts: readonly { line: number; text: string }[],
  tool: "uv" | "pnpm",
): number | undefined {
  for (const part of parts) {
    const tokens = shellTokens(part.text.replace(/[[\],]/g, " "));
    if (tool === "uv" && tokens.includes("uv")) return part.line;
    if (tool === "pnpm" && tokens.some((token) => token === "pnpm" || token.endsWith("/pnpm")))
      return part.line;
  }
  return undefined;
}
