---
name: playbook-verify-toolshed
description: "Drive the mise-toolshed command-line tools from a scratch directory. Use when verifying check-exact-versions, check-lockfiles, check-minimum-release-age, get-skills, or stage-release.sh from a checkout."
---

# playbook-verify-toolshed

Build once, then drive each feature in its own tmux session. The helper deletes that drive's scratch directory and leaves the evidence directory.

## Launch

From the checkout, run `mise run build`.

That task uses the toolchain pinned in `.mise/config.toml`. The build is ready when these files exist:

- `packages/check-exact-versions/dist/check-exact-versions.mjs`
- `packages/check-lockfiles/dist/check-lockfiles.mjs`
- `packages/check-minimum-release-age/dist/check-minimum-release-age.mjs`

`session.sh` starts one detached tmux session per drive. The session name is `playbook-verify-toolshed-` plus the feature file name without `.md`. Before that session runs the feature commands, `session.sh` writes the name to a file in `.agents/skills/playbook-verify-toolshed/evidence/` whose name is the feature file name with `.session` instead of `.md`, and prints a line that starts with `session`. Record that name. The session process owns `HOME` and the git identity for the drive. The parent shell keeps its own. The inner EXIT trap deletes only that drive's scratch directory.

## Doctor

`session.sh` runs doctor at the start of every drive. Run it in the parent shell after Launch and after a failed drive:

```sh
sh .agents/skills/playbook-verify-toolshed/session.sh doctor
```

Doctor reads the checkout. It exits non-zero when a bundle, `bin/get-skills`, `scripts/stage-release.sh`, `git`, `sha256sum`, `node`, or `tmux` is missing. Each bundle's `--version` prints one version line on stdout and exits 0. Doctor does not clone, fetch, or write a scratch directory.

When doctor exits non-zero, a checkout file named above is missing, `git`, `sha256sum`, `node`, or `tmux` is absent from `PATH`, or a bundle's `--version` exited non-zero. Restore the missing file or tool, or repair the bundle whose `--version` failed, then run doctor again before the next drive.

## Drive

Read `features/README.md`, then run every feature file's fenced `sh` block from the checkout. One invocation drives one feature. Do not reuse another drive's scratch directory.

`session.sh` reads the feature commands on stdin, starts the tmux session, runs doctor inside that session, then runs those commands. It prints a `session` line, then one `evidence` line and one `scratch` line. The second field of each line is a name or a path.

## Evidence

Each drive writes three files in `.agents/skills/playbook-verify-toolshed/evidence/`. `.gitignore` in that skill directory ignores `evidence/`. The evidence file uses the feature file name with `.txt` instead of `.md`, and the drive appends every status line, stdout, and stderr there. The session-name file uses `.session`. The `.log` file contains the doctor version lines, the `evidence` line, the `scratch` line, and an `exit` line. Cleanup deletes the scratch directory and the tmux session, and leaves these files.

## PR proof

Cite the drive that ran and the gitignored directory `.agents/skills/playbook-verify-toolshed/evidence/`. Do not commit that directory or a throwaway script.

## Cleanup

The inner EXIT trap deletes the scratch directory, including when the feature commands fail. The outer EXIT trap kills the tmux session. After the last drive, including any re-drive, kill every recorded session again. Every scratch path in a `.log` file does not exist, and the evidence directory does:

```sh
for session_file in .agents/skills/playbook-verify-toolshed/evidence/*.session; do
	session_name=$(cat "$session_file")
	tmux kill-session -t "$session_name" 2>/dev/null || true
	if tmux has-session -t "$session_name" 2>/dev/null; then
		echo "session still present: $session_name" >&2
		exit 1
	fi
done
for drive_log in .agents/skills/playbook-verify-toolshed/evidence/*.log; do
	scratch_path=$(awk '/^scratch / { print $2; exit }' "$drive_log")
	test -n "$scratch_path" || exit 1
	test ! -e "$scratch_path" || exit 1
done
test -d .agents/skills/playbook-verify-toolshed/evidence
```

The parent shell's `HOME` and git identity are unchanged.

## Helpers

`session.sh` is the helper. Run it from the checkout:

```sh
sh .agents/skills/playbook-verify-toolshed/session.sh doctor
```

The other invocation is the fenced `sh` block in the feature file.
