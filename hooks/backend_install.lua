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
	local release = require("get_skills_release")
	release.install(ctx)
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
