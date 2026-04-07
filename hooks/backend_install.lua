--- Writes bin/skills wrapper that invokes scripts/skills with fixed --url and runtime --destination.
--- @param ctx { tool: string, install_path: string }
--- @return table
function PLUGIN:BackendInstall(ctx)
	local cmd = require("cmd")
	local file = require("file")

	if ctx.tool ~= "skills" then
		error("unknown tool: " .. tostring(ctx.tool) .. " (only 'skills' is supported)")
	end

	local install_path = ctx.install_path
	if not install_path or install_path == "" then
		error("install_path cannot be empty")
	end

	local plugin_dir = RUNTIME.pluginDirPath
	local skills_script = file.join_path(plugin_dir, "scripts", "skills")
	if not file.exists(skills_script) then
		error("plugin is missing scripts/skills at " .. skills_script)
	end

	local bin_dir = file.join_path(install_path, "bin")
	cmd.exec("mkdir -p " .. '"' .. bin_dir:gsub('"', '\\"') .. '"')

	local url = "https://github.com/caido/ai-ops"
	local q_script = "'" .. skills_script:gsub("'", "'\\''") .. "'"
	local q_url = "'" .. url:gsub("'", "'\\''") .. "'"

	local wrapper = table.concat({
		"#!/usr/bin/env sh",
		"set -e",
		"exec " .. q_script .. " \\",
		'  --url ' .. q_url .. " \\",
		'  --destination "${SKILLS_DESTINATION:-$PWD}"',
		"",
	}, "\n")

	local bin_dst = file.join_path(install_path, "bin", "skills")
	local out, open_err = io.open(bin_dst, "wb")
	if not out then
		error("failed to write " .. bin_dst .. ": " .. tostring(open_err))
	end
	out:write(wrapper)
	out:close()

	if RUNTIME.osType ~= "windows" then
		cmd.exec('chmod +x "' .. bin_dst:gsub('"', '\\"') .. '"')
	end

	return {}
end
