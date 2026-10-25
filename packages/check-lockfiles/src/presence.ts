import { classify } from "../../shared/src/classify-path.js";
import type { Finding } from "../../shared/src/types.js";

const LOCKFILE_FOR = {
  "package-json": "pnpm-lock.yaml",
  pyproject: "uv.lock",
  mise: "mise.lock",
  cargo: "Cargo.lock",
} as const;

type LockfileName = (typeof LOCKFILE_FOR)[keyof typeof LOCKFILE_FOR];

export function missingLockfiles(files: ReadonlySet<string>): readonly Finding[] {
  const findings: Finding[] = [];
  for (const manifest of files) {
    const lockfile = requiredLockfile(manifest);
    if (lockfile === undefined || lockfileIsPresent(files, manifest, lockfile)) continue;
    findings.push({ path: manifest, line: 1, message: `lockfile ${lockfile} is missing` });
  }
  return findings;
}

function requiredLockfile(relativePath: string): LockfileName | undefined {
  const kind = classify(relativePath);
  switch (kind) {
    case "package-json":
    case "pyproject":
    case "mise":
      return LOCKFILE_FOR[kind];
    case "dockerfile":
    case "workflow":
    case "npmrc":
      return undefined;
    case "skip":
      return relativePath.slice(relativePath.lastIndexOf("/") + 1) === "Cargo.toml"
        ? LOCKFILE_FOR.cargo
        : undefined;
    default: {
      const neverKind: never = kind;
      return neverKind;
    }
  }
}

function lockfileIsPresent(
  files: ReadonlySet<string>,
  manifest: string,
  lockfile: LockfileName,
): boolean {
  let dir = directoryOf(manifest);
  for (;;) {
    if (files.has(dir === "" ? lockfile : `${dir}/${lockfile}`)) return true;
    if (dir === "") return false;
    dir = directoryOf(dir);
  }
}

function directoryOf(relativePath: string): string {
  const slash = relativePath.lastIndexOf("/");
  return slash === -1 ? "" : relativePath.slice(0, slash);
}
