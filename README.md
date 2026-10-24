# mise-toolshed

[mise](https://mise.jdx.dev/) backend plugin that installs small utility tools.

Provided tools:

- **`toolshed:check-pins`**: a released `check-pins` command. Pushing `check-pins-v<semver>` publishes `check-pins.mjs` and `SHA256SUMS`. The plugin downloads that release and refuses the install when the SHA-256 does not match.
- **`toolshed:get-skills`**: a `get-skills` command which installs the [`skills/`](https://github.com/caido/ai-ops/tree/main/skills) tree from **[ai-ops](https://github.com/caido/ai-ops)** into one personal folder you choose.

## check-pins

`node` must be on `PATH` when `check-pins` runs. A consumer without `node` adds an exact `node` version to `[tools]`.

```toml
[plugins]
toolshed = "https://github.com/caido/mise-toolshed#<40-hex sha>"

[tools]
"toolshed:check-pins" = "1.0.0"
```

`mise ls-remote toolshed:check-pins` lists bare versions from `check-pins-v*` tags, oldest first. It does not list `latest`. `mise install` downloads `check-pins.mjs` and `SHA256SUMS` from `https://github.com/caido/mise-toolshed/releases/download/check-pins-v<version>/`, checks the digest, and installs the file as `check-pins` on `PATH`.

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

| Variable | Purpose |
| -------- | ------- |
| `AI_OPS_SKILLS_REF` | Force ref to checkout in ai-ops (e.g. `main`, `v1.0.0`) |
| `AI_OPS_SKILLS_CACHE` | Local clone cache path (default `$XDG_CACHE_HOME/mise-toolshed/ai-ops`) |

**Security:** mise plugins run arbitrary code during install and use; this tool runs `git` and copies files from the cloned repo—only use sources you trust ([mise plugin usage](https://mise.jdx.dev/plugin-usage.html)).

**PATH:** the executable is named `get-skills`. If that conflicts with another tool, use `mise exec toolshed:get-skills@… -- get-skills` or the absolute path under `~/.local/share/mise/installs/`.

**Requirement:** `git` must be on `PATH`.

If the ai-ops repository is private, ensure your Git credential helper can clone `https://github.com/caido/ai-ops` without a TTY, or use SSH via your Git URL rewrites.

**First clone looks stuck:** The first run does a **shallow** clone (`--depth 1`) with **`--progress`** so you should see `Receiving objects` / `Resolving deltas`. A large monorepo can still take several minutes. If it never advances past `0%`, check network, VPN, or auth (private repo). Remove a bad partial clone with `rm -rf "$AI_OPS_SKILLS_CACHE"` (default `~/.cache/mise-toolshed/ai-ops`) and retry.

Install the plugin from a git URL so mise can clone and resolve the plugin source.

## Repository layout

Plugin files are at the repository root. Workspace packages are under `packages/`.

- `metadata.lua` declares the mise plugin toolshed.
- `hooks/` has the mise backend entry points `backend_install.lua`, `backend_list_versions.lua`, and `backend_exec_env.lua`.
- `bin/get-skills` is the script mise installs.
- `lib/get_skills_release.lua` lists and installs get-skills versions from this repo.
- `lib/version_order.lua` orders version strings for get-skills and released tools.
- `lib/released_tool.lua` lists and installs released tools from checksummed GitHub releases.
- `packages/check-pins` is the only package under `packages/`.
- `packages/check-pins` is a private CLI that prints its version.
- `scripts/build-package.mjs` bundles a package.
- `test/get-skills-remote.sh` covers get-skills tag listing.
- `test/get-skills-sync.sh` covers the personal-folder install.
- `test/release-plan.test.ts` and `test/released-tool.test.ts` cover release planning and checksummed installs.
