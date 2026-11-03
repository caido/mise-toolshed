local M = {}

local version_order = require("version_order")
local shell = require("shell")

local DEFAULT_REMOTE = "https://github.com/caido/mise-toolshed"
local DEFAULT_BASE = "https://github.com/caido/mise-toolshed/releases/download"
local REMOTE_ENV = "TOOLSHED_RELEASE_REMOTE"
local BASE_ENV = "TOOLSHED_RELEASE_BASE_URL"

local RELEASED = {
	"check-exact-versions",
	"check-lockfiles",
	"check-minimum-release-age",
}

local LEGACY = {
	"check-pins",
}

local released_set = {}
for _, name in ipairs(RELEASED) do
	released_set[name] = true
end

local known_set = {}
for _, name in ipairs(RELEASED) do
	known_set[name] = true
end
for _, name in ipairs(LEGACY) do
	known_set[name] = true
end

function M.is_released(tool)
	return released_set[tool] == true
end

function M.is_known(tool)
	return known_set[tool] == true
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
	if not M.is_known(tool) then
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

local function quote_arg(value)
	if string.find(value, '"', 1, true) or string.find(value, "\n", 1, true) or string.find(value, "\r", 1, true) then
		error("path contains a quote or newline")
	end
	return '"' .. value .. '"'
end

local function take_hash(found, candidate)
	if #candidate ~= 64 or string.match(candidate, "^%x+$") == nil then
		error("could not parse SHA-256")
	end
	if found ~= nil and found ~= candidate then
		error("could not parse SHA-256")
	end
	return candidate
end

local function parse_sha256(text)
	if type(text) ~= "string" or text == "" then
		error("could not parse SHA-256")
	end
	local found = nil
	for line in string.gmatch(string.gsub(text, "\r", "") .. "\n", "(.-)\n") do
		if string.match(line, "%S") ~= nil then
			local compact = string.lower(string.gsub(line, "%s+", ""))
			if #compact == 64 and string.match(compact, "^%x+$") ~= nil then
				found = take_hash(found, compact)
			else
				local runs = 0
				local run = nil
				for token in string.gmatch(string.lower(line), "%x+") do
					if #token > 64 then
						error("could not parse SHA-256")
					end
					if #token == 64 then
						runs = runs + 1
						run = token
					end
				end
				if runs > 1 then
					error("could not parse SHA-256")
				end
				if runs == 1 then
					local lead = "^%s*" .. run .. "%s+%*?%S+%s*$"
					local alone = "^%s*" .. run .. "%s*$"
					if
						string.match(string.lower(line), lead) == nil
						and string.match(string.lower(line), alone) == nil
					then
						error("could not parse SHA-256")
					end
					found = take_hash(found, run)
				elseif
					string.match(
						compact,
						"%x%x%x%x%x%x%x%x%x%x%x%x%x%x%x%x%x%x%x%x%x%x%x%x%x%x%x%x%x%x%x%x%x%x%x%x%x%x%x%x%x%x%x%x%x%x%x%x%x%x%x%x%x%x%x%x%x%x%x%x%x%x%x%x"
					) ~= nil
				then
					error("could not parse SHA-256")
				end
			end
		end
	end
	if found == nil then
		error("could not parse SHA-256")
	end
	return found
end

local function hash_of(path)
	local cmd = require("cmd")
	local quoted = quote_arg(path)
	local command
	if RUNTIME.osType == "windows" then
		command = "certutil -hashfile " .. quoted .. " SHA256"
	elseif RUNTIME.osType == "macos" then
		command = "shasum -a 256 " .. quoted
	else
		command = "sha256sum " .. quoted
	end
	return parse_sha256(cmd.exec(command) or "")
end

local function expected_hash(text, filename)
	for line in string.gmatch(text, "[^\n]+") do
		local hash, name = string.match(line, "^(%x+)%s+%*?(%S+)%s*$")
		if name ~= nil then
			name = string.gsub(name, "\r$", "")
			hash = string.lower(hash)
		end
		if name == filename then
			if hash == nil or #hash ~= 64 then
				error("could not parse SHA-256")
			end
			return hash
		end
	end
	return nil
end

-- Windows cannot run an extensionless script. mise resolves PATHEXT and launches the .cmd.
local function write_windows_cmd(bin_dir, tool)
	if RUNTIME.osType ~= "windows" then
		return
	end
	local file = require("file")
	local shim = file.join_path(bin_dir, tool .. ".cmd")
	local handle, open_err = io.open(shim, "wb")
	if not handle then
		error("failed to write " .. shim .. ": " .. tostring(open_err))
	end
	handle:write('@echo off\r\nnode "%~dp0' .. tool .. '" %*\r\nexit /b %ERRORLEVEL%\r\n')
	handle:close()
end

function M.install(ctx)
	local tool = ctx.tool
	if M.is_known(tool) and not M.is_released(tool) then
		error(tool .. " is not installable")
	end
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
	local http = require("http")
	local download = ctx.download_path
	if download == nil or download == "" then
		local temp = os.getenv("TMPDIR")
		if temp == nil or temp == "" then
			temp = os.getenv("TEMP")
		end
		if temp == nil or temp == "" then
			temp = os.getenv("TMP")
		end
		if temp == nil or temp == "" then
			error("no download directory")
		end
		download = file.join_path(temp, "toolshed-" .. tool .. "-" .. version)
	end
	local asset_path = file.join_path(download, filename)
	local sums_path = file.join_path(download, "SHA256SUMS")
	local base = base_url()
	local asset_url = base .. "/" .. tag .. "/" .. filename
	local sums_url = base .. "/" .. tag .. "/SHA256SUMS"
	http.download_file({ url = asset_url }, asset_path)
	http.download_file({ url = sums_url }, sums_path)
	local sums_file, open_err = io.open(sums_path, "rb")
	if not sums_file then
		os.remove(asset_path)
		error("failed to read SHA256SUMS for tag " .. tag .. ": " .. tostring(open_err))
	end
	local sums_text = sums_file:read("*a")
	sums_file:close()
	local expected = expected_hash(sums_text, filename)
	if expected == nil then
		os.remove(asset_path)
		os.remove(sums_path)
		error("SHA256SUMS has no " .. filename .. " line for tag " .. tag)
	end
	local actual = hash_of(asset_path)
	if actual ~= expected then
		os.remove(asset_path)
		os.remove(sums_path)
		error(filename .. " checksum mismatch for tag " .. tag .. ": expected " .. expected .. " actual " .. actual)
	end
	local bin_dir = file.join_path(install_path, "bin")
	local dest = file.join_path(bin_dir, tool)
	if file.exists(dest) then
		os.remove(dest)
	end
	local moved, move_err = pcall(file.move, asset_path, dest)
	if not moved then
		local input, in_err = io.open(asset_path, "rb")
		if not input then
			error("failed to place " .. dest .. ": " .. tostring(move_err) .. " / " .. tostring(in_err))
		end
		local body = input:read("*a")
		input:close()
		local output, out_err = io.open(dest, "wb")
		if not output then
			error("failed to place " .. dest .. ": " .. tostring(move_err) .. " / " .. tostring(out_err))
		end
		output:write(body)
		output:close()
		os.remove(asset_path)
	end
	os.remove(sums_path)
	if RUNTIME.osType ~= "windows" then
		local cmd = require("cmd")
		cmd.exec("chmod 755 " .. quote_arg(dest))
	end
	write_windows_cmd(bin_dir, tool)
end

return M
