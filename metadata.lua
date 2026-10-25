-- Backend plugin for `mise install toolshed:get-skills@…`
-- https://mise.jdx.dev/backend-plugin-development.html

PLUGIN = { -- luacheck: ignore
	name = "toolshed",
	version = "1.0.0",
	description = "Install toolshed tools from checksummed GitHub releases",
	author = "Caido",
	homepage = "https://github.com/caido/mise-toolshed",
	notes = {
		"get-skills, check-exact-versions, check-lockfiles, and check-minimum-release-age versions are <tool>-v* GitHub releases. The plugin verifies SHA256SUMS before it installs <tool>.mjs.",
		"With no get-skills tag, latest copies packages/get-skills/dist/get-skills.mjs from the plugin checkout.",
		"node must be on PATH to run the tools. get-skills also needs git on PATH when it clones ai-ops.",
	},
}
