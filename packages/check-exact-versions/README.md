# check-exact-versions

`check-exact-versions` scans one directory tree and prints dependency, tool, plugin, and image pins that are not exact. It is the [STD-006](https://github.com/caido/engineering/blob/main/standards/STD-006-exact-versions.md) tool.

GitHub Actions `uses:` SHAs are not checked. Install commands are not checked. Lockfiles are `check-lockfiles`. Release age is `check-minimum-release-age`.

## Usage

`node` must be on `PATH`. The built command is `dist/check-exact-versions.mjs`. A released install is the `check-exact-versions` executable.

- No arguments scans the current directory. Each finding is one stdout line `file:line: message`. Lines are sorted by path, then line, then message, using string order for the path and the message. The process exits 0 when there are no findings and 1 when there is at least one. A scan does not write to stderr.
- `--version` as the only argument prints the version on stdout and exits 0.
- Any other argument list, including a path, `--help`, or `--version` repeated, prints `usage: check-exact-versions --version` on stderr and exits 1. It does not scan.

The walk does not follow symbolic links. A directory named `node_modules`, `.git`, or `dist` is not entered.

## Supported files

A file is classified by its path relative to the scanned directory, with `/` separators. Anything that does not match a subsection below is ignored.

A file that cannot be read, and a `package.json` or `pyproject.toml` or workflow that the parser rejects, is one finding. The format word is the file kind:

- `package-json is not valid`
- `pyproject is not valid`
- `mise is not valid`
- `dockerfile is not valid`
- `workflow is not valid`
- `npmrc is not valid`

`mise is not valid`, `dockerfile is not valid`, and `npmrc is not valid` are only the unreadable-file finding. Those parsers do not reject a file they could read.

### package.json

Any file named `package.json`, at any depth.

String values in `dependencies`, `devDependencies`, and `optionalDependencies`:

- `dependency <name> is not an exact version`
- `dependency <name> git pin is not 40 hex`

`peerDependencies` are not checked.

A spec passes when it is one of:

- An exact semver, optional leading `=`, with an optional prerelease and build: `1.2.3`, `=1.2.3`, `1.2.3-beta.1`, `1.2.3+build.5`. `1.2` and ranges (`^`, `~`, `>`, `<`, `*`, `latest`, `1.x`) do not pass.
- A spec that starts with `workspace:`, `file:`, `link:`, or `catalog:`. The target is not resolved.
- A spec that starts with `git+`, `git:`, `github:`, `gitlab:`, or `bitbucket:`, and the text after the last `#` is 40 hex.

`ssh:`, `gist:`, an `https://` URL that is not `git+https://`, and an `npm:` alias do not use the git rule. They fail as `dependency <name> is not an exact version` unless they also match an exact semver.

A non-string dependency value is skipped. `engines`, `overrides`, and `resolutions` are not read. `scripts` are not findings.

`packageManager`, when present, must be a string matching `pnpm@` plus exact semver (`pnpm@12.14.0`). Otherwise the finding is `packageManager is not an exact pnpm version`. A missing `packageManager` is not a finding. A non-string `packageManager` makes the file `package-json is not valid`.

### pyproject.toml

Any file named `pyproject.toml`, at any depth.

Requirement strings in `[project] dependencies`, every array under `[project.optional-dependencies]`, and every array under `[dependency-groups]`:

- `dependency <name> is not an exact version`
- `dependency <name> git pin is not 40 hex`

The name is the package token at the start of the requirement, before `@`. Text after the first `;` is a marker and is not the pin.

A requirement passes when the part before the marker is either:

- An equality pin: it contains `==`, the version after `==` is non-empty and has no `*`, and the requirement has none of `!=`, `>=`, `<=`, `~=`, `>`, `<`.
- A direct URL whose URL starts with `git+`, `git:`, `github:`, `gitlab:`, or `bitbucket:`, and the revision (the text after the last `@`, before `#`) is 40 hex.

A direct URL that is not one of those git prefixes fails as `dependency <name> is not an exact version`, including when the URL contains `==`.

An inline table or a broken string in one of those arrays makes the whole file `pyproject is not valid`. Other tables, including `[tool.uv]` and `[build-system]`, are not read.

### mise config

`mise.toml` at any depth, and any `*.toml` file whose parent directory is named `.mise`.

Tool values:

- `tool <name> must be a string` for table form, including `[tools.<name>] version = "…"`.
- `tool <name> is not an exact version` when the string is not `major.minor` or `major.minor.patch`. Each numeric part is `0` or a number without a leading zero. `22.1` passes. `22`, `v22.0.0`, a `v` prefix, a 40-hex commit, and a prerelease do not.

Plugin values:

- `plugin <name> must end in a 40-hex pin` unless the string ends in `#` plus 40 hex. Table form fails the same message.

These names are not mise files: `.mise.toml`, `mise.local.toml`, `.config/mise/config.toml`, `.miserc.toml`.

### Dockerfile

Any file whose name starts with `Dockerfile`, at any depth. `app.Dockerfile` does not match.

`FROM` image references, after flags such as `--platform`:

- `image <reference> must contain @sha256:`

`scratch` passes. A reference that equals an earlier stage name in the same file passes (`FROM base` after `FROM scratch AS base`). `base:latest` does not equal the stage name `base`. The digest check is a substring `@sha256:`. The text after it is not required to be 64 hex.

`RUN`, `CMD`, and `ENTRYPOINT` are not findings.

### .npmrc

Any file named `.npmrc`, at any depth. Its text is not a finding. A file that cannot be read is `npmrc is not valid`.

### workflow YAML

A `.yml` or `.yaml` file whose parent is `workflows` and whose grandparent is `.github`. Composite actions under `.github/actions/` are not scanned.

`container:`, `services:`, an `image:` key nested under a block `container` or `services` on a job, and `uses: docker://…`:

- `image <reference> must contain @sha256:`

Workflow images do not accept `scratch` or a Dockerfile stage name. `uses: docker://…` keeps the `docker://` prefix in the reference. Other `uses:` values are not findings. `run:` steps are not findings. A missing `run` alias is `workflow is not valid` on that line.

## Standards

STD-006 is enforced for the dependency, `packageManager`, mise tool, mise plugin, and image rules above. A Python `requests==2` pin passes. `workspace:`, `file:`, `link:`, and `catalog:` pass and are not resolved. A pipeline step's `uses:` commit is not checked here. `@sha256:` is a substring, so `@sha256:abc` passes.

STD-007 and STD-008 are not this tool.
