local M = {}

local DEFAULT_API = "https://api.github.com/repos/caido/mise-toolshed/releases?per_page=100"
local DEFAULT_DOWNLOAD = "https://github.com/caido/mise-toolshed/releases/download"

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

function M.released_names()
	local names = {}
	for index, name in ipairs(RELEASED) do
		names[index] = name
	end
	return names
end

local function trim_slash(url)
	while string.sub(url, -1) == "/" do
		url = string.sub(url, 1, -2)
	end
	return url
end

local function mirror_of(options)
	if type(options) ~= "table" then
		return nil
	end
	local mirror = options.mirror
	if type(mirror) ~= "string" or mirror == "" then
		return nil
	end
	return trim_slash(mirror)
end

local function assert_version(tool, version)
	if
		type(version) ~= "string"
		or version == ""
		or string.find(version, "/", 1, true)
		or string.find(version, "\\", 1, true)
		or string.find(version, "..", 1, true)
		or string.find(version, "?", 1, true)
		or string.find(version, "#", 1, true)
	then
		error("not a " .. tool .. " version: " .. tostring(version))
	end
end

local function next_link(link)
	if type(link) ~= "string" then
		return nil
	end
	for part in string.gmatch(link, "[^,]+") do
		local quoted = string.find(part, 'rel="next"', 1, true) ~= nil
		local plain = string.find(part, "rel=next", 1, true) ~= nil
		if quoted or plain then
			return string.match(part, "<([^>]+)>")
		end
	end
	return nil
end

-- Tests point releases_url at a local document with the GitHub releases shape.
local function releases_api(options)
	if type(options) ~= "table" then
		return DEFAULT_API
	end
	local url = options.releases_url
	if type(url) ~= "string" or url == "" then
		return DEFAULT_API
	end
	return url
end

local function github_versions(tool, api)
	local http = require("http")
	local json = require("json")
	local prefix = tool .. "-v"
	local pages = {}
	local url = api
	local headers = {
		["Accept"] = "application/vnd.github+json",
		["User-Agent"] = "caido-mise-toolshed",
		["X-GitHub-Api-Version"] = "2022-11-28",
	}
	for _ = 1, 20 do
		local resp = http.get({ url = url, headers = headers })
		if resp.status_code ~= 200 then
			error("fetching releases failed: HTTP " .. tostring(resp.status_code))
		end
		pages[#pages + 1] = json.decode(resp.body)
		url = next_link(resp.headers and resp.headers["link"])
		if url == nil then
			break
		end
	end
	if url ~= nil then
		error("too many GitHub release pages")
	end
	local versions = {}
	local seen = {}
	for page_index = #pages, 1, -1 do
		local page = pages[page_index]
		for index = #page, 1, -1 do
			local release = page[index]
			local tag = type(release) == "table" and release.tag_name or nil
			local unpublished = type(release) == "table" and (release.draft == true or release.prerelease == true)
			if unpublished then
				tag = nil
			end
			if type(tag) == "string" and string.sub(tag, 1, #prefix) == prefix then
				local version = string.sub(tag, #prefix + 1)
				if version ~= "" and not seen[version] then
					seen[version] = true
					local entry = { version = version }
					if type(release.published_at) == "string" and release.published_at ~= "" then
						entry.created_at = release.published_at
					end
					versions[#versions + 1] = entry
				end
			end
		end
	end
	return versions
end

local function mirror_versions(tool, mirror)
	local http = require("http")
	local json = require("json")
	local url = mirror .. "/" .. tool .. "/index.json"
	local resp = http.get({ url = url })
	if resp.status_code ~= 200 then
		error("fetching " .. url .. " failed: HTTP " .. tostring(resp.status_code))
	end
	local decoded = json.decode(resp.body)
	if type(decoded) ~= "table" or type(decoded.versions) ~= "table" then
		error("index.json has no versions for " .. tool)
	end
	return decoded.versions
end

function M.list_versions(tool, options)
	if not M.is_known(tool) then
		error("unknown tool: " .. tostring(tool))
	end
	local mirror = mirror_of(options)
	if mirror ~= nil then
		return mirror_versions(tool, mirror)
	end
	return github_versions(tool, releases_api(options))
end

local function expected_hash(text, filename)
	local found = nil
	for line in string.gmatch(text or "", "[^\n]+") do
		local hash, name = string.match(line, "^(%x+)%s+%*?(%S+)%s*$")
		if name ~= nil then
			name = string.gsub(name, "\r$", "")
			hash = string.lower(hash)
		end
		if name == filename then
			if hash == nil or #hash ~= 64 then
				error("could not parse SHA-256")
			end
			if found ~= nil then
				error("SHA256SUMS has two hashes for " .. filename)
			end
			found = hash
		end
	end
	return found
end

local function sha256(path)
	local cmd = require("cmd")
	if RUNTIME.osType == "windows" then
		local out = cmd.exec('certutil -hashfile "%FILE%" SHA256', { env = { FILE = path } }) or ""
		for line in string.gmatch(string.gsub(out, "\r", ""), "[^\n]+") do
			local compact = string.lower(string.gsub(line, "%s+", ""))
			if #compact == 64 and string.match(compact, "^%x+$") ~= nil then
				return compact
			end
		end
		error("could not parse SHA-256")
	end
	local command = RUNTIME.osType == "darwin" and 'shasum -a 256 "$FILE"' or 'sha256sum "$FILE"'
	local hash = string.match(cmd.exec(command, { env = { FILE = path } }) or "", "^(%x+)")
	if hash == nil or #hash ~= 64 then
		error("could not parse SHA-256")
	end
	return string.lower(hash)
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
	local download = ctx.download_path
	if download == nil or download == "" then
		error("download_path cannot be empty")
	end
	local version = ctx.version
	assert_version(tool, version)
	local filename = tool .. ".mjs"
	local file = require("file")
	local http = require("http")
	local mirror = mirror_of(ctx.options)
	local tag = tool .. "-v" .. version
	local asset_url
	local sums_url
	if mirror ~= nil then
		local dir = mirror .. "/" .. tool .. "/" .. version
		asset_url = dir .. "/" .. filename
		sums_url = dir .. "/SHA256SUMS"
	else
		local dir = DEFAULT_DOWNLOAD .. "/" .. tag
		asset_url = dir .. "/" .. filename
		sums_url = dir .. "/SHA256SUMS"
	end
	local sums = http.get({ url = sums_url })
	if sums.status_code ~= 200 then
		error("no release for " .. tool .. " " .. version .. ": HTTP " .. tostring(sums.status_code))
	end
	local expected = expected_hash(sums.body, filename)
	if expected == nil then
		error("SHA256SUMS has no " .. filename .. " line for tag " .. tag)
	end
	local asset_path = file.join_path(download, filename)
	http.download_file({ url = asset_url }, asset_path)
	local hashed, actual = pcall(sha256, asset_path)
	if not hashed then
		os.remove(asset_path)
		error(actual)
	end
	if actual ~= expected then
		os.remove(asset_path)
		error(filename .. " checksum mismatch for tag " .. tag .. ": expected " .. expected .. " actual " .. actual)
	end
	local bin_dir = file.join_path(install_path, "bin")
	local dest = file.join_path(bin_dir, tool)
	file.move(asset_path, dest)
	-- The file module cannot set the executable bit, so the shebang would not run.
	if RUNTIME.osType ~= "windows" then
		local cmd = require("cmd")
		cmd.exec('chmod 755 "$FILE"', { env = { FILE = dest } })
	end
	write_windows_cmd(bin_dir, tool)
end

return M
