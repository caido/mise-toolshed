#!/bin/sh
set -eu

if command -v mise >/dev/null 2>&1; then
	MISE=$(command -v mise)
else
	echo "mise is required on PATH" >&2
	exit 1
fi

REPO=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)

if grep -F 'ssh://git@github.com/caido/ai-ops.git' "$REPO/bin/get-skills"; then
	echo "bin/get-skills still defaults to ssh://git@github.com/caido/ai-ops.git" >&2
	exit 1
fi
grep -F 'REPO_URL="${REPO_URL:-https://github.com/caido/ai-ops}"' "$REPO/bin/get-skills" >/dev/null

base=$(mktemp -d)
trap 'rm -rf "$base"' EXIT
work="$base/dir with space"
mkdir -p "$work/fixture/bin"

export GIT_CONFIG_GLOBAL="$work/gitconfig"
export GIT_CONFIG_SYSTEM=/dev/null
export GIT_AUTHOR_NAME=toolshed
export GIT_AUTHOR_EMAIL=toolshed@example.com
export GIT_COMMITTER_NAME=toolshed
export GIT_COMMITTER_EMAIL=toolshed@example.com
export GIT_TERMINAL_PROMPT=0
mkdir -p "$work"
: > "$GIT_CONFIG_GLOBAL"

origin="$work/origin.git"
git init --bare -q -b main "$origin"
wt="$work/fixture"
git -C "$wt" init -q -b main
printf 'pinned-1.0.0\n' > "$wt/bin/get-skills"
git -C "$wt" add bin/get-skills
git -C "$wt" commit -m 'pin 1.0.0' >/dev/null
git -C "$wt" tag get-skills-v1.0.0
printf 'pinned-1.2.3\n' > "$wt/bin/get-skills"
git -C "$wt" add bin/get-skills
git -C "$wt" commit -m 'pin 1.2.3' >/dev/null
git -C "$wt" tag get-skills-v1.2.3
printf 'pinned-1.10.0\n' > "$wt/bin/get-skills"
git -C "$wt" add bin/get-skills
git -C "$wt" commit -m 'pin 1.10.0' >/dev/null
git -C "$wt" tag get-skills-v1.10.0
git -C "$wt" tag check-pins-v9.9.9
git -C "$wt" tag v0.0.1
git -C "$wt" remote add origin "$origin"
git -C "$wt" push -q origin HEAD:refs/heads/main
git -C "$wt" push -q origin --tags

git --git-dir="$origin" show get-skills-v1.0.0:bin/get-skills > "$work/blob-1.0.0"
git --git-dir="$origin" show get-skills-v1.2.3:bin/get-skills > "$work/blob-1.2.3"
git --git-dir="$origin" show get-skills-v1.10.0:bin/get-skills > "$work/blob-1.10.0"
if cmp -s "$REPO/bin/get-skills" "$work/blob-1.0.0"; then
	echo "checkout bin/get-skills matches the 1.0.0 blob" >&2
	exit 1
fi
if cmp -s "$REPO/bin/get-skills" "$work/blob-1.2.3"; then
	echo "checkout bin/get-skills matches the 1.2.3 blob" >&2
	exit 1
fi

# file:// plus an absolute path. Spaces in the path stay unencoded.
remote="file://$origin"

use_mise_home() {
	home=$1
	mkdir -p "$home/data" "$home/cache" "$home/config" "$home/state" "$home/project"
	export MISE_DATA_DIR="$home/data"
	export MISE_CACHE_DIR="$home/cache"
	export MISE_CONFIG_DIR="$home/config"
	export MISE_STATE_DIR="$home/state"
	export MISE_GLOBAL_CONFIG_FILE="$home/config/config.toml"
	export MISE_SYSTEM_CONFIG_FILE="$home/config/system.toml"
	export MISE_YES=1
	: > "$MISE_GLOBAL_CONFIG_FILE"
	: > "$MISE_SYSTEM_CONFIG_FILE"
	cd "$home/project"
	"$MISE" plugin link --force toolshed "$REPO" >/dev/null
}

assert_checkout_unchanged() {
	porcelain_after=$(git -C "$REPO" status --porcelain)
	head_after=$(git -C "$REPO" rev-parse HEAD)
	if [ "$porcelain_after" != "$porcelain_before" ] || [ "$head_after" != "$head_before" ]; then
		echo "plugin checkout changed during install" >&2
		echo "HEAD $head_before -> $head_after" >&2
		echo "--- porcelain before ---" >&2
		printf '%s\n' "$porcelain_before" >&2
		echo "--- porcelain after ---" >&2
		printf '%s\n' "$porcelain_after" >&2
		exit 1
	fi
}

