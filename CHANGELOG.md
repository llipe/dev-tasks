# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.6.4] - 2026-07-30

### Changed

- chore(package): add repository field to package.json

## [0.6.3] - 2026-07-30

### Changed

- ci(npm-publish): upgrade Node.js to 24 and ensure npm supports OIDC

## [0.6.2] - 2026-07-30

### Changed

- ci(npm-publish): migrate to OIDC trusted publishers and update Node.js
- docs(readme): align markdown table formatting for consistency
- ci: enhance release workflow and npm publishing
- ci(npm-publish): add provenance attestation and version verification
- chore(package): update package name and bump version to 0.6.1

## [0.6.1] - 2026-07-30

### Changed

- test(bootstrap-commands): use dynamic package version in integration tests
- chore(package): bump version to 0.6.0

## [0.6.0] - 2026-07-30

### Added

- feat: dt extract component with provenance and idempotency (#40)
- feat: dt extract asyncapi Kafka topic inventory and payloads (#41)
- feat: dt extract openapi routes 1 and 3 (#39)
- feat: dt extract schema (#38)
- feat: dt extract detect and pluggable extractor interface (#37)
- feat: migration shim from dev-tasks.sh (#36)
- feat: hash-based reconciliation engine and dev-tasks update (#34)
- feat: dev-tasks bootstrap - install, status, pin, doctor (#35)
- feat: package scaffold with two binaries and layered core (#33)

### Changed

- docs: standardize markdown formatting across documentation and instructions
- chore(.npmrc): clarify npm authentication configuration
- ci: add npm publishing workflow and package configuration
- Merge pull request #74 from llipe:integration/mrc-phase1-extraction
- docs: add dt CLI and architecture documentation
- Merge pull request #68 from llipe:integration/mrc-phase0-1-scaffold
- chore: project setup - greenfield @llipe/dev-tasks scaffold
- docs: add PRD for multi-repo context feature
- chore: enforce --body-file requirement for gh issue/pr operations

## [Unreleased]

### Added

- feat: `dt extract component [--interactive] [--force]` — derives `component.yaml` from detection/extraction with \_provenance, field hashes, and interactive prompts for non-derivable fields
- feat: `dt extract all [--interactive] [--force]` — orchestrates full extraction pipeline and generates `extraction_report.json`
- feat: hash-based idempotent reconciliation for component.yaml (exit 13 on missing required fields, exit 14 on reconciliation conflicts)
- feat: migration shim from legacy `dev-tasks.sh` to `@llipe/dev-tasks` npm package
- feat: `dev-tasks migrate` command — generates manifest from legacy state with `modified: unknown` origin hashes
- feat: legacy detection logic (`core/distribution/migrate.ts`) — detects `.dev-tasks-version` or `.dev-tasks/` without `manifest.json`

### Changed

- **BREAKING:** `dev-tasks.sh` is replaced by a thin migration shim that detects legacy installs, installs `@llipe/dev-tasks`, and runs the migration. The legacy self-update mechanism (`install`, `update`, `self-update`, `check`, `list`, `version` commands) has been removed.
- **BREAKING:** Future updates are managed through npm/pnpm (`pnpm add -g @llipe/dev-tasks@latest`) and the `dev-tasks update` command with hash-based reconciliation.

### Migration

- After running the shim, all pre-existing skill files are tracked in `.dev-tasks/manifest.json` with `origin_sha256: "unknown"`.
- The first `dev-tasks update` will report conflicts for all migrated files (because the original hash is unknown). This is by design — review changes before accepting, or use `--force` to accept all.
- The `dev-tasks.sh` script can be safely removed from your repo after migration.

## [0.5.4] - 2026-07-21

### Changed

- docs: strengthen multi-line body formatting and add product/technical guidelines

## [0.5.3] - 2026-07-20

### Changed

- docs: add quick-start guide and improve README structure

## [0.5.2] - 2026-07-18

### Added

- feat: enforce test-first design as default with verifier design-mode recommendation - product-engineer: add Phase 6 (Verifier Design Recommendation) after Plan, update handoff message to suggest verifier Design Mode before developer, add test-first design default rule (#7), update activity chain tables - developer: add rule #19 (test-first design default approach), update execution flow to load test plans and write tests before implementation - planner: add Verifier Design Mode (Pre-Implementation) section, update developer handoff template with test-first directive and test plan reference - Update AGENTS.md, AGENTS.md.template, CLAUDE.md, CLAUDE.md.template with test-first design guideline bullet - Update Copilot prompts to reflect updated activity chains

### Changed

- chore: format
- chore: archive release automation issue artifacts

## [0.5.1] - 2026-07-17

### Changed

- docs: remove blank line in CHANGELOG.md
- docs(github-ops): add multi-line body formatting guidance for gh CLI

## [0.5.0] - 2026-07-17

### Added

- feat: add release automation script (scripts/release.sh) Implements a single-command release workflow that: - Validates pre-flight conditions (branch, clean tree, format) - Auto-generates CHANGELOG.md entries grouped by commit type - Fetches merged PR metadata via gh CLI (graceful fallback) - Suggests increment type based on commit analysis - Commits changelog, creates annotated tag, pushes to trigger CI Closes #31

### Changed

- chore: apply prettier formatting across agent skills and docs
- chore(workstream): archive token-optimization devtasks artifacts
- Merge pull request #32 from llipe:issue/31-release-automation
- docs: update README with release script usage
