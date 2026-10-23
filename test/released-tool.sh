#!/bin/sh
set -eu

if command -v mise >/dev/null 2>&1; then
	MISE=$(command -v mise)
else
	echo "mise is required on PATH" >&2
	exit 1
fi

if ! command -v sha256sum >/dev/null 2>&1; then
	echo "sha256sum is required on PATH" >&2
	exit 1
fi

REPO=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

export GIT_CONFIG_GLOBAL="$work/gitconfig"
export GIT_CONFIG_SYSTEM=/dev/null
export GIT_AUTHOR_NAME=toolshed
export GIT_AUTHOR_EMAIL=toolshed@example.com
export GIT_COMMITTER_NAME=toolshed
export GIT_COMMITTER_EMAIL=toolshed@example.com
export GIT_TERMINAL_PROMPT=0
: > "$GIT_CONFIG_GLOBAL"

origin="$work/origin.git"
wt="$work/fixture"
git init --bare -q -b main "$origin"
mkdir -p "$wt"
git -C "$wt" init -q -b main
printf 'noise\n' > "$wt/readme"
git -C "$wt" add readme
git -C "$wt" commit -m 'tags' >/dev/null
git -C "$wt" tag check-pins-v1.0.0
git -C "$wt" tag check-pins-v1.1.0
git -C "$wt" tag get-skills-v1.0.0
git -C "$wt" tag get-skills-v2.0.0
git -C "$wt" remote add origin "$origin"
git -C "$wt" push -q origin HEAD:refs/heads/main
git -C "$wt" push -q origin --tags

write_bundle() {
	version=$1
	dir=$2
	mkdir -p "$dir"
	cat > "$dir/check-pins.mjs" << EOF
#!/usr/bin/env node
if (process.argv.length === 3 && process.argv[2] === "--version") {
  process.stdout.write("${version}\\n");
  process.exit(0);
}
process.stderr.write("usage: check-pins --version\\n");
process.exit(1);
EOF
	chmod 755 "$dir/check-pins.mjs"
}

releases="$work/releases"
write_bundle 1.0.0 "$releases/check-pins-v1.0.0"
(
	cd "$releases/check-pins-v1.0.0"
	sha256sum check-pins.mjs > SHA256SUMS
)
write_bundle 1.1.0 "$releases/check-pins-v1.1.0"
(
	cd "$releases/check-pins-v1.1.0"
	sha256sum check-pins.mjs > SHA256SUMS
)

write_bundle 9.9.9 "$releases/check-pins-v9.9.9"
(
	cd "$releases/check-pins-v9.9.9"
	sha256sum check-pins.mjs > SHA256SUMS
	printf '\n/* tampered */\n' >> check-pins.mjs
)
expected=$(sha256sum "$releases/check-pins-v9.9.9/check-pins.mjs" | awk '{print $1}')
actual_line=$(awk '{print $1}' "$releases/check-pins-v9.9.9/SHA256SUMS")

write_bundle 9.8.0 "$releases/check-pins-v9.8.0"
printf '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef  other.txt\n' > "$releases/check-pins-v9.8.0/SHA256SUMS"

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

use_mise_home "$work/home"
export TOOLSHED_RELEASE_REMOTE="file://$origin"
export TOOLSHED_RELEASE_BASE_URL="file://$releases"

"$MISE" ls-remote toolshed:check-pins > "$work/ls-remote.out"
printf '1.0.0\n1.1.0\n' > "$work/ls-remote.expected"
if ! cmp -s "$work/ls-remote.out" "$work/ls-remote.expected"; then
	echo "mise ls-remote toolshed:check-pins did not print 1.0.0 and 1.1.0" >&2
	cat "$work/ls-remote.out" >&2
	exit 1
fi
echo "mise ls-remote toolshed:check-pins"
cat "$work/ls-remote.out"

if "$MISE" ls-remote toolshed:not-a-tool >"$work/unknown.out" 2>"$work/unknown.err"; then
	echo "unknown tool listed versions" >&2
	exit 1
fi
echo "unknown tool failed"
cat "$work/unknown.err"

cat > mise.toml << 'EOF'
[tools]
"toolshed:check-pins" = "1.0.0"
EOF

"$MISE" install
installed=$("$MISE" where toolshed:check-pins)
bin="$installed/bin/check-pins"
if [ ! -x "$bin" ]; then
	echo "installed check-pins is not executable" >&2
	exit 1
fi
if [ -e "$installed/bin/check-pins.mjs" ]; then
	echo "install left check-pins.mjs in bin" >&2
	exit 1
fi
resolved=$("$MISE" exec -- sh -c 'command -v check-pins')
case $resolved in
"$installed"/*) ;;
*)
	echo "command -v check-pins is outside the install dir: $resolved" >&2
	exit 1
	;;
esac
echo "mise exec -- sh -c 'command -v check-pins'"
printf '%s\n' "$resolved"
version_out=$("$MISE" exec -- check-pins --version)
if [ "$version_out" != "1.0.0" ]; then
	echo "check-pins --version printed '$version_out'" >&2
	exit 1
fi
echo "mise exec -- check-pins --version"
printf '%s\n' "$version_out"

if "$MISE" install "toolshed:check-pins@9.9.9" >"$work/tamper.out" 2>"$work/tamper.err"; then
	echo "tampered install succeeded" >&2
	exit 1
fi
if ! grep -F "check-pins.mjs checksum mismatch for tag check-pins-v9.9.9" "$work/tamper.err" >/dev/null; then
	echo "tampered install did not report the mismatch" >&2
	cat "$work/tamper.err" >&2
	exit 1
fi
if ! grep -F "$actual_line" "$work/tamper.err" >/dev/null || ! grep -F "$expected" "$work/tamper.err" >/dev/null; then
	echo "tampered install did not name expected and actual hashes" >&2
	echo "expected sums line $actual_line" >&2
	echo "actual file $expected" >&2
	cat "$work/tamper.err" >&2
	exit 1
fi
if find "$MISE_DATA_DIR" -type f -name check-pins | grep -F '/9.9.9/' >/dev/null; then
	echo "tampered install left bin/check-pins" >&2
	find "$MISE_DATA_DIR" -type f -name check-pins >&2
	exit 1
fi
echo "tampered install failed"
cat "$work/tamper.err"

if "$MISE" install "toolshed:check-pins@9.8.0" >"$work/missing.out" 2>"$work/missing.err"; then
	echo "missing checksum entry install succeeded" >&2
	exit 1
fi
if ! grep -F "SHA256SUMS has no check-pins.mjs line for tag check-pins-v9.8.0" "$work/missing.err" >/dev/null; then
	echo "missing checksum entry did not name the file and tag" >&2
	cat "$work/missing.err" >&2
	exit 1
fi
if find "$MISE_DATA_DIR" -type f -name check-pins | grep -F '/9.8.0/' >/dev/null; then
	echo "missing checksum entry left bin/check-pins" >&2
	exit 1
fi
echo "missing checksum entry failed"
cat "$work/missing.err"
