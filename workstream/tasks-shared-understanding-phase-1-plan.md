# Implementation Plan - Shared Understanding Phase 1 (Docs Foundation and Repository Shape)

## Changelog

| Version | Date       | Summary                                               | Author           |
| ------- | ---------- | ------------------------------------------------------- | ---------------- |
| 1.0     | 2026-09-19 | Initial version. Seven stories, issues pending creation. | product-engineer |
| 1.1     | 2026-09-19 | S-002 AC-8 added (README documents the migrate process): tasks 2.13 to 2.15. Issues #202 to #208 created and recorded in the Scope table. | @llipe / product-engineer |
| 1.2     | 2026-09-19 | Verifier Design Mode corrections (D-46 to D-52): task 4.9 pinned to `tsx` with a fresh-clone verification at 4.9a; task 4.10 reversed (hand-parse, do not promote `yaml`); tasks 4.3/4.4 gain the false-failure constraints; task 3.7 corrected to `templates/scripts/release.sh`; tasks 1.1/1.1a scope the parity test away from immutable records; task 1.9a added for `.gitignore`. | verifier / product-engineer |
| 1.3     | 2026-09-19 | Synced to `main` at `c14905e`: task 1.9a becomes verify-only (PR #209 shipped the `.gitignore` fix); baseline note re-confirmed against the merged base. | product-engineer |

## Scope

All seven Phase 1 stories, delivered on one integration branch as one consolidated pull request (proposed `D-47`, mirroring Phase 0's D-29).

| Story | Issue | Title                                          |
| ----- | ----- | ------------------------------------------------ |
| S-001 | [#202](https://github.com/llipe/dev-tasks/issues/202) | Rename the foundation documents and update every reference |
| S-002 | [#203](https://github.com/llipe/dev-tasks/issues/203) | Propose the rename to consumers via `dev-tasks migrate docs` |
| S-003 | [#204](https://github.com/llipe/dev-tasks/issues/204) | Scaffold `docs/runbooks/` and seed the initial runbook set |
| S-004 | [#205](https://github.com/llipe/dev-tasks/issues/205) | Create `core/checks` and enforce docs structure under `lint` |
| S-005 | [#206](https://github.com/llipe/dev-tasks/issues/206) | Detect repository shape and record the package map |
| S-006 | [#207](https://github.com/llipe/dev-tasks/issues/207) | Make agents package-aware                       |
| S-007 | [#208](https://github.com/llipe/dev-tasks/issues/208) | Enforce runbook coverage and docs ownership     |

**Branch:** `integration/prd-shared-understanding-phase-1`
**Sources:** PRD FR-44 to FR-51, FR-59 to FR-64; spec v1.3; stories v1.3; decisions D-16, D-21, D-42 to D-52 (D-51 and D-52 pending).
**Predecessor:** Phase 0, merged as `a9f7eef` (PR #200). Base for this phase is `main` at `c14905e`, which also carries PR #209.

### Baseline to record before starting

`pnpm run test` on `main` fails on exactly five pre-existing environment cases (D-40). Capture the **full failing test names** to a file at task 0.2; every later gate compares against that set, not a count:

| Failing test                                             | Cause        |
| ---------------------------------------------------------- | ------------ |
| `doctor > checkCacheDir > fails when path is not writable` | runs as root |
| `runUpdate > --force with unwritable backup dir`           | runs as root |
| `deploy.sh > exits 2 when yq is missing from PATH`         | `yq` present |
| `bootstrap > doctor` (2 integration cases)                 | environment  |

A sixth failure, or the disappearance of one of these five, is caused by this work. Compare sets, not counts.

## Relevant Files

### Created

- `docs/product.md`, `docs/tech.md` — renamed from `docs/product-context.md`, `docs/technical-guidelines.md`
- `docs/runbooks/README.md` + 10 runbooks
- `templates/runbooks/README.md`, `templates/runbooks/runbook-template.md`
- `core/checks/docs-structure.ts`, `core/checks/run.ts`, `core/checks/index.ts`
- `core/distribution/migrate-docs.ts`, `core/distribution/workspace.ts`
- `test/unit/foundation-docs-naming.test.ts`, `test/unit/migrate-docs.test.ts`, `test/unit/runbook-set.test.ts`, `test/unit/checks-docs-structure.test.ts`, `test/unit/workspace.test.ts`
- `test/fixtures/docs-structure/`, `test/fixtures/workspace-single/`, `test/fixtures/workspace-mono/`

### Modified

- 50 files naming the old foundation docs: `.claude/` (10), `.github/` (11), `.kiro/` (12), `docs/` (10), `test/` (2), root (5: `AGENTS.md`, `AGENTS.md.template`, `CLAUDE.md`, `CLAUDE.md.template`, `README.md`)
- `bin/dev-tasks.ts`, `core/distribution/{doctor,profiles,install-if-absent,index}.ts`, `core/index.ts`
- `package.json` (`lint` script), `bundle-manifest.json`, `TESTING.md`, `docs/README.md`, `README.md` (migrate-docs command reference and migration subsection)
- `activity-init`, `activity-test-standards`, `researcher`, `plan`, `implement`, `qa-engineer`, `verifier`, `technical-writer`, `infra-engineer`, `developer`, `housekeeping` — across all three trees
- `test/unit/{distribution-doctor,distribution-update,skill-parity-init,skill-init-walkthrough,researcher-parity,skill-parity-testing-layers}.test.ts`, `test/integration/bootstrap-commands.test.ts`

### Deleted

None. Phase 1 is additive plus one rename.

## Tasks

- [ ] 0.0 Set up the integration branch and baseline

  - [ ] 0.1 Confirm `main` is current at `c14905e` (Phase 0 `a9f7eef` plus PR #209); create `integration/prd-shared-understanding-phase-1` from it
  - [ ] 0.2 Run `pnpm run test` and save the **full failing-test names** to a file; this is the D-40 comparison set for every later gate
  - [x] 0.3 Create the seven GitHub issues from the stories; numbers recorded in the Scope table above (#202 to #208)
  - [ ] 0.4 Open the draft PR after the first commit, per the `implement` rules

- [ ] 1.0 Implement Story S-001: Rename the foundation documents and update every reference

  > Note: behavior-preserving `refactor:` commit. Content of both documents is untouched (FR-46, `SIMPLICITY.md` B1). Simplifying either document is a separate change and is out of scope.

  - [ ] 1.1 Write `test/unit/foundation-docs-naming.test.ts` first: scan `.claude/`, `.github/`, `.kiro/`, `core/`, `bin/`, `test/`, `docs/`, and the root for `product-context.md` and `technical-guidelines.md`; it must fail against the current tree. Write the scan roots from scratch — **do not copy** `test/unit/dt-retirement-absence.test.ts`'s `SCAN_ROOTS`, which omits `docs/` entirely and would pass while checking nothing
  - [ ] 1.1a Exclude per D-50: `docs/adr/**`, `docs/requirements/**`, and `workstream/` (24 tracked files there carry the old names), each with a reason comment
  - [ ] 1.2 Add the seeded-match self-test proving the matcher fires, and the false-positive rejection case (Phase 0 guard pattern)
  - [ ] 1.3 `git mv docs/product-context.md docs/product.md` and `git mv docs/technical-guidelines.md docs/tech.md`
  - [ ] 1.4 Update the 10 references in `.claude/`
  - [ ] 1.5 Update the 11 references in `.github/`
  - [ ] 1.6 Update the 12 references in `.kiro/`
  - [ ] 1.7 Update the 10 references in `docs/`, including `docs/README.md`'s index rows
  - [ ] 1.8 Update the 2 references in `test/`
  - [ ] 1.9 Update the 5 rewritable root references: `AGENTS.md`, `AGENTS.md.template`, `CLAUDE.md`, `CLAUDE.md.template`, `README.md`
  - [x] 1.9a `.gitignore` — done ahead of this story by PR #209 (`c14905e`), which removed the `/docs/*.md` allowlist entirely. **Verify only:** `git check-ignore -v docs/product.md` must exit non-zero (AC-8)
  - [ ] 1.10 Add the fallback-resolution paragraph (new name first, old name only if absent) to `activity-init` and every skill/agent that reads a foundation document, identically in all three trees
  - [ ] 1.11 Add those fallback locations to the test's `EXEMPT_FILES` allowlist, each with a reason comment
  - [ ] 1.12 Verify AC-1: `git log --follow docs/product.md` shows the rename and no content change
  - [ ] 1.13 Verify AC-2 and AC-3: `pnpm run test:unit` — the new test passes
  - [ ] 1.14 Verify AC-4 and AC-5: the fallback is prose only; confirm no new `core/` module was added for it
  - [ ] 1.15 Verify AC-6: diff the three trees' changed files against each other; behavioral content identical
  - [ ] 1.16 Manual check: read `activity-init` end to end; the fallback paragraph reads coherently
  - [ ] 1.17 Run Tests: `pnpm run validate`; verify AC-7 — failing set equals the five D-40 names exactly
  - [ ] 1.18 Commit as `refactor(docs)!: rename foundation documents to product.md and tech.md`

- [ ] 2.0 Implement Story S-002: Propose the rename to consumers via `dev-tasks migrate docs`

  > Note: `update` **MUST NOT** rename a consumer-owned file on its own (FR-45). `--force` keeps its existing meaning: perform the mutating action, back up first.

  - [ ] 2.1 Write `test/unit/migrate-docs.test.ts` first: detection with both old names, one, neither; propose mutates nothing; `--force` renames and backs up; content hash identical before and after
  - [ ] 2.2 Add `core/distribution/migrate-docs.ts` with `detectOldFoundationDocs()` and `runDocsMigration()` as separate exports, so `doctor` reuses detection without the mutation path
  - [ ] 2.3 Reuse `createBackupDir`/`backupFile` from `core/distribution/backup.ts`; do not add a second backup mechanism
  - [ ] 2.4 Branch the `case "migrate"` in `bin/dev-tasks.ts` on `positional[0] === "docs"`; leave the bare `migrate` path untouched
  - [ ] 2.5 Add `--json` output for both the propose and apply paths
  - [ ] 2.6 Update `dev-tasks --help` to list the `migrate docs` sub-verb
  - [ ] 2.7 Add the `doctor` old-names check, reusing the detection export, proposing `dev-tasks migrate docs`
  - [ ] 2.8 Add a negative test to `test/unit/distribution-update.test.ts`: `update` never renames a foundation doc
  - [ ] 2.9 Add `migrate docs` cases to `test/integration/bootstrap-commands.test.ts` against a temp fixture repo
  - [ ] 2.10 Verify AC-3: the existing `migrate` integration cases pass unmodified — a change to them is a stop signal
  - [ ] 2.11 Verify AC-1, AC-2, AC-6 by `pnpm run test:unit`; AC-4 by the `doctor` test; AC-5 by the update negative test
  - [ ] 2.12 Verify AC-7 by inspection: S-001's fallback rule already satisfies "agents run unchanged"; nothing is re-implemented here
  - [ ] 2.13 Add `dev-tasks migrate docs` to `README.md`'s `## dev-tasks Command Reference` code block, beside the existing `dev-tasks migrate` line
  - [ ] 2.14 Add a `README.md` subsection documenting the foundation-doc migration: what renamed, propose is the default, `--force` applies it, backups are written, consumers migrate on their own schedule
  - [ ] 2.15 Verify AC-8: read the README section as a consumer upgrading across this release — the migration must be learnable from `README.md` alone, without the PRD or the runbook
  - [ ] 2.16 Edge cases: both names present (partial migration); target exists with different content; read-only directory; `--json` on every path
  - [ ] 2.17 Manual check: run both forms against a scratch copy and read the output as a consumer would
  - [ ] 2.18 Run Tests: `pnpm run validate`; the D-40 set is unchanged
  - [ ] 2.19 Commit as `feat(cli): add dev-tasks migrate docs and doctor old-name detection`

- [ ] 3.0 Implement Story S-003: Scaffold `docs/runbooks/` and seed the initial runbook set

  > Note: the delivery-registry gap is real work, not a detail — `INSTALL_IF_ABSENT_FILES` tags every entry with one platform, and a runbook belongs to the repository. Phase 3's glossary needs the same fix.

  - [ ] 3.1 Write `test/unit/runbook-set.test.ts` first: frontmatter validity, the five fixed headings, index-matches-disk, and AC-5's reverse coverage (every script/workflow named by some runbook)
  - [ ] 3.2 Extend `InstallIfAbsentFile` with a platform-agnostic tag reusing the `ROOT_PROFILE_TAG` pattern; do **not** add a third delivery category
  - [ ] 3.3 Update `core/distribution/install-if-absent.ts` to honor the agnostic tag: installed once per run regardless of how many platforms the profile resolves to
  - [ ] 3.4 Add `templates/runbooks/README.md` (index template) and `templates/runbooks/runbook-template.md`
  - [ ] 3.5 Register both in `INSTALL_IF_ABSENT_FILES` with the agnostic tag
  - [ ] 3.6 Author `runbook-install-dev-tasks` and `runbook-configure-branch-protection`
  - [ ] 3.7 Author `runbook-release-npm` (related: **`templates/scripts/release.sh`** — the consumer template, 6443 B, *not* this repo's own `scripts/release.sh`, 13617 B; only the template is an AC-25 surface — plus `.github/workflows/publish-npm.yml` and `.github/workflows/release-bundle.yml`)
  - [ ] 3.8 Author `runbook-deploy-service` (related: `templates/scripts/deploy.sh`, `deploy-verify.sh`, `deploy-status.sh`, `templates/workflows/deploy-dev.yml`, `deploy-prod.yml`) — the tenth runbook that closes AC-25; see Open Items
  - [ ] 3.9 Author `runbook-rollback-deploy` (related: `templates/scripts/rollback.sh`, `templates/workflows/rollback.yml`)
  - [ ] 3.10 Author `runbook-migrate-foundation-docs` (related: the S-002 command), `runbook-troubleshoot-hooks`, `runbook-setup-supabase-local`, `runbook-setup-simplicity-tooling`, `runbook-retire-dt`
  - [ ] 3.11 Write `docs/runbooks/README.md` listing all ten with trigger, owner, and last-verified columns
  - [ ] 3.12 Add the `docs/runbooks/` link to `docs/README.md`
  - [ ] 3.13 Add the runbooks directory to `bundle-manifest.json` and `consumer_owned_paths` (AC-8)
  - [ ] 3.14 Verify AC-5 explicitly: list all 10 files under `templates/scripts/`, `templates/workflows/`, `.github/workflows/` and confirm each appears in some runbook's `related`
  - [ ] 3.15 Integration test: `install` into a temp repo scaffolds directory and index; a second `install` does not overwrite a modified runbook; `--profile all` installs the agnostic entry exactly once
  - [ ] 3.16 Manual check: follow `runbook-configure-branch-protection` against a scratch repository without consulting the README
  - [ ] 3.17 Run Tests: `pnpm run validate`; the D-40 set is unchanged
  - [ ] 3.18 Commit as `feat(docs): scaffold docs/runbooks and seed the initial runbook set`

- [ ] 4.0 Implement Story S-004: Create `core/checks` and enforce docs structure under `lint`

  > Note: this creates the module FR-57 reserved and D-33 kept out of Phase 0. Exactly one check lands here. No registry or plugin interface for the Phase 3/5/6 checks (AC-8).

  - [ ] 4.1 Write `test/unit/checks-docs-structure.test.ts` first, with fixtures under `test/fixtures/docs-structure/` for each condition
  - [ ] 4.2 Implement `core/checks/docs-structure.ts` returning failures and staleness findings separately
  - [ ] 4.3 Condition: index lists a file that does not exist (AC-2) — resolve repo-root-aware and tolerate directory links, or `docs/README.md`'s links to `../README.md`, `requirements/`, and five root files produce false failures on the clean tree (AC-10)
  - [ ] 4.4 Condition: index omits a file that exists in its directory (AC-3) — **non-recursive**, or the seven ADRs and four PRDs that no index lists individually are flagged (AC-10)
  - [ ] 4.5 Condition: runbook frontmatter missing/invalid, or filename not matching `^runbook-[a-z0-9]+(-[a-z0-9]+)+\.md$` (AC-4)
  - [ ] 4.6 Condition: `related` entry names a script or workflow that does not exist (AC-5)
  - [ ] 4.7 Reported-not-failed: `last_verified` older than 90 days (AC-6, D-21)
  - [ ] 4.8 Absent `docs/runbooks/` reports nothing (AC-9)
  - [ ] 4.9 Add `core/checks/run.ts` and `core/checks/index.ts`; chain **`tsx core/checks/run.ts`** into the `lint` script after `eslint` (D-48). Do **not** use a `dist/` path: `dist/` is gitignored and untracked, `validate` has no `build` step, and `publish-npm.yml` runs `validate` before `build`, so a compiled path fails every fresh clone and breaks the first release after merge
  - [ ] 4.9a Verify D-48 the way the defect was found: clone the branch into a scratch directory and run `pnpm install && pnpm run lint` **without** running `build` first; it must pass
  - [ ] 4.10 Hand-parse the five fixed frontmatter keys; do **not** promote `yaml` to `dependencies` (D-49). The check ships to consumers inside `dist/core/` (`package.json` `files`), where devDependencies are absent, and task 4.11 makes the `verifier` a second caller in consumer repositories
  - [ ] 4.11 Point the `verifier` at the same exported function for its audit summary; the logic is not duplicated
  - [ ] 4.12 Verify AC-7: `lint` still exits non-zero on an ESLint failure independently of the docs check
  - [ ] 4.13 Verify AC-8 by inspection: no registry, no plugin interface, no abstraction for future checks
  - [ ] 4.14 Integration: seed each failure into a temp fixture tree, assert `lint` exits non-zero, assert it exits zero once fixed
  - [ ] 4.15 Edge cases: index entry pointing at a directory; valid frontmatter with an invalid date; `related` pointing outside the repository; empty `docs/runbooks/`
  - [ ] 4.16 Run `pnpm run validate` against the real tree and fix anything it legitimately finds
  - [ ] 4.17 Commit as `feat(checks): add core/checks with the docs-structure check under lint`

- [ ] 5.0 Implement Story S-005: Detect repository shape and record the package map

  > Note: `dev-tasks` is single-package. The monorepo path is built and tested against a fixture, not exercised on this repository.

  - [ ] 5.1 Write `test/unit/workspace.test.ts` first: enumeration per signal type, single-package fallback, drift detection both directions
  - [ ] 5.2 Create `test/fixtures/workspace-single/` and `test/fixtures/workspace-mono/` (a `pnpm-workspace.yaml` monorepo with two packages)
  - [ ] 5.3 Implement `core/distribution/workspace.ts`: detect shape from `pnpm-workspace.yaml`, `workspaces` in `package.json`, `turbo.json`, `nx.json`, `lerna.json`, `[tool.uv.workspace]`
  - [ ] 5.4 Parse the package list from `pnpm-workspace.yaml` and `package.json` `workspaces` only; the other four are presence-only signals
  - [ ] 5.5 Add the `doctor` package-map drift check: warn, never fail (AC-6)
  - [ ] 5.6 Add shape detection and the package-map output structure (package, path, purpose, owner, canonical scripts, bounded context) to `activity-init` in all three trees
  - [ ] 5.7 Add the freeform bounded-context interview question per D-45; state that Phase 3's glossary supersedes it
  - [ ] 5.8 Add the `SIMPLICITY.md` owner-and-thresholds confirmation step to `activity-init` (AC-7)
  - [ ] 5.9 Rename `activity-init`'s "Mode A — Mono-Repo" per D-44 in all three trees; update every cross-reference, including the Mode Detection section and Final Instructions
  - [ ] 5.10 Record this repository's own package map in `docs/tech.md`: one row, single-package shape (AC-3)
  - [ ] 5.11 Update `test/unit/skill-parity-init.test.ts` and `test/unit/skill-init-walkthrough.test.ts` for the renamed mode and the new section
  - [ ] 5.12 Verify AC-1 to AC-4 by `pnpm run test:unit` and the two fixtures; AC-5 by grepping for the old mode name; AC-6 by the `doctor` test; AC-7 by the fresh-repository integration case; AC-8 by the parity suites
  - [ ] 5.13 Edge cases: workspace glob matching zero packages; package with no `name`; nested workspaces; map row for a deleted package; empty `pnpm-workspace.yaml`
  - [ ] 5.14 Manual check: run `activity-init` against the monorepo fixture and read the produced `docs/tech.md` section
  - [ ] 5.15 Run Tests: `pnpm run validate`; the D-40 set is unchanged
  - [ ] 5.16 Commit as `feat(init): detect repository shape and record the package map`

- [ ] 6.0 Implement Story S-006: Make agents package-aware

  > Note: the CI template that scopes to affected packages is **Phase 4** (FR-41, FR-42). This story delivers agent behavior and the documented contract only.

  - [ ] 6.1 Update `researcher` in all three trees: name the package for each finding
  - [ ] 6.2 Update `plan` in all three trees: name the package for each task
  - [ ] 6.3 Update `implement` in all three trees: package as the Conventional Commits scope (`feat(api): …`), optional in a single-package repository
  - [ ] 6.4 Extend `activity-test-standards`'s reachability procedure to per-package; do not add a parallel monorepo path
  - [ ] 6.5 Document the root-script fan-out contract in `docs/tech.md`; `validate` stays the single entry point, no second command
  - [ ] 6.6 Add per-package runner declaration to `TESTING.md` (AC-3)
  - [ ] 6.7 State in the glossary-adjacent content that there is one root glossary with package-mapped bounded contexts, and no per-package glossaries (AC-4)
  - [ ] 6.8 State that the simplicity baseline is one root file keyed by path; no per-package ratchet (AC-5)
  - [ ] 6.9 Extend `test/unit/researcher-parity.test.ts` and `test/unit/skill-parity-testing-layers.test.ts` for the changed content
  - [ ] 6.10 Integration: run the `activity-test-standards` reachability check against the S-005 monorepo fixture
  - [ ] 6.11 Verify AC-1, AC-4 to AC-6 by the parity tests and inspection; AC-2 by `docs/tech.md`; AC-3 by `TESTING.md` and the reachability test
  - [ ] 6.12 Edge cases: single-package repository (scope optional, never empty); package name that is not a valid commit scope; package with no test script
  - [ ] 6.13 Run Tests: `pnpm run validate`; the D-40 set is unchanged
  - [ ] 6.14 Commit as `feat(prompts): make researcher, plan, implement, and qa-engineer package-aware`

- [ ] 7.0 Implement Story S-007: Enforce runbook coverage and docs ownership

  > Note: deterministic conditions stay in `core/checks` (task 4.0). This task adds only the judgment-based finding and the ownership statements.

  - [ ] 7.1 Add the runbook-coverage finding trigger to `verifier` in all three trees: a PR whose task list has ≥3 setup/configuration/migration/credential/data steps and adds or updates no runbook
  - [ ] 7.2 State the finding is advisory and does not block PR readiness (AC-2)
  - [ ] 7.3 Add the FR-49a same-PR delivery rule to `infra-engineer`, `developer`, `qa-engineer`, and `housekeeping` in all three trees (AC-3, AC-4)
  - [ ] 7.4 Extend `technical-writer` with runbook hygiene: indexes in sync, frontmatter valid, naming respected, no dangling `related`, staleness reported (AC-5)
  - [ ] 7.5 State the ownership boundary in `technical-writer`, `housekeeping`, `AGENTS.md`, and `CLAUDE.md`: `technical-writer` owns docs structure and content; a `validate` docs failure routes to it, not to `housekeeping` (AC-6)
  - [ ] 7.6 Extend the parity suites for every changed agent
  - [ ] 7.7 Verify AC-1 to AC-4 by inspection and the parity tests; AC-5 and AC-6 by the changed content; AC-7 by the parity suites
  - [ ] 7.8 Edge cases: a PR with three configuration steps that updates an existing runbook (no finding); a PR with two steps (below threshold); a docs-only PR
  - [ ] 7.9 Manual check: the runbook-coverage trigger must not fire on this phase's own PR, because task 3.0 delivered runbooks
  - [ ] 7.10 Run Tests: `pnpm run validate`; the D-40 set is unchanged
  - [ ] 7.11 Commit as `feat(prompts): enforce runbook coverage and docs ownership`

- [ ] 8.0 Completion gates

  - [ ] 8.1 Run `pnpm run validate`; the failing set equals the five D-40 names exactly, with `lint`, `format:check`, and `typecheck` green
  - [ ] 8.2 Run `pnpm audit --prod` and record the result
  - [ ] 8.3 Map every acceptance criterion across S-001 to S-007 to its evidence; record the mapping in the PR body
  - [ ] 8.4 Run `qa-engineer` at the completion gate and record `coverage_gate: PASS | FAIL | SKIPPED(<reason>)`
  - [ ] 8.5 Run the mandatory `verifier` audit in Audit Mode against the delivered branch; post its summary to the PR
  - [ ] 8.6 Route any drift findings to `product-engineer`'s `activity-drift-reconciliation`; drift does not block completion
  - [ ] 8.7 Fill the PR body: What, Why, How It Works, Testing with the baseline comparison, Checklist, Attribution
  - [ ] 8.8 Confirm no version bump and no release commit are in the PR (D-41); `CHANGELOG.md` entries go under `## [Unreleased]`
  - [ ] 8.9 Mark the PR ready for review; do not merge — `main` requires user approval and the user merges
  - [ ] 8.10 After merge, the maintainer runs `./scripts/release.sh <major|minor|patch>` on `main` (D-41). Not an agent action.

## Acceptance-Criteria to Task Mapping

| Story | AC          | Verifying task |
| ----- | ----------- | ---------------- |
| S-001 | AC-1        | 1.12           |
| S-001 | AC-2, AC-3  | 1.13           |
| S-001 | AC-4, AC-5  | 1.14           |
| S-001 | AC-6        | 1.15           |
| S-001 | AC-7        | 1.17           |
| S-001 | AC-8        | 1.9a           |
| S-004 | AC-10       | 4.3, 4.4       |
| S-002 | AC-1, 2, 6  | 2.11           |
| S-002 | AC-3        | 2.10           |
| S-002 | AC-4        | 2.11           |
| S-002 | AC-5        | 2.8            |
| S-002 | AC-7        | 2.12           |
| S-002 | AC-8        | 2.13, 2.14, 2.15 |
| S-003 | AC-1 to 3   | 3.15           |
| S-003 | AC-4        | 3.1            |
| S-003 | AC-5        | 3.14           |
| S-003 | AC-6, AC-7  | 3.11, 3.12     |
| S-003 | AC-8        | 3.13           |
| S-004 | AC-1 to 6   | 4.1 to 4.7     |
| S-004 | AC-7        | 4.12           |
| S-004 | AC-8        | 4.13           |
| S-004 | AC-9        | 4.8            |
| S-005 | AC-1 to 4   | 5.12           |
| S-005 | AC-5        | 5.9, 5.12      |
| S-005 | AC-6        | 5.5, 5.12      |
| S-005 | AC-7        | 5.8, 5.12      |
| S-005 | AC-8        | 5.11, 5.12     |
| S-006 | AC-1, 4 to 6 | 6.11          |
| S-006 | AC-2        | 6.5, 6.11      |
| S-006 | AC-3        | 6.6, 6.10      |
| S-007 | AC-1 to 4   | 7.7            |
| S-007 | AC-5, AC-6  | 7.4, 7.5       |
| S-007 | AC-7        | 7.6            |

## Open Items Carried From the Stories

1. ~~**`runbook-deploy-service`** (task 3.8) is a tenth runbook beyond FR-47's named nine.~~ Confirmed as `D-46`; Design Mode independently verified the coverage arithmetic.
2. ~~**One consolidated PR** versus three by family.~~ Confirmed as `D-47`.
4. **FR-49a's 18 infra change kinds** have no covering criterion. Recommendation: defer, recorded as `D-51`. **Pending confirmation.**
5. **`dev-tasks migrate` is detect-and-apply, not detect-and-propose**, contrary to FR-45 and the spec's description. Recommendation: correct the description, do not change legacy behavior. Recorded as `D-52`. **Pending confirmation.**
3. ~~**GitHub issues** for S-001 to S-007 are not yet created (task 0.3).~~ Done: #202 to #208.
