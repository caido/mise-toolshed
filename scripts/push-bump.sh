#!/bin/sh
set -eu

tool=${TOOL:?}
script_dir=$(CDPATH='' cd -- "$(dirname "$0")" && pwd)
script_root=$(CDPATH='' cd -- "$script_dir/.." && pwd)
root=$(git rev-parse --show-toplevel)

sh "$script_dir/require-default-branch.sh"

case $tool in
'' | *[!a-z0-9-]*)
	echo "unknown tool: $tool" >&2
	exit 1
	;;
esac

manifest="packages/$tool/package.json"
version=$(node "$script_root/scripts/read-package-version.ts" "$root/$manifest")
case $version in
'' | *[!0-9.]*)
	echo "invalid version: $version" >&2
	exit 1
	;;
esac

cd "$root" || exit 1
if git diff --quiet -- "$manifest" && git diff --cached --quiet -- "$manifest"; then
	echo "refusing to commit unchanged $manifest" >&2
	exit 1
fi

branch="bump/${tool}-v${version}"
GIT_AUTHOR_NAME='github-actions[bot]'
GIT_AUTHOR_EMAIL='41898282+github-actions[bot]@users.noreply.github.com'
GIT_COMMITTER_NAME=$GIT_AUTHOR_NAME
GIT_COMMITTER_EMAIL=$GIT_AUTHOR_EMAIL
export GIT_AUTHOR_NAME GIT_AUTHOR_EMAIL GIT_COMMITTER_NAME GIT_COMMITTER_EMAIL

git -c commit.gpgsign=false commit -q -m "Bump ${tool} to ${version}" -- "$manifest"

remote=${BUMP_REMOTE:-origin}
refspec="HEAD:refs/heads/${branch}"
if [ -n "${GH_TOKEN:-}" ]; then
	basic=$(printf 'x-access-token:%s' "$GH_TOKEN" | base64 -w 0)
	git -c "http.extraHeader=AUTHORIZATION: basic ${basic}" push -q "$remote" "$refspec"
else
	git push -q "$remote" "$refspec"
fi

printf 'pushed %s\n' "$branch"
