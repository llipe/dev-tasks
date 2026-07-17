# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.5.0] - 2026-07-17

### Added

- feat: add release automation script (scripts/release.sh) Implements a single-command release workflow that: - Validates pre-flight conditions (branch, clean tree, format) - Auto-generates CHANGELOG.md entries grouped by commit type - Fetches merged PR metadata via gh CLI (graceful fallback) - Suggests increment type based on commit analysis - Commits changelog, creates annotated tag, pushes to trigger CI Closes #31

### Changed

- chore: apply prettier formatting across agent skills and docs
- chore(workstream): archive token-optimization devtasks artifacts
- Merge pull request #32 from llipe:issue/31-release-automation
- docs: update README with release script usage
