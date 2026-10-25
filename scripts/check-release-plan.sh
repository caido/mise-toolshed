#!/bin/sh
set -eu

root=$(CDPATH='' cd -- "$(dirname "$0")/.." && pwd)

for tool in check-exact-versions check-lockfiles check-minimum-release-age; do
	version=$(node "$root/scripts/read-package-version.ts" "$root/packages/$tool/package.json")
	tag="${tool}-v${version}"
	plan=$(sh "$root/scripts/plan-release.sh" "$tag")
	case "$plan" in
	"publish ${tool} ${version}") ;;
	*)
		echo "unexpected plan: $plan" >&2
		exit 1
		;;
	esac
done
