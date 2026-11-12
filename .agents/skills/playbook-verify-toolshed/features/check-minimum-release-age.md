# check-minimum-release-age

`check-minimum-release-age` scans the current directory and prints each pnpm or mise release-age setting that is missing or below 7 days. A passing setting prints nothing and exits 0. `--version` prints the version. Any other argument list prints usage and does not scan.

## Sub-features

- `age-missing` exits 1 when `pnpm-workspace.yaml` has no `minimumReleaseAge`.
- `age-set` exits 0 when `minimumReleaseAge` is `10080`.
- `age-version` prints the package version.
- `age-usage` rejects an argument other than a single `--version`.

## How to get to it (user POV)

- From the directory to scan, run `node packages/check-minimum-release-age/dist/check-minimum-release-age.mjs` with no arguments.
- Run the same command with `--version`.
- Run the same command with any other argument list, such as `--help`.

## Driving it with session.sh

Preconditions:

- Doctor has exited 0 in this `session.sh` invocation.
- `$REPO`, `$SCRATCH`, and `$EVIDENCE` are set, and `record` is defined.

- **Missing age.** Write an empty `pnpm-workspace.yaml` and scan that directory. Exit status is 1, stdout is `pnpm-workspace.yaml:1: minimumReleaseAge is not set` plus a newline, and stderr is empty.
- **Passing age.** Set `minimumReleaseAge: 10080` and scan again. Exit status is 0 and both streams are empty.
- **Version.** Run `--version`. Exit status is 0, stdout is the `version` field of `packages/check-minimum-release-age/package.json` plus a newline, and stderr is empty.
- **Usage.** Run `--help`. Exit status is 1, stdout is empty, and stderr is `usage: check-minimum-release-age --version` plus a newline.

```sh
sh .agents/skills/playbook-verify-toolshed/session.sh check-minimum-release-age <<'EOF'
TREE="$SCRATCH/tree"
mkdir -p "$TREE"
: >"$TREE/pnpm-workspace.yaml"
status=0
(CDPATH='' cd -- "$TREE" && node "$REPO/packages/check-minimum-release-age/dist/check-minimum-release-age.mjs" >"$SCRATCH/missing.out" 2>"$SCRATCH/missing.err") || status=$?
record missing "$status" "$SCRATCH/missing.out" "$SCRATCH/missing.err"
test "$status" -eq 1
test ! -s "$SCRATCH/missing.err"
printf '%s\n' 'pnpm-workspace.yaml:1: minimumReleaseAge is not set' >"$SCRATCH/missing.expected"
cmp -s "$SCRATCH/missing.expected" "$SCRATCH/missing.out"

printf '%s\n' 'minimumReleaseAge: 10080' >"$TREE/pnpm-workspace.yaml"
status=0
(CDPATH='' cd -- "$TREE" && node "$REPO/packages/check-minimum-release-age/dist/check-minimum-release-age.mjs" >"$SCRATCH/set.out" 2>"$SCRATCH/set.err") || status=$?
record set "$status" "$SCRATCH/set.out" "$SCRATCH/set.err"
test "$status" -eq 0
test ! -s "$SCRATCH/set.out"
test ! -s "$SCRATCH/set.err"

status=0
node "$REPO/packages/check-minimum-release-age/dist/check-minimum-release-age.mjs" --version >"$SCRATCH/ver.out" 2>"$SCRATCH/ver.err" || status=$?
record version "$status" "$SCRATCH/ver.out" "$SCRATCH/ver.err"
test "$status" -eq 0
test ! -s "$SCRATCH/ver.err"
expected=$(node -p "require('$REPO/packages/check-minimum-release-age/package.json').version")
printf '%s\n' "$expected" >"$SCRATCH/ver.expected"
cmp -s "$SCRATCH/ver.expected" "$SCRATCH/ver.out"

status=0
node "$REPO/packages/check-minimum-release-age/dist/check-minimum-release-age.mjs" --help >"$SCRATCH/usage.out" 2>"$SCRATCH/usage.err" || status=$?
record usage "$status" "$SCRATCH/usage.out" "$SCRATCH/usage.err"
test "$status" -eq 1
test ! -s "$SCRATCH/usage.out"
printf '%s\n' 'usage: check-minimum-release-age --version' >"$SCRATCH/usage.expected"
cmp -s "$SCRATCH/usage.expected" "$SCRATCH/usage.err"
EOF
```

## Gotchas

- The command reads configuration only. It does not call a registry.
- A directory with neither `pnpm-workspace.yaml` nor a mise config exits 0.
- `10080` is the passing minute count. A smaller number is a finding.
- The drive writes only `pnpm-workspace.yaml`. A mise config in that directory is judged too, and a missing `minimum_release_age` is another finding.
