---
name: verify-toolshed
description: Drive check-pins, get-skills, and stage-release.sh on a scratch tree and keep one evidence file.
---

# verify-toolshed

Run Launch and Doctor in the checkout. Run the Drive block as its own subshell. Cleanup checks the evidence path and the scratch path that subshell prints.

## Launch

Run `mise run build`.

That task uses the toolchain pinned in `.mise/config.toml`. The build is ready when `packages/check-pins/dist/check-pins.mjs` exists.

## Doctor

Run this after Launch and before Drive. It only reads the checkout. Stop when a command exits non-zero.

```sh
set -eu
test -f packages/check-pins/dist/check-pins.mjs
test -f packages/get-skills/dist/get-skills.mjs
test -f scripts/stage-release.sh
command -v git >/dev/null
command -v sha256sum >/dev/null
node packages/check-pins/dist/check-pins.mjs --version
```

`--version` prints one version line on stdout and exits 0. Doctor does not clone, fetch, or write a stage directory.

## Drive

Run this whole block as one subshell from the checkout. The subshell owns `HOME` and the git identity. The parent shell keeps its own. The EXIT trap is installed immediately after `$SCRATCH` is created, so an early `set -eu` failure still deletes that directory.

```sh
(
  set -eu
  REPO=$(CDPATH='' cd -- . && pwd)
  SCRATCH=$(mktemp -d "${TMPDIR:-/tmp}/verify-toolshed.XXXXXX")
  trap 'rm -rf "$SCRATCH"' EXIT
  EVIDENCE=$(mktemp "${TMPDIR:-/tmp}/verify-toolshed-evidence.XXXXXX")
  export GIT_CONFIG_COUNT=0
  unset GIT_CONFIG_PARAMETERS
  export GIT_CONFIG_GLOBAL="$SCRATCH/gitconfig"
  export GIT_CONFIG_SYSTEM=/dev/null
  export GIT_AUTHOR_NAME=toolshed
  export GIT_AUTHOR_EMAIL=toolshed@example.com
  export GIT_COMMITTER_NAME=toolshed
  export GIT_COMMITTER_EMAIL=toolshed@example.com
  export GIT_TERMINAL_PROMPT=0
  export HOME="$SCRATCH/home"
  export AI_OPS_SKILLS_CACHE="$SCRATCH/cache"
  unset AI_OPS_SKILLS_REF
  : >"$GIT_CONFIG_GLOBAL"
  mkdir -p "$HOME"
  FIXTURE="$SCRATCH/ai-ops"
  mkdir -p "$FIXTURE/skills/grilling"
  printf 'grill-v1\n' >"$FIXTURE/skills/grilling/SKILL.md"
  git -C "$FIXTURE" init -q -b main
  git -C "$FIXTURE" add skills
  git -C "$FIXTURE" commit -q -m 'skills-v1'
  printf 'evidence %s\nscratch %s\n' "$EVIDENCE" "$SCRATCH" | tee "$EVIDENCE"

  record() {
    {
      printf '%s status=%s\n' "$1" "$2"
      printf '%s\n' '--- stdout ---'
      cat "$3"
      printf '%s\n' '--- stderr ---'
      cat "$4"
    } >"$SCRATCH/record.txt"
    cat "$SCRATCH/record.txt" | tee -a "$EVIDENCE"
  }

  PINS="$SCRATCH/pins"
  mkdir -p "$PINS"
  printf '%s\n' '{' '  "dependencies": {' '    "left-pad": "latest"' '  }' '}' >"$PINS/package.json"
  status=0
  (CDPATH='' cd -- "$PINS" && node "$REPO/packages/check-pins/dist/check-pins.mjs" >"$SCRATCH/pins.out" 2>"$SCRATCH/pins.err") || status=$?
  record check-pins-latest "$status" "$SCRATCH/pins.out" "$SCRATCH/pins.err"
  test "$status" -eq 1
  test ! -s "$SCRATCH/pins.err"
  grep -F 'package.json:3: dependency left-pad is not an exact version' "$SCRATCH/pins.out" >/dev/null

  printf '%s\n' '{' '  "dependencies": {' '    "left-pad": "1.2.3"' '  }' '}' >"$PINS/package.json"
  status=0
  (CDPATH='' cd -- "$PINS" && node "$REPO/packages/check-pins/dist/check-pins.mjs" >"$SCRATCH/pins.out" 2>"$SCRATCH/pins.err") || status=$?
  record check-pins-exact "$status" "$SCRATCH/pins.out" "$SCRATCH/pins.err"
  test "$status" -eq 0
  test ! -s "$SCRATCH/pins.out"
  test ! -s "$SCRATCH/pins.err"

  status=0
  printf '9\n' | "$REPO/packages/get-skills/dist/get-skills.mjs" --url "$FIXTURE" >"$SCRATCH/gs-bad.out" 2>"$SCRATCH/gs-bad.err" || status=$?
  record get-skills-bad "$status" "$SCRATCH/gs-bad.out" "$SCRATCH/gs-bad.err"
  test "$status" -eq 1
  test ! -s "$SCRATCH/gs-bad.out"
  grep -F 'toolshed:get-skills: expected 1, 2, or 3' "$SCRATCH/gs-bad.err" >/dev/null
  test ! -e "$AI_OPS_SKILLS_CACHE"

  status=0
  printf '1\n' | "$REPO/packages/get-skills/dist/get-skills.mjs" --url "$FIXTURE" >"$SCRATCH/gs.out" 2>"$SCRATCH/gs.err" || status=$?
  record get-skills "$status" "$SCRATCH/gs.out" "$SCRATCH/gs.err"
  {
    printf '%s\n' '--- grilling/SKILL.md ---'
    cat "$HOME/.cursor/skills/grilling/SKILL.md"
  } >"$SCRATCH/record.txt"
  cat "$SCRATCH/record.txt" | tee -a "$EVIDENCE"
  test "$status" -eq 0
  test ! -s "$SCRATCH/gs.out"
  test "$(git -C "$AI_OPS_SKILLS_CACHE" remote get-url origin)" = "$FIXTURE"
  printf 'grill-v1\n' >"$SCRATCH/grill.expected"
  cmp -s "$SCRATCH/grill.expected" "$HOME/.cursor/skills/grilling/SKILL.md"
  grep -F "toolshed:get-skills: synced $AI_OPS_SKILLS_CACHE/skills" "$SCRATCH/gs.err" >/dev/null

  status=0
  sh "$REPO/scripts/stage-release.sh" check-pins "$SCRATCH/stage" >"$SCRATCH/stage.out" 2>"$SCRATCH/stage.err" || status=$?
  record stage-release "$status" "$SCRATCH/stage.out" "$SCRATCH/stage.err"
  cat "$SCRATCH/stage/SHA256SUMS" >>"$EVIDENCE"
  test "$status" -eq 0
  test ! -s "$SCRATCH/stage.err"
  grep -F 'check-pins.mjs: OK' "$SCRATCH/stage.out" >/dev/null
  test -f "$SCRATCH/stage/check-pins.mjs"
  test -f "$SCRATCH/stage/SHA256SUMS"
  cmp -s "$REPO/packages/check-pins/dist/check-pins.mjs" "$SCRATCH/stage/check-pins.mjs"

  status=0
  sh "$REPO/scripts/stage-release.sh" >"$SCRATCH/stage-usage.out" 2>"$SCRATCH/stage-usage.err" || status=$?
  record stage-release-usage "$status" "$SCRATCH/stage-usage.out" "$SCRATCH/stage-usage.err"
  test "$status" -eq 1
  test ! -s "$SCRATCH/stage-usage.out"
  grep -F 'usage: stage-release.sh <tool> <dest>' "$SCRATCH/stage-usage.err" >/dev/null

  status=0
  sh "$REPO/scripts/stage-release.sh" not-a-tool "$SCRATCH/missing" >"$SCRATCH/stage-missing.out" 2>"$SCRATCH/stage-missing.err" || status=$?
  record stage-release-missing "$status" "$SCRATCH/stage-missing.out" "$SCRATCH/stage-missing.err"
  test "$status" -eq 1
  test ! -s "$SCRATCH/stage-missing.out"
  grep -F "packages/not-a-tool/dist/not-a-tool.mjs" "$SCRATCH/stage-missing.err" >/dev/null

  printf 'evidence %s\nscratch %s\n' "$EVIDENCE" "$SCRATCH"
)
```

