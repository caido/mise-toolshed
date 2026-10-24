import { readFileSync } from "node:fs";

const manifest = process.argv[2];
if (manifest === undefined || manifest.length === 0) {
  process.stderr.write("usage: read-package-version.ts <package.json>\n");
  process.exit(1);
}

const raw: unknown = JSON.parse(readFileSync(manifest, "utf8"));
if (typeof raw !== "object" || raw === null || !("version" in raw)) {
  process.stderr.write("package.json version is missing\n");
  process.exit(1);
}

const version = raw.version;
if (typeof version !== "string" || version.length === 0) {
  process.stderr.write("package.json version is missing\n");
  process.exit(1);
}

process.stdout.write(version);
