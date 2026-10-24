import type { EnvPair, InstallSite } from "./types.js";

type ShellGap = "seq" | "and" | "or" | "pipe" | "bg";

export function installSites(
  relativePath: string,
  line: number,
  command: string,
  scopedEnv: readonly EnvPair[],
  honorMiseEnv: boolean,
): InstallSite[] {
  const sites: InstallSite[] = [];
  let carried = false;
  let conditional = false;
  let inPipe = false;
  let pipeBase = false;
  for (const segment of splitShell(stripShellComment(command))) {
    const trimmed = segment.text.trim();
    if (trimmed !== "") {
      const tokens = shellTokens(trimmed);
      const inherited = inPipe ? pipeBase : carried;
      const invokesMise = tokens.includes("mise");
      if (tokens.includes("uv")) {
        sites.push({
          kind: "install-command",
          tool: "uv",
          command: trimmed,
          scopedEnv,
          scriptLocked: inherited,
          commandLock: uvCommandLock(tokens),
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
          commandLock: undefined,
          honorMiseEnv: false,
          path: relativePath,
          line,
        });
      }
      const publishes = !inPipe && !conditional && segment.gap !== "pipe" && segment.gap !== "bg";
      if (publishes) {
        const next = uvCarryUpdate(tokens);
        if (next !== undefined) carried = next;
      }
    }
    if (segment.gap === "pipe") {
      if (!inPipe) pipeBase = carried;
      inPipe = true;
    } else if (segment.gap === "and" || segment.gap === "or") {
      inPipe = false;
      conditional = true;
    } else {
      inPipe = false;
      conditional = false;
    }
  }
  return sites;
}

function uvCommandLock(tokens: readonly string[]): boolean | undefined {
  const uvAt = tokens.indexOf("uv");
  if (uvAt === -1) return undefined;
  let assignment: boolean | undefined;
  let unset = false;
  for (let index = 0; index < uvAt; index += 1) {
    const token = tokens[index] ?? "";
    if (token.startsWith("UV_LOCKED=")) {
      assignment = token === "UV_LOCKED=1";
      unset = false;
      continue;
    }
    if (token === "UV_LOCKED" && tokens[index - 1] === "-u") {
      assignment = undefined;
      unset = true;
    }
  }
  if (unset) return false;
  return assignment;
}

function uvCarryUpdate(tokens: readonly string[]): boolean | undefined {
  if (tokens[0] === "unset" && tokens.slice(1).includes("UV_LOCKED")) return false;
  if (tokens[0] === "export" && tokens[1] === "-n" && tokens.slice(2).includes("UV_LOCKED")) return false;
  if (tokens[0] === "declare" && tokens[1] === "+x" && tokens.slice(2).includes("UV_LOCKED")) return false;
  return uvLockAssignment(tokens);
}

function stripShellComment(command: string): string {
  let out = "";
  let quote: '"' | "'" | null = null;
  let brace = 0;
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
    if (ch === "$" && command[index + 1] === "{") {
      out += "${";
      index += 1;
      brace += 1;
      continue;
    }
    if (ch === "}" && brace > 0) {
      brace -= 1;
      out += ch;
      continue;
    }
    if (ch === "#" && brace === 0 && commentStartsWord(out)) {
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
  return (
    prev === " " ||
    prev === "\t" ||
    prev === "\n" ||
    prev === ";" ||
    prev === "&" ||
    prev === "|" ||
    prev === "(" ||
    prev === "{" ||
    prev === "`"
  );
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

function splitShell(command: string): { text: string; gap: ShellGap }[] {
  const segments: { text: string; gap: ShellGap }[] = [];
  let current = "";
  let quote: '"' | "'" | null = null;
  const push = (gap: ShellGap): void => {
    segments.push({ text: current, gap });
    current = "";
  };
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
      push("seq");
      continue;
    }
    if (ch === "&" && command[index + 1] === "&") {
      push("and");
      index += 1;
      continue;
    }
    if (ch === "|" && command[index + 1] === "|") {
      push("or");
      index += 1;
      continue;
    }
    if (ch === "&") {
      push("bg");
      continue;
    }
    if (ch === "|") {
      push("pipe");
      continue;
    }
    if (ch === ";") {
      push("seq");
      continue;
    }
    current += ch;
  }
  push("seq");
  return segments;
}

export function shellTokens(segment: string): string[] {
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
    if (ch === " " || ch === "\t" || ch === "(" || ch === ")" || ch === "{" || ch === "}" || ch === "`") {
      push();
      continue;
    }
    current += ch;
  }
  push();
  return tokens;
}
