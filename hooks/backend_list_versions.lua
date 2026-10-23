local released = require("released_tool")

local function process_get_skills()
	local release = require("get_skills_release")
	return { versions = release.list_versions() }
end

function PLUGIN:BackendListVersions(ctx)
	local tool = ctx.tool
	if tool == "get-skills" then
		return process_get_skills()
	end
	if released.is_released(tool) then
		return { versions = released.list_versions(tool) }
	end

	error("unknown tool: " .. tostring(tool))
end
