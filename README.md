# mise-toolshed

[mise](https://mise.jdx.dev/) backend plugin that installs small utility tools.

Provided tools:

- **`toolshed:check-exact-versions`**, **`toolshed:check-lockfiles`**, and **`toolshed:check-minimum-release-age`**: released commands. Pushing `<tool>-v<semver>` publishes `<tool>.mjs` and `SHA256SUMS`. The plugin downloads that release and refuses the install when the SHA-256 does not match. Each tool is first released as `1.0.0`.
- **`toolshed:get-skills`**: a `get-skills` command which installs the [`skills/`](https://github.com/caido/ai-ops/tree/main/skills) tree from **[ai-ops](https://github.com/caido/ai-ops)** into one personal folder you choose.

## Released check tools

`node` must be on `PATH` when a check tool runs. A consumer without `node` adds an exact `node` version to `[tools]`.

```toml
[plugins]
toolshed = "https://github.com/caido/mise-toolshed#<40-hex sha>"

[tools]
"toolshed:check-exact-versions" = "1.0.0"
"toolshed:check-lockfiles" = "1.0.0"
"toolshed:check-minimum-release-age" = "1.0.0"
```

`mise ls-remote toolshed:<tool>` lists bare versions from `<tool>-v*` tags, oldest first. It does not list `latest`. `mise install` downloads `<tool>.mjs` and `SHA256SUMS` from `https://github.com/caido/mise-toolshed/releases/download/<tool>-v<version>/`, checks the digest, and installs the file as `<tool>` on `PATH`.

`check-pins` is not installed anymore. `mise ls-remote toolshed:check-pins` still lists the published tag, and `mise exec` still runs a copy that is already on disk. `mise install` refuses it.

`check-exact-versions` enforces [STD-006](https://github.com/caido/engineering/blob/main/standards/STD-006-exact-versions.md). What it flags is in [packages/check-exact-versions/README.md](packages/check-exact-versions/README.md). `check-lockfiles` is the [STD-007](https://github.com/caido/engineering/blob/main/standards/STD-007-lockfiles.md) tool and has no rules yet. `check-minimum-release-age` enforces [STD-008](https://github.com/caido/engineering/blob/main/standards/STD-008-minimum-release-age.md). What it flags is in [packages/check-minimum-release-age/README.md](packages/check-minimum-release-age/README.md). `packages/shared` is private and is not released.

## Publish a release

Publish a workspace package from the Release workflow on the default branch. Set `tool` to the directory name under `packages/`. The workflow reads `version` from that package's `package.json`, creates the tag `<tool>-v<version>` on the selected commit, and uploads `<tool>.mjs` and `SHA256SUMS` in the same run.

```bash
gh workflow run release.yml --ref main -f tool=check-exact-versions
```

The run stops when that tag already exists or a published release already exists. It does not move an existing tag.

You can still publish by pushing the tag.

```bash
git tag check-exact-versions-v1.0.0 && git push origin check-exact-versions-v1.0.0
```

`get-skills` stays a git tag. Push `get-skills-v<version>` yourself. The Release workflow does not upload assets for that tag.

## get-skills

`latest` installs the newest `get-skills-v*` tag. In a mise home that already has get-skills installed, `mise install` can keep that version. `mise exec toolshed:get-skills@latest -- get-skills` installs and runs the newest tag. Before any such tag exists, `latest` copies the checkout's `bin/get-skills`. A pin `x.y.z` installs `bin/get-skills` from tag `get-skills-vx.y.z` on `https://github.com/caido/mise-toolshed`. The default clone URL is **`https://github.com/caido/ai-ops`**. Run **`bin/get-skills`** from a checkout of this repo without mise.

On each run, the tool asks which personal folder to use. It then **clones or updates** a cache of that repo (default: `~/.cache/mise-toolshed/ai-ops`), checks out a ref (default branch, or overrides below), and copies skill directories into the folder you chose.

## Register the plugin and tool

In the consumer repo’s `mise.toml`:

```toml
[plugins]
toolshed = "https://github.com/caido/mise-toolshed"

[tools]
"toolshed:get-skills" = "latest"
```

A pinned release uses a bare version.

```toml
"toolshed:get-skills" = "1.0.0"
```

Publish that tag from a checkout of this repo.

```bash
git tag get-skills-v1.0.0 && git push origin get-skills-v1.0.0
```

## Install and run

From the consumer project root:

```bash
mise install
mise exec toolshed:get-skills@latest -- get-skills
```

`get-skills` reads one line from stdin. The line chooses the install folder.

1. `$HOME/.cursor/skills`
2. `$HOME/.claude/skills`
3. `$HOME/.agents/skills`

The prompt prints those absolute paths. `1`, `2`, and `3` are the only accepted answers. An empty line, end of input, or any other answer exits with status 1. There is no default folder. No flag and no environment variable skips the prompt. Any argument other than `--url` is an unknown argument and exits with status 1.

The tool writes `.toolshed-get-skills` in the chosen folder, one owned skill name per line. A later run replaces those owned directories from upstream and removes an owned name that upstream removed. Every other file and directory in the chosen folder stays. The tool does not create or read the two folders you did not choose.

If a skill name from upstream is already in the folder and is not listed in `.toolshed-get-skills`, the run exits with status 1. It does not create, replace, or remove any skill directory. Move that personal directory aside and run `get-skills` again.

`mise ls-remote toolshed:get-skills` lists bare versions from `get-skills-v*` tags, oldest first. With no such tags it lists `latest`. The ai-ops revision is still the default branch or `AI_OPS_SKILLS_REF`.

**Overrides (optional):**

| Variable              | Purpose                                                                 |
| --------------------- | ----------------------------------------------------------------------- |
| `AI_OPS_SKILLS_REF`   | Force ref to checkout in ai-ops (e.g. `main`, `v1.0.0`)                 |
| `AI_OPS_SKILLS_CACHE` | Local clone cache path (default `$XDG_CACHE_HOME/mise-toolshed/ai-ops`) |

**Security:** mise plugins run arbitrary code during install and use; this tool runs `git` and copies files from the cloned repo—only use sources you trust ([mise plugin usage](https://mise.jdx.dev/plugin-usage.html)).

**PATH:** the executable is named `get-skills`. If that conflicts with another tool, use `mise exec toolshed:get-skills@… -- get-skills` or the absolute path under `~/.local/share/mise/installs/`.

**Requirement:** `git` must be on `PATH`.

If the ai-ops repository is private, ensure your Git credential helper can clone `https://github.com/caido/ai-ops` without a TTY, or use SSH via your Git URL rewrites.

**First clone looks stuck:** The first run does a **shallow** clone (`--depth 1`) with **`--progress`** so you should see `Receiving objects` / `Resolving deltas`. A large monorepo can still take several minutes. If it never advances past `0%`, check network, VPN, or auth (private repo). Remove a bad partial clone with `rm -rf "$AI_OPS_SKILLS_CACHE"` (default `~/.cache/mise-toolshed/ai-ops`) and retry.

Install the plugin from a git URL so mise can clone and resolve the plugin source.

## Agent skills

`.mise/config.toml` pins the Skills CLI (`npm:skills`) at `1.7.2`. That package needs Node >= 22.20.0. The `node` pin in this repo is 24.22.0.

`.agents/skills/` holds `domain-modeling`, `grilling`, `grill-with-docs`, `codebase-design`, `code-review`, and `tdd` from `skills/` in [caido/ai-ops](https://github.com/caido/ai-ops). `skills-lock.json` records the commit. This command installs those six, with telemetry off and no TTY:

```bash
DISABLE_TELEMETRY=1 DO_NOT_TRACK=1 npx --yes skills@1.7.2 add "caido/ai-ops/skills#a420dd187be1b9dbc3246fe9dcfa4ba85e3e9cab" --skill domain-modeling --skill grilling --skill grill-with-docs --skill codebase-design --skill code-review --skill tdd -a cursor --copy -y </dev/null
```

## Checks

These commands match the CI jobs. Each one installs dependencies from the lockfile first. `mise run test` also builds, because the tool tests run the built bundles.

- `mise run typecheck` reports type errors.
- `mise run lint` reports lint errors and does not change files.
- `mise run build` builds each package.
- `mise run test` builds, then runs the tests.
- `mise run format` reports files that are not formatted and does not change them.
- `mise run format-fix` writes the formatted files.

`mise run format` is the CI job. `mise run format-fix` is the local command that writes.

## Repository layout

Plugin files are at the repository root. Workspace packages are under `packages/`.

- `metadata.lua` declares the mise plugin toolshed.
- `hooks/` has the mise backend entry points `backend_install.lua`, `backend_list_versions.lua`, and `backend_exec_env.lua`.
- `bin/get-skills` is the script mise installs.
- `lib/get_skills_release.lua` lists and installs get-skills versions from this repo.
- `lib/version_order.lua` orders version strings for get-skills and released tools.
- `lib/released_tool.lua` lists and installs released tools from checksummed GitHub releases.
- `packages/shared` is private scanner code. It has no build and it is not released.
- `packages/check-exact-versions`, `packages/check-lockfiles`, and `packages/check-minimum-release-age` are private CLIs. What `check-exact-versions` checks is in [packages/check-exact-versions/README.md](packages/check-exact-versions/README.md). What `check-minimum-release-age` checks is in [packages/check-minimum-release-age/README.md](packages/check-minimum-release-age/README.md).
- `scripts/build-package.mjs` bundles a package.
- `test/get-skills-remote.sh` covers get-skills tag listing.
- `test/get-skills-sync.sh` covers the personal-folder install.
- `test/release-plan.test.ts` and `test/released-tool.test.ts` cover release planning and checksummed installs.
- `test/stage-release.test.ts` drives `scripts/stage-release.sh`, and `.cursor/skills/verify-toolshed/SKILL.md` drives check-pins, get-skills, and that script.
