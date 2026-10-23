local M = {}

-- A caller can point GIT_DIR at the plugin checkout. Leave it set and git writes that repo.
local GIT_UNSET = table.concat({
	"unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE GIT_OBJECT_DIRECTORY",
	"GIT_ALTERNATE_OBJECT_DIRECTORIES GIT_COMMON_DIR GIT_NAMESPACE GIT_PREFIX",
}, " ")

function M.exec(script, env)
	local cmd = require("cmd")
	return cmd.exec(GIT_UNSET .. "\nset -eu\n" .. script, { env = env or {} })
end

return M
