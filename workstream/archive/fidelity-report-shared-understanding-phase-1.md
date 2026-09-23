# Fidelity Report: Shared Understanding — Phase 1 (Docs Foundation and Repository Shape)

## Verdict

| Field                     | Value                                                                                                                        |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **Overall fidelity**      | **Medium**                                                                                                                   |
| **Highest drift impact**  | **Major**                                                                                                                    |
| **Scope**                 | S-001 to S-007 (issues #202-#208), branch `integration/prd-shared-understanding-phase-1`, 15 commits `c84efe7..6d90551`      |
| **Drift is non-blocking** | No finding below blocks PR readiness or issue completion. All route to `product-engineer`'s `activity-drift-reconciliation`. |

Acceptance criteria: **55 evaluated — 48 Pass, 0 Fail, 7 Drift.**
Drift catalog: **14 items — 5 Major, 9 Minor.** By intent: 11 Unintended, 2 Undetermined, 1 Intended.

Quality gates, run independently against `6d90551`: `typecheck` PASS · `lint` PASS (ESLint clean, docs-structure check clean, exit 0) · `format:check` PASS · `audit` PASS (no known vulnerabilities) · `test` 1590 passed / 1 skipped / 5 failed — the five failures are exactly the D-40 environment baseline, unchanged.

**Note on the audit window.** The branch advanced during this audit, from `ef80fe5` to `6d90551`. Two commits landed: `c3c4386` (the `[Unreleased]` changelog entry, task 8.8) and `6d90551`, a `qa-engineer` completion-gate pass that found and fixed three real defects in `core/distribution/workspace.ts` — the Yarn object form of `workspaces` silently reporting single-package for a monorepo, a dead condition, and a deep glob descending past a package boundary into phantom packages. That pass also corrected five things in `TESTING.md`. Everything below is verified against `6d90551`; the three workspace defects are recorded as found-and-fixed, not as drift.

---

## What changed and why, in plain language

The two documents that describe what this product is and how it is built used to be called `product-context.md` and `technical-guidelines.md`. They are now `product.md` and `tech.md`. Nothing inside them changed; only the names, and the fifty-odd places that pointed at the old ones. Every phase of work after this one writes new instructions that name these files, so renaming once, first, is cheaper than renaming later in many places.

Because people who installed this toolkit earlier still have the old names in their own repositories, a new command was added — `dev-tasks migrate docs` — which shows you what would be renamed and changes nothing until you ask it to with `--force`. It backs up the originals first.

A new folder, `docs/runbooks/`, now holds ten step-by-step operating procedures: how to install the toolkit, lock down a branch, cut a release, deploy, roll back, diagnose a blocked hook, and so on. Each one states what must be true before you start, the steps, how to tell it worked, how to undo it, and who to call. The toolkit will also drop an empty folder and a blank template into any repository it is installed in, and it will never overwrite one you have filled in.

To stop that documentation rotting, a small automatic check now runs as part of the normal build. It fails the build if an index lists a file that is not there, if a file sits beside an index that does not list it, or if a runbook is malformed or points at a script that no longer exists. A runbook nobody has re-checked in ninety days gets mentioned but does not fail anything — failing people over a calendar date only teaches them to change the date.

Finally, the toolkit now works out whether a repository is one project or several bundled together, records a small table of what each part is for, and teaches the research, planning, and coding agents to say which part they are talking about.

**What is not quite right.** Five things are worth a second look, and none of them stop this shipping. The instruction telling agents to accept the old file names was written into only one of the roughly thirty places that read those files, so an agent working in a not-yet-migrated repository can still be sent to a file that is not there. The health-check command treats the old names as a _failure_ rather than a _warning_, which contradicts the requirement and contradicts one of the runbooks delivered alongside it. The setup interview was supposed to create the runbooks index and does not. And the new documentation check has two blind spots, found by probing it directly rather than by reading it: it declares a perfectly valid runbook broken if the file uses Windows line endings, and it silently ignores the list of related scripts if that list is written in ordinary YAML style instead of the bracketed style this repository happens to use.

Worth saying plainly, because it is the opposite of a complaint: the testing pass that ran while this audit was in progress found three genuine bugs of its own in the new repository-shape code and fixed them, including one that would have quietly told a Yarn monorepo it was a single project. That is the gate working.

---

## Per-AC results

Legend — **Pass**: delivered as requested, with evidence. **Drift**: delivered differently from requested, or partially. Evidence columns: **CB** = codebase, **WS** = `/workstream` artifacts, **T** = test suite.

### S-001 — Rename the foundation documents and update every reference

| AC   | Description                                                     | CB evidence                                                                                           | WS evidence                | T evidence                                         | Result         |
| ---- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------- | -------------------------------------------------- | -------------- |
| AC-1 | `git mv`, content byte-identical                                | `git log --diff-filter=R main..HEAD` → `R100` for both pairs, commit `7449ab0`                        | task 1.3, 1.12             | —                                                  | **Pass**       |
| AC-2 | No rewritable file names an old document                        | `git grep` over the scanned roots: only allowlisted hits remain — **except `CHANGELOG.md`**           | D-50, spec §8.1            | `foundation-docs-naming.test.ts` green             | **Drift** (D6) |
| AC-3 | Parity test with commented allowlist, own scan roots            | `test/unit/foundation-docs-naming.test.ts` lines 12-17, 41-80, 116-130                                | task 1.1, 1.1a             | 7 cases incl. seeded-match and near-miss rejection | **Pass**       |
| AC-4 | Every skill/agent reading a foundation doc carries the fallback | Only the three `activity-init` copies carry it; 32 prompt files name `docs/product.md`/`docs/tech.md` | task 1.10 marked `[x]`     | `FALLBACK_RULE_FILES` covers 3 files only          | **Drift** (D1) |
| AC-5 | Fallback is prose, no new `core/` module                        | No runtime module added; rule is prose in `activity-init`                                             | task 1.14                  | —                                                  | **Pass**       |
| AC-6 | Three prompt trees at parity                                    | Added-line set comparison across `.claude`/`.github`/`.kiro`: no phase-introduced asymmetry           | task 1.15                  | existing parity suites green                       | **Pass**       |
| AC-7 | `validate` at the D-40 baseline                                 | `typecheck`/`lint`/`format:check` green; 5 test failures, exact set match                             | baseline table, task 0.2   | full suite run at `6d90551`                        | **Pass**       |
| AC-8 | `.gitignore` does not ignore the renamed files                  | `git check-ignore -v docs/product.md` exits non-zero                                                  | delivered ahead by PR #209 | —                                                  | **Pass**       |

### S-002 — `dev-tasks migrate docs`

| AC   | Description                                        | CB evidence                                                                                                                  | WS evidence                 | T evidence                                                             | Result         |
| ---- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | --------------------------- | ---------------------------------------------------------------------- | -------------- |
| AC-1 | Report-only by default, exits `0`                  | `runDocsMigration` returns early when `!apply`                                                                               | task 2.1-2.4                | `migrate-docs.test.ts`, `bootstrap-commands.test.ts`                   | **Pass**       |
| AC-2 | `--force` renames, byte-identical, backs up first  | `createBackupDir`/`backupFile` reused; `node:fs` `rename`                                                                    | task 2.3                    | `--force renames both files byte-identical and backs the originals up` | **Pass**       |
| AC-3 | Bare `migrate` unchanged                           | `bin/dev-tasks.ts` branches on `positional[0] === "docs"`                                                                    | task 2.10                   | `leaves the bare migrate path untouched (AC-3)`                        | **Pass**       |
| AC-4 | `doctor` detects and proposes                      | `checkFoundationDocNames` names both files, both new names, the command — but returns `pass: false` (exit 11), not a warning | task 2.7                    | test asserts `pass === false`, enshrining it                           | **Drift** (D2) |
| AC-5 | `update` never renames a consumer file             | negative test asserts both old files untouched and no `docs/` path touched                                                   | task 2.8                    | `distribution-update.test.ts` new describe block                       | **Pass**       |
| AC-6 | `--json` on both surfaces                          | `bin/dev-tasks.ts` json paths                                                                                                | task 2.5                    | 4 integration `--json` cases                                           | **Pass**       |
| AC-7 | Consumer with old names runs every agent unchanged | Depends on AC-4's fallback rule, present in one skill only                                                                   | task 2.12 ("by inspection") | none                                                                   | **Drift** (D1) |
| AC-8 | `README.md` documents the migration                | `README.md:141` command reference; `### Foundation Document Migration` §, incl. the D-52 asymmetry                           | task 2.13-2.15              | —                                                                      | **Pass**       |

### S-003 — `docs/runbooks/` scaffold and initial set

| AC   | Description                                                              | CB evidence                                                                                                                                                                                               | WS evidence    | T evidence                                                                     | Result                    |
| ---- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | ------------------------------------------------------------------------------ | ------------------------- |
| AC-1 | Platform-agnostic `INSTALL_IF_ABSENT_FILES` entry via `ROOT_PROFILE_TAG` | `profiles.ts` `AgnosticTag`; `install-if-absent.ts` loops per entry, not per platform                                                                                                                     | task 3.2, 3.3  | `installs the platform-agnostic entry exactly once under --profile all (AC-1)` | **Pass**                  |
| AC-2 | `install` scaffolds dir, index, template; install-if-absent              | two `ROOT_PROFILE_TAG` entries targeting `docs/runbooks/`                                                                                                                                                 | task 3.4, 3.5  | 4 install-parity cases incl. deleted-vs-edited                                 | **Pass**                  |
| AC-3 | The ten-runbook initial set on disk                                      | `docs/runbooks/` holds exactly the ten                                                                                                                                                                    | D-46           | `carries exactly the initial set, and nothing undeclared`                      | **Pass**                  |
| AC-4 | Valid frontmatter + five fixed headings                                  | all ten verified by inspection                                                                                                                                                                            | FR-48          | per-runbook frontmatter, ordering, and non-empty-section cases                 | **Pass**                  |
| AC-5 | Every script/workflow named by some runbook's `related`                  | **Independently re-derived at `6d90551`**: 10/10 covered; `runbook-release-npm` names `templates/scripts/release.sh` (6443 B, the consumer template), not `scripts/release.sh` (13617 B, this repo's own) | task 3.7, 3.14 | reverse-coverage case + a dedicated near-miss case                             | **Pass**                  |
| AC-6 | Index lists every runbook with trigger/owner/last-verified               | `docs/runbooks/README.md` table, 10 rows, 4 columns                                                                                                                                                       | task 3.11      | two index cases                                                                | **Pass**                  |
| AC-7 | `docs/README.md` links `docs/runbooks/`                                  | two links added (nav row + reference row)                                                                                                                                                                 | task 3.12      | assertion is `toMatch(/runbooks/i)` — weaker than the AC                       | **Pass** (test weak, D8b) |
| AC-8 | `bundle-manifest.json` + `consumer_owned_paths` carry runbooks           | `templates/runbooks` in bundle paths; `docs/runbooks/` in `consumer_owned_paths`                                                                                                                          | task 3.13      | `does not ship this repository's own ten runbooks to a consumer`               | **Pass**                  |

