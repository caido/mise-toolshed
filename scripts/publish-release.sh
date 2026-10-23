#!/bin/sh
set -eu

tag=${GITHUB_REF_NAME:?}
tool=${TOOL:?}
stage=${RUNNER_TEMP:?}/release

if gh release view "$tag" >/dev/null 2>&1; then
	gh release upload "$tag" "$stage/$tool.mjs" "$stage/SHA256SUMS" --clobber
else
	gh release create "$tag" "$stage/$tool.mjs" "$stage/SHA256SUMS" --title "$tag" --notes "" --verify-tag
fi
