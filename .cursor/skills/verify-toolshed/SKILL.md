---
name: verify-toolshed
description: Drive check-pins, get-skills, and stage-release.sh on a scratch tree and keep one evidence file.
---

# verify-toolshed

Run Launch and Doctor in the checkout. Run the Drive block as its own subshell. Cleanup checks the evidence path that subshell prints.

## Launch

Run `mise run build`.

That task uses the toolchain pinned in `.mise/config.toml`. The build is ready when `packages/check-pins/dist/check-pins.mjs` exists.

## Doctor

Run this after Launch and before Drive. It only reads the checkout. Stop when a command exits non-zero.

```sh
set -eu
test -f packages/check-pins/dist/check-pins.mjs
test -f bin/get-skills
test -f scripts/stage-release.sh
command -v git >/dev/null
command -v sha256sum >/dev/null
node packages/check-pins/dist/check-pins.mjs --version
```

`--version` prints one version line on stdout and exits 0. Doctor does not clone, fetch, or write a stage directory.

## Drive

Run this whole block as one subshell from the checkout. The subshell owns `HOME` and the git identity. The parent shell keeps its own. Paste the Feature map blocks inside the subshell, after the fixture commit and before the closing parenthesis.

```sh
(
  set -eu
  REPO=$(CDPATH='' cd -- . && pwd)
  SCRATCH=$(mktemp -d "${TMPDIR:-/tmp}/verify-toolshed.XXXXXX")
  EVIDENCE=$(mktemp "${TMPDIR:-/tmp}/verify-toolshed-evidence.XXXXXX")
  trap 'rm -rf "$SCRATCH"' EXIT
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
  # Feature map blocks go here.
)
```

`FIXTURE` is a local git directory. Pass that path to `get-skills` as `--url`. Do not pass `https://github.com/caido/ai-ops`. `GIT_CONFIG_COUNT=0` drops environment `insteadOf` rules. The empty global and system files drop file rules. A local clone still prints a depth warning and `git checkout` lines on stderr. The cloning line names `$FIXTURE`.

## Feature map

### check-pins

Entry command. The scratch tree is `$SCRATCH/pins`. A dependency of `latest` is the failure a user sees first.

```sh
PINS="$SCRATCH/pins"
mkdir -p "$PINS"
printf '%s\n' '{' '  "dependencies": {' '    "left-pad": "latest"' '  }' '}' >"$PINS/package.json"
status=0
(CDPATH='' cd -- "$PINS" && node "$REPO/packages/check-pins/dist/check-pins.mjs" >"$SCRATCH/pins.out" 2>"$SCRATCH/pins.err") || status=$?
printf 'check-pins latest status=%s\n' "$status" | tee -a "$EVIDENCE"
cat "$SCRATCH/pins.out" | tee -a "$EVIDENCE"
test "$status" -eq 1
test ! -s "$SCRATCH/pins.err"
grep -F 'package.json:3: dependency left-pad is not an exact version' "$SCRATCH/pins.out" >/dev/null
```

The user sees exit status 1 and this stdout line, which names `package.json`.

```
package.json:3: dependency left-pad is not an exact version
```

Stderr is empty.

Same tree, exact version. Replace the spec and run the same command.

```sh
printf '%s\n' '{' '  "dependencies": {' '    "left-pad": "1.2.3"' '  }' '}' >"$PINS/package.json"
status=0
(CDPATH='' cd -- "$PINS" && node "$REPO/packages/check-pins/dist/check-pins.mjs" >"$SCRATCH/pins.out" 2>"$SCRATCH/pins.err") || status=$?
printf 'check-pins exact status=%s\n' "$status" | tee -a "$EVIDENCE"
cat "$SCRATCH/pins.out" | tee -a "$EVIDENCE"
test "$status" -eq 0
test ! -s "$SCRATCH/pins.out"
test ! -s "$SCRATCH/pins.err"
```

The user sees exit status 0 and empty stdout. A failure here is a non-zero status or any stdout line.

### get-skills

Run the bad choice before the install. Choice `9` exits during the prompt, before `git clone`.

