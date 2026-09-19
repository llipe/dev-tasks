# Implementation Plan - Shared Understanding Phase 0 (Retire `dt`)

## Changelog

| Version | Date       | Summary                                               | Author           |
| ------- | ---------- | ------------------------------------------------------- | ---------------- |
| 1.0     | 2026-09-18 | Initial version. Five stories, issues #195 to #199.                                                    | product-engineer |
| 1.1     | 2026-09-19 | Verifier corrections: five-failure baseline as a set (D-40), both publish assertions, four alias files, format globs, exit-code repoint, six expected test edits, bitbucket template. | verifier / product-engineer |

## Scope

All five Phase 0 stories, delivered on one integration branch as one consolidated pull request (D-29).

| Story | Issue | Title                                          |
| ----- | ----- | ------------------------------------------------ |
| S-001 | [#195](https://github.com/llipe/dev-tasks/issues/195) | Remove the `dt` source tree            |
| S-002 | [#196](https://github.com/llipe/dev-tasks/issues/196) | Remove `dt` tests and guard the retirement |
| S-003 | [#197](https://github.com/llipe/dev-tasks/issues/197) | Prune `dt` dependencies and fix release |
| S-004 | [#198](https://github.com/llipe/dev-tasks/issues/198) | Remove `dt` from prompt trees and registry |
| S-005 | [#199](https://github.com/llipe/dev-tasks/issues/199) | Retire `dt` docs and record ADR-007    |

**Branch:** `integration/prd-shared-understanding-phase-0`
**Sources:** PRD FR-53 to FR-58; spec v1.1; decisions D-14, D-28 to D-38.

### Baseline to record before starting

Run `pnpm run test` on `main` and save the failing-test list. Eleven fail today; **six** live in files this phase deletes (four `ctxFetch`, two `dt init --components`). The phase is correct when exactly these **five** remain, compared as a set of full test names rather than as a count (D-40, superseding D-36 which said four and miscounted):

| Failing test                                             | Cause          |
| ---------------------------------------------------------- | -------------- |
| `doctor > checkCacheDir > fails when path is not writable` | runs as root   |
| `runUpdate > --force with unwritable backup dir`           | runs as root   |
| `deploy.sh > exits 2 when yq is missing from PATH`         | `yq` present   |
| `bootstrap > doctor` (2 integration cases)                 | environment    |

A sixth failure, or the disappearance of one of these five, is caused by this work. Compare sets, not counts: a count survives a regression that removes one failure and introduces another.

## Relevant Files

### Deleted

- `bin/dt.ts` — the retired binary
- `adapters/` — 20 command files; `parse-args.ts` relocates first
- `core/catalog/`, `core/context/`, `core/extract/`, `core/scope/`, `core/verify/`, `core/providers/`
- `schemas/` — `component.schema.json`, `flow.schema.json`, `scope-output.schema.json`
- `templates/meta-repo/`
- 74 test files; `test/fixtures/{catalog,context,extract,schemas,verify}`
- `docs/dt-user-manual.md`, `docs/data-model.md`, `docs/artifact-formats.md`, `docs/requirements/prd-multi-repo-context.md`
- `activity-contract-validation` in `.claude/skills/`, `.github/skills/`, `.kiro/skills/`

### Created

- `bin/parse-args.ts` — moved from `adapters/cli/`
- `test/unit/dt-retirement-absence.test.ts` — the regression guard
- `docs/adr/ADR-007-retire-multi-repo-context-layer.md`

### Modified

- `bin/dev-tasks.ts` — import path
- `core/index.ts` — barrel pruned; `core/exit-codes.ts` — `dt`-only codes removed
- `package.json`, `pnpm-lock.yaml` — bin, imports, files, dependencies, version
- `.github/workflows/publish-npm.yml` — `dist/bin/dt.js` and `dist/adapters` assertions
- `tsconfig.json`, `vitest.config.ts`, `eslint.config.js` — the `#adapters` alias, includes, and restricted-path zone
- `templates/bitbucket-pipelines.yml` — `dt catalog` steps
- `test/unit/exit-codes.test.ts` and four parity tests — expected edits, enumerated in the story
- `test/integration/binaries.test.ts` — `dt` cases removed, absence asserted
- 27 prompt files across `.claude/`, `.github/`, `.kiro/`
- `AGENTS.md`, `AGENTS.md.template`, `CLAUDE.md`
- `README.md`, `docs/README.md`, `docs/system-overview.md`, `docs/workflow-chains.md`, `docs/product-context.md`, `TESTING.md`
- `docs/adr/README.md`, `ADR-001…`, `ADR-002…` — status lines only
- `CHANGELOG.md`

## Tasks

- [ ] 0.0 Set up the integration branch and baseline

  - [ ] 0.1 Confirm `main` is current; create `integration/prd-shared-understanding-phase-0`
  - [ ] 0.2 Run `pnpm run test` and save the **full failing-test names** to a file; this set, minus the six in deleted files, is the baseline every later gate compares against
  - [ ] 0.3 Run `pnpm run build` and confirm both `dist/bin/dev-tasks.js` and `dist/bin/dt.js` exist, so their later absence is meaningful
  - [ ] 0.4 Open the draft PR after the first commit, per the `implement` rules

- [ ] 1.0 Implement Story S-001: Remove the `dt` source tree — [#195](https://github.com/llipe/dev-tasks/issues/195)

  > Note: `core/index.ts` re-exports every deleted module. Prune it in the same commit as the deletion or `typecheck` fails mid-commit. This whole story is one commit.

  - [ ] 1.1 Move `adapters/cli/parse-args.ts` to `bin/parse-args.ts` and update the import in `bin/dev-tasks.ts` to a relative path
  - [ ] 1.2 Delete `bin/dt.ts` and the `dt` entry from `package.json` `bin`
  - [ ] 1.3 Delete the rest of `adapters/`, including `adapters/cli/index.ts`
  - [ ] 1.4 Delete `core/catalog/`, `core/context/`, `core/extract/`, `core/scope/`, `core/verify/`, `core/providers/`
  - [ ] 1.5 Delete `schemas/` and `templates/meta-repo/`
  - [ ] 1.6 Prune `core/index.ts` to `ExitCode`, `ExitCodeValue`, `reconcile`, `ReconcileAction`, `distribution`
  - [ ] 1.7 Enumerate the codes `bin/dev-tasks.ts` actually returns, then prune `core/exit-codes.ts` to those at unchanged numeric values. Note `bin/dev-tasks.ts:237` returns `ExitCode.DependencyError`, a deprecated alias of the `dt`-only `NoCandidates: 11` — repoint it at a retained code
  - [ ] 1.7a Update `test/unit/exit-codes.test.ts`, which asserts the full fifteen-code table and fails on any prune
  - [ ] 1.8 Remove the `#adapters` alias and the deleted directories from **all four** files that name them:
  - [ ] 1.8a `package.json` — `bin`, `imports`, `files`, and the `"adapters/"` and `"schemas/"` entries in the `format` and `format:check` globs (`prettier --check` exits 2 on a missing pattern)
  - [ ] 1.8b `tsconfig.json` — `paths` and `include`
  - [ ] 1.8c `vitest.config.ts` — the alias and the coverage `include`
  - [ ] 1.8d `eslint.config.js` — the `core/` → `adapters/` restricted-path zone
  - [ ] 1.9 Run `pnpm run typecheck`; resolve only dangling references, never by re-adding deleted code
  - [ ] 1.10 Verify AC-1: the nine deleted paths no longer exist
  - [ ] 1.11 Verify AC-2: `adapters/` is gone and `bin/parse-args.ts` exists
  - [ ] 1.12 Verify AC-3 and AC-4 by inspecting `package.json` and `core/index.ts`
  - [ ] 1.13 Verify AC-5: diff `core/exit-codes.ts` and confirm no retained code changed value
  - [ ] 1.14 Verify AC-6: `pnpm run typecheck`, `pnpm run build`, `pnpm run lint`, and `pnpm run format:check` all pass
  - [ ] 1.15 Verify AC-7: run `node dist/bin/dev-tasks.js --version`, `--help`, `status`, `doctor` and compare against the baseline output
  - [ ] 1.16 Run Tests: `pnpm run test:unit`. Six retained tests are expected to change across this phase (`binaries`, `exit-codes`, and four parity tests — see the story). A **seventh** is a stop signal: report, do not fix
  - [ ] 1.17 Run `pnpm run lint` and `pnpm run format:check`
  - [ ] 1.18 Commit as `refactor(core)!: remove the dt source tree and rewire the package`

- [ ] 2.0 Implement Story S-002: Remove `dt` tests and guard the retirement — [#196](https://github.com/llipe/dev-tasks/issues/196)

  > Note: two commits. The deletion first, then the absence test on its own so it is reviewable. The absence test is expected red until task 4.0 lands.

  - [ ] 2.1 Delete the 74 `dt` test files under `test/unit/` and `test/integration/`
  - [ ] 2.2 Delete `test/fixtures/catalog`, `context`, `extract`, `schemas`, `verify`
  - [ ] 2.3 Verify AC-2: `test/fixtures/git-guard`, `infra`, `qa-standards` are untouched
  - [ ] 2.4 Amend `test/integration/binaries.test.ts`: remove the four `dt` cases, add an assertion that `dist/bin/dt.js` does not exist
  - [ ] 2.5 Run Tests: `pnpm run test`; confirm the failing set equals the five baseline names exactly
  - [ ] 2.6 Verify AC-5: any name added to or missing from that set stops the work until diagnosed
  - [ ] 2.7 Restore the test fixture the suite mutates (`test/fixtures/catalog/catalog/index.yaml` is deleted here, so confirm no retained fixture is left dirty by the run)
  - [ ] 2.8 Commit as `test: remove dt tests and fixtures`
  - [ ] 2.9 Write `test/unit/dt-retirement-absence.test.ts`: scan `bin/`, `core/`, `test/`, `.claude/`, `.github/`, `.kiro/`, `AGENTS.md`, `CLAUDE.md` for `dt` command forms, `component.json`, and meta-repo references
  - [ ] 2.10 Match command and path forms only; do not match `dt` inside unrelated words. Read files rather than shelling out, so it runs on every platform
  - [ ] 2.11 Verify AC-4: seed a `dt catalog build` string in a scratch file, confirm the test fails, then remove the seed
  - [ ] 2.12 Confirm the absence test is red for the prompt trees, which is expected until task 4.0 (AC-6)
  - [ ] 2.13 Commit as `test: add dt retirement absence guard`

- [ ] 3.0 Implement Story S-003: Prune `dt` dependencies and fix release — [#197](https://github.com/llipe/dev-tasks/issues/197)

  > Note: the publish workflow assertion is the one deletion that breaks release rather than CI. It only runs on publish.

  - [ ] 3.1 Remove `ajv` from `dependencies`
  - [ ] 3.2 Remove the `pg` optional peer and its `peerDependenciesMeta` entry
  - [ ] 3.3 Remove the `fast-uri` entry from `pnpm.overrides`; leave the `brace-expansion` overrides in place
  - [ ] 3.4 Move `yaml` from `dependencies` to `devDependencies`
  - [ ] 3.5 Verify AC-4: `execa` remains in `dependencies`, since `core/distribution/fetch-package.ts` uses it
  - [ ] 3.6 Run `pnpm install` and commit the regenerated `pnpm-lock.yaml`
  - [ ] 3.7 Edit `.github/workflows/publish-npm.yml` `Verify dist output`: **two** assertions break, line 69 `dist/bin/dt.js` and line 71 `dist/adapters`. Remove both; keep `dist/bin/dev-tasks.js` and `dist/core`
  - [ ] 3.7a Add a test that parses the step and asserts every path it names exists after `pnpm run build`, so this class cannot recur at publish time
  - [ ] 3.8 Verify AC-6: `pnpm install` reports no missing-peer warnings
  - [ ] 3.9 Run `pnpm audit --prod` and paste the result into the PR body
  - [ ] 3.10 Verify AC-7: `pnpm run build` produces `dist/bin/dev-tasks.js` and no `dist/bin/dt.js`
  - [ ] 3.11 Replay the publish workflow's file assertions locally against the fresh build
  - [ ] 3.12 Run Tests: `pnpm run validate`; the 4-failure baseline still holds
  - [ ] 3.13 Commit as `chore(deps): drop dt dependencies and fix the release assertion`

- [ ] 4.0 Implement Story S-004: Remove `dt` from prompt trees and registry — [#198](https://github.com/llipe/dev-tasks/issues/198)

  > Note: parity across the three trees is mandatory. Edit all three together; the parity test fails otherwise. This task turns the absence test green.

  - [ ] 4.1 Delete `activity-contract-validation` from `.claude/skills/`, `.github/skills/`, `.kiro/skills/`
  - [ ] 4.2 Remove its rows from `AGENTS.md`, `AGENTS.md.template`, and `CLAUDE.md`; confirm `activity-contract-test-design` is retained and unchanged (AC-2)
  - [ ] 4.3 Remove the multi-repo mode and `component.json` detection from `activity-init` in all three trees (AC-3)
  - [ ] 4.4 Remove `dt context` from `activity-codebase-research` and the `researcher` agent and command in all three trees
  - [ ] 4.5 Remove `dt init --task` and `dt scope gate` from `product-engineer` in all three trees, including `.claude/commands/` and `.github/prompts/`
  - [ ] 4.6 Remove `dt verify` from `qa-engineer` in all three trees (AC-4)
  - [ ] 4.7 Remove the Task Types / `architecture-change` section (RF-62, RF-64) from `AGENTS.md`, `AGENTS.md.template`, and `CLAUDE.md`
  - [ ] 4.8 Remove the Cross-Repo Partitioning section (RF-63) from the same three files (AC-5, AC-6)
  - [ ] 4.9 Check `AGENTS.md` against the size budget in `docs/agents-md-guidelines.md`
  - [ ] 4.10 Manual check: read `activity-init` end to end in one tree; confirm no orphaned step numbers and no dangling references
  - [ ] 4.10a Remove the `dt catalog build` and `dt catalog validate` steps from `templates/bitbucket-pipelines.yml`, which ships to consumers and is in no other inventory
  - [ ] 4.11 Verify AC-1 and AC-8: run the absence test; it must now pass
  - [ ] 4.12 Run Tests: `pnpm run test:unit`; the agent and skill parity suites must pass (AC-7)
  - [ ] 4.13 Run `pnpm run validate`
  - [ ] 4.14 Commit as `refactor(prompts): remove dt branches from the three trees and AGENTS.md`

- [ ] 5.0 Implement Story S-005: Retire `dt` docs and record ADR-007 — [#199](https://github.com/llipe/dev-tasks/issues/199)

  > Note: two commits. Documentation and ADR first, then the release commit last so the version bump is the final change.

  - [ ] 5.1 Delete `docs/dt-user-manual.md`, `docs/data-model.md`, `docs/artifact-formats.md`, `docs/requirements/prd-multi-repo-context.md` (AC-1)
  - [ ] 5.2 Update `docs/README.md` so it lists no deleted document (AC-2)
  - [ ] 5.3 Delegate the `docs/system-overview.md` rewrite to `technical-writer`: rewrite the affected sections, do not strip them, since about 30 `dt` mentions run through the architecture prose
  - [ ] 5.4 Remove the `dt` sections from `README.md` and `docs/workflow-chains.md` (AC-3)
  - [ ] 5.5 Rewrite `docs/product-context.md` Current State and Roadmap: no `dt` MCP server, no LLM-scoping roadmap item (AC-4)
  - [ ] 5.6 Remove the Contract-validation layer row from `TESTING.md` (AC-5)
  - [ ] 5.7 Write `docs/adr/ADR-007-retire-multi-repo-context-layer.md` with Context, Decision, Alternatives considered (keep, freeze, split to its own repository, remove), Consequences, and the restore path `v0.13.0` at `0a6f35e` (AC-6)
  - [ ] 5.8 Add a `Superseded by ADR-007` status line to ADR-001 and ADR-002 with no other edit; update the ADR index to show both statuses and list ADR-007 (AC-7)
  - [ ] 5.9 Manual check: follow every link in `docs/README.md`, `README.md`, and the ADR index; none may be broken
  - [ ] 5.10 Commit as `docs: retire dt documentation and record ADR-007`
  - [ ] 5.11 Add a `Removed` section to `CHANGELOG.md` naming every removed command: `dt init`, `dt extract` (`detect`, `all`, `component`, `openapi`, `asyncapi`, `schema`), `dt catalog` (`build`, `validate`, `query`, `scaffold`), `dt scope`, `dt scope gate`, `dt verify` (`contract-diff`, `impact`, `drift`), `dt ctx` (`fetch`, `assemble`)
  - [ ] 5.12 Set `package.json` version to `0.14.0` (AC-8)
  - [ ] 5.13 Commit as `chore!: release v0.14.0` with a `BREAKING CHANGE:` footer naming the removed binary (AC-9)

- [ ] 6.0 Completion gates

  - [ ] 6.1 Run `pnpm run validate`; the failing set equals the five baseline names exactly, with `lint` and `format:check` green
  - [ ] 6.2 Run `pnpm audit --prod` and record the result
  - [ ] 6.3 Map every acceptance criterion across S-001 to S-005 to its evidence; record the mapping in the PR body
  - [ ] 6.4 Run `qa-engineer` at the completion gate and record `coverage_gate: PASS | FAIL | SKIPPED(<reason>)`
  - [ ] 6.5 Run the mandatory `verifier` audit in Audit Mode against the delivered branch; post its summary to the PR
  - [ ] 6.6 Route any drift findings to `product-engineer`'s `activity-drift-reconciliation`; drift does not block completion
  - [ ] 6.7 Fill the PR body: What, Why, How It Works, the three teaching sections, Testing with the baseline comparison, Checklist, Attribution
  - [ ] 6.8 Mark the PR ready for review; do not merge — `main` requires user approval and the user merges

## Acceptance-Criteria to Task Mapping

| Story | AC        | Verifying task           |
| ----- | --------- | -------------------------- |
| S-001 | AC-1      | 1.10                     |
| S-001 | AC-2      | 1.11                     |
| S-001 | AC-3, 4   | 1.12                     |
| S-001 | AC-5      | 1.13                     |
| S-001 | AC-6      | 1.14                     |
| S-001 | AC-7      | 1.15                     |
| S-002 | AC-1      | 2.1, 2.2                 |
| S-002 | AC-2      | 2.3                      |
| S-002 | AC-3      | 2.4                      |
| S-002 | AC-4      | 2.11                     |
| S-002 | AC-5      | 2.5, 2.6                 |
| S-002 | AC-6      | 2.12                     |
| S-003 | AC-1 to 3 | 3.1, 3.2, 3.3            |
| S-003 | AC-4      | 3.5                      |
| S-003 | AC-5      | 3.7, 3.11                |
| S-003 | AC-6      | 3.8, 3.9                 |
| S-003 | AC-7      | 3.10                     |
| S-004 | AC-1, 8   | 4.11                     |
| S-004 | AC-2      | 4.1, 4.2                 |
| S-004 | AC-3      | 4.3, 4.10                |
| S-004 | AC-4      | 4.4, 4.5, 4.6            |
| S-004 | AC-5, 6   | 4.7, 4.8                 |
| S-004 | AC-7      | 4.12                     |
| S-005 | AC-1      | 5.1                      |
| S-005 | AC-2      | 5.2, 5.9                 |
| S-005 | AC-3      | 5.3, 5.4                 |
| S-005 | AC-4      | 5.5                      |
| S-005 | AC-5      | 5.6                      |
| S-005 | AC-6      | 5.7                      |
| S-005 | AC-7      | 5.8                      |
| S-005 | AC-8      | 5.11, 5.12               |
| S-005 | AC-9      | 5.13                     |

## Migration Requirements

Not applicable. No data model, no schema, no persistent state. Documented opt-out rationale: the phase deletes code and documentation only; the three JSON Schemas removed describe a manifest format that no runtime data conforms to.

## Rollback

Revert the merge commit. The phase touches no persistent state, so the revert is complete and immediate. The restore path for the deleted capability is release tag `v0.13.0` at commit `0a6f35e`.
