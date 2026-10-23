function PLUGIN:BackendExecEnv(ctx)
	local file = require("file")

	local tool = ctx.tool
	if tool ~= "get-skills" then
		error("unknown tool: " .. tostring(tool) .. " (only 'get-skills' is supported)")
	end

	local bin_path = file.join_path(ctx.install_path, "bin")
	return {
		env_vars = {
			{ key = "PATH", value = bin_path },
		},
	}
end
