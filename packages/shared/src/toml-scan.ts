export function tomlHeader(line: string): string | undefined {
  const match = /^\s*\[([^[\]]+)\]\s*(?:#.*)?$/.exec(line);
  return match?.[1]?.trim();
}

export function tomlAssignment(line: string): { key: string; value: string } | undefined {
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

export function unquoteTomlKey(key: string): string {
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    return readTomlString(key) ?? key.slice(1, -1);
  }
  return key;
}

export function readTomlString(value: string): string | undefined {
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

export function scanToml(
  text: string,
  startDepth: number,
): { strings: string[]; depth: number; broken: boolean; sawTable: boolean } {
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

export function braceDelta(text: string): number {
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
