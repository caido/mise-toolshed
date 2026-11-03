import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { mise, must, pass, trim, withPlugin } from "./support.mjs";

await withPlugin(async ({ env, project }) => {
  must(mise(env, project, ["install", "toolshed:check-exact-versions@1.0.0"]), "install");
  const where = trim(
    must(mise(env, project, ["where", "toolshed:check-exact-versions@1.0.0"]), "where"),
  );
  const bin = path.join(where, "bin", "check-exact-versions");
  await writeFile(bin, "stale");
  must(
    mise(env, project, ["install", "--force", "toolshed:check-exact-versions@1.0.0"]),
    "reinstall",
  );
  const body = await readFile(bin, "utf8");
  if (body === "stale" || !body.startsWith("#!/usr/bin/env")) {
    throw new Error("reinstall left the stale file");
  }
  const version = trim(
    must(
      mise(env, project, [
        "exec",
        "toolshed:check-exact-versions@1.0.0",
        "--",
        "check-exact-versions",
        "--version",
      ]),
      "version",
    ),
  );
  if (version !== "1.0.0") throw new Error(`printed [${version}]`);
});
pass("reinstall");
