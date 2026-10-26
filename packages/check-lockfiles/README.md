# check-lockfiles

`check-lockfiles` scans one directory tree and prints each manifest whose lockfile is missing. It is the [STD-007](https://github.com/caido/engineering/blob/main/standards/STD-007-lockfiles.md) tool.

Exact versions are `check-exact-versions`. Release age is `check-minimum-release-age`.

## Usage

`node` must be on `PATH`. The built command is `dist/check-lockfiles.mjs`. A released install is the `check-lockfiles` executable.

- No arguments scans the current directory. Each finding is one stdout line `file:line: message`. Lines are sorted by path, then line, then message, using string order for the path and the message. The process exits 0 when there are no findings and 1 when there is at least one. A scan does not write to stderr.
- `--version` as the only argument prints the version on stdout and exits 0.
- Any other argument list prints `usage: check-lockfiles --version` on stderr and exits 1. It does not scan.

The walk does not follow symbolic links. A symbolic link is not a manifest and is not a lockfile. A directory named `node_modules`, `.git`, or `dist` is not entered.

## Lockfiles

The only finding is `lockfile <name> is missing` at line 1. A manifest with no dependencies still needs its lockfile. File contents are not read. `.gitignore` is not read.

- `package.json` needs `pnpm-lock.yaml`.
- `pyproject.toml` needs `uv.lock`.
- `mise.toml` needs `mise.lock`.
- `.mise/config.<env>.toml` needs `mise.<env>.lock`. `<env>` is one segment of letters, digits, `_`, or `-`, such as `dev`. `mise.lock` does not satisfy that file.
- Any other `*.toml` file whose parent directory is `.mise` needs `mise.lock`. `package.json`, `pyproject.toml`, and `mise.toml` keep those rules under `.mise` as well. `.mise.toml` is not a mise config.
- `Cargo.toml` needs `Cargo.lock`, unless the path is already a mise config. `.mise/Cargo.toml` needs `mise.lock`.

The lockfile may sit in the manifest's directory or in any parent directory, up to the scanned directory. At that root the lockfile is the bare name. A lockfile in a child directory does not count. A lockfile in a sibling directory does not count.

## Tests

`mise run test` builds the package and runs `vitest run`. Scan cases live in `test/cases.json`. Each case receives a `fixtureDir` from the Vitest context, writes its `files` there, and runs the built command. A case with `pending` is a Vitest todo for behavior that is not implemented yet. Its name starts with `pending`. The todo is reported and does not fail the run. Removing `pending` runs the case.