### S-004 — `core/checks` and the `lint` gate

| AC    | Description                                                      | CB evidence                                                                                                                                                                                       | WS evidence         | T evidence                                                              | Result         |
| ----- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- | ----------------------------------------------------------------------- | -------------- |
| AC-1  | Deterministic, side-effect-free, failures and staleness separate | `checkDocsStructure` returns `{failures, staleness}`; reads only                                                                                                                                  | stories v1.2        | determinism + `writes nothing` cases                                    | **Pass**       |
| AC-2  | Fails when an index lists a missing file                         | rule 1, `checkIndex`                                                                                                                                                                              | task 4.3            | `index-lists-missing` fixture                                           | **Pass**       |
| AC-3  | Fails when an index omits an existing file                       | rule 2, `filesBeside`                                                                                                                                                                             | task 4.4            | `index-omits-file` fixture                                              | **Pass**       |
| AC-4  | Fails on bad frontmatter or filename                             | `RUNBOOK_FILENAME`, hand-parsed five keys                                                                                                                                                         | task 4.5, D-49      | 3 cases — **but CRLF and BOM false-fail**                               | **Drift** (D4) |
| AC-5  | Fails on a `related` path that does not exist                    | `checkRunbook` existence + escape checks                                                                                                                                                          | task 4.6            | 2 cases — **but unquoted YAML lists are silently skipped**              | **Drift** (D5) |
| AC-6  | `last_verified` > 90 days reported, not failed                   | `checkStaleness` → `staleness[]`; `run.ts` prints, exits 0                                                                                                                                        | D-21                | stale fixture + today-stamped fresh case                                | **Pass**       |
| AC-7  | Runs under `lint` as `tsx core/checks/run.ts`, never `dist/`     | **Independently verified**: `package.json` `lint` = `eslint . --max-warnings 0 && tsx core/checks/run.ts`; `git grep` finds no `dist/core/checks` or `node dist/core` anywhere                    | D-48, task 4.9/4.9a | `is chained after eslint in the lint script, not in place of it (AC-7)` | **Pass**       |
| AC-8  | No registry, plugin interface, or abstraction                    | **Independently verified**: `core/checks/index.ts` is two export lines under a comment explaining the refusal. No `Check` type, no registry array, no dynamic dispatch anywhere in `core/checks/` | task 4.13           | inspection (per the AC)                                                 | **Pass**       |
| AC-9  | Absent `docs/runbooks/` reports nothing                          | `runbookFiles` guards on `existsSync` + `isDirectory`                                                                                                                                             | task 4.8            | `no-runbooks-dir`, `empty-runbooks-dir`                                 | **Pass**       |
| AC-10 | Both over-fire guards present                                    | repo-root-aware resolve, directory links tolerated, rule 2 non-recursive; plus a template exclusion the AC does not mention but the code justifies                                                | task 4.3, 4.4       | `passes its own check` on the real tree                                 | **Pass**       |

