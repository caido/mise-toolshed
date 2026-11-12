# get-skills

`get-skills` asks which personal folder to use, clones or updates a git checkout, and copies that checkout's `skills/` directories into the chosen folder. The command exits 1 before any clone when the choice is not `1`, `2`, or `3`. An unknown argument exits 1 before the prompt.

## Sub-features

- `skills-unknown` rejects an argument other than `--url`.
- `skills-bad-choice` rejects a choice other than `1`, `2`, or `3` and does not clone.
- `skills-install` choice `1` copies the fixture skill into `$HOME/.cursor/skills`.

## How to get to it (user POV)

- Run `bin/get-skills` and answer the folder prompt with `1`, `2`, or `3`.
- Pass `--url <git-url>` to choose the checkout. The verification URL is a local git directory.
- Pass any other argument.

## Driving it with session.sh

Preconditions:

- Doctor has exited 0 in this `session.sh` invocation.
- `$REPO`, `$SCRATCH`, `$EVIDENCE`, `$HOME`, and `$AI_OPS_SKILLS_CACHE` are set, and `record` is defined.
- `session.sh` has cleared `AI_OPS_SKILLS_REF` and pointed git config at the scratch directory.

- **skills-unknown.** Run `bin/get-skills --nope`. Exit status is 1, stdout is empty, stderr contains `toolshed:get-skills: unknown argument: --nope`, and `$AI_OPS_SKILLS_CACHE` does not exist.
- **skills-bad-choice.** Run `bin/get-skills` with stdin `9`. Exit status is 1, stdout is empty, stderr contains `toolshed:get-skills: expected 1, 2, or 3`, and `$AI_OPS_SKILLS_CACHE` does not exist.
- **skills-install.** Create a local git fixture whose `skills/grilling/SKILL.md` is `grill-v1`, then run `bin/get-skills --url` on that directory with stdin `1`. Exit status is 0, stdout is empty, stderr contains `toolshed:get-skills: synced` and the cache `skills` path, the cache remote is the fixture path, and `$HOME/.cursor/skills/grilling/SKILL.md` is `grill-v1`.

```sh
sh .agents/skills/playbook-verify-toolshed/session.sh get-skills <<'EOF'
status=0
"$REPO/bin/get-skills" --nope >"$SCRATCH/unknown.out" 2>"$SCRATCH/unknown.err" || status=$?
record skills-unknown "$status" "$SCRATCH/unknown.out" "$SCRATCH/unknown.err"
test "$status" -eq 1
test ! -s "$SCRATCH/unknown.out"
grep -F 'toolshed:get-skills: unknown argument: --nope' "$SCRATCH/unknown.err" >/dev/null
test ! -e "$AI_OPS_SKILLS_CACHE"

status=0
printf '9\n' | "$REPO/bin/get-skills" >"$SCRATCH/bad.out" 2>"$SCRATCH/bad.err" || status=$?
record skills-bad-choice "$status" "$SCRATCH/bad.out" "$SCRATCH/bad.err"
test "$status" -eq 1
test ! -s "$SCRATCH/bad.out"
grep -F 'toolshed:get-skills: expected 1, 2, or 3' "$SCRATCH/bad.err" >/dev/null
test ! -e "$AI_OPS_SKILLS_CACHE"

FIXTURE="$SCRATCH/ai-ops"
mkdir -p "$FIXTURE/skills/grilling"
printf 'grill-v1\n' >"$FIXTURE/skills/grilling/SKILL.md"
git -C "$FIXTURE" init -q -b main
git -C "$FIXTURE" add skills
git -C "$FIXTURE" commit -q -m 'skills-v1'

status=0
printf '1\n' | "$REPO/bin/get-skills" --url "$FIXTURE" >"$SCRATCH/install.out" 2>"$SCRATCH/install.err" || status=$?
record skills-install "$status" "$SCRATCH/install.out" "$SCRATCH/install.err"
{
	printf '%s\n' '--- grilling/SKILL.md ---'
	cat "$HOME/.cursor/skills/grilling/SKILL.md"
} >>"$EVIDENCE"
test "$status" -eq 0
test ! -s "$SCRATCH/install.out"
test "$(git -C "$AI_OPS_SKILLS_CACHE" remote get-url origin)" = "$FIXTURE"
printf 'grill-v1\n' >"$SCRATCH/grill.expected"
cmp -s "$SCRATCH/grill.expected" "$HOME/.cursor/skills/grilling/SKILL.md"
grep -F "toolshed:get-skills: synced $AI_OPS_SKILLS_CACHE/skills" "$SCRATCH/install.err" >/dev/null
EOF
```

## Gotchas

- The verification `--url` is a local git directory. `https://github.com/caido/ai-ops` is the production default and is not the verification target.
- Choice `9` exits during the prompt, before `git clone`.
- A local clone still prints git progress on stderr. The synced line names `$AI_OPS_SKILLS_CACHE/skills`.
- `session.sh` sets `GIT_CONFIG_COUNT=0`, an empty global git config, and `GIT_CONFIG_SYSTEM=/dev/null` so environment `insteadOf` rules do not rewrite the local path.
