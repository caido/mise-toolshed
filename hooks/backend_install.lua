local function process_gh_aw(ctx)
	local version = ctx.version or ""
	if version == "" or version == "latest" then
		error("toolshed:gh-aw requires an explicit version tag (e.g. v0.2.0); 'latest' is not supported")
	end

	local cmd = require("cmd")
	cmd.exec("command -v gh >/dev/null 2>&1")

	-- `gh extension install` fails if already installed; remove first for idempotency.
	cmd.exec("gh extension remove github/gh-aw >/dev/null 2>&1 || true")
	cmd.exec('gh extension install "github/gh-aw" --pin v' .. version)

	return {}
end

local function process_get_skills(ctx)
	local cmd = require("cmd")
	local file = require("file")

	local install_path = ctx.install_path
	if not install_path or install_path == "" then
		error("install_path cannot be empty")
	end

	local bin_src = file.join_path(RUNTIME.pluginDirPath, "bin", "get-skills")
	if not file.exists(bin_src) then
		error("plugin is missing bin/get-skills at " .. bin_src)
	end

	local bin_dir = file.join_path(install_path, "bin")
	cmd.exec("mkdir -p " .. '"' .. bin_dir:gsub('"', '\\"') .. '"')

	local bin_dst = file.join_path(bin_dir, "get-skills")
	local out, open_err = io.open(bin_dst, "wb")
	if not out then
		error("failed to write " .. bin_dst .. ": " .. tostring(open_err))
	end
	out:write(file.read(bin_src))
	out:close()

	if RUNTIME.osType ~= "windows" then
		cmd.exec('chmod +x "' .. bin_dst:gsub('"', '\\"') .. '"')
	end

	return {}
end

--- Installs the requested tool.
function PLUGIN:BackendInstall(ctx)
	local tool = ctx.tool
	if tool == "gh-aw" then
		return process_gh_aw(ctx)
	end
	if tool == "get-skills" then
		return process_get_skills(ctx)
	end

	error("unknown tool: " .. tostring(tool) .. " (only 'get-skills' or 'gh-aw' is supported)")
end
