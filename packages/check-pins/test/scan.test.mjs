import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(packageRoot, "../..");
const bundlePath = path.join(packageRoot, "dist", "check-pins.mjs");
const sha = "0123456789abcdef0123456789abcdef01234567";

function scan(cwd, args = []) {
  return spawnSync(process.execPath, [bundlePath, ...args], { cwd, encoding: "utf8" });
}

async function withFixture(files, fn) {
  const dir = await mkdtemp(path.join(tmpdir(), "check-pins-scan-"));
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

test("npm ranges are rejected in every dependency map", async () => {
  const specs = ["^1.0.0", "~1.0.0", ">1.0.0", "<1.0.0", ">=1", "<=1", "*", "latest", "1.x", "1.2", "abc", "^1.2.3"];
  const sections = ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"];
  for (const section of sections) {
    for (const spec of specs) {
      await withFixture({ "package.json": packageJson(section, spec) }, (dir) => {
        expectFindings(
          scan(dir),
          `package.json:3: dependency left-pad is not an exact version\n`,
        );
      });
    }
  }
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
  const entries = specs.map((spec, index) => `    "pkg${index}": ${JSON.stringify(spec)}`).join(",\n");
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
"toolshed:check-pins" = "1.0.0"

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
    await withFixture(
      { "mise.toml": `[tools]\nnode = ${JSON.stringify(spec)}\n` },
      (dir) => {
        expectFindings(scan(dir), "mise.toml:2: tool node is not an exact version\n");
      },
    );
  }
});

