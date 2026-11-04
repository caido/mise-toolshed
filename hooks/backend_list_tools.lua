local released = require("released_tool")

function PLUGIN:BackendListTools(ctx)
	local tools = {
		{ name = "get-skills" },
	}
	for _, name in ipairs(released.released_names()) do
		tools[#tools + 1] = { name = name }
	end
	return { tools = tools }
end
