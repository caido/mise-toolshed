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

String values in `dependencies`, `devDependencies`, `optionalDependencies`, and `peerDependencies`:

- `dependency <name> is not an exact version`
- `dependency <name> git pin is not 40 hex`

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

The name is the package token at the start of the requirement, before ` @ `. Text after the first `;` is a marker and is not the pin.

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

The goals below are [STD-006 Exact versions](https://github.com/caido/engineering/blob/main/standards/STD-006-exact-versions.md), [STD-007 Lockfiles](https://github.com/caido/engineering/blob/main/standards/STD-007-lockfiles.md), and [STD-008 Minimum release age](https://github.com/caido/engineering/blob/main/standards/STD-008-minimum-release-age.md). This repository's own `[settings] minimum_release_age = "7d"` and `minimumReleaseAge: 10080` meet STD-008 for this repo. check-pins checks neither.

### STD-006 Exact versions

Enforced, for the files in [Supported files](#supported-files):

- An npm dependency is an exact semver, an unresolved `workspace:` / `file:` / `link:` / `catalog:` spec, or a `git+`, `git:`, `github:`, `gitlab:`, or `bitbucket:` spec whose commit is 40 hex.
- A Python requirement in the arrays above is `==` without a range operator or `*`, or a git direct URL whose revision is 40 hex.
- `packageManager` is an exact `pnpm@x.y.z`.
- A mise tool string is `major.minor` or `major.minor.patch`.
- A mise plugin string ends in `#` plus 40 hex.
- A GitHub Action `uses:` is a local `./` path, or a 40-hex SHA with a version comment.
- A Dockerfile `FROM` is `scratch`, an earlier stage name, or a reference that contains `@sha256:`.
- A workflow `container:`, `services:` / `image:`, or `docker://` `uses:` contains `@sha256:`.

Not covered:

- A mise tool may be `major.minor`. A `v` prefix and a 40-hex tool commit fail. Table form fails instead of being read as a version.
- `@sha256:` is not required to be 64 hex.
- `ssh:`, `gist:`, `https://…git#<sha>`, and `npm:` aliases are not treated as git pins.
- `workspace:`, `file:`, `link:`, and `catalog:` are not resolved.
- Only names that start with `Dockerfile` are images. `app.Dockerfile` is not scanned.
- Only `.github/workflows/*.yml` and `*.yaml` are actions. `.github/actions/` is not scanned.
- `package.json` `engines`, `overrides`, and `resolutions` are not read.
- `.mise.toml`, `mise.local.toml`, and `.config/mise/config.toml` are not read.

### STD-007 Lockfiles

Enforced:

- A `uv` command in a judged script must not contain `--frozen` and must be locked with `UV_LOCKED=1` by a prefix, an `export` in that script, a workflow `env`, or mise `[env]` in the cases above.
- `pnpm install` and `pnpm i` must pass `--frozen-lockfile`, or inherit `frozen-lockfile=true` from any scanned `.npmrc`.

Not covered:

- `--locked` is not a lock.
- mise `[env] UV_LOCKED = "1"` is not required, and the base mise config is not required to exist.
- `uv.lock`, `pnpm-lock.yaml`, and `mise.lock` are not read, so a missing or stale lockfile is not a finding.
- `.npmrc` `frozen-lockfile` is not scoped to the directory of the command.
- uv and pnpm commands outside `package.json` scripts, Dockerfile `RUN` / `CMD` / `ENTRYPOINT`, and workflow `run:` are not judged. That includes shell scripts, Makefiles, and `.mise/tasks`.

### STD-008 Minimum release age

Not covered. check-pins does not read age settings and does not compare a pin to a release time.

- mise `[settings]`, including `minimum_release_age`, is ignored.
- `pnpm-workspace.yaml` `minimumReleaseAge` is not read.
- pyproject `[tool.uv]` is not read.
- `.miserc.toml` is not read.

## Open questions

Should `.mise/config.netlify.toml` reject every plugin and every toolshed tool, and require its `node` and `pnpm` to equal `.mise/config.toml`? It is scanned as a normal mise file. There is no cross-file comparison.

Default if unanswered: keep the current behavior.

Should a mise tool require `x.y.z`, and should a `v` prefix or a 40-hex commit pass? `major.minor` passes today. A `v` prefix and a 40-hex commit fail as `tool <name> is not an exact version`. Table form, including `[tools.<name>] version = "…"`, fails as `tool <name> must be a string`.

Default if unanswered: keep the current behavior.

Should a Dockerfile `FROM` require `@sha256:` plus 64 hex characters? Any reference that contains `@sha256:` passes. `scratch` and an earlier stage name pass. A file is a Dockerfile only when its name starts with `Dockerfile`, so `app.Dockerfile` is not scanned.

Default if unanswered: keep the current behavior.

Should npm git pins accept `ssh:`, `gist:`, `https://….git#<40 hex>`, and `npm:` aliases, and reject other URL shapes? Specs that start with `git+`, `git:`, `github:`, `gitlab:`, or `bitbucket:` need 40 hex after the last `#`. The other shapes fail as `dependency <name> is not an exact version`. `workspace:`, `file:`, `link:`, and `catalog:` pass without being resolved.

Default if unanswered: keep the current behavior.

Should GitHub Actions outside `.github/workflows/*.yml` and `*.yaml` be scanned, including composite actions under `.github/actions/`? A scanned `uses:` still needs a 40-hex SHA and a version comment, and a `./` path still passes.

Default if unanswered: keep the current behavior.

Should uv findings be limited to `uv sync` and `uv run`, and should `--locked` count as a lock? Every segment with a `uv` token is judged. `--frozen` is its own finding and does not replace the lock finding. A lock is `UV_LOCKED=1` from a prefix, an `export`, a workflow `env`, or mise `[env]` for `package.json` scripts and for commands that call `mise`. `--locked` is not a lock.

Default if unanswered: keep the current behavior.

Should uv and pnpm commands in shell scripts, Makefiles, and `.mise/tasks` be scanned? They are judged only in `package.json` scripts, Dockerfile `RUN`, `CMD`, and `ENTRYPOINT`, and workflow `run:` steps.

Default if unanswered: keep the current behavior.

Should a mise config be required to exist, and should it be required to set `UV_LOCKED = "1"`? The key is only a lock source. A scan with no mise file passes.

Default if unanswered: keep the current behavior.

Should the command take a path, read `.gitignore`, and skip more directories such as `.nuxt`, `.output`, and `coverage`? It takes no path, skips only `node_modules`, `.git`, and `dist`, and scans gitignored directories. `.mise.toml`, `mise.local.toml`, and `.config/mise/config.toml` are not scanned.

Default if unanswered: keep the current behavior.

Should lockfiles and the settings around them be read? `[settings]` in mise config is ignored, so `minimum_release_age` is not checked. `.miserc.toml`, `pnpm-workspace.yaml` (`minimumReleaseAge`, catalogs, overrides), `uv.lock`, `pnpm-lock.yaml`, `mise.lock`, `package.json` `engines`, `overrides`, and `resolutions`, and pyproject `[tool.uv]` are not read. `.npmrc` is read only for `frozen-lockfile`. `packageManager` must be an exact `pnpm@x.y.z`. STD-007's lockfile match and STD-008's release age are both in this gap.

Default if unanswered: keep the current behavior.

Should `frozen-lockfile=true` in `.npmrc` apply only in the directory of the `pnpm install`? Any scanned `.npmrc` whose last `frozen-lockfile` value is `true` covers every `pnpm install` and `pnpm i` in the tree. The command itself still needs `--frozen-lockfile` when no such line exists.

Default if unanswered: keep the current behavior.

Should check-pins fail a dependency or tool that was released less than 7 days ago, for every ecosystem STD-008 covers? No release time is read. mise `minimum_release_age` and pnpm `minimumReleaseAge` are not read.

Default if unanswered: keep the current behavior.