test("a mise tool table must be a string", async () => {
  await withFixture(
    { "mise.toml": `[tools]\nnode = { version = "24.22.0" }\n` },
    (dir) => {
      expectFindings(scan(dir), "mise.toml:2: tool node must be a string\n");
    },
  );
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

test("dockerfile install commands are judged", async () => {
  await withFixture(
    {
      Dockerfile: `FROM scratch
RUN uv sync
RUN ["pnpm", "install"]
`,
    },
    (dir) => {
      expectFindings(
        scan(dir),
        `Dockerfile:2: uv command must set UV_LOCKED=1
Dockerfile:3: pnpm install must pass --frozen-lockfile
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
.github/workflows/ci.yml:5: action actions/checkout@${sha} must be a 40-hex SHA with a version comment
.github/workflows/ci.yml:6: action actions/checkout@${sha} must be a 40-hex SHA with a version comment
.github/workflows/ci.yml:8: image docker://alpine:3 must contain @sha256:
`,
      );
    },
  );
});

test("uv sync fails unless UV_LOCKED=1 is on the command", async () => {
  await withFixture(
    {
      ".github/workflows/ci.yml": `jobs:
  build:
    steps:
      - run: uv sync
`,
    },
    (dir) => {
      expectFindings(scan(dir), ".github/workflows/ci.yml:4: uv command must set UV_LOCKED=1\n");
    },
  );
  await withFixture(
    {
      ".github/workflows/ci.yml": `jobs:
  build:
    steps:
      - run: UV_LOCKED=1 uv sync
`,
    },
    (dir) => {
      expectClean(scan(dir));
    },
  );
});

test("uv --frozen is its own finding and still requires a lock", async () => {
  await withFixture(
    {
      ".github/workflows/ci.yml": `jobs:
  build:
    steps:
      - run: UV_LOCKED=1 uv sync --frozen
`,
    },
    (dir) => {
      expectFindings(scan(dir), ".github/workflows/ci.yml:4: uv command must not contain --frozen\n");
    },
  );
  await withFixture(
    {
      ".github/workflows/ci.yml": `jobs:
  build:
    steps:
      - run: uv sync --frozen
`,
    },
    (dir) => {
      expectFindings(
        scan(dir),
        `.github/workflows/ci.yml:4: uv command must not contain --frozen
.github/workflows/ci.yml:4: uv command must set UV_LOCKED=1
`,
      );
    },
  );
});

test("a run block reports the line that contains the command", async () => {
  await withFixture(
    {
      ".github/workflows/ci.yml": `jobs:
  build:
    steps:
      - run: |
          uv sync
          pnpm install
`,
    },
    (dir) => {
      expectFindings(
        scan(dir),
        `.github/workflows/ci.yml:5: uv command must set UV_LOCKED=1
.github/workflows/ci.yml:6: pnpm install must pass --frozen-lockfile
`,
      );
    },
  );
});

test("workflow env UV_LOCKED=1 covers the run", async () => {
  await withFixture(
    {
      ".github/workflows/ci.yml": `name: ci
env:
  UV_LOCKED: "1"
jobs:
  build:
    steps:
      - run: uv sync
`,
    },
    (dir) => {
      expectClean(scan(dir));
    },
  );
});

test("job and step env overlay the run and do not leak sideways", async () => {
  await withFixture(
    {
      ".github/workflows/ci.yml": `jobs:
  build:
    env:
      UV_LOCKED: "0"
    steps:
      - env:
          UV_LOCKED: "1"
        run: uv sync
`,
    },
    (dir) => {
      expectClean(scan(dir));
    },
  );
  await withFixture(
    {
      ".github/workflows/ci.yml": `jobs:
  a:
    steps:
      - env:
          UV_LOCKED: "1"
        run: uv sync
      - run: uv sync
  b:
    steps:
      - run: uv sync
`,
    },
    (dir) => {
      expectFindings(
        scan(dir),
        `.github/workflows/ci.yml:7: uv command must set UV_LOCKED=1
.github/workflows/ci.yml:10: uv command must set UV_LOCKED=1
`,
      );
    },
  );
});

test("a discovered mise UV_LOCKED=1 covers a package.json uv script", async () => {
  await withFixture(
    {
      "package.json": `{
  "scripts": {
    "build": "uv sync"
  }
}
`,
      "mise.toml": `[env]
UV_LOCKED = "1"
`,
    },
    (dir) => {
      expectClean(scan(dir));
    },
  );
});

test("no uv command produces no uv finding", async () => {
  await withFixture(
    {
      ".github/workflows/ci.yml": `jobs:
  build:
    steps:
      - run: echo hi
`,
    },
    (dir) => {
      expectClean(scan(dir));
    },
  );
});

test("pnpm install needs a frozen lockfile on the command or in some npmrc", async () => {
  await withFixture(
    {
      ".github/workflows/ci.yml": `jobs:
  build:
    steps:
      - run: pnpm install
      - run: pnpm -r install
`,
    },
    (dir) => {
      expectFindings(
        scan(dir),
        `.github/workflows/ci.yml:4: pnpm install must pass --frozen-lockfile
.github/workflows/ci.yml:5: pnpm install must pass --frozen-lockfile
`,
      );
    },
  );
  await withFixture(
    {
      ".github/workflows/ci.yml": `jobs:
  build:
    steps:
      - run: mise exec -- pnpm install --frozen-lockfile
`,
    },
    (dir) => {
      expectClean(scan(dir));
    },
  );
  await withFixture(
    {
      ".npmrc": "frozen-lockfile=true\n",
      ".github/workflows/ci.yml": `jobs:
  build:
    steps:
      - run: pnpm install
`,
    },
    (dir) => {
      expectClean(scan(dir));
    },
  );
});

test("pnpm i is an install and pnpm build is not", async () => {
  await withFixture(
    {
      ".github/workflows/ci.yml": `jobs:
  build:
    steps:
      - run: pnpm i
      - run: pnpm -r i
      - run: pnpm -r --if-present build
`,
    },
    (dir) => {
      expectFindings(
        scan(dir),
        `.github/workflows/ci.yml:4: pnpm install must pass --frozen-lockfile
.github/workflows/ci.yml:5: pnpm install must pass --frozen-lockfile
`,
      );
    },
  );
});

test("the last frozen-lockfile assignment in a file wins, and another file does not cancel true", async () => {
  await withFixture(
    {
      ".npmrc": "frozen-lockfile=true\nfrozen-lockfile=false\n",
      ".github/workflows/ci.yml": "jobs:\n  build:\n    steps:\n      - run: pnpm install\n",
    },
    (dir) => {
      expectFindings(
        scan(dir),
        ".github/workflows/ci.yml:4: pnpm install must pass --frozen-lockfile\n",
      );
    },
  );
  await withFixture(
    {
      "a/.npmrc": "frozen-lockfile=false\n",
      "b/.npmrc": "frozen-lockfile=true\n",
      ".github/workflows/ci.yml": "jobs:\n  build:\n    steps:\n      - run: pnpm install\n",
    },
    (dir) => {
      expectClean(scan(dir));
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

test("comment-only workflow keys still open jobs, steps, and env", async () => {
  await withFixture(
    {
      ".github/workflows/ci.yml": `jobs: # release
  build: # typecheck
    steps: # install
      - uses: actions/checkout@v6.0.3
`,
    },
    (dir) => {
      expectFindings(
        scan(dir),
        ".github/workflows/ci.yml:4: action actions/checkout@v6.0.3 must be a 40-hex SHA with a version comment\n",
      );
    },
  );
});

test("a workflow run joins backslash continuations before judging the command", async () => {
  await withFixture(
    {
      ".github/workflows/ci.yml": `jobs:
  build:
    steps:
      - run: |
          pnpm \\
            install
`,
    },
    (dir) => {
      expectFindings(
        scan(dir),
        ".github/workflows/ci.yml:5: pnpm install must pass --frozen-lockfile\n",
      );
    },
  );
  await withFixture(
    {
      ".github/workflows/ci.yml": `jobs:
  build:
    steps:
      - run: |
          pnpm install \\
            --frozen-lockfile
`,
    },
    (dir) => {
      expectClean(scan(dir));
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

test("service and container env do not lock a job step", async () => {
  await withFixture(
    {
      ".github/workflows/ci.yml": `jobs:
  build:
    services:
      db:
        image: postgres:16@sha256:abc
        env:
          UV_LOCKED: "1"
    container:
      env:
        UV_LOCKED: "1"
      image: node:22@sha256:abc
    steps:
      - run: uv sync
`,
    },
    (dir) => {
      expectFindings(scan(dir), ".github/workflows/ci.yml:13: uv command must set UV_LOCKED=1\n");
    },
  );
});

test("UV_LOCKED quotes and an earlier export in the same script count", async () => {
  await withFixture(
    {
      ".github/workflows/ci.yml": `jobs:
  build:
    steps:
      - run: UV_LOCKED="1" uv sync
      - run: export UV_LOCKED=1 && uv sync
`,
    },
    (dir) => {
      expectClean(scan(dir));
    },
  );
});

test("mise UV_LOCKED covers package scripts and mise commands only", async () => {
  await withFixture(
    {
      "mise.toml": `[env]
UV_LOCKED = "1"
`,
      Dockerfile: "FROM scratch\nRUN uv sync\n",
      ".github/workflows/ci.yml": `jobs:
  build:
    steps:
      - run: uv sync
      - run: mise exec -- uv sync
`,
    },
    (dir) => {
      expectFindings(
        scan(dir),
        `.github/workflows/ci.yml:4: uv command must set UV_LOCKED=1
Dockerfile:2: uv command must set UV_LOCKED=1
`,
      );
    },
  );
});

test("pnpm install is the pnpm token followed by install", async () => {
  await withFixture(
    {
      ".github/workflows/ci.yml": `jobs:
  build:
    steps:
      - run: apt-get install -y pnpm
      - run: pnpm install --frozen-lockfile=false
      - run: pnpm install --frozen-lockfile --no-frozen-lockfile
      - run: pnpm install --no-frozen-lockfile --frozen-lockfile
`,
    },
    (dir) => {
      expectFindings(
        scan(dir),
        `.github/workflows/ci.yml:5: pnpm install must pass --frozen-lockfile
.github/workflows/ci.yml:6: pnpm install must pass --frozen-lockfile
`,
      );
    },
  );
});

test("a dockerfile comment inside a continuation stays in the same instruction", async () => {
  await withFixture(
    {
      Dockerfile: `FROM scratch
RUN apt-get update && \\
    # install deps
    pnpm install
RUN echo hi && \\

    # uv sync
    echo done
`,
    },
    (dir) => {
      expectFindings(scan(dir), "Dockerfile:4: pnpm install must pass --frozen-lockfile\n");
    },
  );
});

test("steps at the same indent as the steps key are scanned", async () => {
  await withFixture(
    {
      ".github/workflows/ci.yml": `jobs:
  build:
    steps:
    - uses: actions/checkout@v6.0.3
`,
    },
    (dir) => {
      expectFindings(
        scan(dir),
        ".github/workflows/ci.yml:4: action actions/checkout@v6.0.3 must be a 40-hex SHA with a version comment\n",
      );
    },
  );
});

test("an explicit negated frozen-lockfile flag overrides npmrc", async () => {
  await withFixture(
    {
      ".npmrc": "frozen-lockfile=true\n",
      ".github/workflows/ci.yml": `jobs:
  build:
    steps:
      - run: pnpm install --no-frozen-lockfile
      - run: pnpm install --frozen-lockfile=false
      - run: pnpm install
`,
    },
    (dir) => {
      expectFindings(
        scan(dir),
        `.github/workflows/ci.yml:4: pnpm install must pass --frozen-lockfile
.github/workflows/ci.yml:5: pnpm install must pass --frozen-lockfile
`,
      );
    },
  );
});

test("UV_LOCKED carries across segments only when it is exported", async () => {
  await withFixture(
    {
      ".github/workflows/ci.yml": `jobs:
  build:
    steps:
      - run: UV_LOCKED=1 && uv sync
      - run: echo UV_LOCKED=1 && uv sync
      - run: UV_LOCKED=1 uv lock && uv sync
      - run: export UV_LOCKED=1 && uv sync
      - run: declare -x UV_LOCKED=1 && uv sync
`,
    },
    (dir) => {
      expectFindings(
        scan(dir),
        `.github/workflows/ci.yml:4: uv command must set UV_LOCKED=1
.github/workflows/ci.yml:5: uv command must set UV_LOCKED=1
.github/workflows/ci.yml:6: uv command must set UV_LOCKED=1
`,
      );
    },
  );
});

test("a piped scan returns every finding line", async () => {
  const deps = Array.from({ length: 2000 }, (_, index) => `    "pkg${index}": "^1.0.0"`).join(",\n");
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

test("a continued dockerfile command is one command", async () => {
  await withFixture(
    {
      Dockerfile: `FROM scratch
RUN pnpm \\
  install
RUN UV_LOCKED=1 uv sync \\
  --frozen
`,
    },
    (dir) => {
      expectFindings(
        scan(dir),
        `Dockerfile:2: pnpm install must pass --frozen-lockfile
Dockerfile:4: uv command must not contain --frozen
`,
      );
    },
  );
  await withFixture(
    {
      ".npmrc": "frozen-lockfile=true\n",
      Dockerfile: `FROM scratch
RUN pnpm install \\
  --no-frozen-lockfile
`,
    },
    (dir) => {
      expectFindings(scan(dir), "Dockerfile:2: pnpm install must pass --frozen-lockfile\n");
    },
  );
});

test("a folded workflow run is one command", async () => {
  await withFixture(
    {
      ".github/workflows/ci.yml": `jobs:
  build:
    steps:
      - run: >
          pnpm
          install
      - run: >
          UV_LOCKED=1 uv sync
          --frozen
`,
    },
    (dir) => {
      expectFindings(
        scan(dir),
        `.github/workflows/ci.yml:5: pnpm install must pass --frozen-lockfile
.github/workflows/ci.yml:8: uv command must not contain --frozen
`,
      );
    },
  );
});

test("a shell comment is not a pin", async () => {
  await withFixture(
    {
      ".github/workflows/ci.yml": `jobs:
  build:
    steps:
      - run: uv sync # UV_LOCKED=1
      - run: UV_LOCKED=1 uv sync # --frozen
      - run: pnpm install # --frozen-lockfile
`,
    },
    (dir) => {
      expectFindings(
        scan(dir),
        `.github/workflows/ci.yml:4: uv command must set UV_LOCKED=1
.github/workflows/ci.yml:6: pnpm install must pass --frozen-lockfile
`,
      );
    },
  );
});

test("UV_LOCKED after the uv token does not lock the command", async () => {
  await withFixture(
    {
      ".github/workflows/ci.yml": `jobs:
  build:
    steps:
      - run: uv sync UV_LOCKED=1
`,
    },
    (dir) => {
      expectFindings(scan(dir), ".github/workflows/ci.yml:4: uv command must set UV_LOCKED=1\n");
    },
  );
});

test("a direct python url is not an exact pin when it contains ==" , async () => {
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

test("an anchor on steps or a job still opens the block", async () => {
  await withFixture(
    {
      ".github/workflows/ci.yml": `jobs: &all
  build: &job
    steps: &steps
      - uses: actions/checkout@v6.0.3
`,
    },
    (dir) => {
      expectFindings(
        scan(dir),
        ".github/workflows/ci.yml:4: action actions/checkout@v6.0.3 must be a 40-hex SHA with a version comment\n",
      );
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
      expectFindings(scan(dir), ".github/workflows/ci.yml:4: image node:22 must contain @sha256:\n");
    },
  );
});

test("a folded run keeps a blank line as a command break", async () => {
  await withFixture(
    {
      ".github/workflows/ci.yml": `jobs:
  build:
    steps:
      - run: >
          pnpm install

          pnpm install --frozen-lockfile
`,
    },
    (dir) => {
      expectFindings(scan(dir), ".github/workflows/ci.yml:5: pnpm install must pass --frozen-lockfile\n");
    },
  );
});

test("a run alias replays each anchored script on its own", async () => {
  await withFixture(
    {
      ".github/workflows/ci.yml": `jobs:
  build:
    steps:
      - run: &locked >
          export UV_LOCKED=1 &&
          uv sync
      - run: *locked
      - run: &lines |
          export UV_LOCKED=1
          uv sync
      - run: *lines
`,
    },
    (dir) => {
      expectFindings(
        scan(dir),
        `.github/workflows/ci.yml:10: uv command must set UV_LOCKED=1
.github/workflows/ci.yml:11: uv command must set UV_LOCKED=1
`,
      );
    },
  );
});

test("a run anchor and its alias are both scanned", async () => {
  await withFixture(
    {
      ".github/workflows/ci.yml": `jobs:
  build:
    steps:
      - run: &install |
          pnpm install
      - run: *install
      - run: *missing
`,
    },
    (dir) => {
      expectFindings(
        scan(dir),
        `.github/workflows/ci.yml:5: pnpm install must pass --frozen-lockfile
.github/workflows/ci.yml:6: pnpm install must pass --frozen-lockfile
.github/workflows/ci.yml:7: workflow is not valid
`,
      );
    },
  );
});

test("a hash inside a shell word is not a comment", async () => {
  await withFixture(
    {
      ".github/workflows/ci.yml": `jobs:
  build:
    steps:
      - run: echo pkg#rev && pnpm install
`,
    },
    (dir) => {
      expectFindings(scan(dir), ".github/workflows/ci.yml:4: pnpm install must pass --frozen-lockfile\n");
    },
  );
});

test("an escaped pnpm token is still pnpm", async () => {
  await withFixture(
    {
      ".github/workflows/ci.yml": `jobs:
  build:
    steps:
      - run: \\pnpm install
`,
    },
    (dir) => {
      expectFindings(scan(dir), ".github/workflows/ci.yml:4: pnpm install must pass --frozen-lockfile\n");
    },
  );
});

test("a background pnpm install is still an install", async () => {
  await withFixture(
    {
      ".github/workflows/ci.yml": `jobs:
  build:
    steps:
      - run: pnpm install&
`,
    },
    (dir) => {
      expectFindings(scan(dir), ".github/workflows/ci.yml:4: pnpm install must pass --frozen-lockfile\n");
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
      assert.equal(result.stderr, "usage: check-pins --version\n");
    }
  });
});

test("symlinks are not followed", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "check-pins-scan-"));
  const outside = await mkdtemp(path.join(tmpdir(), "check-pins-link-"));
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
