#!/bin/sh
set -eu

default_branch=${DEFAULT_BRANCH:?}
ref=${GITHUB_REF:?}

if [ "$ref" != "refs/heads/${default_branch}" ]; then
	echo "refusing dispatch from $ref; default branch is $default_branch" >&2
	exit 1
fi
