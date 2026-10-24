#!/bin/sh
set -eu

tag=${RELEASE_TAG:?}
sha=${GITHUB_SHA:?}
repo=${GITHUB_REPOSITORY:?}
: "${GH_TOKEN:?}"

gh api --method POST "repos/${repo}/git/refs" -f "ref=refs/tags/${tag}" -f "sha=${sha}"
