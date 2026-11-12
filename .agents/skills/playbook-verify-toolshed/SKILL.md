---
name: playbook-verify-toolshed
description: "Drive the mise-toolshed command-line tools on a scratch tree. Use when verifying check-exact-versions, check-lockfiles, check-minimum-release-age, get-skills, or stage-release.sh from a checkout."
---

# playbook-verify-toolshed

The tools are short-lived CLIs. Build once, then drive each feature in its own `session.sh` invocation. The helper deletes that drive's scratch directory and leaves the evidence file.

## Launch

From the checkout, run `mise run build`.

That task uses the toolchain pinned in `.mise/config.toml`. The build is ready when these files exist:

- `packages/check-exact-versions/dist/check-exact-versions.mjs`
- `packages/check-lockfiles/dist/check-lockfiles.mjs`
- `packages/check-minimum-release-age/dist/check-minimum-release-age.mjs`

There is no server to keep. Each drive starts in its own shell through `session.sh`. That process owns `HOME` and the git identity for the drive. The parent shell keeps its own. The helper's EXIT trap deletes only that drive's scratch directory.

## Doctor

Run doctor after Launch, before the first drive, at the start of each drive, and again after any failed drive. `session.sh` runs it at the start of every drive. Run it in the parent shell after Launch and after a failed drive:

```sh
sh .agents/skills/playbook-verify-toolshed/session.sh doctor
```

Doctor reads the checkout. It exits non-zero when a built command, `bin/get-skills`, `scripts/stage-release.sh`, `git`, `sha256sum`, or `node` is missing. Each built command's `--version` prints one version line on stdout and exits 0. Doctor does not clone, fetch, or write a scratch directory.

When doctor fails because these commands disagree with the checkout, fix this skill and run doctor again before the next drive.

## Drive

Read `features/README.md`, then run every feature file's `Driving it with session.sh` block from the checkout. One invocation drives one feature. Do not reuse another drive's scratch directory.

`session.sh <feature-id>` reads the feature commands on stdin, runs doctor, then runs those commands. It prints `evidence <path>` and `scratch <path>` on stdout when the commands exit 0.

## Evidence

Evidence is `.agents/skills/playbook-verify-toolshed/evidence/<feature-id>.txt`. `.agents/skills/playbook-verify-toolshed/.gitignore` ignores `evidence/`. Each drive truncates that file, then appends every recorded status, stdout, and stderr before the scratch directory is deleted. Cleanup leaves the directory in place.

## PR proof

Cite the drive that ran and the gitignored directory `.agents/skills/playbook-verify-toolshed/evidence/`. Do not commit that directory or a throwaway script.

## Cleanup

`session.sh` records no long-lived pid. Its EXIT trap deletes the scratch directory it created, including when the feature commands fail. After the last drive, including any re-drive:

```sh
test -d .agents/skills/playbook-verify-toolshed/evidence
test ! -e <scratch>
```

`<scratch>` is the path that invocation printed. The parent shell's `HOME` and git identity are unchanged.

## Helpers

`session.sh` is the helper. Run it from the checkout:

```sh
sh .agents/skills/playbook-verify-toolshed/session.sh doctor
sh .agents/skills/playbook-verify-toolshed/session.sh <feature-id> <<'EOF'
# feature commands
EOF
```
