# check-exact-versions

`check-exact-versions` scans the current directory and prints each pin that is not exact. A clean tree prints nothing and exits 0. `--version` prints the version. Any other argument list prints usage and does not scan.

## Sub-features

- `exact-finding` exits 1 when a dependency spec is `latest`.
- `exact-clean` exits 0 when that dependency spec is an exact version.
- `exact-version` prints the package version.
- `exact-usage` rejects an argument other than a single `--version`.

## How to get to it (user POV)

- From the directory to scan, run `node packages/check-exact-versions/dist/check-exact-versions.mjs` with no arguments.
- Run the same command with `--version`.
- Run the same command with any other argument list, such as `--help`.

## Driving it with session.sh

Preconditions:

- Doctor has exited 0 in this `session.sh` invocation.
- `$REPO`, `$SCRATCH`, and `$EVIDENCE` are set, and `record` is defined.

- **exact-finding.** Write a `package.json` whose dependency `left-pad` is `latest`, and scan that directory. Exit status is 1, stdout contains `package.json:3: dependency left-pad is not an exact version`, and stderr is empty.
- **exact-clean.** Change that spec to `1.2.3` and scan again. Exit status is 0 and both streams are empty.
- **exact-version.** Run `--version` outside the tree. Exit status is 0, stdout is the `version` field of `packages/check-exact-versions/package.json` plus a newline, and stderr is empty.
- **exact-usage.** Run `--help`. Exit status is 1, stdout is empty, and stderr is `usage: check-exact-versions --version` plus a newline.

```sh
sh .agents/skills/playbook-verify-toolshed/session.sh check-exact-versions <<'EOF'
TREE="$SCRATCH/tree"
mkdir -p "$TREE"
printf '%s\n' '{' '  "dependencies": {' '    "left-pad": "latest"' '  }' '}' >"$TREE/package.json"
status=0
(CDPATH='' cd -- "$TREE" && node "$REPO/packages/check-exact-versions/dist/check-exact-versions.mjs" >"$SCRATCH/latest.out" 2>"$SCRATCH/latest.err") || status=$?
record exact-finding "$status" "$SCRATCH/latest.out" "$SCRATCH/latest.err"
test "$status" -eq 1
test ! -s "$SCRATCH/latest.err"
grep -F 'package.json:3: dependency left-pad is not an exact version' "$SCRATCH/latest.out" >/dev/null

printf '%s\n' '{' '  "dependencies": {' '    "left-pad": "1.2.3"' '  }' '}' >"$TREE/package.json"
status=0
(CDPATH='' cd -- "$TREE" && node "$REPO/packages/check-exact-versions/dist/check-exact-versions.mjs" >"$SCRATCH/exact.out" 2>"$SCRATCH/exact.err") || status=$?
record exact-clean "$status" "$SCRATCH/exact.out" "$SCRATCH/exact.err"
test "$status" -eq 0
test ! -s "$SCRATCH/exact.out"
test ! -s "$SCRATCH/exact.err"

status=0
node "$REPO/packages/check-exact-versions/dist/check-exact-versions.mjs" --version >"$SCRATCH/ver.out" 2>"$SCRATCH/ver.err" || status=$?
record exact-version "$status" "$SCRATCH/ver.out" "$SCRATCH/ver.err"
test "$status" -eq 0
test ! -s "$SCRATCH/ver.err"
expected=$(node -p "require('$REPO/packages/check-exact-versions/package.json').version")
printf '%s\n' "$expected" >"$SCRATCH/ver.expected"
cmp -s "$SCRATCH/ver.expected" "$SCRATCH/ver.out"

status=0
node "$REPO/packages/check-exact-versions/dist/check-exact-versions.mjs" --help >"$SCRATCH/usage.out" 2>"$SCRATCH/usage.err" || status=$?
record exact-usage "$status" "$SCRATCH/usage.out" "$SCRATCH/usage.err"
test "$status" -eq 1
test ! -s "$SCRATCH/usage.out"
printf '%s\n' 'usage: check-exact-versions --version' >"$SCRATCH/usage.expected"
cmp -s "$SCRATCH/usage.expected" "$SCRATCH/usage.err"
EOF
```

## Gotchas

- A path argument is usage. The scan directory is the process's current directory.
- The walk does not follow symbolic links and does not enter `node_modules`, `.git`, or `dist`.
- The finding line number is the line of the pin in the scanned file.
- The drive uses one `package.json` dependency. A mise tool, a pyproject requirement, a container image, or a plugin pin in the same tree is also a finding when it is not exact.
