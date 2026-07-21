# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

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