`FIXTURE` is a local git directory. `get-skills` receives that path as `--url`. Do not pass `https://github.com/caido/ai-ops`. `GIT_CONFIG_COUNT=0` drops environment `insteadOf` rules. The empty global and system files drop file rules. A local clone still prints a depth warning and `git checkout` lines on stderr. The cloning line names `$FIXTURE`.

## Feature map

### check-pins

Entry command, from `$REPO`, with cwd `$SCRATCH/pins`.

`node "$REPO/packages/check-pins/dist/check-pins.mjs"`

A `package.json` dependency of `latest` exits 1. Stdout names that file with `package.json:3: dependency left-pad is not an exact version`. Stderr is empty. The same file with `"left-pad": "1.2.3"` exits 0 and both streams are empty. The Drive subshell appends both streams to `$EVIDENCE` before the trap runs.

### get-skills

Entry command.

`printf '1\n' | "$REPO/packages/get-skills/dist/get-skills.mjs" --url "$FIXTURE"`

Choice `9` exits 1 before any clone. Stderr includes `toolshed:get-skills: expected 1, 2, or 3`. Stdout is empty. `$AI_OPS_SKILLS_CACHE` does not exist. Choice `1` exits 0. Stdout is empty. Stderr includes the folder prompt and `toolshed:get-skills: synced <cache>/skills to <install>`. `$HOME/.cursor/skills/grilling/SKILL.md` is `grill-v1`, and that file is copied into `$EVIDENCE` before cleanup. The clone remote is `$FIXTURE`.

### stage-release.sh

Entry command.

`sh "$REPO/scripts/stage-release.sh" check-pins "$SCRATCH/stage"`

Exit status 0. Stdout contains `check-pins.mjs: OK`. Stderr is empty. `$SCRATCH/stage/check-pins.mjs` and `$SCRATCH/stage/SHA256SUMS` both exist, and `check-pins.mjs` matches `packages/check-pins/dist/check-pins.mjs` byte for byte. No arguments exits 1 with stderr `usage: stage-release.sh <tool> <dest>`. An unknown tool exits 1 and stderr names `packages/<tool>/dist/<tool>.mjs`.

## Evidence

`$EVIDENCE` is the one evidence file. It is created outside `$SCRATCH`. The Drive subshell prints `evidence <path>` and `scratch <path>`, and appends each feature's status, stdout, and stderr before the trap deletes the scratch directory. The installed `grilling/SKILL.md` and the staged `SHA256SUMS` are appended there too.

## Cleanup

The EXIT trap deletes `$SCRATCH` when the subshell returns, including when `set -eu` aborts early. `$EVIDENCE` stays. In the parent shell, use the printed paths.

```sh
test -f <evidence>
test ! -e <scratch>
```

The parent shell's `HOME` and git identity are unchanged.
