import type { FileKind, ParsedFile } from "./types.js";

export function unreadable(relativePath: string, format: Exclude<FileKind, "skip">): ParsedFile {
  return {
    sites: [{ kind: "unreadable", format, path: relativePath, line: 1 }],
    miseUvLocked: false,
    npmrcFrozen: false,
  };
}
