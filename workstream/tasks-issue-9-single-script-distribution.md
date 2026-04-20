# Implementation Plan - Issue #9: Single-script toolkit distribution

## Relevant Files

- `dev-tasks.sh` — Main entry-point script (install, update, check, version commands)
- `bundle-manifest.json` — Machine-readable manifest listing managed paths and compatibility metadata
- `scripts/build-bundle.sh` — Build script that packages managed files into a release tarball with checksum
- `.github/workflows/release-bundle.yml` — GitHub Actions workflow to publish release artifacts on tag
- `README.md` — Installation, update, version pinning, rollback documentation

## Tasks

- [x] 1.0 Implement Issue #9 - https://github.com/llipe/dev-tasks/issues/9: Single-script toolkit distribution with install, update, version check, and AGENTS.md integration prompt

  - [x] 1.1 Create `bundle-manifest.json` defining managed file surface and compatibility metadata
  - [x] 1.2 Create `dev-tasks.sh` with CLI skeleton: argument parsing, help text, and `version` subcommand
  - [x] 1.3 Implement `check` subcommand: query GitHub API for latest release, compare with installed version
  - [x] 1.4 Implement `install` subcommand: resolve version, download tarball, verify checksum, extract, place files, write `.dev-tasks-version`, print AGENTS.md integration prompt
  - [x] 1.5 Implement `update` subcommand: read current version, detect local modifications, download new version, replace files, write metadata, print AGENTS.md prompt
  - [x] 1.6 Add `--dry-run` and `--backup` flag support across install/update
  - [x] 1.7 Add robust error handling: network failures, missing tools, permission errors, corrupt archives, non-zero exit codes
  - [x] 1.8 Create `scripts/build-bundle.sh`: package managed files into tarball, generate SHA256 checksum
  - [x] 1.9 Create `.github/workflows/release-bundle.yml`: trigger on tag push, build bundle, create GitHub Release, upload assets
  - [x] 1.10 Update `README.md` with install, update, version check, pinning, rollback, and AGENTS.md integration instructions
  - [x] 1.11 Verify Acceptance Criterion: `dev-tasks.sh install` places all managed files in correct paths
  - [x] 1.12 Verify Acceptance Criterion: AGENTS.md integration prompt is printed after every install/update (never overwritten)
  - [x] 1.13 Verify Acceptance Criterion: `--dry-run` shows planned changes without modifying files
  - [x] 1.14 Verify Acceptance Criterion: `.dev-tasks-version` is written with version and timestamp
  - [x] 1.15 Verify Acceptance Criterion: network/tool/permission failures produce clear errors and non-zero exit codes
