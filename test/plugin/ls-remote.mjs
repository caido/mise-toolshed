import { mise, must, pass, withPlugin } from "./support.mjs";

await withPlugin(({ env, project }) => {
  const raw = must(
    mise(env, project, ["ls-remote", "--json", "toolshed:check-lockfiles"]),
    "ls-remote",
  );
  let listed;
  try {
    listed = JSON.parse(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`ls-remote did not print JSON: ${message}\n${raw}`);
  }
  if (!Array.isArray(listed)) throw new Error(`ls-remote JSON was not a list\n${raw}`);
  const versions = listed.map((entry) =>
    entry !== null && typeof entry === "object" ? entry.version : undefined,
  );
  const older = versions.indexOf("1.0.0");
  const newer = versions.indexOf("1.0.1");
  if (older === -1 || newer === -1 || older > newer) {
    throw new Error(`1.0.0 is not listed before 1.0.1: ${versions.join(", ")}`);
  }
  for (const entry of listed) {
    const version = entry !== null && typeof entry === "object" ? entry.version : undefined;
    const createdAt = entry !== null && typeof entry === "object" ? entry.created_at : undefined;
    if (typeof createdAt !== "string" || createdAt === "") {
      throw new Error(`version ${version} has no created_at\n${raw}`);
    }
  }
});
pass("ls-remote");
