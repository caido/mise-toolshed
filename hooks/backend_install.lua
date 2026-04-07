--- Installs a snapshot of skills/ plus bin/skills for toolshed:skills
--- @param ctx { tool: string, version: string, install_path: string, download_path: string, options: table }
--- @return table
function PLUGIN:BackendInstall(ctx)
	local cmd = require("cmd")
	local file = require("file")

	local tool = ctx.tool
	if tool ~= "skills" then
		error("unknown tool: " .. tostring(tool) .. " (only 'skills' is supported)")
	end

	local version = ctx.version
	local install_path = ctx.install_path
	if not version or version == "" then
		error("version cannot be empty")
	end
	if not install_path or install_path == "" then
		error("install_path cannot be empty")
	end

	local plugin_dir = RUNTIME.pluginDirPath
	local git_dir = file.join_path(plugin_dir, ".git")
	if not file.exists(git_dir) then
		error(
			"toolshed mise plugin requires a git clone with .git metadata. "
				.. "Reinstall with: mise plugin install toolshed https://github.com/caido/mise-toolshed"
		)
	end

	local ref = version == "latest" and "HEAD" or version

	local q_plugin = '"' .. plugin_dir:gsub('"', '\\"') .. '"'
	local q_install = '"' .. install_path:gsub('"', '\\"') .. '"'
	local q_ref = '"' .. ref:gsub('"', '\\"') .. '"'

	local verify = cmd.exec("git -C " .. q_plugin .. " rev-parse --verify " .. q_ref .. " 2>&1") or ""
	if verify:match("fatal:") or verify:match("Needed a single revision") then
		error("unknown git ref for toolshed:skills: " .. tostring(version))
	end

	cmd.exec("mkdir -p " .. q_install)
	local bin_dir = file.join_path(install_path, "bin")
	cmd.exec("mkdir -p " .. '"' .. bin_dir:gsub('"', '\\"') .. '"')

	local extract = cmd.exec(
		"git -C "
			.. q_plugin
			.. " archive "
			.. q_ref
			.. " skills 2>&1 | tar -x -C "
			.. q_install
			.. " 2>&1"
	) or ""
	if extract:match("fatal:") or extract:match("pathspec") then
		error("failed to extract skills/ for " .. tostring(version) .. ": " .. extract)
	end

	local skills_dir = file.join_path(install_path, "skills")
	if not file.exists(skills_dir) then
		error(
			"git archive produced no skills/ directory for ref "
				.. ref
				.. ". Ensure that revision contains a top-level skills/ tree."
		)
	end

	local bin_src = file.join_path(plugin_dir, "scripts", "skills")
	if not file.exists(bin_src) then
		error("plugin is missing scripts/skills at " .. bin_src)
	end

	local content = file.read(bin_src)
	local bin_dst = file.join_path(install_path, "bin", "skills")
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
