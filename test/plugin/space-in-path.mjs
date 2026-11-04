import { mise, must, pass, trim, withPlugin } from "./support.mjs";

await withPlugin(
  ({ env, project }) => {
    if (!env.MISE_DATA_DIR.includes(" ") || !env.MISE_CACHE_DIR.includes(" ")) {
      throw new Error("the scenario directories have no space");
    }
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
  },
  { dataDirName: "data dir", cacheDirName: "cache dir" },
);
pass("space-in-path");
