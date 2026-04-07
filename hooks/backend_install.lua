--- Copies bin/get-skills from the plugin into install_path/bin/get-skills.
--- @param ctx { tool: string, install_path: string }
--- @return table
function PLUGIN:BackendInstall(ctx)
	local cmd = require("cmd")
	local file = require("file")

	if ctx.tool ~= "get-skills" then
		error("unknown tool: " .. tostring(ctx.tool) .. " (only 'get-skills' is supported)")
	end

	local install_path = ctx.install_path
	if not install_path or install_path == "" then
		error("install_path cannot be empty")
	end

	local plugin_dir = RUNTIME.pluginDirPath
	local bin_src = file.join_path(plugin_dir, "bin", "get-skills")
	if not file.exists(bin_src) then
		error("plugin is missing bin/get-skills at " .. bin_src)
	end

	local bin_dir = file.join_path(install_path, "bin")
	cmd.exec("mkdir -p " .. '"' .. bin_dir:gsub('"', '\\"') .. '"')

	local content = file.read(bin_src)
	local bin_dst = file.join_path(install_path, "bin", "get-skills")
	local out, open_err = io.open(bin_dst, "wb")
	if not out then
		error("failed to write " .. bin_dst .. ": " .. tostring(open_err))
	end
	out:write(content)
	out:close()

	if RUNTIME.osType ~= "windows" then
		cmd.exec('chmod +x "' .. bin_dst:gsub('"', '\\"') .. '"')
	end

	return {}
end
