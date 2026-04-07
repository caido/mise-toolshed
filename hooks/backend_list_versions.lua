--- toolshed:get-skills has a single installable version (latest); skills rev comes from ai-ops at runtime.
--- @param ctx { tool: string, options: table }
--- @return { versions: string[] }
function PLUGIN:BackendListVersions(ctx)
	if ctx.tool ~= "get-skills" then
		error("unknown tool: " .. tostring(ctx.tool) .. " (only 'get-skills' is supported)")
	end

	return { versions = { "latest" } }
end
