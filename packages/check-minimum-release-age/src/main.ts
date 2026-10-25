import { TOOL_NAME, TOOL_VERSION } from "#tool-version";
import { scan } from "./scan.js";

const argv = process.argv.slice(2);
if (argv.length === 1 && argv[0] === "--version") {
  process.stdout.write(`${TOOL_VERSION}\n`);
  process.exitCode = 0;
} else if (argv.length !== 0) {
  process.stderr.write(`usage: ${TOOL_NAME} --version\n`);
  process.exitCode = 1;
} else {
  const findings = scan(process.cwd());
  for (const found of findings) {
    process.stdout.write(`${found.path}:${found.line}: ${found.message}\n`);
  }
  process.exitCode = findings.length === 0 ? 0 : 1;
}
