import { mise, must, pass, trim, withPlugin } from "./support.mjs";

const headers = {
  Accept: "application/vnd.github+json",
  "User-Agent": "caido-mise-toolshed",
  "X-GitHub-Api-Version": "2022-11-28",
};

async function githubVersions(tool) {
  const prefix = `${tool}-v`;
  const pages = [];
  let url = "https://api.github.com/repos/caido/mise-toolshed/releases?per_page=100";
  for (let page = 0; page < 20; page += 1) {
    const response = await fetch(url, { headers });
    if (!response.ok) throw new Error(`GitHub releases HTTP ${response.status}`);
    pages.push(await response.json());
    const link = response.headers.get("link") ?? "";
    const next = link.split(",").find((part) => part.includes('rel="next"'));
    const match = next?.match(/<([^>]+)>/);
    if (match?.[1] === undefined) break;
    url = match[1];
  }
  const versions = [];
  const seen = new Set();
  for (let pageIndex = pages.length - 1; pageIndex >= 0; pageIndex -= 1) {
    const page = pages[pageIndex] ?? [];
    for (let index = page.length - 1; index >= 0; index -= 1) {
      const tag = page[index]?.tag_name;
      if (typeof tag === "string" && tag.startsWith(prefix)) {
        const version = tag.slice(prefix.length);
        if (version !== "" && !seen.has(version)) {
          seen.add(version);
          versions.push(version);
        }
      }
    }
  }
  return versions;
}

const expected = await githubVersions("check-lockfiles");
if (!expected.includes("1.0.0") || !expected.includes("1.0.1")) {
  throw new Error(`released versions missing from GitHub: ${expected.join(", ")}`);
}
await withPlugin(({ env, project }) => {
  const versions = trim(
    must(mise(env, project, ["ls-remote", "toolshed:check-lockfiles"]), "ls-remote"),
  )
    .split("\n")
    .filter((line) => line !== "");
  if (versions.join("\n") !== expected.join("\n")) {
    throw new Error(
      `ls-remote disagreed with GitHub publish order\nplugin: ${versions.join(", ")}\ngithub: ${expected.join(", ")}`,
    );
  }
});
pass("ls-remote");
