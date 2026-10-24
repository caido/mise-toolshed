#!/bin/sh
set -eu

root=$(CDPATH='' cd -- "$(dirname "$0")/.." && pwd)
version=$(node "$root/scripts/read-package-version.ts" "$root/packages/check-pins/package.json")
tag="check-pins-v${version}"
plan=$(sh "$root/scripts/plan-release.sh" "$tag")

case "$plan" in
"publish check-pins ${version}") ;;
*)
	echo "unexpected plan: $plan" >&2
	exit 1
	;;
esac
