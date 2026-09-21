# Fidelity Report — Issue #171 / PR #183

## 1. Header / Verdict

- **Fidelity: Medium**
- **Highest drift impact: Major** (Unintended)
- **Scope:** Issue #171, "Ship CLAUDE.md and AGENTS.md root context to consumers" — PR #183 (draft), branch `issue/171-deliver-claude-root-context` → `integration/claude-runtime-parity-plan`.

Drift is non-blocking to PR/issue completion per the `verifier`/`implement` contract. The code fix itself is correct; the gap is in test coverage fidelity, not in the shipped behavior.

## 2. Human-readable summary

This PR fixes a real problem: when someone installed the `claude` profile of this tool, they got no `CLAUDE.md` or `AGENTS.md` file at all, because those two files were never packaged for distribution. The fix — adding the two files to the list of things that get shipped, and delivering them only when they don't already exist (so a user's own edits are never overwritten) — is implemented correctly and matches the design intent everywhere it was checked: the code, the task list, the README, and the git-invariant text added to both templates.

The one place this PR overstates itself is the new automated test. The PR describes a test that would catch the exact original bug (files missing from the package) "before the install-level assertion is even reached." In practice, the test never checks that packaging step — it runs the tool directly out of the repo checkout, where the two files exist on disk regardless of whether they're listed for packaging. I confirmed this by removing the packaging-list entries the fix added and re-running the test suite: it still passed all 5 tests. So the new test proves the install-if-absent *behavior* works, but it does not prove the original bug (missing from the shipped package) is what got fixed, or that it can't come back unnoticed. Everything else — the code, docs, task list, and quality gates — checks out.

## 3. Per-AC result table

| AC-ID | Description | Codebase evidence | Workstream evidence | Test evidence | Result |
| --- | --- | --- | --- | --- | --- |
| AC-1 | Fresh `install --profile claude` yields a repo where Claude Code loads project memory on the first turn | `core/distribution/profiles.ts` adds `CLAUDE.md.template`→`CLAUDE.md` and `AGENTS.md.template`→`AGENTS.md` to `INSTALL_IF_ABSENT_FILES` (platform `claude`); `package.json` `files[]` now includes both `.template` sources; `install.ts`/`update.ts`/`install-if-absent.ts` consume the list generically, unchanged | Task 3.1-3.3 checked in `workstream/tasks-claude-runtime-parity-plan.md`; CP-03 in test plan states this AC | Test 1/5 (`a fresh install --profile claude produces CLAUDE.md and AGENTS.md`) passes on a real built CLI invocation into a temp dir | **Pass, with a coverage caveat** — see Drift D-1. The install-if-absent delivery behavior is genuinely verified; the packaging boundary (`files[]`) that was the actual root cause is not exercised by this test and would not have caught the original defect |
| AC-2 | Existing consumer `CLAUDE.md`/`AGENTS.md` survives `install` and `update` unchanged | `INSTALL_IF_ABSENT_FILES` category (pre-existing, from Task 1.0) never overwrites an existing target; unchanged by this PR | Task 3.3, 3.7 checked; CP-03 negative assertion states this | Tests 2-4/5 (`survives install unchanged` x2, `survives update unchanged`) pass with real content-diff assertions | **Pass** |
| AC-3 | `pnpm run test:integration` and `pnpm run validate` pass | No code defects found in `profiles.ts`, `install-if-absent.ts`, `install.ts`, `update.ts` | Task 3.8 checked | Full suite re-run independently: `pnpm run test` — 117 files / 1979 tests passed; `typecheck`, `lint`, `format:check` all passed before test phase in `pnpm run validate` | **Pass** |

## 4. Drift catalog

### D-1 — New test does not exercise the packaging boundary it claims to cover

