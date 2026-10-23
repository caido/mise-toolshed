# mise-toolshed

[mise](https://mise.jdx.dev/) backend plugin that installs small utility tools.

Currently provided tools:

- **`toolshed:get-skills`**: a `get-skills` command which syncs the [`skills/`](https://github.com/caido/ai-ops/tree/main/skills) tree from **[ai-ops](https://github.com/caido/ai-ops)** into `.claude/skills`, `.agents/skills`, and `.cursor/skills` under a chosen root directory.

`latest` installs the newest `get-skills-v*` tag. In a mise home that already has get-skills installed, `mise install` can keep that version. `mise exec toolshed:get-skills@latest -- get-skills` installs and runs the newest tag. Before any such tag exists, `latest` copies the checkout's `bin/get-skills`. A pin `x.y.z` installs `bin/get-skills` from tag `get-skills-vx.y.z` on `https://github.com/caido/mise-toolshed`. The default clone URL is **`https://github.com/caido/ai-ops`**; the destination root defaults to **`$PWD`** (override with **`SKILLS_DESTINATION`** or **`--destination`**). Run **`bin/get-skills`** from a checkout of this repo without mise.

On each run, the tool **clones or updates** a cache of that repo (default: `~/.cache/mise-toolshed/ai-ops`), checks out a ref (default branch, or overrides below), then copies `skills/` into the three agent paths under the destination root.

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

That **replaces** the three skill directories so they match the selected revision in ai-ops (`rsync` when available, otherwise a copy/remove pass so removed upstream skills disappear locally).

`mise ls-remote toolshed:get-skills` lists bare versions from `get-skills-v*` tags, oldest first. With no such tags it lists `latest`. The ai-ops revision is still the default branch or `AI_OPS_SKILLS_REF`.

**Overrides (optional):**

| Variable | Purpose |
| -------- | ------- |
| `SKILLS_DESTINATION` | Root directory for `.claude/skills`, etc. (default: `$PWD` when `get-skills` runs) |
| `AI_OPS_SKILLS_REF` | Force ref to checkout in ai-ops (e.g. `main`, `v1.0.0`) |
| `AI_OPS_SKILLS_CACHE` | Local clone cache path (default `$XDG_CACHE_HOME/mise-toolshed/ai-ops`) |

**Security:** mise plugins run arbitrary code during install and use; this tool runs `git` and copies files from the cloned repo—only use sources you trust ([mise plugin usage](https://mise.jdx.dev/plugin-usage.html)).

**PATH:** the executable is named `get-skills`. If that conflicts with another tool, use `mise exec toolshed:get-skills@… -- get-skills` or the absolute path under `~/.local/share/mise/installs/`.

**Requirement:** `git` must be on `PATH`.

If the ai-ops repository is private, ensure your Git credential helper can clone `https://github.com/caido/ai-ops` without a TTY, or use SSH via your Git URL rewrites.

**First clone looks stuck:** The first run does a **shallow** clone (`--depth 1`) with **`--progress`** so you should see `Receiving objects` / `Resolving deltas`. A large monorepo can still take several minutes. If it never advances past `0%`, check network, VPN, or auth (private repo). Remove a bad partial clone with `rm -rf "$AI_OPS_SKILLS_CACHE"` (default `~/.cache/mise-toolshed/ai-ops`) and retry.

Install the plugin from a git URL so mise can clone and resolve the plugin source.
