-- Backend plugin for `mise install toolshed:get-skills@…`
-- https://mise.jdx.dev/backend-plugin-development.html

PLUGIN = { -- luacheck: ignore
	name = "toolshed",
	version = "1.0.0",
	description = "Install toolshed tools: get-skills from git tags into one personal skills folder, and released tools from checksummed GitHub releases",
	author = "Caido",
	homepage = "https://github.com/caido/mise-toolshed",
	notes = {
		"get-skills versions are get-skills-v* tags on https://github.com/caido/mise-toolshed. With no such tags, latest is the plugin checkout.",
		"check-pins versions are check-pins-v* GitHub releases. The plugin verifies SHA256SUMS before it installs the file. node must be on PATH to run it.",
	},
}
