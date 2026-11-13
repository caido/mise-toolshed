# stage-release

`stage-release.sh` copies one built bundle into a destination directory and writes `SHA256SUMS` beside it. The script prints usage and exits 1 when the argument count is not two. When the bundle is absent, the script prints `missing` and the absolute bundle path, and it does not create the destination.

## Sub-features

- `stage-copy` copies `check-exact-versions.mjs` and writes `SHA256SUMS`.
- `stage-usage` rejects an argument count other than two.
- `stage-missing` prints `missing` and the absolute `packages/<tool>/dist/<tool>.mjs` path when that bundle is absent.

## How to get to it (user POV)

- Run `sh scripts/stage-release.sh <tool> <dest>` for a tool whose bundle exists.
- Run `sh scripts/stage-release.sh` with no arguments.
- Run `sh scripts/stage-release.sh <tool> <dest>` for a tool with no bundle.

## Driving it with session.sh

Preconditions:

- Doctor has exited 0 in this `session.sh` invocation.
- `$REPO`, `$SCRATCH`, and `$EVIDENCE` are set, and `log` is defined.
- `packages/check-exact-versions/dist/check-exact-versions.mjs` exists.

- **stage-copy.** Run `stage-release.sh check-exact-versions` into a new directory. Exit status is 0, stdout contains `check-exact-versions.mjs: OK`, stderr is empty, and the destination `check-exact-versions.mjs` matches the built bundle byte for byte. `SHA256SUMS` is appended to the evidence file.
- **stage-usage.** Run `stage-release.sh` with no arguments. Exit status is 1, stdout is empty, and stderr is `usage: stage-release.sh <tool> <dest>` plus a newline.
- **stage-missing.** Run `stage-release.sh not-a-tool` into `$SCRATCH/missing`. Exit status is 1, stdout is empty, and stderr is exactly `missing $REPO/packages/not-a-tool/dist/not-a-tool.mjs` plus a newline. `$SCRATCH/missing` does not exist.

```sh
sh .agents/skills/playbook-verify-toolshed/session.sh stage-release <<'EOF'
status=0
sh "$REPO/scripts/stage-release.sh" check-exact-versions "$SCRATCH/stage" >"$SCRATCH/stage.out" 2>"$SCRATCH/stage.err" || status=$?
log "stage-copy status=$status"
{
	printf '%s\n' '--- stdout ---'
	cat "$SCRATCH/stage.out"
	printf '%s\n' '--- stderr ---'
	cat "$SCRATCH/stage.err"
} >>"$EVIDENCE"
cat "$SCRATCH/stage/SHA256SUMS" >>"$EVIDENCE"
test "$status" -eq 0
test ! -s "$SCRATCH/stage.err"
grep -F 'check-exact-versions.mjs: OK' "$SCRATCH/stage.out" >/dev/null
test -f "$SCRATCH/stage/check-exact-versions.mjs"
test -f "$SCRATCH/stage/SHA256SUMS"
cmp -s "$REPO/packages/check-exact-versions/dist/check-exact-versions.mjs" "$SCRATCH/stage/check-exact-versions.mjs"

status=0
sh "$REPO/scripts/stage-release.sh" >"$SCRATCH/usage.out" 2>"$SCRATCH/usage.err" || status=$?
log "stage-usage status=$status"
{
	printf '%s\n' '--- stdout ---'
	cat "$SCRATCH/usage.out"
	printf '%s\n' '--- stderr ---'
	cat "$SCRATCH/usage.err"
} >>"$EVIDENCE"
test "$status" -eq 1
test ! -s "$SCRATCH/usage.out"
printf '%s\n' 'usage: stage-release.sh <tool> <dest>' >"$SCRATCH/usage.expected"
cmp -s "$SCRATCH/usage.expected" "$SCRATCH/usage.err"

status=0
sh "$REPO/scripts/stage-release.sh" not-a-tool "$SCRATCH/missing" >"$SCRATCH/missing.out" 2>"$SCRATCH/missing.err" || status=$?
log "stage-missing status=$status"
{
	printf '%s\n' '--- stdout ---'
	cat "$SCRATCH/missing.out"
	printf '%s\n' '--- stderr ---'
	cat "$SCRATCH/missing.err"
} >>"$EVIDENCE"
test "$status" -eq 1
test ! -s "$SCRATCH/missing.out"
printf '%s\n' "missing $REPO/packages/not-a-tool/dist/not-a-tool.mjs" >"$SCRATCH/missing.expected"
cmp -s "$SCRATCH/missing.expected" "$SCRATCH/missing.err"
test ! -e "$SCRATCH/missing"
EOF
```

## Gotchas

- The bundle path is `packages/<tool>/dist/<tool>.mjs` under the checkout that contains `scripts/stage-release.sh`. Launch has to finish first.
- `sha256sum -c` writes `<tool>.mjs: OK` on stdout. Stderr stays empty when the checksum matches.
- `not-a-tool` is a name with no package. The destination is not created when the bundle is missing.
