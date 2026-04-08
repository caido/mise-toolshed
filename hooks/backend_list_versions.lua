local function process_gh_aw()
	local versions = {}

	local p = io.popen("git ls-remote --tags --refs https://github.com/github/gh-aw.git 2>/dev/null")
	if p then
		for line in p:lines() do
			local ref = line:match("%s+refs/tags/(.+)$")
			if ref and ref ~= "" then
				table.insert(versions, ref)
			end
		end
		p:close()
	end

	table.sort(versions)
	return { versions = versions }
end

local function process_get_skills()
	return { versions = { "latest" } }
end

--- Returns installable versions for the requested tool.
function PLUGIN:BackendListVersions(ctx)
	local tool = ctx.tool
	if tool == "gh-aw" then
		return process_gh_aw()
	end
	if tool == "get-skills" then
		return process_get_skills()
	end

	error("unknown tool: " .. tostring(tool) .. " (only 'get-skills' or 'gh-aw' is supported)")
end