### S-005 — Repository shape and the package map

| AC   | Description                                                                                              | CB evidence                                                                                                                                          | WS evidence    | T evidence                                                                                                 | Result         |
| ---- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | ---------------------------------------------------------------------------------------------------------- | -------------- |
| AC-1 | Six detection signals                                                                                    | `workspace.ts` `SIGNAL_FILES` + `workspaces` (array **and** Yarn object form, fixed in `6d90551`) + `[tool.uv.workspace]`                            | task 5.3, 5.4  | a case per signal type, plus the new Yarn-object, deep-glob-boundary, trailing-key, and plain-Python cases | **Pass**       |
| AC-2 | Package map in `docs/tech.md`, six columns                                                               | `## Package Map` section + `activity-init` output structure                                                                                          | task 5.6, 5.10 | `skill-parity-init.test.ts`                                                                                | **Pass**       |
| AC-3 | Single-package records exactly one root row                                                              | `detectWorkspace` root fallback; `docs/tech.md` one row                                                                                              | task 5.10      | `records one row for the root (AC-3)`                                                                      | **Pass**       |
| AC-4 | Bounded context freeform at interview time                                                               | skill text cites `shared-understanding#D-45`                                                                                                         | D-45           | parity assertion                                                                                           | **Pass**       |
| AC-5 | "Mode A — Mono-Repo" renamed, no dangling cross-reference                                                | now "Mode A — Documented Repository"; only the rename note, the changelog, and the guard mention the old term                                        | D-44, task 5.9 | `no longer uses the old mode heading anywhere (AC-5)`                                                      | **Pass**       |
| AC-6 | `doctor` warns, never fails, on map drift                                                                | `checkPackageMap` returns `pass: true, warn: true`                                                                                                   | task 5.5       | both drift directions + no-map case                                                                        | **Pass**       |
| AC-7 | `activity-init` creates `product.md`, `tech.md`, **`docs/runbooks/README.md`**, confirms `SIMPLICITY.md` | `## SIMPLICITY.md Confirmation` present; **no runbooks-index creation step** — "runbooks" appears once in the skill, in an unrelated cross-reference | task 5.8, 5.12 | the test named for AC-7 asserts only the SIMPLICITY clause                                                 | **Drift** (D3) |
| AC-8 | Three trees at parity                                                                                    | added-line comparison shows none                                                                                                                     | task 5.11      | parity suites                                                                                              | **Pass**       |

### S-006 — Package-aware agents

| AC   | Description                                      | CB evidence                                                                                                                       | WS evidence   | T evidence                                                       | Result                      |
| ---- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- | ------------- | ---------------------------------------------------------------- | --------------------------- |
| AC-1 | `researcher`/`plan`/`implement` name the package | `## Package Attribution`, `## Package Scope in Commits`, plan equivalent — byte-identical across the three trees                  | task 6.1-6.3  | `researcher-parity`, `skill-parity-testing-layers`               | **Pass**                    |
| AC-2 | Root fan-out documented, `validate` single entry | `docs/tech.md` `## Root Script Fan-Out`                                                                                           | task 6.5      | parity assertion incl. the Phase 4 boundary                      | **Pass**                    |
| AC-3 | `TESTING.md` per-package runners + reachability  | `### Per-package runners (monorepo contract)`; skill `### Per-package procedure`; reconciled with the Packages table in `6d90551` | task 6.4, 6.6 | reachability test asserts a **test-local helper**, not the skill | **Pass** (test hollow, D8c) |
| AC-4 | One root glossary, contexts map to packages      | `docs/tech.md` ownership section                                                                                                  | task 6.7      | parity assertion                                                 | **Pass**                    |
| AC-5 | One root simplicity baseline, keyed by path      | same section                                                                                                                      | task 6.8      | parity assertion                                                 | **Pass**                    |
| AC-6 | Three trees at parity                            | verified                                                                                                                          | task 6.9      | parity suites                                                    | **Pass**                    |

