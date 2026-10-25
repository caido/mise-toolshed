# check-lockfiles

`check-lockfiles` is the [STD-007](https://github.com/caido/engineering/blob/main/standards/STD-007-lockfiles.md) tool. This version has the shared command line and no lockfile rules yet.

## Usage

`node` must be on `PATH`. The built command is `dist/check-lockfiles.mjs`. A released install is the `check-lockfiles` executable.

- No arguments scans the current directory and prints no findings. The process exits 0. A scan does not write to stderr.
- `--version` as the only argument prints the version on stdout and exits 0.
- Any other argument list prints `usage: check-lockfiles --version` on stderr and exits 1. It does not scan.
