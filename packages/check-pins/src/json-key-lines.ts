class JsonStop extends Error {}

export function jsonKeyLines(text: string): Map<string, number> | undefined {
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

function parseJsonValue(
  state: { i: number; line: number; text: string },
  lines: Map<string, number>,
  path: string,
): void {
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

function parseJsonObject(
  state: { i: number; line: number; text: string },
  lines: Map<string, number>,
  path: string,
): void {
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

function parseJsonArray(
  state: { i: number; line: number; text: string },
  lines: Map<string, number>,
  path: string,
): void {
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