### S-007 — Runbook coverage and docs ownership

| AC   | Description                                         | CB evidence                                                                                                                      | WS evidence    | T evidence                              | Result   |
| ---- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | -------------- | --------------------------------------- | -------- |
| AC-1 | `verifier` reports the finding                      | `## Runbook-Coverage Finding` in all three `verifier` variants, with both conditions                                             | task 7.1       | trigger/threshold/vocabulary assertions | **Pass** |
| AC-2 | Finding is advisory                                 | "non-blocking to PR readiness", "Never hold a PR on it"                                                                          | task 7.2       | advisory assertions ×3                  | **Pass** |
| AC-3 | Wired to four owners                                | owner-per-work-kind table in `verifier`                                                                                          | task 7.1       | owner assertion                         | **Pass** |
| AC-4 | FR-49a same-PR rule in the owning agents            | `## Runbook Delivery in the Same PR` in 12 files (4 owners × 3 trees), plus `AGENTS.md`, `CLAUDE.md`, and both `.template` files | task 7.3, D-51 | 3 assertions × 12 files                 | **Pass** |
| AC-5 | `technical-writer` runbook hygiene, five conditions | `## Runbook Hygiene`, incl. "never auto-bumped"                                                                                  | task 7.4       | 5-condition assertion ×3                | **Pass** |
| AC-6 | Ownership exclusive, both halves                    | `## Documentation Ownership` / `## Documentation Is Not Yours`; both registries and both templates                               | task 7.5       | both halves + registry assertions       | **Pass** |
| AC-7 | Three trees at parity                               | verified                                                                                                                         | task 7.6       | parity suites                           | **Pass** |

---

## Drift catalog

Every item below is **non-blocking to PR readiness and to issue completion**, per the standing drift policy. Each routes to `product-engineer`'s `activity-drift-reconciliation`.

### D1 — The FR-45 fallback rule reaches one skill, not every reader — **Major / Unintended**

S-001 AC-4 and task 1.10 both say "every skill and agent that reads a foundation document". Thirty-two files across the three prompt trees name `docs/product.md` or `docs/tech.md`. Exactly three carry the fallback paragraph: the `activity-init` copies. No other file states it or cross-references it, and `AGENTS.md`/`CLAUDE.md` — the always-loaded contracts — do not carry it either.

Consequence, in a consumer repository that has not migrated: `developer`, `qa-engineer`, `researcher`, `technical-writer`, `infra-engineer`, `plan`, and `implement` are instructed to read `docs/tech.md`, which does not exist there, with nothing telling them to look for `docs/technical-guidelines.md`. That is the condition PRD AC-23 ("runs every agent unchanged") and FR-45 ("agents **MUST** resolve the old names as a fallback for one release cycle") exist to prevent.

Task 1.10 is marked `[x]`. The guard cannot notice, because `FALLBACK_RULE_FILES` enumerates the same three files the work touched.

_Evidence:_ `git grep -l -E "docs/product\.md|docs/tech\.md" -- .claude .github .kiro` → 32 files; `git grep -l "Fallback, one release cycle"` → 3. `test/unit/foundation-docs-naming.test.ts:126-130`.

### D2 — `doctor` fails on the old names where the PRD says it warns — **Major / Undetermined**

`checkFoundationDocNames` returns `pass: false`. `doctor`'s exit code follows `pass` alone, so a consumer who has not migrated gets `✗`, "Some checks failed.", and exit `11` (`DependencyError`). PRD AC-23 reads "`doctor` **prints a warning** naming both files and the new names." FR-45 frames the whole transition as "proposed, not assumed."

The `warn?: boolean` field was introduced in this same commit and is used correctly by `checkPackageMap` (`pass: true, warn: true`) under a comment explaining exactly why a report must not fail. The foundation-doc check did not use it.

Two documents delivered in this PR disagree about what happens. `docs/runbooks/runbook-migrate-foundation-docs.md` says "`doctor` reports the old names to tell you the migration is available, **not that anything failed**." `README.md` says "`dev-tasks doctor` reports the old names as a **failing check**". The code follows the README.

Classified Undetermined rather than Unintended: the README documents the behavior deliberately and the unit test asserts `pass === false` under a title citing PRD AC-23, so a choice was made. But no decision record covers it, the PRD was not amended, and the sibling runbook contradicts it. A consumer whose CI runs `dev-tasks doctor` gets a red build on upgrade, for a migration they were told was optional.

_Evidence:_ `core/distribution/doctor.ts` `checkFoundationDocNames`; `bin/dev-tasks.ts:244-245`; `test/unit/distribution-doctor.test.ts` "fails and names both documents, both new names, and the command (PRD AC-23)".

### D3 — `activity-init` does not create the runbooks index — **Major / Unintended**

S-005 AC-7 and PRD AC-26 both require `activity-init` on a fresh repository to create `docs/product.md`, `docs/tech.md`, **and `docs/runbooks/README.md`**, and to confirm `SIMPLICITY.md`. The `SIMPLICITY.md` confirmation was added as a new section. The runbooks index was not: the word "runbooks" appears once in the entire skill, in a cross-reference to `runbook-setup-simplicity-tooling.md`.

The parity test named for AC-7 asserts only the `SIMPLICITY.md` clause, so the omission is invisible to the suite.

Mitigating: `dev-tasks install` scaffolds `docs/runbooks/README.md` install-if-absent (S-003 AC-2, verified by four integration cases), so in the normal install-then-init order the file exists. The AC names `activity-init` specifically, and a repository initialized without `install` gets no index.

