local M = {}

local version_order = require("version_order")
local shell = require("shell")

local TAG_PREFIX = "get-skills-v"
local CHANNEL_LATEST = "latest"
local DEFAULT_REMOTE = "https://github.com/caido/mise-toolshed"
local REMOTE_ENV = "TOOLSHED_GET_SKILLS_REMOTE"

local function remote_url()
	local remote = os.getenv(REMOTE_ENV)
	if remote == nil or remote == "" then
		return DEFAULT_REMOTE
	end
	if string.find(remote, '"', 1, true) or string.find(remote, "'", 1, true) or string.find(remote, "\n", 1, true) then
		error(REMOTE_ENV .. " contains a quote or newline")
	end
	return remote
end

local function version_from_tag(tag)
	if tag == nil or string.sub(tag, 1, #TAG_PREFIX) ~= TAG_PREFIX then
		return nil
	end
	local version = string.sub(tag, #TAG_PREFIX + 1)
	if not version_order.version_body(version) then
		return nil
	end
	return version
end

function M.list_versions()
	local out = shell.exec('git ls-remote --tags --refs "$TOOLSHED_REMOTE"', {
		TOOLSHED_REMOTE = remote_url(),
	}) or ""
	local seen = {}
	local versions = {}
	for line in string.gmatch(out, "[^\n]+") do
		local tag = string.match(line, "%s+refs/tags/(.+)$")
		local version = version_from_tag(tag)
		if version and not seen[version] then
			seen[version] = true
			versions[#versions + 1] = version
		end
	end
	versions = version_order.sort_versions(versions)
	-- mise names a symlink "latest" and deletes a real directory of that name
	-- once a semver install exists. Offer the checkout only when no tag exists.
	if #versions == 0 then
		versions[1] = CHANNEL_LATEST
	end
	return versions
end

local function chmod_installed(path)
	if RUNTIME.osType == "windows" then
		return
	end
	shell.exec('chmod +x "$TOOLSHED_DEST"', { TOOLSHED_DEST = path })
end

local function copy_checkout(install_path)
	local file = require("file")
	local bin_src = file.join_path(RUNTIME.pluginDirPath, "packages", "get-skills", "dist", "get-skills.mjs")
	if not file.exists(bin_src) then
		error("plugin is missing packages/get-skills/dist/get-skills.mjs at " .. bin_src)
	end
	local bin_dir = file.join_path(install_path, "bin")
	shell.exec('mkdir -p "$TOOLSHED_BIN_DIR"', { TOOLSHED_BIN_DIR = bin_dir })
	local bin_dst = file.join_path(bin_dir, "get-skills")
	local out, open_err = io.open(bin_dst, "wb")
	if not out then
		error("failed to write " .. bin_dst .. ": " .. tostring(open_err))
	end
	out:write(file.read(bin_src))
	out:close()
	chmod_installed(bin_dst)
end

function M.install(ctx)
	local install_path = ctx.install_path
	if install_path == nil or install_path == "" then
		error("install_path cannot be empty")
	end
	local version = ctx.version
	if version == nil or version == "" or version == CHANNEL_LATEST then
		copy_checkout(install_path)
		return
	end
	require("released_tool").install(ctx)
end

return M
