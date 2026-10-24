#!/bin/sh
set -eu

if [ -z "${GITHUB_OUTPUT:-}" ]; then
	echo "GITHUB_OUTPUT is required" >&2
	exit 1
fi

tool=${TOOL:?}
default_branch=${DEFAULT_BRANCH:?}
ref=${GITHUB_REF:?}
repo=${GITHUB_REPOSITORY:?}
root=$(CDPATH='' cd -- "$(dirname "$0")/.." && pwd)

case $tool in
'' | *[!a-z0-9-]*)
	echo "unknown tool: $tool" >&2
	exit 1
	;;
esac

manifest="$root/packages/$tool/package.json"
if [ ! -f "$manifest" ]; then
	echo "unknown tool: $tool" >&2
	exit 1
fi

version=$(node "$root/scripts/read-package-version.ts" "$manifest")
case $version in
'' | *[!0-9A-Za-z.+-]*)
	echo "invalid version: $version" >&2
	exit 1
	;;
esac

tag="${tool}-v${version}"
if [ "$ref" != "refs/heads/${default_branch}" ]; then
	echo "refusing dispatch from $ref; default branch is $default_branch" >&2
	exit 1
fi

tag_err=$(mktemp)
rel_err=$(mktemp)
trap 'rm -f "$tag_err" "$rel_err"' EXIT

if gh api "repos/${repo}/git/ref/tags/${tag}" >/dev/null 2>"$tag_err"; then
	echo "tag $tag already exists" >&2
	exit 1
elif grep -F -q "HTTP 404" "$tag_err"; then
	:
else
	cat "$tag_err" >&2
	exit 1
fi

if draft=$(gh release view "$tag" --json isDraft --jq .isDraft 2>"$rel_err"); then
	case "$draft" in
	false)
		echo "published release $tag already exists" >&2
		exit 1
		;;
	true) ;;
	*)
		echo "unexpected isDraft: $draft" >&2
		exit 1
		;;
	esac
elif grep -F -q "release not found" "$rel_err"; then
	:
else
	cat "$rel_err" >&2
	exit 1
fi

plan=$(sh "$root/scripts/plan-release.sh" "$tag")
if [ "$plan" != "publish ${tool} ${version}" ]; then
	echo "unexpected plan: $plan" >&2
	exit 1
fi

printf '%s\n' "$plan" "$tag"
{
	echo "action=publish"
	echo "tool=${tool}"
	echo "tag=${tag}"
} >>"$GITHUB_OUTPUT"
