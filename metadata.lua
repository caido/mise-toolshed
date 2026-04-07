-- Backend plugin for `mise install toolshed:skills@…`
-- https://mise.jdx.dev/backend-plugin-development.html

PLUGIN = { -- luacheck: ignore
	name = "toolshed",
	version = "1.0.0",
	description = "Install shared agent skills into .claude/skills, .agents/skills, and .cursor/skills",
	author = "Caido",
	homepage = "https://github.com/caido/mise-toolshed",
	notes = {
		"Requires the plugin to be a git clone (mise plugin install from git URL) so versions map to git refs.",
	},
}
