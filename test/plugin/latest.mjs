import { mise, must, pass, trim, withPlugin } from "./support.mjs";

await withPlugin(({ env, project }) => {
  const listed = trim(
    must(mise(env, project, ["ls-remote", "toolshed:check-lockfiles"]), "ls-remote"),
  )
    .split("\n")
    .filter((line) => line !== "");
  const newest = listed[listed.length - 1];
  if (newest === undefined || newest === "") throw new Error("ls-remote printed no versions");
  must(mise(env, project, ["install", "toolshed:check-lockfiles@latest"]), "install latest");
  const version = trim(
    must(
      mise(env, project, [
        "exec",
        "toolshed:check-lockfiles@latest",
        "--",
        "check-lockfiles",
        "--version",
      ]),
      "version",
    ),
  );
  if (version !== newest) throw new Error(`latest printed [${version}], newest is ${newest}`);
});
pass("latest");
