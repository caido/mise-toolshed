#!/bin/sh
set -eu

if [ "$#" -ne 2 ]; then
	echo "usage: stage-release.sh <tool> <dest>" >&2
	exit 1
fi

tool=$1
dest=$2
root=$(CDPATH='' cd -- "$(dirname "$0")/.." && pwd)
src="$root/packages/$tool/dist/$tool.mjs"

if [ ! -f "$src" ]; then
	echo "missing $src" >&2
	exit 1
fi

mkdir -p "$dest"
cp "$src" "$dest/$tool.mjs"
(
	cd "$dest"
	sha256sum "$tool.mjs" >SHA256SUMS
	sha256sum -c SHA256SUMS
)
