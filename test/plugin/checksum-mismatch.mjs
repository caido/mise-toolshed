import { createHash } from "node:crypto";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { startMirror } from "../support/release-mirror.mjs";
import { filesUnder, mise, pass, withPlugin } from "./support.mjs";

const body = "#!/usr/bin/env node\nprocess.stdout.write('1.0.0\\n');\n";
const wrong = "0".repeat(64);
const actual = createHash("sha256").update(body).digest("hex");
const root = await mkdtemp(path.join(tmpdir(), "toolshed-sums-"));
const release = path.join(root, "check-exact-versions-v1.0.0");
await mkdir(release, { recursive: true });
await writeFile(path.join(release, "check-exact-versions.mjs"), body);
await writeFile(path.join(release, "SHA256SUMS"), `${wrong}  check-exact-versions.mjs\n`);

const mirror = await startMirror(root);
try {
  await withPlugin(async ({ env, project, dataDir }) => {
    const install = mise({ ...env, TOOLSHED_RELEASE_BASE_URL: mirror.url }, project, [
      "install",
      "toolshed:check-exact-versions@1.0.0",
    ]);
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
  await mirror.close();
}
pass("checksum-mismatch");
