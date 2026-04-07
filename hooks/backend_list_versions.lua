--- Lists available versions for toolshed:skills (git tags + latest)
--- @param ctx { tool: string, options: table }
--- @return { versions: string[] }
function PLUGIN:BackendListVersions(ctx)
	local cmd = require("cmd")
	local file = require("file")

	if ctx.tool ~= "skills" then
		error("unknown tool: " .. tostring(ctx.tool) .. " (only 'skills' is supported)")
	end

	local plugin_dir = RUNTIME.pluginDirPath
	local git_dir = file.join_path(plugin_dir, ".git")
	if not file.exists(git_dir) then
		error(
			"toolshed mise plugin requires a git clone with .git metadata. "
				.. "Reinstall with: mise plugin install toolshed https://github.com/caido/mise-toolshed"
		)
	end

	local quoted = '"' .. plugin_dir:gsub('"', '\\"') .. '"'
	local list_cmd = "git -C " .. quoted .. " tag -l \"v*\" --sort=version:refname 2>/dev/null"
	local tags_out = cmd.exec(list_cmd) or ""

	local versions = {}
	for line in tags_out:gmatch("[^\r\n]+") do
		if line ~= "" then
			table.insert(versions, line)
		end
	end

	table.insert(versions, "latest")

	return { versions = versions }
end
