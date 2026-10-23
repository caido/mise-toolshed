local function process_get_skills()
	local release = require("get_skills_release")
	return { versions = release.list_versions() }
end

--- Returns installable versions for the requested tool.
function PLUGIN:BackendListVersions(ctx)
	local tool = ctx.tool
	if tool == "get-skills" then
		return process_get_skills()
	end

	error("unknown tool: " .. tostring(tool) .. " (only 'get-skills' is supported)")
end
