function PLUGIN:BackendExecEnv(ctx)
	local file = require("file")
	local released = require("released_tool")

	local tool = ctx.tool
	if tool ~= "get-skills" and not released.is_released(tool) then
		error("unknown tool: " .. tostring(tool))
	end

	local bin_path = file.join_path(ctx.install_path, "bin")
	return {
		env_vars = {
			{ key = "PATH", value = bin_path },
		},
	}
end
