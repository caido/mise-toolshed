# mise-toolshed

[mise](https://mise.jdx.dev/) backend plugin that installs the `toolshed:skills` tool: a `skills` command which syncs the bundled [`skills/`](skills/) tree into `.claude/skills`, `.agents/skills`, and `.cursor/skills` under the current working directory.

The canonical skill content for Caido’s AI operations lives in [ai-ops](https://github.com/caido/ai-ops); this repository packages those skills for consumers who install via mise.

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

That **replaces** the three skill directories so they match the bundled snapshot (`rsync` when available, otherwise a copy/remove pass so removed upstream skills disappear locally).

Versions from `mise ls-remote toolshed:skills` are git tags matching `v*` plus `latest` (commit `HEAD`). Install only from a git URL so the plugin clone retains `.git` metadata.

**Security:** mise plugins run arbitrary code during install and use—only install plugins from sources you trust ([mise plugin usage](https://mise.jdx.dev/plugin-usage.html)).

**PATH:** the executable is named `skills`. If that conflicts with another tool, use `mise exec toolshed:skills@… -- skills` or the absolute path under `~/.local/share/mise/installs/`.
