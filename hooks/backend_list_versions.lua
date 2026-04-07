--- toolshed:get-skills has a single installable version (latest); skills rev comes from ai-ops at runtime.
--- @param ctx { tool: string, options: table }
--- @return { versions: string[] }
function PLUGIN:BackendListVersions(ctx)
	if ctx.tool ~= "get-skills" and ctx.tool ~= "skills" then
		error("unknown tool: " .. tostring(ctx.tool) .. " (only 'get-skills' or legacy 'skills' is supported)")
	end

	return { versions = { "latest" } }
end
