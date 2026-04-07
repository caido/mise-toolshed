# mise-toolshed

[mise](https://mise.jdx.dev/) backend plugin that installs the `toolshed:skills` tool: a `skills` command which syncs the [`skills/`](https://github.com/caido/ai-ops/tree/main/skills) tree from **[ai-ops](https://github.com/caido/ai-ops)** into `.claude/skills`, `.agents/skills`, and `.cursor/skills` under the current working directory.

On each run, the tool **clones or updates** a cache of the ai-ops repo (default: `~/.cache/mise-toolshed/ai-ops`), checks out a ref derived from your installed `toolshed:skills` version (or overrides below), then copies `skills/` into those agent directories.

## Register the plugin and tool

In the consumer repo’s `mise.toml`:

```toml
[plugins]
toolshed = "https://github.com/caido/mise-toolshed"

[tools]
"toolshed:skills" = "latest"
```

## Install and run

From the consumer project root:

```bash
mise install
mise exec toolshed:skills@latest -- skills
```

That **replaces** the three skill directories so they match the selected revision in ai-ops (`rsync` when available, otherwise a copy/remove pass so removed upstream skills disappear locally).

Versions from `mise ls-remote toolshed:skills` are git tags on **this** repo (`v*`) plus `latest`. For `latest`, the skills script tracks ai-ops `main` (or `master` if `main` is missing). For a pinned `toolshed:skills@v1.2.3`, the script tries the same ref name in ai-ops (e.g. tag `v1.2.3`); if it does not exist, it falls back to the default branch.

**Overrides (optional):**

| Variable | Purpose |
| -------- | ------- |
| `AI_OPS_SKILLS_REPO` | Git URL for ai-ops (default `https://github.com/caido/ai-ops.git`) |
| `AI_OPS_SKILLS_REF` | Force ref to checkout in ai-ops (e.g. `main`, `v1.0.0`) |
| `AI_OPS_SKILLS_CACHE` | Local clone path (default `$XDG_CACHE_HOME/mise-toolshed/ai-ops`) |

**Security:** mise plugins run arbitrary code during install and use; this tool runs `git` and copies files from the cloned repo—only use sources you trust ([mise plugin usage](https://mise.jdx.dev/plugin-usage.html)).

**PATH:** the executable is named `skills`. If that conflicts with another tool, use `mise exec toolshed:skills@… -- skills` or the absolute path under `~/.local/share/mise/installs/`.

**Requirement:** `git` must be on `PATH`.

If the ai-ops repository is private, set `AI_OPS_SKILLS_REPO` to an SSH URL (for example `git@github.com:caido/ai-ops.git`) or ensure your credential helper can clone `https://` without a TTY.

Install the plugin from a git URL so the plugin clone retains `.git` metadata for `mise ls-remote` / version installs.
