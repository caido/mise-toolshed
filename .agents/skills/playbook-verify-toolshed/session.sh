#!/bin/sh
set -eu

root=$(CDPATH='' cd -- "$(dirname "$0")/../../.." && pwd)
evidence_dir="$root/.agents/skills/playbook-verify-toolshed/evidence"

usage() {
	echo "usage: session.sh doctor | session.sh <feature-id>" >&2
}

doctor() {
	test -f "$root/packages/check-exact-versions/dist/check-exact-versions.mjs"
	test -f "$root/packages/check-lockfiles/dist/check-lockfiles.mjs"
	test -f "$root/packages/check-minimum-release-age/dist/check-minimum-release-age.mjs"
	test -f "$root/bin/get-skills"
	test -f "$root/scripts/stage-release.sh"
	command -v git >/dev/null
	command -v sha256sum >/dev/null
	command -v node >/dev/null
	command -v tmux >/dev/null
	node "$root/packages/check-exact-versions/dist/check-exact-versions.mjs" --version
	node "$root/packages/check-lockfiles/dist/check-lockfiles.mjs" --version
	node "$root/packages/check-minimum-release-age/dist/check-minimum-release-age.mjs" --version
}

run_inner() {
	commands=$1
	doctor
	scratch=$(mktemp -d "${TMPDIR:-/tmp}/playbook-verify-toolshed.XXXXXX")
	trap 'rm -rf "$scratch"' EXIT
	evidence="$evidence_dir/${feature}.txt"
	mkdir -p "$evidence_dir"
	: >"$evidence"

	export GIT_CONFIG_COUNT=0
	unset GIT_CONFIG_PARAMETERS
	export GIT_CONFIG_GLOBAL="$scratch/gitconfig"
	export GIT_CONFIG_SYSTEM=/dev/null
	export GIT_AUTHOR_NAME=toolshed
	export GIT_AUTHOR_EMAIL=toolshed@example.com
	export GIT_COMMITTER_NAME=toolshed
	export GIT_COMMITTER_EMAIL=toolshed@example.com
	export GIT_TERMINAL_PROMPT=0
	export HOME="$scratch/home"
	export AI_OPS_SKILLS_CACHE="$scratch/cache"
	unset AI_OPS_SKILLS_REF
	: >"$GIT_CONFIG_GLOBAL"
	mkdir -p "$HOME"
	export REPO="$root"
	export SCRATCH="$scratch"
	export EVIDENCE="$evidence"

	cat >"$scratch/header.sh" <<'EOF'
set -eu
record() {
	{
		printf '%s status=%s\n' "$1" "$2"
		printf '%s\n' '--- stdout ---'
		cat "$3"
		printf '%s\n' '--- stderr ---'
		cat "$4"
	} >>"$EVIDENCE"
}
EOF
	cat "$scratch/header.sh" "$commands" >"$scratch/body.sh"
	status=0
	sh "$scratch/body.sh" || status=$?
	printf 'evidence %s\nscratch %s\n' "$evidence" "$scratch"
	printf 'exit %s\n' "$status"
	exit "$status"
}

if [ "$#" -lt 1 ] || [ "$#" -gt 3 ]; then
	usage
	exit 1
fi

if [ "$1" = "doctor" ]; then
	if [ "$#" -ne 1 ]; then
		usage
		exit 1
	fi
	doctor
	exit 0
fi

feature=$1
case "$feature" in
*[!a-z0-9-]*)
	usage
	exit 1
	;;
esac
if [ -z "$feature" ]; then
	usage
	exit 1
fi

if [ "${2:-}" = "--inner" ]; then
	if [ "$#" -ne 3 ] || [ ! -s "$3" ]; then
		echo "session: feature body is empty" >&2
		exit 1
	fi
	run_inner "$3"
fi

if [ "$#" -ne 1 ]; then
	usage
	exit 1
fi

commands=$(mktemp)
cat >"$commands"
if [ ! -s "$commands" ]; then
	echo "session: feature body is empty" >&2
	exit 1
fi

session_name="playbook-verify-toolshed-${feature}"
mkdir -p "$evidence_dir"
printf '%s\n' "$session_name" >"$evidence_dir/${feature}.session"
log="$evidence_dir/${feature}.log"
: >"$log"

trap 'tmux kill-session -t "$session_name" 2>/dev/null || true; rm -f "$commands"' EXIT

if tmux has-session -t "$session_name" 2>/dev/null; then
	tmux kill-session -t "$session_name"
fi

printf 'session %s\n' "$session_name"
tmux new-session -d -s "$session_name" -c "$root" \
	"sh '$root/.agents/skills/playbook-verify-toolshed/session.sh' '$feature' --inner '$commands' >'$log' 2>&1"

while tmux has-session -t "$session_name" 2>/dev/null; do
	sleep 1
done

cat "$log"
status=$(awk '/^exit / { code = $2 } END { if (code == "") print 1; else print code }' "$log")
exit "$status"
