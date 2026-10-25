local M = {}

local version_order = require("version_order")
local shell = require("shell")

local DEFAULT_REMOTE = "https://github.com/caido/mise-toolshed"
local DEFAULT_BASE = "https://github.com/caido/mise-toolshed/releases/download"
local REMOTE_ENV = "TOOLSHED_RELEASE_REMOTE"
local BASE_ENV = "TOOLSHED_RELEASE_BASE_URL"

local RELEASED = {
	"check-pins",
}

local released_set = {}
for _, name in ipairs(RELEASED) do
	released_set[name] = true
end

function M.is_released(tool)
	return released_set[tool] == true
end

local function reject_shell_break(value, label)
	if string.find(value, '"', 1, true) or string.find(value, "'", 1, true) or string.find(value, "\n", 1, true) then
		error(label .. " contains a quote or newline")
	end
end

local function env_or_default(name, default)
	local value = os.getenv(name)
	if value == nil or value == "" then
		return default
	end
	reject_shell_break(value, name)
	return value
end

local function remote_url()
	return env_or_default(REMOTE_ENV, DEFAULT_REMOTE)
end

local function base_url()
	local base = env_or_default(BASE_ENV, DEFAULT_BASE)
	while string.sub(base, -1) == "/" do
		base = string.sub(base, 1, -2)
	end
	return base
end

local function version_from_tag(tool, tag)
	local prefix = tool .. "-v"
	if tag == nil or string.sub(tag, 1, #prefix) ~= prefix then
		return nil
	end
	local version = string.sub(tag, #prefix + 1)
	if not version_order.version_body(version) then
		return nil
	end
	return version
end

function M.list_versions(tool)
	if not M.is_released(tool) then
		error("unknown tool: " .. tostring(tool))
	end
	local out = shell.exec('git ls-remote --tags --refs "$TOOLSHED_REMOTE"', {
		TOOLSHED_REMOTE = remote_url(),
	}) or ""
	local seen = {}
	local versions = {}
	for line in string.gmatch(out, "[^\n]+") do
		local tag = string.match(line, "%s+refs/tags/(.+)$")
		local version = version_from_tag(tool, tag)
		if version and not seen[version] then
			seen[version] = true
			versions[#versions + 1] = version
		end
	end
	return version_order.sort_versions(versions)
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

local function hash_of(path)
	local out = shell.exec(
		[[
if command -v sha256sum >/dev/null 2>&1; then
  sha256sum "$TOOLSHED_FILE"
else
  shasum -a 256 "$TOOLSHED_FILE"
fi
]],
		{ TOOLSHED_FILE = path }
	) or ""
	local hash = string.match(out, "^(%x+)")
	if hash == nil then
		error("could not hash " .. path)
	end
	return string.lower(hash)
end

local function expected_hash(text, filename)
	for line in string.gmatch(text, "[^\n]+") do
		local hash, name = string.match(line, "^(%x+)%s+%*?(%S+)%s*$")
		if name ~= nil then
			name = string.gsub(name, "\r$", "")
			hash = string.lower(hash)
		end
		if name == filename then
			return hash
		end
	end
	return nil
end

function M.install(ctx)
	local tool = ctx.tool
	if not M.is_released(tool) then
		error("unknown tool: " .. tostring(tool))
	end
	local install_path = ctx.install_path
	if install_path == nil or install_path == "" then
		error("install_path cannot be empty")
	end
	local version = ctx.version
	if not version_order.version_body(version) then
		error("not a " .. tool .. " version: " .. tostring(version))
	end
	local tag = tool .. "-v" .. version
	local filename = tool .. ".mjs"
	local file = require("file")
	local download = ctx.download_path
	if download == nil or download == "" then
		download = trim_trailing_newline(shell.exec("mktemp -d"))
	end
	local asset_path = file.join_path(download, filename)
	local sums_path = file.join_path(download, "SHA256SUMS")
	local base = base_url()
	shell.exec(
		[[
curl -fsSL --output "$TOOLSHED_ASSET" "$TOOLSHED_ASSET_URL"
curl -fsSL --output "$TOOLSHED_SUMS" "$TOOLSHED_SUMS_URL"
]],
		{
			TOOLSHED_ASSET = asset_path,
			TOOLSHED_SUMS = sums_path,
			TOOLSHED_ASSET_URL = base .. "/" .. tag .. "/" .. filename,
			TOOLSHED_SUMS_URL = base .. "/" .. tag .. "/SHA256SUMS",
		}
	)
	local sums_file, open_err = io.open(sums_path, "rb")
	if not sums_file then
		error("failed to read SHA256SUMS for tag " .. tag .. ": " .. tostring(open_err))
	end
	local sums_text = sums_file:read("*a")
	sums_file:close()
	local expected = expected_hash(sums_text, filename)
	if expected == nil then
		error("SHA256SUMS has no " .. filename .. " line for tag " .. tag)
	end
	local actual = hash_of(asset_path)
	if actual ~= expected then
		error(filename .. " checksum mismatch for tag " .. tag .. ": expected " .. expected .. " actual " .. actual)
	end
	local bin_dir = file.join_path(install_path, "bin")
	local dest = file.join_path(bin_dir, tool)
	shell.exec(
		[[
mkdir -p "$TOOLSHED_BIN_DIR"
mv -f "$TOOLSHED_ASSET" "$TOOLSHED_DEST"
]],
		{
			TOOLSHED_BIN_DIR = bin_dir,
			TOOLSHED_ASSET = asset_path,
			TOOLSHED_DEST = dest,
		}
	)
	if RUNTIME.osType ~= "windows" then
		shell.exec('chmod 755 "$TOOLSHED_DEST"', { TOOLSHED_DEST = dest })
	end
end

return M
