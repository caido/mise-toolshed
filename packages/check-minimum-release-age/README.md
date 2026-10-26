# check-minimum-release-age

`check-minimum-release-age` scans one directory tree and prints pnpm and mise release-age settings that are missing or below 7 days. It is the [STD-008](https://github.com/caido/engineering/blob/main/standards/STD-008-minimum-release-age.md) tool.

The check reads configuration only. It does not call a registry. `minimumReleaseAgeExclude` is ignored. Cargo, Cross, uv, and other tools are out of scope.

## Usage

`node` must be on `PATH`. The built command is `dist/check-minimum-release-age.mjs`. A released install is the `check-minimum-release-age` executable.

- No arguments scans the current directory. Each finding is one stdout line `file:line: message`. Lines are sorted by path, then line, then message, using string order for the path and the message. The process exits 0 when there are no findings and 1 when there is at least one. A scan does not write to stderr.
- `--version` as the only argument prints the version on stdout and exits 0.
- Any other argument list, including a path, `--help`, or `--version` repeated, prints `usage: check-minimum-release-age --version` on stderr and exits 1. It does not scan.

The walk does not follow symbolic links. A directory named `node_modules`, `.git`, or `dist` is not entered.

## Supported files

A file is classified by its path relative to the scanned directory, with `/` separators. Anything that does not match a subsection below is ignored. A directory with neither file exits 0.

A file that cannot be read is one finding:

- `pnpm-workspace is not valid`
- `mise is not valid`

A directory that cannot be read is `directory is not readable` on line 1. The scan still reports every other finding.

### pnpm-workspace.yaml

Any file named `pnpm-workspace.yaml`, at any depth.

The top-level `minimumReleaseAge` key is a number of minutes. The last top-level assignment wins. A missing key is `minimumReleaseAge is not set` on line 1. A value that is not a base-10 number, or is below `10080`, is `minimumReleaseAge must be at least 10080 minutes` on the key's line. `10080` passes. `minimumReleaseAgeExclude` does not change the result.

### mise config

`mise.toml` at any depth, and any `*.toml` file whose parent directory is named `.mise`.

`minimum_release_age` must be a TOML string under `[settings]`, or `settings.minimum_release_age` before the first table. A missing key is `minimum_release_age is not set` on line 1.

The string must be a mise duration of at least 7 days. mise parses that string with jiff, which accepts a friendly duration, an ISO 8601 duration such as `P7D` or `PT168.0H`, and a bare integer of seconds. A fraction on an ISO year, month, week, or day, such as `P7.0D`, is not a mise duration. Friendly units are lowercase `y`, `mo`, `w`, `d`, `h`, `m`, `s`, `ms`, `us`, and `ns`, written from larger to smaller. `m` is minutes. A fraction is allowed only on the last unit, and only for hours or smaller. `168:00:00` is 168 hours. A leading `+` is allowed. `0s`, `7d ago`, and a leading `-` are not a 7-day duration. `7d`, `168h`, `1w`, `6d24h`, `6d, 24h`, `168,0h`, and `10080m` pass. `6d`, `10079m`, `7.5d`, `7D`, `24h6d`, and `6d,24h` do not.

An absolute date is a finding, including `2026-01-01` and `2024-06-01T12:00:00Z`. A non-string, a shorter duration, a date, and any other text are `minimum_release_age must be at least 7d` on the assignment line.

These names are not mise files: `.mise.toml`, `mise.local.toml`, `.config/mise/config.toml`, `.miserc.toml`.

## Standards

STD-008 is enforced for the pnpm and mise rules above. Seven days is `10080` minutes for pnpm and a duration of `604800000` milliseconds for mise. Calendar months and years are measured from 2025-01-01, which is the anchor mise uses when it converts a span to a duration.

## Tests

`mise run test` builds the package and runs `vitest run`. Scan cases live in `test/cases.json`. Each case receives a `fixtureDir` from the Vitest context, writes its `files` there, and runs the built command. A case with `pending` is a Vitest todo for behavior that is not implemented yet. Its name starts with `pending`. The todo is reported and does not fail the run. Removing `pending` runs the case.
