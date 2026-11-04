import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { startMirror } from "../support/release-mirror.mjs";
import { filesUnder, mise, pass, withPlugin } from "./support.mjs";

const body = "#!/usr/bin/env node\nprocess.stdout.write('1.0.0\\n');\n";
const wrong = "0".repeat(64);
const actual = createHash("sha256").update(body).digest("hex");
const root = await mkdtemp(path.join(tmpdir(), "toolshed-sums-"));
const release = path.join(root, "check-exact-versions", "1.0.0");
let mirror;
try {
  await mkdir(release, { recursive: true });
  await writeFile(path.join(release, "check-exact-versions.mjs"), body);
  await writeFile(path.join(release, "SHA256SUMS"), `${wrong}  check-exact-versions.mjs\n`);
  await writeFile(
    path.join(root, "check-exact-versions", "index.json"),
    `${JSON.stringify({
      versions: [{ version: "1.0.0", created_at: "2024-01-01T00:00:00Z" }],
    })}\n`,
  );
  mirror = await startMirror(root);
  await withPlugin(async ({ env, project, dataDir }) => {
    await writeFile(
      path.join(project, "mise.toml"),
      `[tools]\n"toolshed:check-exact-versions" = { version = "1.0.0", mirror = "${mirror.url}" }\n`,
    );
    const install = mise(env, project, ["install"]);
    if (install.status === 0) throw new Error("checksum mismatch installed the tool");
    if (!install.stderr.includes("checksum mismatch")) {
      throw new Error(`expected a checksum error\n${install.stderr}`);
    }
    if (!install.stderr.includes(wrong) || !install.stderr.includes(actual)) {
      throw new Error(`checksum error hid the hashes\n${install.stderr}`);
    }
    const left = await filesUnder(dataDir);
    const installed = left.filter((file) => file.includes(`${path.sep}1.0.0${path.sep}`));
    if (installed.length > 0) throw new Error(`install left files\n${installed.join("\n")}`);
  });
} finally {
  await mirror?.close();
  await rm(root, { recursive: true, force: true });
}
pass("checksum-mismatch");
