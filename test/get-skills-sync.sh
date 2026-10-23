#!/bin/sh
set -eu

REPO=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
BIN="$REPO/bin/get-skills"

base=$(mktemp -d)
trap 'rm -rf "$base"' EXIT
home="$base/home dir"
cache="$base/cache"
fixture="$base/ai-ops"
sentinel="$base/sentinel"

export GIT_CONFIG_GLOBAL="$base/gitconfig"
export GIT_CONFIG_SYSTEM=/dev/null
export GIT_AUTHOR_NAME=toolshed
export GIT_AUTHOR_EMAIL=toolshed@example.com
export GIT_COMMITTER_NAME=toolshed
export GIT_COMMITTER_EMAIL=toolshed@example.com
export GIT_TERMINAL_PROMPT=0
export HOME="$home"
export AI_OPS_SKILLS_CACHE="$cache"
unset AI_OPS_SKILLS_REF
unset SKILLS_DESTINATION
: > "$GIT_CONFIG_GLOBAL"
mkdir -p "$home" "$sentinel"

fail() {
	printf '%s\n' "$1" >&2
	if [ -f "$base/stderr" ]; then
		echo "--- stderr ---" >&2
		cat "$base/stderr" >&2
	fi
	if [ -f "$base/stdout" ]; then
		echo "--- stdout ---" >&2
		cat "$base/stdout" >&2
	fi
	exit 1
}

run_choice() {
	status=0
	printf '%s\n' "$1" | "$BIN" --url "$fixture" >"$base/stdout" 2>"$base/stderr" || status=$?
}

assert_status() {
	if [ "$status" != "$1" ]; then
		fail "exit $status, expected $1"
	fi
}

assert_stderr() {
	if ! grep -F "$1" "$base/stderr" >/dev/null; then
		fail "stderr missing: $1"
	fi
}

assert_stdout_empty() {
	if [ -s "$base/stdout" ]; then
		fail "stdout was not empty"
	fi
}

cmp_file() {
	if ! cmp -s "$1" "$2"; then
		fail "$3"
	fi
}

only_home() {
	found=$(find "$HOME" -print)
	if [ "$found" != "$HOME" ]; then
		printf '%s\n' "$found" >&2
		fail "HOME was not empty"
	fi
}

show_tree() {
	printf '%s\n' "$1"
	(CDPATH= cd -- "$HOME" && find .cursor/skills -print | LC_ALL=C sort)
}

mkdir -p "$fixture/skills/grilling" "$fixture/skills/handoff"
printf 'grill-v1\n' > "$fixture/skills/grilling/SKILL.md"
printf 'hand-v1\n' > "$fixture/skills/handoff/SKILL.md"
printf 'not-a-skill\n' > "$fixture/skills/README.txt"
git -C "$fixture" init -q -b main
git -C "$fixture" add skills
git -C "$fixture" commit -q -m 'skills-v1'

status=0
printf '9\n' | "$BIN" --url "$fixture" >"$base/stdout" 2>"$base/stderr" || status=$?
assert_status 1
only_home

status=0
"$BIN" --url "$fixture" </dev/null >"$base/stdout" 2>"$base/stderr" || status=$?
assert_status 1
only_home
if [ -e "$cache" ]; then
	fail "bad choice cloned a cache"
fi

status=0
"$BIN" --destination "$HOME" >"$base/stdout" 2>"$base/stderr" || status=$?
assert_status 1
assert_stderr "unknown argument"
only_home
if [ -e "$cache" ]; then
	fail "--destination cloned a cache"
fi

mkdir -p "$HOME/.cursor/skills/verify-analytics" "$HOME/.cursor/skills/handoff"
printf 'keep\n' > "$HOME/.cursor/skills/verify-analytics/SKILL.md"
printf 'mine\n' > "$HOME/.cursor/skills/handoff/SKILL.md"
printf 'keep-note\n' > "$HOME/.cursor/skills/notes.txt"
cp "$HOME/.cursor/skills/verify-analytics/SKILL.md" "$base/keep"
cp "$HOME/.cursor/skills/handoff/SKILL.md" "$base/mine"
cp "$HOME/.cursor/skills/notes.txt" "$base/keep-note"

run_choice 1
assert_status 1
assert_stderr "handoff"
if [ -e "$HOME/.cursor/skills/.toolshed-get-skills" ]; then
	fail "collision wrote a manifest"
