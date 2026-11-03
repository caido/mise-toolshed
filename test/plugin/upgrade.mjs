import { writeFile } from "node:fs/promises";
import path from "node:path";
import { mise, must, pass, trim, withPlugin } from "./support.mjs";

await withPlugin(async ({ env, project }) => {
  must(mise(env, project, ["install", "toolshed:check-lockfiles@1.0.0"]), "install 1.0.0");
  must(mise(env, project, ["install", "toolshed:check-lockfiles@1.0.1"]), "install 1.0.1");
  const installed = trim(must(mise(env, project, ["ls", "toolshed:check-lockfiles"]), "ls"));
  if (!installed.includes("1.0.0") || !installed.includes("1.0.1")) {
    throw new Error(`both versions are not installed\n${installed}`);
  }
  const config = path.join(project, "mise.toml");
  await writeFile(config, '[tools]\n"toolshed:check-lockfiles" = "1.0.0"\n');
  const older = trim(
    must(mise(env, project, ["exec", "--", "check-lockfiles", "--version"]), "old version"),
  );
  if (older !== "1.0.0") throw new Error(`pin 1.0.0 printed [${older}]`);
  await writeFile(config, '[tools]\n"toolshed:check-lockfiles" = "1.0.1"\n');
  const newer = trim(
    must(mise(env, project, ["exec", "--", "check-lockfiles", "--version"]), "new version"),
  );
  if (newer !== "1.0.1") throw new Error(`pin 1.0.1 printed [${newer}]`);
});
pass("upgrade");
