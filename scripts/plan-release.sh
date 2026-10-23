#!/bin/sh
set -eu

if [ "$#" -ne 1 ]; then
	echo "usage: plan-release.sh <tool-vversion>" >&2
	exit 1
fi

tag=$1
root=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)

case $tag in
*-v*) ;;
*)
	echo "not a tool tag: $tag" >&2
	exit 1
	;;
esac

tool=${tag%-v*}
version=${tag#"${tool}-v"}

case $tool in
'' | *[!a-z0-9-]*)
	echo "not a package tool tag: $tag" >&2
	exit 1
	;;
esac

if [ -z "$version" ]; then
	echo "not a tool tag: $tag" >&2
	exit 1
fi

manifest="$root/packages/$tool/package.json"
if [ ! -f "$manifest" ]; then
	echo "tag $tag has no packages/$tool; publishing nothing" >&2
	echo skip
	exit 0
fi

pkg_version=$(TOOLSHED_PKG="$manifest" node --input-type=module -e '
import { readFileSync } from "node:fs";
const raw = JSON.parse(readFileSync(process.env.TOOLSHED_PKG, "utf8"));
if (typeof raw.version !== "string" || raw.version.length === 0) {
  process.stderr.write("package.json version is missing\n");
  process.exit(1);
}
process.stdout.write(raw.version);
')

if [ "$version" != "$pkg_version" ]; then
	echo "tag $tag version $version does not match packages/$tool/package.json $pkg_version" >&2
	exit 1
fi

echo "publish $tool $version"