_Evidence:_ `grep -n runbooks .claude/skills/activity-init/SKILL.md` → one hit, line 157. `test/unit/skill-parity-init.test.ts`, "confirms the SIMPLICITY.md owner and thresholds with the user (AC-7)".

### D4 — The docs-structure check false-fails on CRLF and on a BOM — **Major / Unintended**

`parseFrontmatter` opens with `content.startsWith("---\n")`. A file with CRLF line endings begins `---\r\n`; a file with a UTF-8 byte-order mark begins `﻿---`. Either returns `null`, and the check emits `runbook-frontmatter: … has no frontmatter block` — a hard `lint` failure on a structurally perfect runbook.

Probed directly against scratch trees, re-confirmed at `6d90551`:

```
CRLF => ["runbook-frontmatter: docs/runbooks/runbook-deploy-thing.md has no frontmatter block."]
BOM  => ["runbook-frontmatter: docs/runbooks/runbook-deploy-thing.md has no frontmatter block."]
```

Any contributor or consumer on a checkout with `core.autocrlf=true` sees every runbook reported as malformed. This is exactly the failure mode AC-10 was written to prevent — "a check that reports failures on a correct tree gets disabled" — applied to a case AC-10 did not enumerate. The test plan's TC-901 named "BOM, CRLF" among its generator inputs; §5.10 was never implemented (D9).

### D5 — `related` is read only from quoted strings, so an ordinary YAML list is silently unchecked — **Major / Unintended**

Both `core/checks/docs-structure.ts` and `test/unit/runbook-set.test.ts` extract related paths with `/["']([^"']+)["']/g`. A runbook written in idiomatic block-sequence YAML yields **zero** related paths — and the `related:` key still has a non-empty value, so the missing-key rule does not fire either.

Probed directly:

```yaml
related:
  - scripts/does-not-exist.sh
  - /etc/passwd
```

→ `[]`. No findings. A dangling `related` (PRD AC-24) and a path escaping the repository are both invisible, and such a runbook would contribute nothing to the AC-25 reverse-coverage set while appearing well-formed.

Mitigating: `templates/runbooks/runbook-template.md` ships the bracketed-quoted form, so a consumer copying the template writes the shape the parser understands. Everything in this repository uses that shape, which is why the gate is green today.

Root cause shared with D4: D-49's decision not to promote `yaml` to `dependencies` is sound, but the hand-rolled substitute handles exactly the one dialect this repository happens to write.

### D6 — `CHANGELOG.md` is an undocumented fifth exclusion from the rename guard — **Minor / Unintended**

S-001 AC-2 scopes the guard to "…or the repository root" and enumerates four exclusions: the fallback paragraphs, `docs/adr/**`, `docs/requirements/**`, `workstream/**`. AC-3 requires "every exclusion in an explicit, commented allowlist."

`CHANGELOG.md` is a root file, it names both old documents, and the reference is **new in this phase** — introduced by `c3c4386`; `main` has none. It is neither in `SCAN_ROOTS` nor in `EXCLUDED_DIRS` nor in `EXEMPT_FILES`. It is simply not scanned, with nothing recording that as a decision. The content is correct and desirable: a changelog must name what was renamed. Only the silence is the problem.

Related, and already acknowledged in the code: `EXEMPT_FILES` exempts `README.md` whole-file, so a stale reference anywhere in it is invisible. The comment at lines 64-68 states that cost explicitly. A reasoned trade, not a gap.

_Evidence:_ `git grep -n -E "product-context\.md" main -- CHANGELOG.md` → empty; at `HEAD` → line 20. `SCAN_ROOTS` at `test/unit/foundation-docs-naming.test.ts:24-39`.

### D7 — The frontmatter parser is still duplicated, and the new cross-check does not pin it — **Minor / Unintended**

`test/unit/runbook-set.test.ts:75-98` re-implements `parseFrontmatter` line-for-line from `core/checks/docs-structure.ts:92-115` rather than importing it. Spec §8.3's "one implementation, two callers — the logic is not duplicated" holds between `lint` and the `verifier`, and is broken here.

`6d90551` added a case, "agrees with the shipped check, not just with its own parser copy", which calls `checkDocsStructure(ROOT)` and asserts no failures. That is a real improvement in intent, but it does not do what its name claims: it asserts the shipped check passes _this tree_, which `test/unit/checks-docs-structure.test.ts`'s "this repository > passes its own check (AC-10)" already asserts. It never compares the two parsers on any input, so two byte-identical copies sharing the same D4 and D5 blind spots still agree perfectly. Pinning would mean feeding both the same adversarial fixtures, or deleting the copy.

### D8 — Three tests are narrower than the criterion they are named for — **Minor / Unintended**

**(a)** `test/unit/runbook-coverage-parity.test.ts:198-206`, "this phase's own PR would not trigger the finding (7.9)", asserts that `docs/runbooks/README.md` links at least ten runbooks. It never reads a task list, never counts configuration steps, and never evaluates the trigger. Given `runbook-set.test.ts` already asserts the index lists exactly ten, it is trivially true. It is offered as the durable substitute for manual task 7.9 and does not substitute for it.

**(b)** `test/unit/runbook-set.test.ts`, "links docs/runbooks from the docs index (AC-7)", is `expect(docsIndex).toMatch(/runbooks/i)`. Any prose mention of the word satisfies it; the AC requires a link. Deleting both actual links and leaving one sentence would pass.

**(c)** `test/integration/test-standards-reachability.test.ts` defines `reachabilityTable()` inside the test file and asserts on its output. The only production code involved is `detectWorkspace`, already covered by `test/unit/workspace.test.ts`. Nothing reads `activity-test-standards`, so the skill losing or mis-stating its per-package procedure — the defect S-006 AC-3 names — would not fail it. It is also filed under `test/integration/` while being a synchronous pure-function call, which misplaces it in the `/TESTING.md` layer taxonomy.

