--- Prepends install bin to PATH.
--- Both tools get the same treatment (gh-aw doesn't install a binary but this is harmless).
function PLUGIN:BackendExecEnv(ctx)
	local file = require("file")

	local tool = ctx.tool
	if tool ~= "get-skills" and tool ~= "gh-aw" then
		error("unknown tool: " .. tostring(tool) .. " (only 'get-skills' or 'gh-aw' is supported)")
	end

	local bin_path = file.join_path(ctx.install_path, "bin")
	return {
		env_vars = {
			{ key = "PATH", value = bin_path },
		},
	}
end
