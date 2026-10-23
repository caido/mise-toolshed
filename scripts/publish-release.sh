#!/bin/sh
set -eu

tag=${GITHUB_REF_NAME:?}
tool=${TOOL:?}
stage=${RUNNER_TEMP:?}/release
view_err=$(mktemp)
trap 'rm -f "$view_err"' EXIT

if draft=$(gh release view "$tag" --json isDraft --jq .isDraft 2>"$view_err"); then
	case "$draft" in
	true | false) ;;
	*)
		echo "unexpected isDraft: $draft" >&2
		exit 1
		;;
	esac
	gh release upload "$tag" "$stage/$tool.mjs" "$stage/SHA256SUMS" --clobber
	if [ "$draft" = "true" ]; then
		gh release edit "$tag" --draft=false
	fi
elif grep -F -q "release not found" "$view_err"; then
	gh release create "$tag" "$stage/$tool.mjs" "$stage/SHA256SUMS" --title "$tag" --notes "" --verify-tag
else
	cat "$view_err" >&2
	exit 1
fi