- **Description:** The PR body and `workstream/test-plan-claude-runtime-parity.md` (CP-03) both state the negative assertion includes: "`package.json` `files[]` omission of either `.template` source fails the 'ships in package' assertion before the install-level assertion is even reached." `test/integration/install-parity.test.ts` contains no assertion of this kind. It invokes `dist/bin/dev-tasks.js` directly out of the repo checkout (`getPackageRoot()` walks up from the built script's own directory to find the nearest `package.json`, which resolves to the repo root during this test run, not to an npm-packed/installed copy). Since `CLAUDE.md.template`/`AGENTS.md.template` physically exist in the repo checkout regardless of `package.json` `files[]` contents, the test cannot distinguish "shipped in the package" from "present in the source tree."
  - **Verified experimentally:** removed the two `files[]` entries this PR added (`AGENTS.md.template`, `CLAUDE.md.template`), rebuilt, and re-ran `test/integration/install-parity.test.ts` — all 5 tests still passed. This is the same class of regression the PR exists to fix (issue #171: "their `.template` sources didn't ship in `package.json` `files[]`"), and the delivered test suite would not catch it if it recurred.
  - **Scope note:** this is not unique to this PR — the same pattern (no `npm pack`-equivalent test anywhere in the suite) also applies to the pre-existing `DESIGN.md`/`TESTING.md` `ROOT_FILES` coverage in `test/integration/bootstrap-commands.test.ts`. It is a systemic gap this PR inherits and does not introduce, but the PR's own description and test-plan pass criteria claim coverage that does not exist for the specific files this PR ships.
- **Impact class:** Major (the exact defect class the issue exists to fix is not regression-tested; the fix itself is correct today, but nothing prevents a future `package.json` edit from silently reintroducing the original bug).
- **Intent class:** Unintended (the PR description and CP-03 explicitly claim this assertion exists and would fire first; it does not).
- **Evidence source(s):** `test/integration/install-parity.test.ts` (read + executed), `bin/dev-tasks.ts` (`getPackageRoot()`), `package.json` (files[] experiment), PR #183 body, `workstream/test-plan-claude-runtime-parity.md` CP-03.
- **Non-blocking note:** per the `implement`/`verifier` contract, this drift does not block PR #183 or issue #171 from being marked complete.

### D-2 — Developer's "no code change needed in `install.ts`" claim: confirmed true (not a defect, recorded for completeness)

- **Description:** Issue #171's "Relevant Files" pre-listed `core/distribution/install.ts`, but the delivered diff touches only `core/distribution/profiles.ts` (plus `package.json`, the two templates, README, tests, task list). Independently verified: `install.ts` imports `deliverInstallIfAbsentFiles` and calls it with the full `INSTALL_IF_ABSENT_FILES` list (unchanged, pre-existing from Task 1.0/#169); same for `update.ts`. Neither needed modification because both already iterate the registry generically. This claim is **accurate**.
- **Impact class:** None (this is a confirmation, not a finding).
- **Intent class:** Intended.
- **Evidence source(s):** `core/distribution/install.ts:19,147`, `core/distribution/update.ts:25,30,351,398`, diff stat between `integration/claude-runtime-parity-plan` and `issue/171-deliver-claude-root-context` (confirms these two files are absent from the changed-files list).

## 5. Edge-case and randomized test outcomes

No randomized/fuzz tactics were specified for CP-03 in the test plan; none applicable. Edge case EC-02 ("install→update→install cycle preserves edits", per the traceability matrix) is covered indirectly by test 4/5 (`survives update unchanged`) but the matrix's "Automated — Planned" status for Task 3.0 rows has not been updated to "Automated — Delivered" despite the tests now existing and passing; this is a documentation-currency gap, not a behavioral one (Minor, Unintended).

## 6. Recommendations

| Finding | Recommended next step |
| --- | --- |
| D-1 (packaging-boundary test gap) | `developer`: add a test that exercises the real npm packaging boundary (e.g., run `npm pack --dry-run --json` or `npm pack` into a tarball and assert `.template` sources are included in the file list, before/independent of the install-time assertions), or clarify the PR/test-plan language so it no longer claims a coverage that doesn't exist. Given the systemic nature (also affects `ROOT_FILES`), this may be a good candidate for a follow-on task rather than blocking this PR. |
| D-2 (relevant-files / install.ts claim) | No action needed — claim independently confirmed accurate. |
| Traceability matrix status | `product-engineer` (`activity-drift-reconciliation`): update Task 3.0 rows in `workstream/traceability-matrix-claude-runtime-parity.md` from "Automated — Planned" to "Automated — Delivered" now that CP-03's tests exist and pass. |

## Coverage / audit-completeness note

Evidence was collected for all 3 ACs against all four required sources (codebase, `/workstream` artifacts, test suite — executed, not just read — and PRD/spec intent via issue #171 body). No missing evidence; audit is complete, not blocked.