fi
cmp_file "$base/keep" "$HOME/.cursor/skills/verify-analytics/SKILL.md" "verify-analytics changed on collision"
cmp_file "$base/mine" "$HOME/.cursor/skills/handoff/SKILL.md" "handoff changed on collision"
cmp_file "$base/keep-note" "$HOME/.cursor/skills/notes.txt" "notes.txt changed on collision"
if [ -e "$HOME/.cursor/skills/grilling" ]; then
	fail "grilling was installed on collision"
fi
if [ -d "$HOME/.claude" ] || [ -d "$HOME/.agents" ]; then
	fail "collision created another personal folder"
fi

mkdir -p "$HOME/aside"
mv "$HOME/.cursor/skills/handoff" "$HOME/aside/handoff"
run_choice 1
assert_status 0
assert_stdout_empty
canon=$(CDPATH= cd -- "$HOME/.cursor/skills" && pwd)
assert_stderr "toolshed:get-skills: synced $cache/skills to $canon"
printf 'grilling\nhandoff\n' > "$base/manifest-v1"
cmp_file "$base/manifest-v1" "$HOME/.cursor/skills/.toolshed-get-skills" "cursor manifest after skills-v1"
printf 'grill-v1\n' > "$base/grill-v1"
printf 'hand-v1\n' > "$base/hand-v1"
cmp_file "$base/grill-v1" "$HOME/.cursor/skills/grilling/SKILL.md" "grilling body"
cmp_file "$base/hand-v1" "$HOME/.cursor/skills/handoff/SKILL.md" "handoff body"
cmp_file "$base/keep" "$HOME/.cursor/skills/verify-analytics/SKILL.md" "verify-analytics after install"
cmp_file "$base/keep-note" "$HOME/.cursor/skills/notes.txt" "notes.txt after install"
if [ -e "$HOME/.cursor/skills/README.txt" ] || [ -e "$HOME/.claude/skills/README.txt" ]; then
	fail "README.txt was installed"
fi
if [ -d "$HOME/.claude" ] || [ -d "$HOME/.agents" ]; then
	fail "unchosen folders were created"
fi
if [ -e "$HOME/.cursor/skills/.toolshed-get-skills.stage" ] || [ -e "$HOME/.cursor/skills/.toolshed-get-skills.lock" ]; then
	fail "stage or lock remained after install"
fi
origin_url=$(git -C "$cache" remote get-url origin)
if [ "$origin_url" != "$fixture" ]; then
	fail "origin is $origin_url"
fi
rm -rf "$base/cursor-v1"
cp -R "$HOME/.cursor/skills" "$base/cursor-v1"
show_tree "before .cursor/skills"

run_choice 2
assert_status 0
assert_stdout_empty
canon_claude=$(CDPATH= cd -- "$HOME/.claude/skills" && pwd)
assert_stderr "toolshed:get-skills: synced $cache/skills to $canon_claude"
cmp_file "$base/manifest-v1" "$HOME/.claude/skills/.toolshed-get-skills" "claude manifest"
cmp_file "$base/grill-v1" "$HOME/.claude/skills/grilling/SKILL.md" "claude grilling"
cmp_file "$base/hand-v1" "$HOME/.claude/skills/handoff/SKILL.md" "claude handoff"
if ! diff -r "$base/cursor-v1" "$HOME/.cursor/skills" >/dev/null; then
	fail "choice 2 changed .cursor/skills"
fi
if [ -d "$HOME/.agents" ]; then
	fail ".agents was created"
fi
if [ -e "$HOME/.claude/skills/README.txt" ]; then
	fail "README.txt was installed into claude"
fi
rm -rf "$base/claude-v1"
cp -R "$HOME/.claude/skills" "$base/claude-v1"

rm -rf "$fixture/skills/grilling"
printf 'hand-v2\n' > "$fixture/skills/handoff/SKILL.md"
mkdir -p "$fixture/skills/to-rca"
printf 'rca-v1\n' > "$fixture/skills/to-rca/SKILL.md"
git -C "$fixture" add -A
git -C "$fixture" commit -q -m 'skills-v2'