### D9 — The randomized and property-based sweep was never implemented — **Minor / Undetermined**

`workstream/test-plan-shared-understanding-phase-1.md` §5.10 specifies TC-901 to TC-906 with seed policy `20260919` and replay instructions, and the execution checklist carries "Randomized sweep: TC-901 to TC-906 with seed `20260919`". No such test exists: no property-based library, no seeded generator, no `SEED=` handling anywhere in `test/`. The task list never scheduled it — tasks 1.0-7.0 carry hand-written "Edge cases" sub-tasks instead, and task 8.0 has no randomized-sweep gate.

This is load-bearing rather than procedural: TC-901's stated generator inputs included "BOM, CRLF" and non-list `related` — precisely D4 and D5. The sweep was designed to find them.

Classified Undetermined: substituting enumerated edge cases for randomized ones may have been deliberate, but nothing records it.

### D10 — Task-list checkboxes disagree with what happened, in both directions — **Minor / Unintended**

_Marked done, not done._ Sub-task 3.16 ("follow `runbook-configure-branch-protection` against a scratch repository") is `[x]`. It was not executed — `gh` is not installed here (`which gh` → not found) and changing a real repository's protection settings was out of scope. Four other manual checks carry the same mark with no recorded evidence: 1.16, 2.17, 5.14, 7.9. Task 1.10 is `[x]` for work only partially done (D1).

_Done, not marked._ Task 8.8 (no version bump, changelog under `[Unreleased]`) was completed by `c3c4386` and remains `[ ]`. Task 8.4 (`qa-engineer` at the completion gate) evidently ran — `6d90551`'s message opens "Found by the qa-engineer completion gate (task 8.4)" — and remains `[ ]`, with no `coverage_gate` recorded anywhere (D13).

### D11 — Editorial and cosmetic defects introduced by this phase — **Minor / Unintended**

- `CHANGELOG.md` `[Unreleased]` carries **two `### Changed` sections** (lines 18 and 40) — the new block was inserted above Phase 0's, leaving a duplicate heading inside one release. Keep a Changelog expects one.
- `TESTING.md:50` lost its list-continuation indent: `` `no test `` / ``script` is a finding…`` — the second line starts at column 0. It renders as a lazy continuation, but it is inconsistent with every neighbouring bullet. Introduced by `6d90551`.
- All three `activity-init` copies carry a stray double `---` separator immediately before `## Repository Shape Detection`. At parity across trees, so the parity suites are satisfied.
- `templates/runbooks/README.md` ships an index table with one empty row `|  |  |  |  |`.
- `CLAUDE.md` and `CLAUDE.md.template` File Organization row lost column alignment on the `/docs/` line.
- `docs/runbooks/runbook-release-npm.md` states "The steps below describe the template", then the steps invoke `./scripts/release.sh` — which in this repository is the other, larger, maintainer-only script the same runbook just distinguished. Correct for a consumer, ambiguous for a reader here.
- `researcher` (all three trees) directs the agent to `detectWorkspace` in `core/distribution/workspace.ts`, a source path absent from a consumer repository (only `dist/core/` ships) and not reachable from the CLI.

Systemic note: `format:check` covers `bin/`, `core/`, `test/`, `*.json`, `*.ts`, and `eslint.config.js`. No markdown is format-checked anywhere, which is why this whole class survives a green `validate`.

### D12 — `migrate docs` reports two consumer files, not "custom prompts" — **Minor / Intended**

FR-45 and S-002 AC-1 say the proposal lists "the consumer-owned files (`CLAUDE.md`, `AGENTS.md`, custom prompts)" that still name the old documents. `CONSUMER_OWNED_FILES` is `["CLAUDE.md", "AGENTS.md"]`. The module header states the reason plainly: custom prompts have no defined location in a consumer repository, so they are left to the agent reading the proposal. Recorded as an Intended narrowing with its rationale in place.

### D13 — `coverage_gate` was not recorded — **Minor / Unintended**

`AGENTS.md` and `CLAUDE.md` both require: "`qa-engineer` runs at the completion gate, before the `verifier` audit, and records `coverage_gate: PASS | FAIL | SKIPPED(<reason>)`. Skipping requires a non-empty reason; **omitting the field is treated as incomplete**."

The gate plainly ran — `6d90551` is its output and names task 8.4. The value is recorded nowhere: not in the task list, not in the commit message, not in `TESTING.md`, not in any workstream artifact. `TESTING.md` still reports that no usable coverage provider is installed, so the honest value is almost certainly `SKIPPED(no coverage provider configured; V8 declared in vitest.config.ts but no provider package installed)` — but an audit cannot supply a gate's own verdict, only note its absence.

### D14 — `.gitignore` silently swallows every new `/workstream/*.md`, including this report — **Minor / Unintended**

`.gitignore:23` is `/workstream/*.md`, commented "Active workstream artifacts are per-feature scratch". Seventy-two markdown files under `workstream/` are tracked anyway, including every artifact this phase was built from: the specification, the stories, the task list, the decisions log, the test plan, and the traceability matrix. The rule does not describe what the repository does.

The consequence is immediate and concrete: this fidelity report is ignored on creation. `git status` does not show it, `git add .` will not stage it, and a reviewer cloning the branch will not find it.

This is the same defect class PR #209 fixed one rule lower in the same file. The comment directly beneath, added by that PR, explains it exactly: an ignore-plus-allowlist over a directory that holds durable documents "silently swallowed any document nobody remembered to allowlist". `/docs/` was fixed; the identical `/workstream/` rule three lines above was left, and the phase that depends on twenty-four tracked `workstream/` files did not notice.

Scoped honestly: the rule predates this phase, so this is not drift introduced here. It is reported because it is newly consequential — it is what prevents this report from reaching the reviewers rule 12 requires it to reach — and because the reasoning that fixed its twin is already written three lines away.

---

## Verified, not drift

Six things were checked independently rather than taken from the task list. All hold at `6d90551`.

