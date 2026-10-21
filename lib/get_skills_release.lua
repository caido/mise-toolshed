local M = {}

local TAG_PREFIX = "get-skills-v"
local CHANNEL_LATEST = "latest"
local DEFAULT_REMOTE = "https://github.com/caido/mise-toolshed"
local REMOTE_ENV = "TOOLSHED_GET_SKILLS_REMOTE"

-- A caller can point GIT_DIR at the plugin checkout. Leave it set and git writes that repo.
local GIT_UNSET = table.concat({
	"unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE GIT_OBJECT_DIRECTORY",
	"GIT_ALTERNATE_OBJECT_DIRECTORIES GIT_COMMON_DIR GIT_NAMESPACE GIT_PREFIX",
}, " ")

local function sh(script, env)
	local cmd = require("cmd")
	return cmd.exec(GIT_UNSET .. "\nset -eu\n" .. script, { env = env or {} })
end

local function remote_url()
	local remote = os.getenv(REMOTE_ENV)
	if remote == nil or remote == "" then
		return DEFAULT_REMOTE
	end
	if string.find(remote, '"', 1, true)
		or string.find(remote, "'", 1, true)
		or string.find(remote, "\n", 1, true)
	then
		error(REMOTE_ENV .. " contains a quote or newline")
	end
	return remote
end

local function version_body(version)
	if version == nil or version == "" or version == CHANNEL_LATEST then
		return false
	end
	return string.match(version, "^[%w][%w%.%+%-]*$") ~= nil
end

local function version_from_tag(tag)
	if tag == nil or string.sub(tag, 1, #TAG_PREFIX) ~= TAG_PREFIX then
		return nil
	end
	local version = string.sub(tag, #TAG_PREFIX + 1)
	if not version_body(version) then
		return nil
	end
	return version
end

local function tag_from_version(version)
	if not version_body(version) then
		error("not a get-skills version: " .. tostring(version))
	end
	return TAG_PREFIX .. version
end

local function trim_trailing_newline(text)
	local end_at = #text
	while end_at > 0 do
		local ch = string.sub(text, end_at, end_at)
		if ch ~= "\n" and ch ~= "\r" then
			break
		end
		end_at = end_at - 1
	end
	return string.sub(text, 1, end_at)
end

local function split_segments(version)
	local segments = {}
	local rest = version
	while true do
		local dot = string.find(rest, ".", 1, true)
		if not dot then
			segments[#segments + 1] = rest
			return segments
		end
		segments[#segments + 1] = string.sub(rest, 1, dot - 1)
		rest = string.sub(rest, dot + 1)
	end
end

-- GNU sort -V is absent on macOS. Numeric segments compare as numbers so 1.9
-- precedes 1.10. Anything else compares as text. This is not a semver parser.
local function segment_less(left, right)
	local left_digits = string.match(left, "^%d+$")
	local right_digits = string.match(right, "^%d+$")
	if left_digits and right_digits then
		return tonumber(left) < tonumber(right)
	end
	return left < right
end

local function version_less(left, right)
	local left_segments = split_segments(left)
	local right_segments = split_segments(right)
	local count = #left_segments
	if #right_segments > count then
		count = #right_segments
	end
	for index = 1, count do
		local left_segment = left_segments[index] or "0"
		local right_segment = right_segments[index] or "0"
		if left_segment ~= right_segment then
			return segment_less(left_segment, right_segment)
		end
	end
	return false
end

local function sort_versions(versions)
	table.sort(versions, version_less)
	return versions
end

function M.list_versions()
	local out = sh('git ls-remote --tags --refs "$TOOLSHED_REMOTE"', {
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
	versions = sort_versions(versions)
	versions[#versions + 1] = CHANNEL_LATEST
	return versions
end

local function chmod_installed(path)
	if RUNTIME.osType == "windows" then
		return
	end
	sh('chmod +x "$TOOLSHED_DEST"', { TOOLSHED_DEST = path })
end

local function copy_checkout(install_path)
	local file = require("file")
	local bin_src = file.join_path(RUNTIME.pluginDirPath, "bin", "get-skills")
	if not file.exists(bin_src) then
		error("plugin is missing bin/get-skills at " .. bin_src)
	end
	local bin_dir = file.join_path(install_path, "bin")
	sh('mkdir -p "$TOOLSHED_BIN_DIR"', { TOOLSHED_BIN_DIR = bin_dir })
	local bin_dst = file.join_path(bin_dir, "get-skills")
	local out, open_err = io.open(bin_dst, "wb")
	if not out then
		error("failed to write " .. bin_dst .. ": " .. tostring(open_err))
	end
	out:write(file.read(bin_src))
	out:close()
	chmod_installed(bin_dst)
end

local function install_tag(ctx, tag)
	local file = require("file")
	local download = ctx.download_path
	if download == nil or download == "" then
		download = trim_trailing_newline(sh("mktemp -d"))
	end
	local fetch_dir = file.join_path(download, "repo")
	local bin_dir = file.join_path(ctx.install_path, "bin")
	local dest = file.join_path(bin_dir, "get-skills")
	local stage = file.join_path(fetch_dir, "get-skills.stage")
	-- cmd.exec returns a Lua string and does not keep the blob bytes.
	sh([[
mkdir -p "$TOOLSHED_BIN_DIR" "$TOOLSHED_FETCH_DIR"
git init "$TOOLSHED_FETCH_DIR"
git -C "$TOOLSHED_FETCH_DIR" fetch --depth 1 "$TOOLSHED_REMOTE" "refs/tags/${TOOLSHED_TAG}:refs/tags/${TOOLSHED_TAG}"
git -C "$TOOLSHED_FETCH_DIR" show "${TOOLSHED_TAG}:bin/get-skills" > "$TOOLSHED_STAGE"
mv -f "$TOOLSHED_STAGE" "$TOOLSHED_DEST"
]], {
		TOOLSHED_BIN_DIR = bin_dir,
		TOOLSHED_FETCH_DIR = fetch_dir,
		TOOLSHED_REMOTE = remote_url(),
		TOOLSHED_TAG = tag,
		TOOLSHED_STAGE = stage,
		TOOLSHED_DEST = dest,
	})
	chmod_installed(dest)
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
	install_tag(ctx, tag_from_version(version))
end

return M
