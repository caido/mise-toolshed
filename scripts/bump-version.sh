#!/bin/sh
set -eu

if [ "$#" -ne 3 ]; then
	echo "usage: bump-version.sh <root> <tool> <part>" >&2
	exit 1
fi

root=$1
tool=$2
part=$3
script_root=$(CDPATH='' cd -- "$(dirname "$0")/.." && pwd)

case $tool in
'' | *[!a-z0-9-]*)
	echo "unknown tool: $tool" >&2
	exit 1
	;;
esac

case $part in
major | minor | patch) ;;
*)
	echo "invalid part: $part" >&2
	exit 1
	;;
esac

manifest="$root/packages/$tool/package.json"
if [ ! -f "$manifest" ]; then
	echo "unknown tool: $tool" >&2
	exit 1
fi

node "$script_root/scripts/bump-package-version.ts" "$manifest" "$part"
