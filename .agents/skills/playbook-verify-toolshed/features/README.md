# Toolshed verification map

This directory is the maintained source for driving mise-toolshed. Read this index before driving, then use the matching feature file as the recipe. The directory contains `README.md` and one feature file per tool.

## Baseline preconditions

- The current directory is a checkout of mise-toolshed.
- `mise run build` has finished.
- `sh .agents/skills/playbook-verify-toolshed/session.sh doctor` exits 0.
- Each drive uses its own `session.sh` invocation. The parent shell's `HOME` and git identity stay unchanged.

## Driving conventions

- Start every recipe from the baseline preconditions.
- Treat every command as literal. Keep quoted names and flags unchanged.
- Run each feature with `sh .agents/skills/playbook-verify-toolshed/session.sh <feature-id>` and the commands in that file.
- Pass a local git directory to `get-skills --url`. Do not pass `https://github.com/caido/ai-ops`.
- Leave `.agents/skills/playbook-verify-toolshed/evidence/` in place during cleanup.

## Evidence and skip reporting

- Record the command, the exit status, stdout, and stderr in `evidence/<feature-id>.txt`.
- A scan or install also records the written file or the installed skill text in that same evidence file.
- Report an unreachable entry point with the attempted command and the unmet precondition.
- Do not report a skipped entry point as verified through a different entry point.

## Feature entry contract

Each feature file starts with an H1 title and one paragraph describing the user-visible behavior. It then uses exactly four H2 sections in this order.

1. `Sub-features` lists short IDs with one line for each behavior.
2. `How to get to it (user POV)` lists every user entry point.
3. `Driving it with session.sh` starts with `Preconditions:` and uses labeled bullets that pair each user action with an exact command and observable result.
4. `Gotchas` lists traps that can waste or invalidate a verification run.

## Features

- [check-exact-versions](./check-exact-versions.md) scans the current directory and prints pins that are not exact.
- [check-lockfiles](./check-lockfiles.md) scans the current directory and prints manifests whose lockfile is missing.
- [check-minimum-release-age](./check-minimum-release-age.md) scans the current directory and prints pnpm and mise release-age settings that are missing or below 7 days.
- [get-skills](./get-skills.md) copies skill directories from a git checkout into one personal folder chosen on stdin.
- [stage-release](./stage-release.md) copies one built `<tool>.mjs` into a destination and writes `SHA256SUMS`.
