#!/bin/sh
set -eu

root=$(CDPATH='' cd -- "$(dirname "$0")/../../.." && pwd)

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
	node "$root/packages/check-exact-versions/dist/check-exact-versions.mjs" --version
	node "$root/packages/check-lockfiles/dist/check-lockfiles.mjs" --version
	node "$root/packages/check-minimum-release-age/dist/check-minimum-release-age.mjs" --version
}

if [ "$#" -ne 1 ]; then
	usage
	exit 1
fi

if [ "$1" = "doctor" ]; then
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

doctor

scratch=$(mktemp -d "${TMPDIR:-/tmp}/playbook-verify-toolshed.XXXXXX")
trap 'rm -rf "$scratch"' EXIT
evidence="$root/.agents/skills/playbook-verify-toolshed/evidence/${feature}.txt"
mkdir -p "$(dirname "$evidence")"
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

cat >"$scratch/commands.sh"
if [ ! -s "$scratch/commands.sh" ]; then
	echo "session: feature body is empty" >&2
	exit 1
fi

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
cat "$scratch/header.sh" "$scratch/commands.sh" >"$scratch/body.sh"
sh "$scratch/body.sh"
printf 'evidence %s\nscratch %s\n' "$evidence" "$scratch"