use_mise_home "$work/pin"
export TOOLSHED_GET_SKILLS_REMOTE="$remote"
"$MISE" ls-remote toolshed:get-skills > "$work/ls-remote.out"
printf '1.0.0\n1.2.3\n1.10.0\n' > "$work/ls-remote.expected"
if ! cmp -s "$work/ls-remote.out" "$work/ls-remote.expected"; then
	echo "mise ls-remote toolshed:get-skills did not print the expected versions" >&2
	echo "--- actual ---" >&2
	cat "$work/ls-remote.out" >&2
	exit 1
fi
echo "mise ls-remote toolshed:get-skills"
cat "$work/ls-remote.out"

cat > mise.toml << 'EOF'
[tools]
"toolshed:get-skills" = "1.2.3"
EOF

porcelain_before=$(git -C "$REPO" status --porcelain)
head_before=$(git -C "$REPO" rev-parse HEAD)
"$MISE" install
assert_checkout_unchanged
installed=$("$MISE" where toolshed:get-skills@1.2.3)
bin="$installed/bin/get-skills"
if ! cmp -s "$bin" "$work/blob-1.2.3"; then
	echo "1.2.3 install does not match get-skills-v1.2.3:bin/get-skills" >&2
	exit 1
fi
if cmp -s "$bin" "$REPO/bin/get-skills"; then
	echo "1.2.3 install matches the checkout bin/get-skills" >&2
	exit 1
fi
echo "install 1.2.3 matched get-skills-v1.2.3:bin/get-skills"

porcelain_before=$(git -C "$REPO" status --porcelain)
head_before=$(git -C "$REPO" rev-parse HEAD)
"$MISE" install --force
assert_checkout_unchanged
if ! cmp -s "$bin" "$work/blob-1.2.3"; then
	echo "second 1.2.3 install changed bin/get-skills" >&2
	exit 1
fi
echo "second install 1.2.3 left the same bytes"

if "$MISE" install toolshed:get-skills@9.9.9 >/dev/null 2>"$work/missing.err"; then
	echo "install of an unlisted version succeeded" >&2
	exit 1
fi
echo "install 9.9.9 failed"

# A prior numeric install makes mise treat its latest symlink as already
# satisfied. This home has no install yet, so latest resolves to the newest tag.
use_mise_home "$work/latest"
export TOOLSHED_GET_SKILLS_REMOTE="$remote"
cat > mise.toml << 'EOF'
[tools]
"toolshed:get-skills" = "latest"
EOF

porcelain_before=$(git -C "$REPO" status --porcelain)
head_before=$(git -C "$REPO" rev-parse HEAD)
"$MISE" install
assert_checkout_unchanged
latest=$("$MISE" where toolshed:get-skills@latest)
latest_bin="$latest/bin/get-skills"
if ! cmp -s "$latest_bin" "$work/blob-1.10.0"; then
	echo "latest install does not match get-skills-v1.10.0:bin/get-skills" >&2
	exit 1
fi
if cmp -s "$latest_bin" "$REPO/bin/get-skills"; then
	echo "latest install matches the checkout bin/get-skills" >&2
	exit 1
fi
echo "install latest matched get-skills-v1.10.0:bin/get-skills"

empty="$work/empty.git"
git init --bare -q -b main "$empty"
empty_wt="$work/empty-wt"
mkdir -p "$empty_wt"
git -C "$empty_wt" init -q -b main
printf 'no-tags\n' > "$empty_wt/readme"
git -C "$empty_wt" add readme
git -C "$empty_wt" commit -m 'no tags' >/dev/null
git -C "$empty_wt" remote add origin "$empty"
git -C "$empty_wt" push -q origin HEAD:refs/heads/main

use_mise_home "$work/notags"
export TOOLSHED_GET_SKILLS_REMOTE="file://$empty"
"$MISE" ls-remote toolshed:get-skills > "$work/notags.out"
printf 'latest\n' > "$work/notags.expected"
if ! cmp -s "$work/notags.out" "$work/notags.expected"; then
	echo "a remote with no get-skills tags did not list only latest" >&2
	cat "$work/notags.out" >&2
	exit 1
fi
echo "mise ls-remote with no get-skills tags"
cat "$work/notags.out"

cat > mise.toml << 'EOF'
[tools]
"toolshed:get-skills" = "latest"
EOF
"$MISE" install
notags_bin=$("$MISE" where toolshed:get-skills@latest)/bin/get-skills
if ! cmp -s "$notags_bin" "$REPO/bin/get-skills"; then
	echo "latest with no tags does not match the checkout bin/get-skills" >&2
	exit 1
fi
echo "install latest with no tags matched the checkout bin/get-skills"
