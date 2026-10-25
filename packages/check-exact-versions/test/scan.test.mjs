import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(packageRoot, "../..");
const bundlePath = path.join(packageRoot, "dist", "check-exact-versions.mjs");
const sha = "0123456789abcdef0123456789abcdef01234567";

function scan(cwd, args = []) {
  return spawnSync(process.execPath, [bundlePath, ...args], { cwd, encoding: "utf8" });
}

async function withFixture(files, fn) {
  const dir = await mkdtemp(path.join(tmpdir(), "exact-versions-scan-"));
  try {
    for (const [rel, text] of Object.entries(files)) {
      const full = path.join(dir, rel);
      await mkdir(path.dirname(full), { recursive: true });
      await writeFile(full, text);
    }
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function expectClean(result) {
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(result.stdout, "");
  assert.equal(result.stderr, "");
}

function expectFindings(result, stdout) {
  assert.equal(result.stderr, "");
  assert.equal(result.status, 1, result.stdout);
  assert.equal(result.stdout, stdout);
}

function packageJson(section, spec) {
  return `{
  "${section}": {
    "left-pad": ${JSON.stringify(spec)}
  }
}
`;
}

test("empty directory prints nothing", async () => {
  await withFixture({}, (dir) => {
    expectClean(scan(dir));
  });
});

test("npm ranges are rejected in dependencies, devDependencies, and optionalDependencies", async () => {
  const specs = [
    "^1.0.0",
    "~1.0.0",
    ">1.0.0",
    "<1.0.0",
    ">=1",
    "<=1",
    "*",
    "latest",
    "1.x",
    "1.2",
    "abc",
    "^1.2.3",
  ];
  const sections = ["dependencies", "devDependencies", "optionalDependencies"];
  for (const section of sections) {
    for (const spec of specs) {
      await withFixture({ "package.json": packageJson(section, spec) }, (dir) => {
        expectFindings(scan(dir), `package.json:3: dependency left-pad is not an exact version\n`);
      });
    }
  }
});

test("peerDependencies are not checked", async () => {
  await withFixture(
    {
      "package.json": `{
  "peerDependencies": {
    "left-pad": "^1.0.0"
  }
}
`,
    },
    (dir) => {
      expectClean(scan(dir));
    },
  );
});

test("a tarball URL is an inexact version, not a git pin", async () => {
  await withFixture(
    { "package.json": packageJson("dependencies", "https://example.com/pkg.tgz") },
    (dir) => {
      expectFindings(scan(dir), "package.json:3: dependency left-pad is not an exact version\n");
    },
  );
});

test("exact npm specs and local protocols pass", async () => {
  const specs = [
    "1.2.3",
    "=1.2.3",
    "1.2.3-beta.1",
    "1.2.3+build.5",
    "workspace:*",
    "workspace:^",
    "file:../local",
    "link:../local",
    "catalog:foo",
    `git+https://github.com/org/repo.git#${sha}`,
  ];
  const entries = specs
    .map((spec, index) => `    "pkg${index}": ${JSON.stringify(spec)}`)
    .join(",\n");
  await withFixture(
    {
      "package.json": `{
  "dependencies": {
${entries}
  }
}
`,
    },
    (dir) => {
      expectClean(scan(dir));
    },
  );
});

test("an npm git pin must be 40 hex", async () => {
  await withFixture(
    { "package.json": packageJson("dependencies", "git+https://github.com/org/repo.git#main") },
    (dir) => {
      expectFindings(scan(dir), "package.json:3: dependency left-pad git pin is not 40 hex\n");
    },
  );
});

test("engines and an exact packageManager are not findings", async () => {
  await withFixture(
    {
      "package.json": `{
  "engines": { "node": ">=24" },
  "packageManager": "pnpm@12.14.0"
}
`,
    },
    (dir) => {
      expectClean(scan(dir));
    },
  );
});

test("a missing packageManager is not a finding", async () => {
  await withFixture({ "package.json": "{}\n" }, (dir) => {
    expectClean(scan(dir));
  });
});

test("packageManager must be an exact pnpm version", async () => {
  for (const spec of ["pnpm@latest", "yarn@1.22.22", "pnpm@1.2"]) {
    await withFixture(
      {
        "package.json": `{
  "packageManager": ${JSON.stringify(spec)}
}
`,
      },
      (dir) => {
        expectFindings(scan(dir), "package.json:2: packageManager is not an exact pnpm version\n");
      },
    );
  }
});

test("python exact pins, markers, and ignored tables pass", async () => {
  await withFixture(
    {
      "apps/pyproject.toml": `[project]
name = "demo"
requires-python = ">=3.11"
dependencies = [
  "requests==2.32.3",
  'requests==2.32.3 ; python_version >= "3"',
  "pkg @ git+https://example.com/r.git@${sha}",
  "pkg @ git+https://example.com/r.git@${sha}#subdirectory=pkg",
]

[project.optional-dependencies]
dev = [
  "pytest==8.2.0",
]

[dependency-groups]
test = [
  "ruff==0.6.0",
]

[build-system]
requires = ["setuptools>=61"]
build-backend = "setuptools.build_meta"

[tool.poetry.dependencies]
python = "^3.11"
requests = ">=2"
`,
    },
    (dir) => {
      expectClean(scan(dir));
    },
  );
});

test("a python range is not an exact version", async () => {
  await withFixture(
    {
      "apps/pyproject.toml": `[project]
dependencies = [
  "requests>=2",
]
`,
    },
    (dir) => {
      expectFindings(
        scan(dir),
        "apps/pyproject.toml:3: dependency requests is not an exact version\n",
      );
    },
  );
});

test("a python git revision is the text after the last @ and before #", async () => {
  await withFixture(
    {
      "apps/pyproject.toml": `[project]
dependencies = [
  "pkg @ git+https://example.com/r.git@main#subdirectory=${sha}",
]
`,
    },
    (dir) => {
      expectFindings(scan(dir), "apps/pyproject.toml:3: dependency pkg git pin is not 40 hex\n");
    },
  );
});

test("a broken in-scope python array is one unreadable file", async () => {
  await withFixture(
    {
      "pyproject.toml": `[project]
dependencies = [
  "requests==2.32.3",
  "unterminated
]
`,
    },
    (dir) => {
      expectFindings(scan(dir), "pyproject.toml:1: pyproject is not valid\n");
    },
  );
});

test("mise tool strings and a pinned plugin pass", async () => {
  await withFixture(
    {
      "mise.toml": `[tools]
node = "16.15"
pnpm = "1.0.0"
zizmor = "24.22.0"
"toolshed:example" = "1.0.0"

[plugins]
toolshed = "https://github.com/caido/mise-toolshed#${sha}"
`,
    },
    (dir) => {
      expectClean(scan(dir));
    },
  );
});

test("mise tool versions that are not major.minor or major.minor.patch fail", async () => {
  for (const spec of ["22", "latest", "v22.0.0", "prefix:22.1.0"]) {
    await withFixture({ "mise.toml": `[tools]\nnode = ${JSON.stringify(spec)}\n` }, (dir) => {
      expectFindings(scan(dir), "mise.toml:2: tool node is not an exact version\n");
    });
  }
});

test("a mise tool table must be a string", async () => {
  await withFixture({ "mise.toml": `[tools]\nnode = { version = "24.22.0" }\n` }, (dir) => {
    expectFindings(scan(dir), "mise.toml:2: tool node must be a string\n");
  });
});

test("a mise plugin must end in a 40-hex pin", async () => {
  await withFixture(
    {
      "mise.toml": `[plugins]
toolshed = "https://github.com/caido/mise-toolshed"
`,
    },
    (dir) => {
      expectFindings(scan(dir), "mise.toml:2: plugin toolshed must end in a 40-hex pin\n");
    },
  );
});

test("dockerfile images, scratch, and prior stage aliases", async () => {
  await withFixture(
    {
      Dockerfile: `FROM node:22
FROM node:22@sha256:abc
FROM scratch
FROM scratch AS base
FROM base
FROM base:latest
FROM ubuntu:24.04 AS app
`,
    },
    (dir) => {
      expectFindings(
        scan(dir),
        `Dockerfile:1: image node:22 must contain @sha256:
Dockerfile:6: image base:latest must contain @sha256:
Dockerfile:7: image ubuntu:24.04 must contain @sha256:
`,
      );
    },
  );
});

test("workflow actions, local actions, and digested images pass", async () => {
  await withFixture(
    {
      ".github/workflows/ci.yml": `jobs:
  build:
    container: node:22@sha256:abc
    steps:
      - uses: actions/checkout@${sha} # v6.0.3
      - uses: ./.github/actions/local
      - uses: docker://alpine@sha256:abc
      - run: echo "uv sync"
        with:
          container: my-name
`,
    },
    (dir) => {
      expectClean(scan(dir));
    },
  );
});

test("workflow actions and images without pins fail", async () => {
  await withFixture(
    {
      ".github/workflows/ci.yml": `jobs:
  build:
    container: node:22
    steps:
      - uses: actions/checkout@${sha}
      - uses: actions/checkout@${sha}
        # v6.0.3
      - uses: docker://alpine:3
`,
    },
    (dir) => {
      expectFindings(
        scan(dir),
        `.github/workflows/ci.yml:3: image node:22 must contain @sha256:
.github/workflows/ci.yml:8: image docker://alpine:3 must contain @sha256:
`,
      );
    },
  );
});

test("a python equality pin cannot contain a wildcard", async () => {
  await withFixture(
    {
      "pyproject.toml": `[project]
dependencies = [
  "requests==2.32.*",
]
`,
    },
    (dir) => {
      expectFindings(scan(dir), "pyproject.toml:3: dependency requests is not an exact version\n");
    },
  );
});

test("a python wheel URL is not a git pin", async () => {
  await withFixture(
    {
      "pyproject.toml": `[project]
dependencies = [
  "pkg @ https://files.pythonhosted.org/packages/a/b/requests-2.32.3-py3-none-any.whl",
]
`,
    },
    (dir) => {
      expectFindings(scan(dir), "pyproject.toml:3: dependency pkg is not an exact version\n");
    },
  );
});

test("a multiline mise string does not change the section", async () => {
  await withFixture(
    {
      "mise.toml": `[tools]
note = """
[env]
UV_LOCKED = "1"
"""
pnpm = "latest"
`,
    },
    (dir) => {
      expectFindings(
        scan(dir),
        `mise.toml:2: tool note is not an exact version
mise.toml:6: tool pnpm is not an exact version
`,
      );
    },
  );
});

test("workflow images are container and service references", async () => {
  await withFixture(
    {
      ".github/workflows/ci.yml": `on:
  workflow_call:
    inputs:
      image:
        default: node:22
jobs:
  build:
    container:
      image: node:22
    services:
      db:
        image: postgres:16
    steps:
      - uses: actions/checkout@${sha} # v6.0.3
        with:
          image: node:22
`,
    },
    (dir) => {
      expectFindings(
        scan(dir),
        `.github/workflows/ci.yml:9: image node:22 must contain @sha256:
.github/workflows/ci.yml:12: image postgres:16 must contain @sha256:
`,
      );
    },
  );
});

test("a piped scan returns every finding line", async () => {
  const deps = Array.from({ length: 2000 }, (_, index) => `    "pkg${index}": "^1.0.0"`).join(
    ",\n",
  );
  await withFixture(
    {
      "package.json": `{
  "dependencies": {
${deps}
  }
}
`,
    },
    (dir) => {
      const result = scan(dir);
      const lines = result.stdout.split("\n").filter((line) => line.length > 0);
      assert.equal(result.status, 1);
      assert.equal(lines.length, 2000);
      assert.equal(lines[0], "package.json:3: dependency pkg0 is not an exact version");
      assert.equal(lines[1999], "package.json:2002: dependency pkg1999 is not an exact version");
    },
  );
});

test("a direct python url is not an exact pin when it contains ==", async () => {
  await withFixture(
    {
      "pyproject.toml": `[project]
dependencies = [
  "pkg @ https://example.com/foo==1.2.3.whl",
]
`,
    },
    (dir) => {
      expectFindings(scan(dir), "pyproject.toml:3: dependency pkg is not an exact version\n");
    },
  );
});

test("a block scalar container is an image", async () => {
  await withFixture(
    {
      ".github/workflows/ci.yml": `jobs:
  build:
    container: |
      node:22
    steps:
      - run: echo hi
`,
    },
    (dir) => {
      expectFindings(
        scan(dir),
        ".github/workflows/ci.yml:4: image node:22 must contain @sha256:\n",
      );
    },
  );
});

test("skipped directories and non-target files are not scanned", async () => {
  const bad = packageJson("dependencies", "^1.0.0");
  await withFixture(
    {
      "node_modules/package.json": bad,
      ".git/package.json": bad,
      "dist/package.json": bad,
      Makefile: "pnpm install\nuv sync\n",
      "scripts/build-render.sh": "pnpm install\nuv sync\n",
    },
    (dir) => {
      expectClean(scan(dir));
    },
  );
});

test("findings are sorted by path, then line, then message", async () => {
  await withFixture(
    {
      "package.json": `{
  "dependencies": {
    "left-pad": "^1.0.0",
    "right-pad": "latest"
  }
}
`,
    },
    (dir) => {
      expectFindings(
        scan(dir),
        `package.json:3: dependency left-pad is not an exact version
package.json:4: dependency right-pad is not an exact version
`,
      );
    },
  );
  await withFixture(
    {
      "package.json": packageJson("dependencies", "^1.0.0"),
      "apps/package.json": packageJson("dependencies", "latest"),
    },
    (dir) => {
      expectFindings(
        scan(dir),
        `apps/package.json:3: dependency left-pad is not an exact version
package.json:3: dependency left-pad is not an exact version
`,
      );
    },
  );
});

test("the repo root is clean", () => {
  expectClean(scan(repoRoot));
});

test("paths and other argv print usage and do not scan", async () => {
  await withFixture({ "package.json": packageJson("dependencies", "^1.0.0") }, (dir) => {
    for (const args of [["."], ["--help"], ["--version", "--version"]]) {
      const result = scan(dir, args);
      assert.equal(result.status, 1);
      assert.equal(result.stdout, "");
      assert.equal(result.stderr, "usage: check-exact-versions --version\n");
    }
  });
});

test("symlinks are not followed", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "exact-versions-scan-"));
  const outside = await mkdtemp(path.join(tmpdir(), "exact-versions-link-"));
  try {
    await writeFile(path.join(outside, "package.json"), packageJson("dependencies", "^1.0.0"));
    await symlink(outside, path.join(dir, "linked"));
    await symlink(path.join(outside, "package.json"), path.join(dir, "package.json"));
    expectClean(scan(dir));
  } finally {
    await rm(dir, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  }
});

test("invalid package.json is unreadable", async () => {
  await withFixture({ "package.json": "{\n" }, (dir) => {
    expectFindings(scan(dir), "package.json:1: package-json is not valid\n");
  });
});