run_choice 1
assert_status 0
assert_stdout_empty
assert_stderr "toolshed:get-skills: synced $cache/skills to $canon"
printf 'handoff\nto-rca\n' > "$base/manifest-v2"
cmp_file "$base/manifest-v2" "$HOME/.cursor/skills/.toolshed-get-skills" "cursor manifest after skills-v2"
printf 'hand-v2\n' > "$base/hand-v2"
printf 'rca-v1\n' > "$base/rca-v1"
cmp_file "$base/hand-v2" "$HOME/.cursor/skills/handoff/SKILL.md" "handoff was not updated"
cmp_file "$base/rca-v1" "$HOME/.cursor/skills/to-rca/SKILL.md" "to-rca body"
cmp_file "$base/keep" "$HOME/.cursor/skills/verify-analytics/SKILL.md" "verify-analytics after removal"
cmp_file "$base/keep-note" "$HOME/.cursor/skills/notes.txt" "notes.txt after removal"
if [ -e "$HOME/.cursor/skills/grilling" ]; then
	fail "grilling was not removed"
fi
if ! diff -r "$base/claude-v1" "$HOME/.claude/skills" >/dev/null; then
	fail "choice 1 changed the claude skills-v1 tree"
fi
if [ -e "$HOME/.cursor/skills/.toolshed-get-skills.stage" ]; then
	fail "stage remained after update"
fi
show_tree "after .cursor/skills"

rm -rf "$base/cursor-v2"
cp -R "$HOME/.cursor/skills" "$base/cursor-v2"
run_choice 1
assert_status 0
assert_stdout_empty
if ! diff -r "$base/cursor-v2" "$HOME/.cursor/skills" >/dev/null; then
	fail "repeat run changed .cursor/skills bytes"
fi
cmp_file "$base/hand-v2" "$HOME/.cursor/skills/handoff/SKILL.md" "handoff changed on repeat"
cmp_file "$base/keep-note" "$HOME/.cursor/skills/notes.txt" "notes.txt changed on repeat"

printf '%s\n' handoff '../verify-analytics' to-rca > "$HOME/.cursor/skills/.toolshed-get-skills"
cp "$HOME/.cursor/skills/.toolshed-get-skills" "$base/planted"
run_choice 1
assert_status 1
cmp_file "$base/planted" "$HOME/.cursor/skills/.toolshed-get-skills" "planted manifest was rewritten"
cmp_file "$base/keep" "$HOME/.cursor/skills/verify-analytics/SKILL.md" "verify-analytics changed after bad manifest"
cmp_file "$base/rca-v1" "$HOME/.cursor/skills/to-rca/SKILL.md" "to-rca missing after bad manifest"
cmp_file "$base/keep-note" "$HOME/.cursor/skills/notes.txt" "notes.txt changed after bad manifest"

printf 'handoff\nto-rca\n' > "$HOME/.cursor/skills/.toolshed-get-skills"
run_choice_dest() {
	status=0
	printf '1\n' | env SKILLS_DESTINATION="$sentinel" "$BIN" --url "$fixture" >"$base/stdout" 2>"$base/stderr" || status=$?
}
run_choice_dest
assert_status 0
assert_stdout_empty
assert_stderr "toolshed:get-skills: synced $cache/skills to $canon"
cmp_file "$base/manifest-v2" "$HOME/.cursor/skills/.toolshed-get-skills" "cursor manifest after ignored destination"
cmp_file "$base/hand-v2" "$HOME/.cursor/skills/handoff/SKILL.md" "cursor handoff after ignored destination"
sentinel_found=$(find "$sentinel" -print)
if [ "$sentinel_found" != "$sentinel" ]; then
	printf '%s\n' "$sentinel_found" >&2
	fail "SKILLS_DESTINATION received skills"
fi

mkdir -p "$fixture/skills/.not-a-skill"
printf 'no\n' > "$fixture/skills/.not-a-skill/SKILL.md"
git -C "$fixture" add -A
git -C "$fixture" commit -q -m 'illegal skill name'
rm -rf "$base/cursor-before-illegal"
cp -R "$HOME/.cursor/skills" "$base/cursor-before-illegal"
run_choice 3
assert_status 1
assert_stderr ".not-a-skill"
if [ -e "$HOME/.agents" ]; then
	fail "illegal source name created .agents"
fi
if ! diff -r "$base/cursor-before-illegal" "$HOME/.cursor/skills" >/dev/null; then
	fail "illegal source name changed .cursor/skills"
fi
cmp_file "$base/keep-note" "$HOME/.cursor/skills/notes.txt" "notes.txt changed after illegal source name"
