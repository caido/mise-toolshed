---
name: playbook-verify-toolshed
description: "Drive the mise-toolshed command-line tools on a scratch tree. Use when verifying check-exact-versions, check-lockfiles, check-minimum-release-age, get-skills, or stage-release.sh from a checkout."
---

# playbook-verify-toolshed

Each command is short-lived. Build once, then drive each feature in its own `session.sh` invocation. The helper deletes that drive's scratch directory and leaves the evidence file.

## Launch

From the checkout, run `mise run build`.

That task uses the toolchain pinned in `.mise/config.toml`. The build is ready when these files exist:

- `packages/check-exact-versions/dist/check-exact-versions.mjs`
- `packages/check-lockfiles/dist/check-lockfiles.mjs`
- `packages/check-minimum-release-age/dist/check-minimum-release-age.mjs`

Each drive starts in its own shell through `session.sh`. That process owns `HOME` and the git identity for the drive. The parent shell keeps its own. The helper's EXIT trap deletes only that drive's scratch directory.

## Doctor

`session.sh` runs doctor at the start of every drive. Run it in the parent shell after Launch and after a failed drive:

```sh
sh .agents/skills/playbook-verify-toolshed/session.sh doctor
```

Doctor reads the checkout. It exits non-zero when a built command, `bin/get-skills`, `scripts/stage-release.sh`, `git`, `sha256sum`, or `node` is missing. Each built command's `--version` prints one version line on stdout and exits 0. Doctor does not clone, fetch, or write a scratch directory.

When doctor fails because these commands disagree with the checkout, fix this skill and run doctor again before the next drive.

## Drive

Read `features/README.md`, then run every feature file's fenced `sh` block from the checkout. One invocation drives one feature. Do not reuse another drive's scratch directory.

`session.sh` reads the feature commands on stdin, runs doctor, then runs those commands. On success it prints one `evidence` line and one `scratch` line. The second field of each line is a path.

## Evidence

Each drive writes one file in `.agents/skills/playbook-verify-toolshed/evidence/`. The file name is the feature file name with `.txt` instead of `.md`. `.agents/skills/playbook-verify-toolshed/.gitignore` ignores that `evidence/` directory. The drive truncates the file, then appends every recorded status, stdout, and stderr. Cleanup deletes the scratch directory and leaves the evidence directory in place.

## PR proof

Cite the drive that ran and the gitignored directory `.agents/skills/playbook-verify-toolshed/evidence/`. Do not commit that directory or a throwaway script.

## Cleanup

`session.sh` records no long-lived pid. Its EXIT trap deletes the scratch directory it created, including when the feature commands fail. Store that invocation's stdout in `session_output`. After the last drive, including any re-drive, the scratch path from that stdout does not exist, and the evidence directory does:

```sh
scratch_path=$(printf '%s\n' "$session_output" | awk '/^scratch / { print $2; exit }')
test -n "$scratch_path"
test ! -e "$scratch_path"
test -d .agents/skills/playbook-verify-toolshed/evidence
```

The parent shell's `HOME` and git identity are unchanged.

## Helpers

`session.sh` is the helper. Run it from the checkout:

```sh
sh .agents/skills/playbook-verify-toolshed/session.sh doctor
```

The other invocation is the fenced `sh` block in the feature file.
