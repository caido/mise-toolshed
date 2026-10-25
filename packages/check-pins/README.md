# check-pins

`check-pins` scans one directory tree and prints dependency, tool, image, and install pins that are not exact.

## Usage

`node` must be on `PATH`. The built command is `dist/check-pins.mjs`. A released install is the `check-pins` executable.

- No arguments scans the current directory. Each finding is one stdout line `file:line: message`. Lines are sorted by path, then line, then message, using string order for the path and the message. The process exits 0 when there are no findings and 1 when there is at least one. A scan does not write to stderr.
- `--version` as the only argument prints the version on stdout and exits 0.
- Any other argument list, including a path, `--help`, or `--version` repeated, prints `usage: check-pins --version` on stderr and exits 1. It does not scan.

The walk does not follow symbolic links. A directory named `node_modules`, `.git`, or `dist` is not entered. See [Skipped directories](#skipped-directories).

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

#### What it checks

String values in `dependencies`, `devDependencies`, and `optionalDependencies`:

- `dependency <name> is not an exact version`
- `dependency <name> git pin is not 40 hex`

`peerDependencies` are not checked.

A spec passes when it is one of:

- An exact semver, optional leading `=`, with an optional prerelease and build: `1.2.3`, `=1.2.3`, `1.2.3-beta.1`, `1.2.3+build.5`. `1.2` and ranges (`^`, `~`, `>`, `<`, `*`, `latest`, `1.x`) do not pass.
- A spec that starts with `workspace:`, `file:`, `link:`, or `catalog:`. The target is not resolved.
- A spec that starts with `git+`, `git:`, `github:`, `gitlab:`, or `bitbucket:`, and the text after the last `#` is 40 hex. Any other text after that prefix is `dependency <name> git pin is not 40 hex`.

`ssh:`, `gist:`, an `https://` URL that is not `git+https://`, and an `npm:` alias do not use the git rule. They fail as `dependency <name> is not an exact version` unless they also match an exact semver.

A non-string dependency value is skipped. `engines`, `overrides`, and `resolutions` are not read.

`packageManager`, when present, must be a string matching `pnpm@` plus exact semver (`pnpm@12.14.0`). Otherwise:

- `packageManager is not an exact pnpm version`

A missing `packageManager` is not a finding. A non-string `packageManager` makes the file `package-json is not valid`.

String values in `scripts` are judged as install commands. See [uv and pnpm commands](#uv-and-pnpm-commands). For those script commands, `[env] UV_LOCKED = "1"` in a scanned mise file counts as a lock.

### pyproject.toml

Any file named `pyproject.toml`, at any depth.

#### What it checks

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

`[tools]`, `[plugins]`, and `[env]` are read. `[tools.<name>]`, `[plugins.<name>]`, a dotted key such as `node.version`, and an inline `{ ... }` value are table form. Other tables, including `[settings]`, are ignored. A subtable body is not read as assignments.

#### What it checks

Tool values:

- `tool <name> must be a string` for table form, including `[tools.<name>] version = "…"`.
- `tool <name> is not an exact version` when the string is not `major.minor` or `major.minor.patch`. Each numeric part is `0` or a number without a leading zero. `22.1` passes. `22`, `v22.0.0`, a `v` prefix, a 40-hex commit, and a prerelease do not.

Plugin values:

- `plugin <name> must end in a 40-hex pin` unless the string ends in `#` plus 40 hex. Table form fails the same message.

`[env] UV_LOCKED = "1"` is not a finding. It is a lock source for `uv` commands in `package.json` scripts and for commands whose shell tokens include `mise`. The value is the TOML scalar, so a quoted `"1"` counts. Any scanned mise file that sets it covers the whole scan. The key is not required, and a mise file is not required to exist.

`.mise/config.netlify.toml` is scanned with these same rules. It is not compared with another file.

These names are not mise files: `.mise.toml`, `mise.local.toml`, `.config/mise/config.toml`, `.miserc.toml`.

### Dockerfile

Any file whose name starts with `Dockerfile`, at any depth. `app.Dockerfile` does not match.

#### What it checks

`FROM` image references, after flags such as `--platform`:

- `image <reference> must contain @sha256:`

`scratch` passes. A reference that equals an earlier stage name in the same file passes (`FROM base` after `FROM scratch AS base`). `base:latest` does not equal the stage name `base`. The digest check is a substring `@sha256:`. The text after it is not required to be 64 hex.

`RUN`, `CMD`, and `ENTRYPOINT` are judged as install commands. See [uv and pnpm commands](#uv-and-pnpm-commands). A JSON exec form of strings is joined with spaces and judged as one command. The finding line is the continued physical line that contains the `uv` or `pnpm` token when that line can be found. `[env]` from mise counts only when the command's tokens include `mise`.

### .npmrc

Any file named `.npmrc`, at any depth.

#### What it checks

`.npmrc` produces no finding of its own. The last `frozen-lockfile=` assignment in the file is read. Blank lines and lines that start with `#` or `;` are ignored. When that last value is `true`, every `pnpm install` in the scan may use it. See [uv and pnpm commands](#uv-and-pnpm-commands). The value is not limited to the directory of the command. A file whose last value is not `true` does not cancel a `true` from another `.npmrc`. No other `.npmrc` key is read.

### workflow YAML

A `.yml` or `.yaml` file whose parent is `workflows` and whose grandparent is `.github`. Composite actions under `.github/actions/` are not scanned. Other YAML under `.github/` is not scanned.

#### What it checks

`uses:`:

- `action <uses> must be a 40-hex SHA with a version comment`

A value that starts with `./` passes. Any other value passes only when it ends in `@` plus 40 hex and the same line has a comment matching `v?X.Y.Z` (optional leading `v`, optional prerelease or build). `uses: docker://…` is an image, not an action.

`container:`, `services:`, and an `image:` key nested under a block `container` or `services` on a job:

- `image <reference> must contain @sha256:`

Workflow images do not accept `scratch` or a Dockerfile stage name. `uses: docker://…` uses the same image message, with the `docker://` prefix left in the reference. A digest is the substring `@sha256:`.

`run:` steps are judged as install commands. See [uv and pnpm commands](#uv-and-pnpm-commands). A literal block is one command per joined continuation. A folded block is one command, except a more-indented line, which is its own command. An anchor is replayed where an alias is used, and the anchor itself is judged too. A missing alias is `workflow is not valid` on that line.

`env` on the workflow, the job, and the step is merged in that order for the step's commands. A later map replaces the same name. Env under `container` or `services` is not a step env. `[env]` from mise counts only when the command's tokens include `mise`.

### uv and pnpm commands

These commands are read only from `package.json` `scripts`, Dockerfile `RUN`, `CMD`, and `ENTRYPOINT`, and workflow `run:` steps.

Every shell segment that contains a `uv` token is a uv command, not only `uv sync` and `uv run`.

- `uv command must not contain --frozen` when the command text contains `--frozen`.
- `uv command must set UV_LOCKED=1` when the command is not locked.

Both can be reported for the same command. The `--frozen` finding is first.

A uv command is locked when, in this order:

- A `UV_LOCKED=` assignment appears before the `uv` token. `UV_LOCKED=1` locks. Any other value does not. `env -u UV_LOCKED` before `uv` does not lock.
- Otherwise, an earlier segment in the same script exported `UV_LOCKED=1` with `export` or `declare -x`, and nothing later cleared it. `unset UV_LOCKED`, `export -n UV_LOCKED`, and `declare +x UV_LOCKED` clear it. The export does not cross `&&`, `||`, `|`, or `&`.
- Otherwise, a surrounding `env` map (workflow, job, or step) has `UV_LOCKED` equal to `1`.
- Otherwise, for `package.json` scripts and for a command that itself runs `mise`, some scanned mise file set `[env] UV_LOCKED = "1"`.

`--locked` is not a lock.

A `pnpm` token, or a token that ends in `/pnpm`, followed later by `install` or `i`:

- `pnpm install must pass --frozen-lockfile`

The command passes when it contains `--frozen-lockfile` or `--frozen-lockfile=true`, or when it contains neither those nor `--no-frozen-lockfile`, `--no-frozen-lockfile=true`, or `--frozen-lockfile=false`, and some scanned `.npmrc` has `frozen-lockfile=true` as its last assignment of that key. An explicit false flag fails even when `.npmrc` says true. `pnpm build` and a `pnpm` token with no `install` or `i` are not installs. The pnpm check does not use `UV_LOCKED` or mise env.

## Skipped directories

The walk skips a directory named:

- `node_modules`
- `.git`
- `dist`

The name match is the directory's own name, at any depth. `.gitignore` is not read, so a gitignored directory with another name is scanned. Symbolic links are not followed, including a symlink to a file.

## Standards coverage

Each Success Criteria below is mapped to the check that exists today. A criterion check-pins does not fully enforce is an open question.

### [STD-006](https://github.com/caido/engineering/blob/main/standards/STD-006-exact-versions.md) Exact versions

A dependency uses one exact version. It never uses a range, a major-only version or latest.

Enforced for string specs in `dependencies`, `devDependencies`, and `optionalDependencies`: a range, a major-only version, and `latest` fail as `dependency <name> is not an exact version`. An exact `x.y.z` passes. A spec that starts with `git+`, `git:`, `github:`, `gitlab:`, or `bitbucket:` must be 40 hex after the last `#`. `packageManager` must be an exact `pnpm@x.y.z`. A Python requirement with a range operator fails. A Python git direct URL must use a 40-hex revision. `peerDependencies` are not checked.

Not covered. `requests==2` passes, so a major-only Python equality is accepted. `workspace:`, `file:`, `link:`, and `catalog:` pass and are not resolved. `engines`, `overrides`, and `resolutions` are not read. `ssh:`, `gist:`, `https://….git#<sha>`, and `npm:` aliases fail as inexact even when the commit is 40 hex.

A tool or plugin uses one exact version. It never uses a range, a major-only version or latest.

Enforced on a scanned mise file: a tool string of `22`, `latest`, or a range fails as `tool <name> is not an exact version`. A plugin string must end in `#` plus 40 hex, or it fails as `plugin <name> must end in a 40-hex pin`.

Not covered. `node = "22.1"` passes, so a major.minor tool version is accepted. A `v` prefix and a 40-hex tool commit fail. Table form, including `[tools.<name>] version = "…"`, fails as `tool <name> must be a string` and the version inside is not read. `.mise.toml`, `mise.local.toml`, and `.config/mise/config.toml` are not scanned.

A pipeline step or shared pipeline uses one commit. It never uses a branch name or a movable tag.

Enforced for `uses:` in `.github/workflows/*.yml` and `*.yaml`: a branch or a tag fails as `action <uses> must be a 40-hex SHA with a version comment`. A 40-hex SHA with that comment passes. A `./` path passes.

Not covered. Composite actions under `.github/actions/` and other YAML under `.github/` are not scanned.

A container image is referenced by its content digest, not a tag.

Enforced for a scanned Dockerfile `FROM` and for a scanned workflow `container:`, `services:` / `image:`, and `docker://` `uses:`: a tag with no `@sha256:` fails as `image <reference> must contain @sha256:`.

Not covered. `@sha256:` is a substring, so `@sha256:abc` passes and the digest is not checked as content. `scratch` and an earlier stage name pass with no digest. A file is a Dockerfile only when its name starts with `Dockerfile`, so `app.Dockerfile` is not scanned.

### [STD-007](https://github.com/caido/engineering/blob/main/standards/STD-007-lockfiles.md) Lockfiles

The repository must commit the lockfile. The lockfile must not be ignored.

Not covered. `uv.lock`, `pnpm-lock.yaml`, and `mise.lock` are not read. `.gitignore` is not read, so an ignored lockfile is not a finding.

A clean install must fail when the lockfile is missing or out of date with the manifest.

Partly enforced, and only as a flag on a judged command. A `uv` command must be locked with `UV_LOCKED=1`. `pnpm install` and `pnpm i` must pass `--frozen-lockfile`, or inherit `frozen-lockfile=true` from any scanned `.npmrc`. `--frozen` on `uv` is its own finding and is not that lock. The lockfile is not compared with the manifest, so a missing or stale lockfile with no such command is not a finding.

A clean install must fail when a fetched artifact does not match the recorded checksum.

Not covered. Checksums in a lockfile are not read.

CI and release builds must install from the lockfile and must never change it.

Partly enforced for a `uv` or `pnpm install` command in `package.json` scripts, Dockerfile `RUN`, `CMD`, and `ENTRYPOINT`, and workflow `run:` steps, by the same flags as above. `--locked` is not a lock. A `frozen-lockfile=true` line in any `.npmrc` covers every `pnpm install` in the scan. Shell scripts, Makefiles, and `.mise/tasks` are not judged. mise `[env] UV_LOCKED = "1"` is a lock source for some commands and is not required, and a mise file is not required to exist.

### [STD-008](https://github.com/caido/engineering/blob/main/standards/STD-008-minimum-release-age.md) Minimum release age

A newly added or upgraded dependency or tool must meet the age in the Goal.

Not covered. No release time is read. mise `[settings] minimum_release_age` is ignored. `pnpm-workspace.yaml` `minimumReleaseAge` is not read. pyproject `[tool.uv]` and `.miserc.toml` are not read. This repository sets `minimum_release_age = "7d"` and `minimumReleaseAge: 10080`. check-pins checks neither.

Packages that Caido publishes are exempt.

Not covered. There is no exemption, because age is not checked.

## Open questions

Should `.mise/config.netlify.toml` reject every plugin and every toolshed tool, and require its `node` and `pnpm` to equal `.mise/config.toml`? It is scanned as a normal mise file. There is no cross-file comparison.

Default if unanswered: keep the current behavior.

STD-006 says a dependency uses one exact version and never uses a range, a major-only version, or latest. Should that apply to every dependency check-pins can see? A range, a major-only version, and `latest` already fail for string specs in `dependencies`, `devDependencies`, and `optionalDependencies`, and `packageManager` must be an exact `pnpm@x.y.z`. `peerDependencies` are not checked. `requests==2` passes. `workspace:`, `file:`, `link:`, and `catalog:` pass without being resolved. `engines`, `overrides`, `resolutions`, and pnpm catalogs are not read.

Default if unanswered: keep the current behavior.

Should `ssh:`, `gist:`, `https://….git#<40 hex>`, and `npm:` aliases count as one exact dependency version when the commit is 40 hex? They fail as `dependency <name> is not an exact version`. Specs that start with `git+`, `git:`, `github:`, `gitlab:`, or `bitbucket:` need 40 hex after the last `#`.

Default if unanswered: keep the current behavior.

STD-006 says a tool or plugin uses one exact version and never uses a range, a major-only version, or latest. Should `major.minor` fail, and should a `v` prefix or a 40-hex commit pass? `22.1` passes. `22`, `latest`, and a range fail. A `v` prefix and a 40-hex tool commit fail as `tool <name> is not an exact version`. Table form, including `[tools.<name>] version = "…"`, fails as `tool <name> must be a string`. `.mise.toml`, `mise.local.toml`, and `.config/mise/config.toml` are not scanned. A scanned plugin string must end in `#` plus 40 hex.

Default if unanswered: keep the current behavior.

STD-006 says a pipeline step or shared pipeline uses one commit and never uses a branch name or a movable tag. Should composite actions under `.github/actions/` and other YAML under `.github/` be scanned? In `.github/workflows/*.yml` and `*.yaml`, a `uses:` that is not a `./` path must be a 40-hex SHA with a version comment. A branch or a tag there fails.

Default if unanswered: keep the current behavior.

STD-006 says a container image is referenced by its content digest, not a tag. Should `@sha256:` have to be the content digest, and should `app.Dockerfile` be scanned? Any scanned reference that contains `@sha256:` passes, including `@sha256:abc`. `scratch` and an earlier stage name pass. A Dockerfile is only a file whose name starts with `Dockerfile`.

Default if unanswered: keep the current behavior.

Should uv findings be limited to `uv sync` and `uv run`, and should `--locked` count as a lock? Every segment with a `uv` token is judged. `--frozen` is its own finding and does not replace the lock finding. A lock is `UV_LOCKED=1` from a prefix, an `export`, a workflow `env`, or mise `[env]` for `package.json` scripts and for commands that call `mise`. `--locked` is not a lock.

Default if unanswered: keep the current behavior.

STD-007 says the repository must commit the lockfile and the lockfile must not be ignored. Should a missing or gitignored `uv.lock`, `pnpm-lock.yaml`, or `mise.lock` be a finding? Those files are not read, and `.gitignore` is not read.

Default if unanswered: keep the current behavior.

STD-007 says a clean install must fail when the lockfile is missing or out of date with the manifest. Should check-pins compare the lockfile to the manifest? It does not. A judged `uv` command must be locked with `UV_LOCKED=1`, and a judged `pnpm install` or `pnpm i` must pass `--frozen-lockfile` or inherit `frozen-lockfile=true` from any scanned `.npmrc`. A tree with no such command and no lockfile passes.

Default if unanswered: keep the current behavior.

STD-007 says a clean install must fail when a fetched artifact does not match the recorded checksum. Should lockfile checksums be checked? They are not read.

Default if unanswered: keep the current behavior.

STD-007 says CI and release builds must install from the lockfile and must never change it. Should that include shell scripts, Makefiles, and `.mise/tasks`, and should `--locked` count? Those paths are not judged. Judged `uv` and `pnpm install` commands are the only check, in `package.json` scripts, Dockerfile `RUN`, `CMD`, and `ENTRYPOINT`, and workflow `run:` steps.

Default if unanswered: keep the current behavior.

Should a mise config be required to exist, and should it be required to set `UV_LOCKED = "1"`? The key is only a lock source. A scan with no mise file passes.

Default if unanswered: keep the current behavior.

Should the command take a path, read `.gitignore`, and skip more directories such as `.nuxt`, `.output`, and `coverage`? It takes no path, skips only `node_modules`, `.git`, and `dist`, and scans gitignored directories.

Default if unanswered: keep the current behavior.

Should `frozen-lockfile=true` in `.npmrc` apply only in the directory of the `pnpm install`? Any scanned `.npmrc` whose last `frozen-lockfile` value is `true` covers every `pnpm install` and `pnpm i` in the tree. `.npmrc` is read only for that key. The command itself still needs `--frozen-lockfile` when no such line exists.

Default if unanswered: keep the current behavior.

STD-008 says a newly added or upgraded dependency or tool must be at least 7 days old. Should check-pins enforce that age? No release time is read. mise `[settings] minimum_release_age`, `pnpm-workspace.yaml` `minimumReleaseAge`, pyproject `[tool.uv]`, and `.miserc.toml` are not read.

Default if unanswered: keep the current behavior.

STD-008 says packages that Caido publishes are exempt from that age. Should check-pins carry that exemption? It has no exemption, because it does not check age.

Default if unanswered: keep the current behavior.

Should a `[[...]]` array-of-tables header in `pyproject.toml` be its own table? `tomlHeader` matches only a single pair of brackets, and both `parsePyproject` and `parseMise` leave the previous section in place when it does not match. `[[tool.mypy.overrides]]` is skipped until the next single-bracket header. After `[dependency-groups]` or `[project.optional-dependencies]`, every key is still a requirement list, so `module = ["foo.*"]` is reported as `dependency foo is not an exact version`. After `[project]`, only a key named `dependencies` is still judged. A mise `[tools]`, `[plugins]`, or `[env]` section stays current across that same skipped header.

Default if unanswered: keep the current behavior.
