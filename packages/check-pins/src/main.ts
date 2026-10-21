import { TOOL_NAME, TOOL_VERSION } from "#tool-version";

const args: readonly string[] = process.argv.slice(2);
if (args.length === 1 && args[0] === "--version") {
  process.stdout.write(`${TOOL_VERSION}\n`);
  process.exit(0);
}

process.stderr.write(`usage: ${TOOL_NAME} --version\n`);
process.exit(1);