1. **PRD AC-25 coverage is complete and the near-miss was avoided.** All ten files under `templates/scripts/` (5), `templates/workflows/` (3), and `.github/workflows/` (2) appear in some runbook's `related`. `runbook-release-npm` names `templates/scripts/release.sh` — the consumer template and the AC-25 surface — and not `scripts/release.sh`, this repository's own larger script; the runbook says so in prose, and `runbook-set.test.ts` carries a dedicated assertion for the distinction.
2. **D-48 holds.** `lint` is `eslint . --max-warnings 0 && tsx core/checks/run.ts`. `git grep` finds no `dist/core/checks` or `node dist/core` path anywhere. `lint` still exits non-zero on ESLint alone, because of the `&&` short-circuit.
3. **D-50's exclusions are real and justified where they are written.** `docs/adr/**`, `docs/requirements/**`, and `workstream/` are excluded in `EXCLUDED_DIRS`, each with a paragraph of reasoning. `SCAN_ROOTS` was written from scratch and demonstrably includes `docs/`, asserted by its own regression test. A further test proves the excluded trees still contain old names, so a dead exclusion gets removed rather than left as unexplained configuration. The one gap is D6.
4. **S-004 AC-8 holds.** `core/checks/index.ts` is two export statements under a comment explaining the refusal. There is no `Check` interface, no registry array, no dynamic dispatch, and no abstraction anticipating Phases 3, 5, or 6 anywhere in the module.
5. **Three-tree parity holds for everything this phase changed.** Comparing the added-line sets of `.claude`, `.github`, and `.kiro` across the full diff, every divergence is pre-existing platform framing — Claude's subagent/`Task` addenda, Kiro's `resources:` frontmatter, Copilot's prompt-file split — with the renamed filename substituted. Every section this phase introduced (`Runbook-Coverage Finding`, `Runbook Delivery in the Same PR`, `Runbook Hygiene`, `Documentation Ownership`, `Documentation Is Not Yours`, `Repository Shape Detection`, `Package Map`, `Package Attribution`, `Package Scope in Commits`, `Foundation Document Names`) is present in all three trees, byte-identical where the surrounding file allows.
6. **Tests that assert something trivially true or too narrowly** — three found, catalogued as D8. One more, `runbook-set.test.ts`'s new cross-check, is weaker than its name and is folded into D7.

---

## Documentation structure

Run as required, via `tsx core/checks/run.ts` against the delivered tree. Result reported, not re-derived.

```
$ tsx core/checks/run.ts
(no output)
exit 0
```

- **Failures: 0.** Expected — this is a `lint` gate and `lint` is green, so a failure here would mean the gate was bypassed.
- **Staleness findings: 0.** All ten runbooks carry `last_verified: 2026-09-19`, one day old. Per D-21 staleness is reported and never fails; had there been any, it would appear here and still be non-blocking.

One caveat on the clean result, carried from D4 and D5: this tree passes partly because it writes frontmatter in the single dialect the parser understands — LF, no BOM, bracketed and quoted `related`. A green run here is not evidence that the gate is robust.

---

## Runbook-coverage finding (FR-49b), evaluated against this PR

**The trigger does not fire.** Both conditions are required; the second fails.

| Condition                                                                                                 | Met?    | Evidence                                                                                                                                                                                                                                                                                                   |
| --------------------------------------------------------------------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Task list contains three or more steps touching configuration, environment, tooling, credentials, or data | **Yes** | Well past the threshold: 1.3 (`git mv` of two tracked documents — data), 3.2/3.3/3.5 (`INSTALL_IF_ABSENT_FILES` delivery registry — configuration), 3.13 (`bundle-manifest.json` and `consumer_owned_paths` — configuration), 4.9 (`lint` script — tooling), 2.2-2.6 (a new migration command — migration) |
| The PR adds or updates **no** runbook under `docs/runbooks/`                                              | **No**  | Ten runbooks added, plus `docs/runbooks/README.md` and `templates/runbooks/`                                                                                                                                                                                                                               |

Not a finding. Recorded here because the criterion asks for the evaluation to be explicit, and because this PR is the first work to which the rule now applies. Consistent with manual task 7.9 — though as D8(a) notes, the automated stand-in for 7.9 does not evaluate this trigger, so this section is the real execution of it.

---

## Confirming the two known items

**The five pre-existing test failures are the D-40 baseline, unchanged by this phase — confirmed.** The failing set at `6d90551` is exactly:

```
test/integration/bootstrap-commands.test.ts > doctor > runs all checks and outputs results
test/integration/bootstrap-commands.test.ts > doctor > supports --json output with structured check results
test/unit/distribution-doctor.test.ts > checkCacheDir > fails when path is not writable
test/unit/distribution-update.test.ts > runUpdate() > --force with unwritable backup dir > throws error when backup directory cannot be created
test/unit/infra-script-contract.test.ts > deploy.sh — blocked conditions and edge cases > exits 2 when yq is missing from PATH
```

Set equality with the recorded baseline, not merely a count of five. One check worth stating, since this phase added two `doctor` checks and two of the failures are `doctor` integration cases: the cause is `node-version` (`Node.js >= 24 required. Found: v22.22.2`), not the new checks. Running `dev-tasks doctor --json` directly shows `foundation-doc-names` and `package-map` both passing. `TESTING.md`'s Runtime parity section was corrected in `6d90551` to record this accurately.

**Sub-task 3.16 was not executed — confirmed, and you have it right.** `gh` is not installed here, and mutating a real repository's protection settings is out of scope for an audit. One correction to add: the sub-task is marked `[x]` in the task list. Unexecuted work recorded as done is the finding, not the non-execution — see D10. The runbook itself is well-formed and reads as executable; what is missing is the evidence that anyone ran it.

---

## Recommendations

