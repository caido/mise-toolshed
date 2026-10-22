-- Backend plugin for `mise install toolshed:get-skills@…`
-- https://mise.jdx.dev/backend-plugin-development.html

PLUGIN = { -- luacheck: ignore
	name = "toolshed",
	version = "1.0.0",
	description = "Sync ai-ops skills/ into .claude/skills, .agents/skills, and .cursor/skills (clone + copy)",
	author = "Caido",
	homepage = "https://github.com/caido/mise-toolshed",
	notes = {
		"get-skills versions are get-skills-v* tags on https://github.com/caido/mise-toolshed. With no such tags, latest is the plugin checkout.",
	},
}
