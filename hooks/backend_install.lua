local released = require("released_tool")

local function process_get_skills(ctx)
	local release = require("get_skills_release")
	release.install(ctx)
	return {}
end

function PLUGIN:BackendInstall(ctx)
	local tool = ctx.tool
	if tool == "get-skills" then
		return process_get_skills(ctx)
	end
	if released.is_released(tool) then
		released.install(ctx)
		return {}
	end
	if released.is_known(tool) then
		error(tool .. " is not installable")
	end

	error("unknown tool: " .. tostring(tool))
end
