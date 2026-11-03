import { mise, must, pass, trim, withPlugin } from "./support.mjs";

function parts(version) {
  return version.split(".").map((part) => Number(part));
}

await withPlugin(({ env, project }) => {
  const versions = trim(
    must(mise(env, project, ["ls-remote", "toolshed:check-lockfiles"]), "ls-remote"),
  )
    .split("\n")
    .filter((line) => line !== "");
  for (let index = 1; index < versions.length; index += 1) {
    const previous = parts(versions[index - 1] ?? "");
    const current = parts(versions[index] ?? "");
    const ordered =
      previous[0] < current[0] ||
      (previous[0] === current[0] && previous[1] < current[1]) ||
      (previous[0] === current[0] && previous[1] === current[1] && previous[2] < current[2]);
    if (!ordered) throw new Error(`versions are not oldest first: ${versions.join(", ")}`);
  }
  if (!versions.includes("1.0.0") || !versions.includes("1.0.1")) {
    throw new Error(`released versions missing: ${versions.join(", ")}`);
  }
});
pass("ls-remote");