```sh
status=0
printf '9\n' | "$REPO/bin/get-skills" --url "$FIXTURE" >"$SCRATCH/gs-bad.out" 2>"$SCRATCH/gs-bad.err" || status=$?
printf 'get-skills bad status=%s\n' "$status" | tee -a "$EVIDENCE"
cat "$SCRATCH/gs-bad.err" | tee -a "$EVIDENCE"
test "$status" -eq 1
test ! -s "$SCRATCH/gs-bad.out"
grep -F 'toolshed:get-skills: expected 1, 2, or 3' "$SCRATCH/gs-bad.err" >/dev/null
test ! -e "$AI_OPS_SKILLS_CACHE"
```

The user sees exit status 1. Stderr includes `toolshed:get-skills: expected 1, 2, or 3`. `$AI_OPS_SKILLS_CACHE` does not exist.

Entry command. Choice `1` installs into `$HOME/.cursor/skills`.

```sh
status=0
printf '1\n' | "$REPO/bin/get-skills" --url "$FIXTURE" >"$SCRATCH/gs.out" 2>"$SCRATCH/gs.err" || status=$?
printf 'get-skills status=%s\n' "$status" | tee -a "$EVIDENCE"
cat "$SCRATCH/gs.err" | tee -a "$EVIDENCE"
test "$status" -eq 0
test ! -s "$SCRATCH/gs.out"
test "$(git -C "$AI_OPS_SKILLS_CACHE" remote get-url origin)" = "$FIXTURE"
printf 'grill-v1\n' >"$SCRATCH/grill.expected"
cmp -s "$SCRATCH/grill.expected" "$HOME/.cursor/skills/grilling/SKILL.md"
grep -F "toolshed:get-skills: synced $AI_OPS_SKILLS_CACHE/skills" "$SCRATCH/gs.err" >/dev/null
```

The user sees the folder prompt on stderr, the local clone banner, and `toolshed:get-skills: synced <cache>/skills to <install>`. `$HOME/.cursor/skills/grilling/SKILL.md` contains `grill-v1`. Stdout is empty. `git -C "$AI_OPS_SKILLS_CACHE" remote get-url origin` prints `$FIXTURE`.

### stage-release.sh

Entry command.

```sh
status=0
sh "$REPO/scripts/stage-release.sh" check-pins "$SCRATCH/stage" >"$SCRATCH/stage.out" 2>"$SCRATCH/stage.err" || status=$?
printf 'stage-release status=%s\n' "$status" | tee -a "$EVIDENCE"
cat "$SCRATCH/stage.out" | tee -a "$EVIDENCE"
test "$status" -eq 0
grep -F 'check-pins.mjs: OK' "$SCRATCH/stage.out" >/dev/null
```

The user sees exit status 0 and `check-pins.mjs: OK` on stdout. `$SCRATCH/stage` contains `check-pins.mjs` and `SHA256SUMS`.

Failure. No arguments exits 1 and stderr is `usage: stage-release.sh <tool> <dest>`.

```sh
status=0
sh "$REPO/scripts/stage-release.sh" >"$SCRATCH/stage-usage.out" 2>"$SCRATCH/stage-usage.err" || status=$?
printf 'stage-release usage status=%s\n' "$status" | tee -a "$EVIDENCE"
cat "$SCRATCH/stage-usage.err" | tee -a "$EVIDENCE"
test "$status" -eq 1
grep -F 'usage: stage-release.sh <tool> <dest>' "$SCRATCH/stage-usage.err" >/dev/null
```

An unknown tool exits 1 and stderr names `packages/<tool>/dist/<tool>.mjs`.

```sh
status=0
sh "$REPO/scripts/stage-release.sh" not-a-tool "$SCRATCH/missing" >"$SCRATCH/stage-missing.out" 2>"$SCRATCH/stage-missing.err" || status=$?
printf 'stage-release missing status=%s\n' "$status" | tee -a "$EVIDENCE"
cat "$SCRATCH/stage-missing.err" | tee -a "$EVIDENCE"
test "$status" -eq 1
grep -F "packages/not-a-tool/dist/not-a-tool.mjs" "$SCRATCH/stage-missing.err" >/dev/null
```

## Evidence

`$EVIDENCE` is the one evidence file. The Drive subshell prints `evidence <path>`. Each feature appends its status and the output a user sees. The file is not under `$SCRATCH`.

## Cleanup

The Drive subshell's EXIT trap deletes `$SCRATCH`, including when a feature check fails. After the subshell returns, run `test -f` on the path printed as `evidence <path>`. That file is still there. The parent shell's `HOME` and git identity are unchanged.
