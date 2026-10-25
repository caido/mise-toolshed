export function indentOf(line: string): number {
  return /^\s*/.exec(line)?.[0].length ?? 0;
}

export function parseYamlKey(
  line: string,
): { indent: number; key: string; value: string } | undefined {
  const match = /^(\s*)([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
  if (match === null) return undefined;
  return { indent: match[1]?.length ?? 0, key: match[2] ?? "", value: match[3] ?? "" };
}

export function yamlScalar(text: string): { value: string; comment: string } {
  const trimmed = text.trim();
  if (trimmed === "" || trimmed.startsWith("#")) {
    return { value: "", comment: trimmed.startsWith("#") ? trimmed.slice(1).trim() : "" };
  }
  return splitYamlComment(text);
}

export function splitYamlComment(text: string): { value: string; comment: string } {
  let quote: '"' | "'" | null = null;
  for (let index = 0; index < text.length; index += 1) {
    const ch = text[index] ?? "";
    if (quote) {
      if (quote === "'" && ch === "'" && text[index + 1] === "'") {
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
    if (ch === " " && text[index + 1] === "#") {
      return { value: text.slice(0, index).trim(), comment: text.slice(index + 2).trim() };
    }
  }
  return { value: text.trim(), comment: "" };
}

export function unquoteYaml(value: string): string {
  if (value.startsWith("'") && value.endsWith("'") && value.length >= 2) {
    return value.slice(1, -1).replaceAll("''", "'");
  }
  if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) {
    return unescapeYamlDouble(value.slice(1, -1));
  }
  return value;
}

function unescapeYamlDouble(value: string): string {
  let out = "";
  for (let index = 0; index < value.length; index += 1) {
    const ch = value[index] ?? "";
    if (ch !== "\\") {
      out += ch;
      continue;
    }
    const next = value[index + 1] ?? "";
    index += 1;
    if (next === "n") out += "\n";
    else if (next === "t") out += "\t";
    else if (next === "r") out += "\r";
    else if (next === "\\") out += "\\";
    else if (next === '"') out += '"';
    else out += next;
  }
  return out;
}

export function isBlockScalar(value: string): boolean {
  const flag = value.trim();
  return flag.startsWith("|") || flag.startsWith(">");
}

export function structuralValue(value: string): string {
  if (/^&[A-Za-z_][A-Za-z0-9_-]*$/.test(value)) return "";
  return value;
}

export function readBlock(
  lines: readonly string[],
  cursor: { i: number },
  indent: number,
  keepBlank = false,
): { line: number; text: string; indent: number }[] {
  const physical: { line: number; text: string; indent: number }[] = [];
  let next = cursor.i + 1;
  for (; next < lines.length; next += 1) {
    const blockLine = lines[next] ?? "";
    if (blockLine.trim() === "") {
      if (keepBlank) physical.push({ line: next + 1, text: "", indent: 0 });
      continue;
    }
    if (indentOf(blockLine) <= indent) break;
    physical.push({ line: next + 1, text: blockLine.trim(), indent: indentOf(blockLine) });
  }
  cursor.i = next - 1;
  return physical;
}

export function foldBlock(parts: readonly { line: number; text: string; indent: number }[]): {
  line: number;
  text: string;
} {
  let contentIndent = -1;
  for (const part of parts) {
    if (part.text === "") continue;
    if (contentIndent === -1 || part.indent < contentIndent) contentIndent = part.indent;
  }
  let text = "";
  let line = 0;
  for (const part of parts) {
    if (part.text === "") {
      if (text !== "" && !text.endsWith("\n")) text += "\n";
      continue;
    }
    if (line === 0) line = part.line;
    const moreIndented = part.indent > contentIndent;
    if (moreIndented && text !== "" && !text.endsWith("\n")) text += "\n";
    if (text === "" || text.endsWith("\n")) text += part.text;
    else text += ` ${part.text}`;
  }
  return { line, text };
}

export function runHeader(value: string): {
  anchor?: string;
  block?: string;
  alias?: string;
  plain: string;
} {
  let rest = value.trim();
  let anchor: string | undefined;
  const anchored = /^&([^\s[\]{},]+)(?:\s+([\s\S]*))?$/.exec(rest);
  if (anchored) {
    anchor = anchored[1];
    rest = (anchored[2] ?? "").trim();
  }
  rest = stripYamlTag(rest);
  const alias = /^\*([^\s[\]{},]+)$/.exec(rest);
  if (alias?.[1] !== undefined) return { anchor, alias: alias[1], plain: rest };
  if (rest.startsWith("|") || rest.startsWith(">")) return { anchor, block: rest, plain: rest };
  return { anchor, plain: rest };
}

function stripYamlTag(value: string): string {
  if (!value.startsWith("!")) return value;
  const tagged = /^!(?:<[^>]*>|\S*)\s*([\s\S]*)$/.exec(value);
  return (tagged?.[1] ?? "").trim();
}

export function joinContinuations(
  parts: readonly { line: number; text: string }[],
): { line: number; text: string }[] {
  const scripts: { line: number; text: string }[] = [];
  let text = "";
  let line = 0;
  let open = false;
  for (const part of parts) {
    if (part.text === "") {
      if (open) {
        scripts.push({ line, text });
        open = false;
      }
      continue;
    }
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
