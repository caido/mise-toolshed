# mise-toolshed

[mise](https://mise.jdx.dev/) backend plugin that installs the `toolshed:get-skills` tool: a `get-skills` command which syncs the [`skills/`](https://github.com/caido/ai-ops/tree/main/skills) tree from **[ai-ops](https://github.com/caido/ai-ops)** into `.claude/skills`, `.agents/skills`, and `.cursor/skills` under a chosen root directory.

`mise install` copies the plugin’s **`bin/get-skills`** into the tool install (same path). The default clone URL is **`https://github.com/caido/ai-ops`**; the destination root defaults to **`$PWD`** (override with **`SKILLS_DESTINATION`** or **`--destination`**). Run **`bin/get-skills`** from a checkout of this repo without mise.

On each run, the tool **clones or updates** a cache of that repo (default: `~/.cache/mise-toolshed/ai-ops`), checks out a ref (default branch, or overrides below), then copies `skills/` into the three agent paths under the destination root.

## Register the plugin and tool

In the consumer repo’s `mise.toml`:

```toml
[plugins]
toolshed = "https://github.com/caido/mise-toolshed"

[tools]
"toolshed:get-skills" = "latest"
```

The older name **`toolshed:skills`** (command **`skills`**) is still accepted by the plugin so existing configs keep working; prefer **`toolshed:get-skills`** for new setups.

## Install and run

From the consumer project root:

```bash
mise install
mise exec toolshed:get-skills@latest -- get-skills
```

That **replaces** the three skill directories so they match the selected revision in ai-ops (`rsync` when available, otherwise a copy/remove pass so removed upstream skills disappear locally).

`mise ls-remote toolshed:get-skills` only reports **`latest`**—there is no separate toolshed version; the revision of skills comes from ai-ops (`main` / `master`, or `AI_OPS_SKILLS_REF`).

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

Install the plugin from a git URL so mise can clone and resolve the plugin source.
