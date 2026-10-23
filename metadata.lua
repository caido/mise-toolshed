-- Backend plugin for `mise install toolshed:get-skills@…`
-- https://mise.jdx.dev/backend-plugin-development.html

PLUGIN = { -- luacheck: ignore
	name = "toolshed",
	version = "1.0.0",
	description = "Install ai-ops skills into one personal folder: ~/.cursor/skills, ~/.claude/skills, or ~/.agents/skills",
	author = "Caido",
	homepage = "https://github.com/caido/mise-toolshed",
	notes = {
		"get-skills versions are get-skills-v* tags on https://github.com/caido/mise-toolshed. With no such tags, latest is the plugin checkout.",
	},
}
