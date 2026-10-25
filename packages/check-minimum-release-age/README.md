# check-minimum-release-age

`check-minimum-release-age` is the [STD-008](https://github.com/caido/engineering/blob/main/standards/STD-008-minimum-release-age.md) tool. This version has the shared command line and no release-age rules yet.

## Usage

`node` must be on `PATH`. The built command is `dist/check-minimum-release-age.mjs`. A released install is the `check-minimum-release-age` executable.

- No arguments scans the current directory and prints no findings. The process exits 0. A scan does not write to stderr.
- `--version` as the only argument prints the version on stdout and exits 0.
- Any other argument list prints `usage: check-minimum-release-age --version` on stderr and exits 1. It does not scan.

## Tests

`mise run test` builds the package and runs `node --test`. Scan cases live in `test/cases.json`. Each case writes its `files` into a temporary directory and runs the built command. A case with `pending` is a node:test todo for behavior that is not implemented yet. The case name starts with `pending`, and the suite stays green while that behavior is missing.
