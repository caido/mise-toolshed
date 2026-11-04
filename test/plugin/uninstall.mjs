import { writeFile } from "node:fs/promises";
import path from "node:path";
import { mise, must, pass, trim, withPlugin } from "./support.mjs";

await withPlugin(async ({ env, project }) => {
  await writeFile(
    path.join(project, "mise.toml"),
    '[tools]\n"toolshed:check-exact-versions" = "1.0.0"\n',
  );
  must(mise(env, project, ["install"]), "install");
  const version = trim(
    must(mise(env, project, ["exec", "--", "check-exact-versions", "--version"]), "version"),
  );
  if (version !== "1.0.0") throw new Error(`printed [${version}]`);
  must(mise(env, project, ["uninstall", "toolshed:check-exact-versions@1.0.0"]), "uninstall");
  const where = mise(env, project, ["where", "toolshed:check-exact-versions@1.0.0"]);
  if (where.status === 0) throw new Error(`version is still installed at ${where.stdout}`);
  const which = mise(env, project, ["which", "check-exact-versions"]);
  if (which.status === 0) throw new Error(`tool is still on PATH at ${which.stdout}`);
});
pass("uninstall");
