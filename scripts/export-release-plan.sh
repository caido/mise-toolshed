#!/bin/sh
set -eu

if [ -z "${GITHUB_OUTPUT:-}" ]; then
	echo "GITHUB_OUTPUT is required" >&2
	exit 1
fi

tag=${GITHUB_REF_NAME:?}
root=$(CDPATH='' cd -- "$(dirname "$0")/.." && pwd)
plan=$(sh "$root/scripts/plan-release.sh" "$tag")

case "$plan" in
skip)
	echo "action=skip" >>"$GITHUB_OUTPUT"
	echo "tag=${tag}" >>"$GITHUB_OUTPUT"
	echo "::notice::tag ${tag} has no workspace package; publishing nothing"
	;;
publish\ *)
	rest=${plan#publish }
	tool=${rest%% *}
	echo "action=publish" >>"$GITHUB_OUTPUT"
	echo "tool=${tool}" >>"$GITHUB_OUTPUT"
	echo "tag=${tag}" >>"$GITHUB_OUTPUT"
	;;
*)
	echo "unexpected plan: $plan" >&2
	exit 1
	;;
esac
