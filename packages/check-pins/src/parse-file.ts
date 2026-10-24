import { parseDockerfile } from "./parse-dockerfile.js";
import { parseMise } from "./parse-mise.js";
import { parseNpmrc } from "./parse-npmrc.js";
import { parsePackageJson } from "./parse-package-json.js";
import { parsePyproject } from "./parse-pyproject.js";
import { parseWorkflow } from "./parse-workflow.js";
import type { FileKind, ParsedFile, ScanFacts } from "./types.js";

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
