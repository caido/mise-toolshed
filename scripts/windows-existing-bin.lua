-- Install check-exact-versions into a bin directory that already holds a stale file.
local root = arg[1]
if root == nil or root == "" then
	root = "."
end

package.path = root .. "/lib/?.lua;" .. package.path

local function quote(value)
	return '"' .. value .. '"'
end

local function exec(command)
	local handle = io.popen("cmd /S /C " .. quote(command), "r")
	if not handle then
		error("failed to run " .. command)
	end
	local out = handle:read("*a") or ""
	local ok, _, code = handle:close()
	if not ok then
		error("command failed (" .. tostring(code) .. "): " .. command .. "\n" .. out)
	end
	return out
end

package.preload["cmd"] = function()
	return { exec = exec }
end

package.preload["file"] = function()
	local file = {}
	function file.join_path(...)
		local parts = {}
		for index = 1, select("#", ...) do
			parts[index] = select(index, ...)
		end
		return table.concat(parts, "\\")
	end
	function file.exists(path)
		local handle = io.open(path, "rb")
		if handle then
			handle:close()
			return true
		end
		return false
	end
	return file
end

RUNTIME = { osType = "windows" }

local released = require("released_tool")
local temp = os.getenv("TEMP")
if temp == nil or temp == "" then
	error("TEMP is unset")
end
local work = temp .. "\\toolshed-existing-bin-" .. tostring(os.time())
local install_path = work .. "\\install"
local bin = install_path .. "\\bin"
local dest = bin .. "\\check-exact-versions"
exec("mkdir " .. quote(work))
exec("mkdir " .. quote(work .. "\\download"))
exec("mkdir " .. quote(install_path))
exec("mkdir " .. quote(bin))
local stale = assert(io.open(dest, "wb"))
stale:write("stale")
stale:close()

released.install({
	tool = "check-exact-versions",
	version = "1.0.0",
	install_path = install_path,
	download_path = work .. "\\download",
})

local installed = assert(io.open(dest, "rb"))
local body = installed:read("*a")
installed:close()
if body == "stale" or string.sub(body, 1, 14) ~= "#!/usr/bin/env" then
	error("copy did not install the verified asset")
end

local version = string.gsub(exec(quote(dest .. ".cmd") .. " --version"), "%s+", "")
if version ~= "1.0.0" then
	error("existing bin install printed [" .. version .. "]")
end
io.write("existing bin: check-exact-versions " .. version .. "\n")
