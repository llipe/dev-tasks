# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.11.0] - 2026-08-25

### Added

- feat(agent): add researcher agent and activity-codebase-research skill
- feat(test): add integration, E2E, and contract validation skills (#130)

### Fixed

- fix: trim AGENTS.md from 2678 to 1218 words

### Changed

- chore: prettier
- chore: archive workstream
- Merge pull request #147 from llipe:issue/139-research-agent
- docs: fix drift found by technical-writer pass
- Merge pull request #146 from llipe:issue/142-clean-agents-md
- test(fixtures): update catalog fixture timestamps and generator version
- Merge pull request #138 from llipe/issue/130-integration-testing-playwright-e2e
- test: add parity and content tests for issue #130 skills

## [Unreleased]

### Added

- feat(agent): add `researcher` agent and `activity-codebase-research` skill (#139)
  - Ten-agent roster (Copilot/Kiro), eight Claude subagents
  - Eight-slice taxonomy, 250-line/30-file budget caps
  - Conditional pre-refine (Issue Mode) and pre-spec (Feature Mode) research step
  - Developer troubleshooting and planner pre-orchestration paths
  - ADR-004: pre-spec codebase research step

## [0.10.0] - 2026-08-19

### Added

- feat(ux): add ux-scaffold, ux-theme-gen skills; rewrite ux-engineer agent

### Fixed

- fix(design): distribute DESIGN.md and convert it to a placeholder contract

### Changed

- chore: format update
- Merge pull request #137 from llipe/issue/136-ux-engineer-overhaul
- chore: remove webapp-mockup skill entirely
- docs: add DESIGN.md to system-overview and update workflow-chains with lite mode
- chore!: raise minimum Node.js to >= 24

## [Unreleased]

### Changed

- **BREAKING:** raise the minimum supported Node.js version to `>= 24` (was `>= 20`).
  Node 24 is an LTS line supported through April 2028; Node 20 is past end-of-life,
  so the previous floor claimed support for an unsupported runtime. Consumers on
  Node 20 or 22 must upgrade. Affects `engines.node`, the `dev-tasks doctor` check
  (`MIN_NODE_MAJOR`), the shipped CI templates (`templates/meta-repo/catalog-rebuild.yml`,
  `templates/bitbucket-pipelines.yml`), and the documented prerequisites.
- Pin `@types/node` to `24.13.3`, matching the minimum supported runtime rather than
  the latest release, so Node 26-only APIs cannot be referenced against a Node 24 floor.

## [0.9.2] - 2026-08-18

### Fixed

- fix(dist): auto-migrate on update when manifest is missing

### Changed

- Merge pull request #135 from llipe:issue/fix-update-no-manifest-detection
- test(fixtures): update catalog fixture timestamps and generator version

## [0.9.1] - 2026-08-18

### Fixed

- fix(dist): discover new package files during update

### Changed

- Merge pull request #134 from llipe:issue/fix-update-discover-new-files

## [0.9.0] - 2026-08-18

### Added

- feat(qa): wire TESTING.md distribution and update all registries
- feat(qa): wire qa-engineer into developer, planner, implement, verifier
- feat(qa): add three testing skills mirrored across platforms
- feat(qa): add TESTING.md contract and qa-engineer agent
- feat(extract): wire schema extraction through ladder (declared → observed)
- feat(extract): add pg as optional peer dep, update Known Limitations
- feat(extract): add AsyncAPI declared rung for on-disk spec detection
- feat(extract): add OpenAPI ladder orchestrator (declared → observed → inferred)
- feat(extract): remove in-CLI LLM, extend report with provenance and handoff
- feat(extract): add workspace discovery and ladder runner
- feat(extract): implement route2 spike — boot + introspect for Express

### Fixed

- fix: format
- fix(qa): address Major audit findings D-1 and D-2
- fix(workflow): open draft PR after first commit, not before

### Changed

- Merge pull request #129 from llipe:issue/123-qa-agent-and-testing-standard
- docs(qa): sync registries, guidelines, and ADR-003 for the coverage gate
- test(qa): add fixture projects reproducing the home-ledger defects
- test(dist): add failing root-file distribution assertions for TESTING.md
- test(qa): add failing testing-standard assertions and rule-19 guard
- test(qa): add failing qa-engineer parity and prompt-cap assertions
- Merge pull request #128 from llipe/docs/current-state-sync-post-125
- chore(workstream): reorganize docs into archive directory
- docs: sync documentation with current dt implementation state
- Merge pull request #125 from llipe:claude/dev-tasks-codebase-analysis-oxda22
- chore: resolve merge conflict with main in catalog index.yaml
- docs(workstream): fix manual test plan — scripts must run from project root
- docs(workstream): fix manual test plan — scripts must run from project root
- docs(workstream): rewrite manual test plan with proper tsx file approach
- docs(workstream): fix manual test plan for tsx top-level await limitation
- chore: fix lint and format issues, update task checklist
- chore(workstream): link task list to issue #127 and PR #125
- Merge pull request #126 from llipe:issue/docs-current-state-sync
- docs: reorganize and document system architecture and agent framework
- chore(workstream): add task list for extraction ladder inversion plan

## [0.8.0] - 2026-08-11

### Fixed

- fix(hooks): update git-guard matcher and add branch-guard for write tools (issue #110, task 5.0)
- fix(agent): add branch/PR to per-turn output contract (issue #110, task 4.0)
- fix(agent): harden branch creation gate across all platforms (issue #110, task 3.0)
- fix(agent): add subagent tool to developer agent (issue #110, task 1.0)
- fix: remove unsupported permissions field from agent frontmatter

### Changed

- chore: format corrections
- chore: doc archiving
- Merge pull request #120 from llipe:issue/110-developer-branch-creation
- chore(workstream): mark all tasks complete for issue #110
- docs(steering): document fileMatchPattern glob behavior for zero-depth (issue #110, task 2.0)
- chore(workstream): activate task list for issue #110
- chore: docs housekeeping
- Merge pull request #119 from llipe:issue/103-kiro-agent-format
- chore: update catalog fixture timestamps and generator version
- docs: note permissions field is unsupported in current Kiro runtime
- chore: adapt .kiro/agents to official Kiro custom agent format

## [0.7.4] - 2026-08-07

### Changed

- chore: format check
- docs: clarify dt stability status and add binary stability column
- chore: reformat pnpm-lock.yaml for consistency

## [0.7.3] - 2026-08-07

### Fixed

- fix(cache): use mtime instead of atime for LRU eviction

## [0.7.2] - 2026-08-07

### Changed

- style: reformat code for consistency

## [0.7.1] - 2026-08-07

### Added

- feat(distribution): add version pinning and unpin command with registry fetch

### Changed

- docs: fix markdown table alignment in dev-tasks and dt user manuals

## [0.7.0] - 2026-08-06

### Added

- feat: implement dt verify impact and dt verify drift
- feat(verify): mark S-024 contract-diff story complete
- feat(verify): implement dt verify contract-diff (OpenAPI + AsyncAPI breaking-change detection)
- feat(agents): add cross-repo partitioning with contract-as-interface (RF-63)
- feat(agents): add architecture-change task type with meta-repo write authority
- feat(init-skill): rewrite with mono/multi/greenfield mode detection
- feat: implement full dt init --task orchestration pipeline (S-020)
- feat(scope): add graph closure expansion, gate rules G1-G7, and partition proposal
- feat(scope): implement LLM scoping step with schema validation and repair retry
- feat: implement dt init --components (S-017)
- feat(ctx): implement dt ctx assemble — layered budgeted deterministic bundle
- feat(ctx): implement sparse-clone fetch with SHA-keyed cache and LRU GC
- feat: implement meta-repo scaffold and CI rebuild templates
- feat(catalog): implement catalog query and routing commands (S-013) Implements dt catalog resolve, get, deps, consumers, flow, closure, and coverage subcommands with full --json support. - core/catalog/resolve.ts: text normalization (lowercase, de-accent, light es/en stemming, stopword removal) and weighted lexical scorer (exact id 100, alias 80, flow alias 75, domain 60, alias-token 40, name/desc 25) - core/catalog/queries.ts: graph reads (get, deps with depth/direction, consumers, flow, closure with include-consumers/max cap) - core/catalog/coverage.ts: extraction quality aggregation per component - adapters/cli/catalog-query.ts: CLI handler for all query subcommands - FlowEntry model extended with optional aliases field - Flow fixture files updated with aliases for routing tests Refs #46
- feat(catalog): implement dt catalog validate with V01-V19 checks Implements referential integrity and structural validation checks per spec §6.2. Errors (V01-V11, V14-V15, V19) abort with exit 4; warnings (V12-V13, V16-V18) do not. Under --strict, V12 cycle warnings become errors. Supports allowed_cycles config. Closes #45
- feat(catalog): support component.yaml in addition to component.json Build now looks for component.json first, then falls back to component.yaml. This matches the spec's mention of component.yaml while preserving backward compat with JSON format.
  - **Correction (2026-08-14):** this fallback was reverted within the same release (`7bebc79` reverting `f697265`) and was never shipped. The released behavior of 0.7.0 is `component.json` only; a repo carrying only `component.yaml` is reported in `index.errors[]`. See [`docs/adr/ADR-001-component-json-manifest-format.md`](docs/adr/ADR-001-component-json-manifest-format.md).
- feat(catalog): implement dt catalog build — aggregate manifests and generate index Implements Story S-011 (#43): - Define CatalogIndex types in core/catalog/index-model.ts - Implement registry parsing, manifest fetching, and mirroring - Build inverted consumer index from provides/consumes - Tally extraction quality from provenance fields - Aggregate domains and flows from manifests and catalog/flows/ - Generate deterministic catalog/index.yaml (sorted keys, stable order) - Implement idempotent write (skip when nothing changed) - Handle single repo failure: record in errors[], exit 3 - Detect duplicate component IDs across repos - Wire dt catalog build --registry <path> [--concurrency] [--json] CLI - Add 20-component fixture registry with diverse scenarios - Add yaml@2.7.1 dependency for YAML serialization Closes #43
- feat(catalog): add JSON Schemas and dt validate-component Adds component.schema.json, flow.schema.json, and scope-output.schema.json (JSON Schema draft 2020-12) plus a local validate-component module using ajv's Ajv2020 class. Wires dt validate-component <path> with human and --json output, exit 0/4. No network access required. Refs #42

### Fixed

- fix(deps): resolve audit vulnerabilities in brace-expansion and fast-uri
- fix(deps): upgrade yaml to 2.8.3 to resolve GHSA-48c2-rrv3-qjmp

### Changed

- docs: fix markdown table alignment in skill documentation
- test: add integration tests for dt verify contract-diff
- docs: mark S-025 story (dt verify impact and drift) complete
- Merge pull request #117 from llipe:issue/61-dt-verify-impact-drift
- Merge pull request #116 from llipe:issue/60-dt-verify-contract-diff
- doc: prd for knowledge transfer
- Merge pull request #115 from llipe:issue/57-cross-repo-partitioning
- Merge pull request #114 from llipe:issue/59-architecture-change-task-type
- Merge pull request #113 from llipe:issue/56-init-skill-mode-detection
- docs: update workflow-chains and AGENTS.md for init mode detection
- Merge pull request #112 from llipe:issue/54-full-dt-init-orchestration
- docs: update dt user manual with --task pipeline documentation (S-020)
- chore: start issue #54 — full dt init orchestration (S-020)
- Merge pull request #111 from llipe:issue/55-scope-gate-closure
- docs: add dt scope gate documentation to user manual
- Merge pull request #109 from llipe:issue/52-llm-scoping-step
- docs: add dt scope command and calibration records to user manual
- Merge pull request #107 from llipe:issue/51-dt-init-components
- docs: add dt init --components to user manual
- Merge pull request #106 from llipe:issue/49-ctx-assemble
- docs: add dt ctx assemble section to user manual
- Merge pull request #105 from llipe:issue/48-ctx-fetch-sparse-cache
- docs: add dt ctx fetch and dt ctx gc to user manual
- test(fixtures): add mixed-format registry fixture for catalog tests
- docs: add dt catalog scaffold and CI rebuild to user manual
- Merge pull request #104 from llipe:issue/47-meta-repo-scaffold-ci-rebuild
- test: add edge-case tests for catalog scaffold
- Merge pull request #99 from llipe:story/S-013-catalog-query-routing
- Merge pull request #98 from llipe:issue/45-catalog-validate
- test(catalog): add edge-case tests for V12 cycles and V13/V16 warnings
- test(fixtures): add comprehensive component catalog test fixtures
- Merge pull request #97 from llipe:story/S-011-catalog-build
- docs: add artifact format and authorship reference
- revert(catalog): drop component.yaml fallback, standardize on component.json
- Merge pull request #96 from llipe:issue/42-json-schemas-validate-component
- docs: document dt validate-component in README
- chore(workstream): archive completed npm install distribution task

## [0.6.7] - 2026-07-31

### Changed

- docs(readme): simplify installation and setup instructions

## [0.6.6] - 2026-07-30

### Fixed

- fix(cli): support --flag=value syntax for all value-bearing flags The parser only matched exact '--profile' followed by a separate argument. Passing '--profile=kiro' was treated as an unknown flag and the profile defaulted to 'both'. Now all value flags (--profile, --pin, --meta-repo, --db-url, --strategy) correctly handle both '--flag value' and '--flag=value' syntax.

### Changed

- Merge pull request #95 from llipe:fix/91-profile-equals-syntax

## [0.6.5] - 2026-07-30

### Added

- feat(distribution): profile-aware install to native platform paths Closes #91 - Add core/distribution/profiles.ts with profile-to-paths mapping - Rewrite install.ts to copy files to native platform paths (.github/, .claude/, .kiro/) instead of .dev-tasks/skills/ - Generalize manifest.ts from skills[] to files[] with profile field - Update update.ts to reconcile files at native paths - Add --profile flag (copilot|claude|kiro|both|all, default: both) - Update package.json files array to include platform directories - Remove deprecated top-level skills/ directory - Maintain backward compat: readManifest migrates legacy format BREAKING CHANGE: manifest.json now uses files[] instead of skills[]. The readManifest function handles migration from legacy format transparently.
- feat(extract): migrate component manifest from YAML to JSON format

### Fixed

- fix: format fix

### Changed

- Merge pull request #94 from llipe:issue/91-npm-install-distribution
- docs(workstream): mark issue #91 npm install distribution complete

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

- feat: `dt extract component [--interactive] [--force]` — derives `component.json` from detection/extraction with \_provenance, field hashes, and interactive prompts for non-derivable fields
- feat: `dt extract all [--interactive] [--force]` — orchestrates full extraction pipeline and generates `extraction_report.json`
- feat: hash-based idempotent reconciliation for component.json (exit 13 on missing required fields, exit 14 on reconciliation conflicts)
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
