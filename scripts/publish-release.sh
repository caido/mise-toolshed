#!/bin/sh
set -eu

tag=${GITHUB_REF_NAME:?}
tool=${TOOL:?}
stage=${RUNNER_TEMP:?}/release
view_err=$(mktemp)
trap 'rm -f "$view_err"' EXIT

if gh release view "$tag" >/dev/null 2>"$view_err"; then
	gh release upload "$tag" "$stage/$tool.mjs" "$stage/SHA256SUMS" --clobber
elif grep -F -q "release not found" "$view_err"; then
	gh release create "$tag" "$stage/$tool.mjs" "$stage/SHA256SUMS" --title "$tag" --notes "" --verify-tag
else
	cat "$view_err" >&2
	exit 1
fi
