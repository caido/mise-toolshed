#!/bin/sh
set -eu

REPO=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
version=$(TOOLSHED_PKG="$REPO/packages/check-pins/package.json" node --input-type=module -e '
import { readFileSync } from "node:fs";
const raw = JSON.parse(readFileSync(process.env.TOOLSHED_PKG, "utf8"));
process.stdout.write(raw.version);
')

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
mkdir -p "$work/bin"
cat > "$work/bin/gh" << 'EOF'
#!/bin/sh
echo "gh invoked" >&2
exit 99
EOF
chmod +x "$work/bin/gh"
export PATH="$work/bin:$PATH"

skip_out=$(sh "$REPO/scripts/plan-release.sh" get-skills-v1.0.0 2>"$work/skip.err")
if [ "$skip_out" != "skip" ]; then
	echo "get-skills-v1.0.0 did not plan a skip" >&2
	printf '%s\n' "$skip_out" >&2
	exit 1
fi
if ! grep -F "tag get-skills-v1.0.0 has no packages/get-skills; publishing nothing" "$work/skip.err" >/dev/null; then
	echo "get-skills-v1.0.0 skip notice is missing" >&2
	cat "$work/skip.err" >&2
	exit 1
fi
if grep -F "gh invoked" "$work/skip.err" >/dev/null; then
	echo "get-skills-v1.0.0 invoked gh" >&2
	exit 1
fi
echo "get-skills-v1.0.0 publishes nothing and exits 0"
cat "$work/skip.err"

if sh "$REPO/scripts/plan-release.sh" check-pins-v9.9.9 >"$work/mismatch.out" 2>"$work/mismatch.err"; then
	echo "check-pins-v9.9.9 planned a publish" >&2
	exit 1
fi
if ! grep -F "does not match packages/check-pins/package.json $version" "$work/mismatch.err" >/dev/null; then
	echo "check-pins-v9.9.9 did not fail the package.json version check" >&2
	cat "$work/mismatch.err" >&2
	exit 1
fi
if grep -F "gh invoked" "$work/mismatch.err" >/dev/null; then
	echo "check-pins-v9.9.9 invoked gh" >&2
	exit 1
fi
if [ -s "$work/mismatch.out" ]; then
	echo "check-pins-v9.9.9 wrote a plan before failing" >&2
	cat "$work/mismatch.out" >&2
	exit 1
fi
echo "check-pins-v9.9.9 fails before publishing"
cat "$work/mismatch.err"

match_out=$(sh "$REPO/scripts/plan-release.sh" "check-pins-v$version" 2>"$work/match.err")
if [ "$match_out" != "publish check-pins $version" ]; then
	echo "matching tag did not proceed" >&2
	printf '%s\n' "$match_out" >&2
	exit 1
fi
if grep -F "gh invoked" "$work/match.err" >/dev/null; then
	echo "matching tag invoked gh" >&2
	exit 1
fi
echo "check-pins-v$version proceeds"
printf '%s\n' "$match_out"
