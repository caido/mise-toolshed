import { TOOL_NAME, TOOL_VERSION } from "#tool-version";
import { run } from "../../shared/src/run.js";

process.exitCode = run(
  { name: TOOL_NAME, version: TOOL_VERSION },
  process.argv.slice(2),
  process.cwd(),
  { stdout: process.stdout, stderr: process.stderr },
  () => [],
);
