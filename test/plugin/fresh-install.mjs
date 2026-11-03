import { mise, must, pass, trim, withPlugin } from "./support.mjs";

await withPlugin(({ env, project }) => {
  must(mise(env, project, ["install", "toolshed:check-exact-versions@1.0.0"]), "install");
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
pass("fresh-install");
