# check-lockfiles

`check-lockfiles` scans the current directory and prints each manifest whose lockfile is missing. When every required lockfile is present, the command prints nothing and exits 0. `--version` prints the version. Any other argument list prints usage and does not scan.

## Sub-features

- `lockfile-missing` exits 1 when `package.json` has no `pnpm-lock.yaml`.
- `lockfile-present` exits 0 when `pnpm-lock.yaml` is in that directory.
- `lockfile-version` prints the package version.
- `lockfile-usage` rejects an argument other than a single `--version`.

## How to get to it (user POV)

- From the directory to scan, run `node "$REPO/packages/check-lockfiles/dist/check-lockfiles.mjs"` with no arguments. `$REPO` is the absolute path of the checkout.
- Run the same command with `--version`.
- Run the same command with any other argument list, such as `--help`.

## Driving it with session.sh

Preconditions:

- Doctor has exited 0 in this `session.sh` invocation.
- `$REPO`, `$SCRATCH`, and `$EVIDENCE` are set, and `log` is defined.

- **lockfile-missing.** Write `package.json` and scan that directory. Exit status is 1, stdout is `package.json:1: lockfile pnpm-lock.yaml is missing` plus a newline, and stderr is empty.
- **lockfile-present.** Add an empty `pnpm-lock.yaml` beside it and scan again. Exit status is 0, and stdout and stderr are empty.
- **lockfile-version.** Run `--version`. Exit status is 0, stdout is the `version` field of `packages/check-lockfiles/package.json` plus a newline, and stderr is empty.
- **lockfile-usage.** Run `--help`. Exit status is 1, stdout is empty, and stderr is `usage: check-lockfiles --version` plus a newline.

```sh
sh .agents/skills/playbook-verify-toolshed/session.sh check-lockfiles <<'EOF'
TREE="$SCRATCH/tree"
mkdir -p "$TREE"
printf '%s\n' '{' '  "name": "fixture"' '}' >"$TREE/package.json"
status=0
(CDPATH='' cd -- "$TREE" && node "$REPO/packages/check-lockfiles/dist/check-lockfiles.mjs" >"$SCRATCH/missing.out" 2>"$SCRATCH/missing.err") || status=$?
log "lockfile-missing status=$status"
{
	printf '%s\n' '--- stdout ---'
	cat "$SCRATCH/missing.out"
	printf '%s\n' '--- stderr ---'
	cat "$SCRATCH/missing.err"
} >>"$EVIDENCE"
test "$status" -eq 1
test ! -s "$SCRATCH/missing.err"
printf '%s\n' 'package.json:1: lockfile pnpm-lock.yaml is missing' >"$SCRATCH/missing.expected"
cmp -s "$SCRATCH/missing.expected" "$SCRATCH/missing.out"

: >"$TREE/pnpm-lock.yaml"
status=0
(CDPATH='' cd -- "$TREE" && node "$REPO/packages/check-lockfiles/dist/check-lockfiles.mjs" >"$SCRATCH/present.out" 2>"$SCRATCH/present.err") || status=$?
log "lockfile-present status=$status"
{
	printf '%s\n' '--- stdout ---'
	cat "$SCRATCH/present.out"
	printf '%s\n' '--- stderr ---'
	cat "$SCRATCH/present.err"
} >>"$EVIDENCE"
test "$status" -eq 0
test ! -s "$SCRATCH/present.out"
test ! -s "$SCRATCH/present.err"

status=0
node "$REPO/packages/check-lockfiles/dist/check-lockfiles.mjs" --version >"$SCRATCH/ver.out" 2>"$SCRATCH/ver.err" || status=$?
log "lockfile-version status=$status"
{
	printf '%s\n' '--- stdout ---'
	cat "$SCRATCH/ver.out"
	printf '%s\n' '--- stderr ---'
	cat "$SCRATCH/ver.err"
} >>"$EVIDENCE"
test "$status" -eq 0
test ! -s "$SCRATCH/ver.err"
expected=$(node -p "require('$REPO/packages/check-lockfiles/package.json').version")
printf '%s\n' "$expected" >"$SCRATCH/ver.expected"
cmp -s "$SCRATCH/ver.expected" "$SCRATCH/ver.out"

status=0
node "$REPO/packages/check-lockfiles/dist/check-lockfiles.mjs" --help >"$SCRATCH/usage.out" 2>"$SCRATCH/usage.err" || status=$?
log "lockfile-usage status=$status"
{
	printf '%s\n' '--- stdout ---'
	cat "$SCRATCH/usage.out"
	printf '%s\n' '--- stderr ---'
	cat "$SCRATCH/usage.err"
} >>"$EVIDENCE"
test "$status" -eq 1
test ! -s "$SCRATCH/usage.out"
printf '%s\n' 'usage: check-lockfiles --version' >"$SCRATCH/usage.expected"
cmp -s "$SCRATCH/usage.expected" "$SCRATCH/usage.err"
EOF
```

## Gotchas

- The command does not read lockfile contents. An empty `pnpm-lock.yaml` satisfies `package.json`.
- A lockfile in the manifest directory or any parent directory up to the scan root counts. A lockfile in a child directory or a sibling directory does not count.
- The walk does not follow symbolic links and does not enter `node_modules`, `.git`, or `dist`.
- The drive uses `package.json`. `pyproject.toml`, `mise.toml`, and `Cargo.toml` in the same tree are also manifests.