| #   | Finding                                                    | Recommended next step                                                                                                                                                                                                                                                                                                                                             | Owner                                                                      |
| --- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| D1  | Fallback rule in one skill only                            | Fix. Either add the fallback paragraph to every prompt that reads a foundation document, or — cheaper and more durable — state it once in `AGENTS.md`/`CLAUDE.md` and both templates, where every agent already loads it. Then extend the guard with an assertion that any file naming `docs/tech.md` either carries the rule or is covered by the root contract. | `developer`                                                                |
| D2  | `doctor` fails where the PRD says warn                     | Decide, then align all three surfaces. If warn is correct: `pass: true, warn: true`, update the unit test, update `README.md`. If fail is correct: amend PRD AC-23 with a decision record and fix `runbook-migrate-foundation-docs.md`, which currently contradicts the shipped behavior.                                                                         | `product-engineer` (decision), then `developer`                            |
| D3  | `activity-init` does not create the runbooks index         | Fix. Add the `docs/runbooks/README.md` creation step to `activity-init` in all three trees, and widen the AC-7 parity assertion to all four clauses.                                                                                                                                                                                                              | `developer`                                                                |
| D4  | CRLF/BOM false failure                                     | Fix. Strip a leading BOM and normalize `\r\n` before parsing, in `core/checks/docs-structure.ts`. Add both as fixtures.                                                                                                                                                                                                                                           | `developer`                                                                |
| D5  | Unquoted `related` silently unchecked                      | Fix. Parse block-sequence `- path` entries alongside the bracketed form, or reject a `related` value the parser cannot read rather than treating it as empty — silence is the dangerous branch.                                                                                                                                                                   | `developer`                                                                |
| D6  | `CHANGELOG.md` outside the guard with no record            | Fix, cheaply. Add `CHANGELOG.md` to `SCAN_ROOTS` and to `EXEMPT_FILES` with a one-line reason ("a changelog must name what was renamed"), so the exclusion is stated rather than implied.                                                                                                                                                                         | `developer`                                                                |
| D7  | Duplicated frontmatter parser, cross-check does not pin it | Fix with D4/D5. Either import the parser from `core/checks` in `runbook-set.test.ts`, or feed both copies the same adversarial fixtures. The current cross-check duplicates an assertion that already exists elsewhere.                                                                                                                                           | `developer`                                                                |
| D8  | Three tests narrower than their AC                         | Fix. (b) is one line — assert the markdown link. (a) should be deleted or replaced with a test that reads a task list and counts qualifying steps. (c) should either assert the skill text alongside the helper, or be re-filed as a unit test and renamed so it stops claiming to cover the skill.                                                               | `qa-engineer`                                                              |
| D9  | Randomized sweep unimplemented                             | Route to planning. Either schedule TC-901 to TC-906 as a follow-up issue — they were designed to catch D4 and D5 — or record a decision that the enumerated edge cases supersede them. Do not leave the test plan's checklist item silently unmet.                                                                                                                | `product-engineer`                                                         |
| D10 | Checkbox accuracy, both directions                         | Correct the task list: unmark 3.16 with its reason (`gh` absent, out of scope); record what evidence exists for 1.16, 2.17, 5.14, 7.9; reconcile 1.10 with D1; mark 8.8 and 8.4 done.                                                                                                                                                                             | `product-engineer` via `activity-drift-reconciliation`                     |
| D11 | Editorial defects                                          | Fix. The duplicate `### Changed` and the `TESTING.md` indent are one-line changes. Separately, consider extending `format:check` to markdown — no `.md` file in this repository is format-checked, which is why this class survives a green `validate`.                                                                                                           | `technical-writer` (docs), `developer` (CHANGELOG, tooling)                |
| D12 | `custom prompts` not enumerated                            | No action needed. Intended narrowing, reason recorded in the module header.                                                                                                                                                                                                                                                                                       | —                                                                          |
| D13 | `coverage_gate` unrecorded                                 | Record it. The gate ran; its verdict needs to exist somewhere durable before task 8.4 can close.                                                                                                                                                                                                                                                                  | `qa-engineer`                                                              |
| D14 | `/workstream/*.md` gitignored while 72 are tracked         | Fix. Either drop the rule, as PR #209 did for `/docs/`, or narrow it to the genuinely throwaway names. Until then, every workstream artifact — this report included — needs `git add -f`.                                                                                                                                                                         | `housekeeping` (tooling), `product-engineer` (which artifacts are durable) |

Two observations that are not findings and need no action:

- **PRD AC-30 remains deliberately split.** The CI half needs the Phase 4 template; the stories record the split rather than discovering it. Correct as delivered.
- **`.claude/commands/planner.md` carries no foundation-document reference while `.kiro/agents/planner.md` does.** Pre-existing on `main`, not introduced here.

---

## Output contract

| Field                    | Value                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mode / phase             | Audit Mode, Phase 4 (Reporting & Publication)                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Source artifacts         | PRD v1.13; spec v1.4; stories v1.4; decisions v1.9 (D-40 to D-52); test plan and traceability matrix; the delivered branch at `6d90551`                                                                                                                                                                                                                                                                                                                           |
| Artifact written         | `/workstream/fidelity-report-shared-understanding-phase-1.md`                                                                                                                                                                                                                                                                                                                                                                                                     |
| GitHub issue link        | **Not published** — `gh` is not installed in this environment (see Blocking gaps)                                                                                                                                                                                                                                                                                                                                                                                 |
| AC coverage              | 55 / 55 evaluated; 48 Pass, 0 Fail, 7 Drift                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Overall fidelity verdict | Medium                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Highest drift impact     | Major                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Blocking gaps            | Publication only. This report could not be posted to issues #202-#208 or to PR #211: `gh` is unavailable here. Rules 11 and 12 of the `verifier` contract — issue publication and reviewer accessibility — are **unmet** and must be completed by the calling session or by `github-ops`. Separately, the artifact is gitignored (D14) and needs `git add -f` to reach the branch at all. No audit-coverage gap: every AC was evaluated against all four sources. |
