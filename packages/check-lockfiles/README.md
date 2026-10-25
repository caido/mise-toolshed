# check-lockfiles

`check-lockfiles` is the [STD-007](https://github.com/caido/engineering/blob/main/standards/STD-007-lockfiles.md) tool. This version has the shared command line and no lockfile rules yet.

## Usage

`node` must be on `PATH`. The built command is `dist/check-lockfiles.mjs`. A released install is the `check-lockfiles` executable.

- No arguments scans the current directory and prints no findings. The process exits 0. A scan does not write to stderr.
- `--version` as the only argument prints the version on stdout and exits 0.
- Any other argument list prints `usage: check-lockfiles --version` on stderr and exits 1. It does not scan.

## Tests

`mise run test` builds the package and runs `vitest run`. Scan cases live in `test/cases.json`. Each case receives a `fixtureDir` from the Vitest context, writes its `files` there, and runs the built command. A case with `pending` is a Vitest todo for behavior that is not implemented yet. Its name starts with `pending`. The todo is reported and does not fail the run. Removing `pending` runs the case.
