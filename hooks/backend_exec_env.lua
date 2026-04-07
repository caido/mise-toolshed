--- Prepends install bin to PATH so `get-skills` is available under `mise exec toolshed:get-skills`
--- @param ctx { install_path: string, tool: string, version: string, options: table }
--- @return { env_vars: { key: string, value: string }[] }
function PLUGIN:BackendExecEnv(ctx)
	local file = require("file")

	-- Legacy `toolshed:skills` uses tool name "skills"; current is "get-skills".
	if ctx.tool ~= "get-skills" and ctx.tool ~= "skills" then
		error("unknown tool: " .. tostring(ctx.tool) .. " (only 'get-skills' or legacy 'skills' is supported)")
	end

	local bin_path = file.join_path(ctx.install_path, "bin")
	return {
		env_vars = {
			{ key = "PATH", value = bin_path },
		},
	}
end
