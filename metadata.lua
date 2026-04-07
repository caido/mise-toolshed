-- Backend plugin for `mise install toolshed:get-skills@…`
-- https://mise.jdx.dev/backend-plugin-development.html

PLUGIN = { -- luacheck: ignore
	name = "toolshed",
	version = "1.0.0",
	description = "Sync ai-ops skills/ into .claude/skills, .agents/skills, and .cursor/skills (clone + copy)",
	author = "Caido",
	homepage = "https://github.com/caido/mise-toolshed",
	notes = {
		"Requires the plugin to be a git clone (mise plugin install from git URL) so versions map to git refs.",
	},
}
