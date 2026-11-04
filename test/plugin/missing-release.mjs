import path from "node:path";
import { filesUnder, mise, pass, withPlugin } from "./support.mjs";

await withPlugin(async ({ env, project, dataDir }) => {
  const install = mise(env, project, ["install", "toolshed:check-exact-versions@9.9.9"]);
  if (install.status === 0) throw new Error("missing release installed a tool");
  if (!install.stderr.includes("no release for check-exact-versions 9.9.9")) {
    throw new Error(`missing release did not name the version\n${install.stderr}${install.stdout}`);
  }
  if (!/HTTP \d+/.test(install.stderr)) {
    throw new Error(`missing release was not an HTTP error\n${install.stderr}${install.stdout}`);
  }
  const left = await filesUnder(dataDir);
  const installed = left.filter((file) => file.includes(`${path.sep}9.9.9${path.sep}`));
  if (installed.length > 0) {
    throw new Error(`missing release left files\n${installed.join("\n")}`);
  }
});
pass("missing-release");
