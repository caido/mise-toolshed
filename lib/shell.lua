-- get-skills still clones a git tag and copies bin/get-skills with the shell.
-- Released tools do not use this module.
local M = {}

-- A caller can point GIT_DIR at the plugin checkout. Leave it set and git writes that repo.
local GIT_UNSET = table.concat({
	"unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE GIT_OBJECT_DIRECTORY",
	"GIT_ALTERNATE_OBJECT_DIRECTORIES GIT_COMMON_DIR GIT_NAMESPACE GIT_PREFIX",
}, " ")

local seq = 0

local function quote_cmd(value)
	if string.find(value, '"', 1, true) ~= nil then
		error("path contains a quote: " .. value)
	end
	return '"' .. value .. '"'
end

-- Git Bash coreutils take /c/Users/... . cmd.exe does not.
local function to_bash_path(value)
	local drive, rest = string.match(value, "^(%a):[\\/](.*)$")
	if drive == nil then
		return value
	end
	rest = string.gsub(rest, "\\", "/")
	return "/" .. string.lower(drive) .. "/" .. rest
end

local function first_file(paths)
	local file = require("file")
	for _, path in ipairs(paths) do
		if file.exists(path) then
			return path
		end
	end
	return nil
end

local function add_bash(paths, root)
	if root == nil or root == "" then
		return
	end
	paths[#paths + 1] = root .. "\\Git\\bin\\bash.exe"
	paths[#paths + 1] = root .. "\\Git\\usr\\bin\\bash.exe"
end

local function bash_exe()
	local paths = {}
	add_bash(paths, os.getenv("ProgramFiles"))
	add_bash(paths, os.getenv("ProgramFiles(x86)"))
	local local_app = os.getenv("LOCALAPPDATA")
	if local_app ~= nil and local_app ~= "" then
		add_bash(paths, local_app .. "\\Programs")
	end
	local found = first_file(paths)
	if found ~= nil then
		return found
	end
	local cmd = require("cmd")
	local ok, out = pcall(cmd.exec, "where git")
	if ok and out ~= nil then
		for line in string.gmatch(out, "[^\r\n]+") do
			local git = string.gsub(line, "%s+$", "")
			local dir = string.match(git, "^(.*)[\\/][^\\/]+$")
			local parent = dir and string.match(dir, "^(.*)[\\/][^\\/]+$") or nil
			local beside = {}
			if dir ~= nil then
				beside[#beside + 1] = dir .. "\\bash.exe"
			end
			if parent ~= nil then
				beside[#beside + 1] = parent .. "\\bin\\bash.exe"
				beside[#beside + 1] = parent .. "\\usr\\bin\\bash.exe"
			end
			found = first_file(beside)
			if found ~= nil then
				return found
			end
		end
	end
	error("Windows needs Git Bash (bash.exe from Git for Windows) to install toolshed tools")
end

local function temp_leaf()
	seq = seq + 1
	local noise = "0"
	local cmd = require("cmd")
	local ok, out = pcall(cmd.exec, "echo %RANDOM%")
	if ok and out ~= nil then
		noise = string.match(out, "%d+") or noise
	end
	return "toolshed-" .. noise .. "-" .. tostring(seq) .. "-" .. tostring(os.time())
end

local function temp_root()
	local base = os.getenv("TEMP")
	if base == nil or base == "" then
		base = os.getenv("TMP")
	end
	if base == nil or base == "" then
		error("TEMP is not set")
	end
	return base
end

local function write_text(path, text)
	local handle, open_err = io.open(path, "wb")
	if not handle then
		error("failed to write " .. path .. ": " .. tostring(open_err))
	end
	handle:write(text)
	handle:close()
end

local function bash_env(env)
	local converted = {}
	for key, value in pairs(env or {}) do
		if type(value) ~= "string" then
			error("shell env values must be strings")
		end
		converted[key] = to_bash_path(value)
	end
	-- Keep the paths we already translated. Git Bash would otherwise rewrite them.
	converted.MSYS_NO_PATHCONV = "1"
	converted.MSYS2_ARG_CONV_EXCL = "*"
	converted.CHERE_INVOKING = "1"
	return converted
end

local function exec_windows(script, env)
	local cmd = require("cmd")
	local file = require("file")
	local script_path = file.join_path(temp_root(), temp_leaf() .. ".sh")
	write_text(script_path, GIT_UNSET .. "\nset -eu\n" .. script .. "\n")
	local command = quote_cmd(bash_exe()) .. " " .. quote_cmd(script_path)
	local ok, result = pcall(cmd.exec, command, { env = bash_env(env) })
	os.remove(script_path)
	if not ok then
		error(result)
	end
	return string.gsub(result or "", "\r", "")
end

function M.exec(script, env)
	if RUNTIME.osType == "windows" then
		return exec_windows(script, env)
	end
	local cmd = require("cmd")
	return cmd.exec(GIT_UNSET .. "\nset -eu\n" .. script, { env = env or {} })
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

function M.temp_dir()
	if RUNTIME.osType == "windows" then
		local file = require("file")
		local dir = file.join_path(temp_root(), temp_leaf())
		M.exec('mkdir -p "$TOOLSHED_DIR"', { TOOLSHED_DIR = dir })
		return dir
	end
	return trim_trailing_newline(M.exec("mktemp -d") or "")
end

return M
