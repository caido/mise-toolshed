local function process_get_skills(ctx)
	local release = require("get_skills_release")
	release.install(ctx)
	return {}
end

--- Installs the requested tool.
function PLUGIN:BackendInstall(ctx)
	local tool = ctx.tool
	if tool == "get-skills" then
		return process_get_skills(ctx)
	end

	error("unknown tool: " .. tostring(tool) .. " (only 'get-skills' is supported)")
end
