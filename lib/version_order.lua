local M = {}

function M.version_body(version)
	if version == nil or version == "" or version == "latest" then
		return false
	end
	return string.match(version, "^[%w][%w%.%+%-]*$") ~= nil
end

local function split_segments(version)
	local segments = {}
	local rest = version
	while true do
		local dot = string.find(rest, ".", 1, true)
		if not dot then
			segments[#segments + 1] = rest
			return segments
		end
		segments[#segments + 1] = string.sub(rest, 1, dot - 1)
		rest = string.sub(rest, dot + 1)
	end
end

local function segment_less(left, right)
	local left_core, left_rest = string.match(left, "^(%d+)(.*)$")
	local right_core, right_rest = string.match(right, "^(%d+)(.*)$")
	if left_core and right_core then
		if tonumber(left_core) ~= tonumber(right_core) then
			return tonumber(left_core) < tonumber(right_core)
		end
		local left_bare = left_rest == ""
		local right_bare = right_rest == ""
		if left_bare ~= right_bare then
			return right_bare
		end
		local left_numeric, left_tail = string.match(left_rest, "^%-(%d+)(.*)$")
		local right_numeric, right_tail = string.match(right_rest, "^%-(%d+)(.*)$")
		if left_numeric and right_numeric then
			if tonumber(left_numeric) ~= tonumber(right_numeric) then
				return tonumber(left_numeric) < tonumber(right_numeric)
			end
			return left_tail < right_tail
		end
		return left_rest < right_rest
	end
	return left < right
end

local function version_less(left, right)
	local left_segments = split_segments(left)
	local right_segments = split_segments(right)
	local count = #left_segments
	if #right_segments > count then
		count = #right_segments
	end
	for index = 1, count do
		local left_segment = left_segments[index] or "0"
		local right_segment = right_segments[index] or "0"
		if left_segment ~= right_segment then
			return segment_less(left_segment, right_segment)
		end
	end
	return false
end

function M.sort_versions(versions)
	table.sort(versions, version_less)
	return versions
end

return M
