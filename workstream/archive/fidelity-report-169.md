# Fidelity Report — Issue #169 / PR #180 (Task 1.0: `.claude/settings.json` deliverable)

## Verdict

**Fidelity: High**
**Highest drift impact present: Minor**
**Scope:** Task 1.0 of `workstream/tasks-claude-runtime-parity-plan.md` (subtasks 1.1–1.12), PR #180, branch `issue/169-claude-settings-deliverable` → `integration/claude-runtime-parity-plan`.

This is an independently obtained result. The `developer` subagent's self-reported `verifier_audit: run` / `fidelity_verdict: High` (posted to PR #180 as a comment, since it had no `Task` tool to delegate to a real `verifier` invocation) was **not** taken as given — the codebase diff, tests, ADR, task list, and issue body were re-read and the test suite was re-executed independently for this report. The independent result **confirms** the self-reported High verdict, with one additional Minor documentation-fidelity finding the self-audit did not surface.

## Human-readable summary

Before this PR, Claude Code users who installed this toolkit got the two guard scripts (`git-guard.sh` and, later, `branch-guard.sh`) copied onto disk, but nothing told Claude Code to actually run them — the file that does that wiring, `.claude/settings.json`, was never delivered by the installer at all. It sat on a "the consumer owns this" list forever, which really meant "nobody ships it." Kiro users, by contrast, got the equivalent wiring file automatically. So Claude installs _looked_ complete but the safety hooks were dead on arrival.

This PR fixes the delivery gap, not the wiring content. It teaches the installer a new rule: "write this file only if it's not already there, and never touch it again once it exists" — different from how every other file in this toolkit behaves (either always overwritten, or synced/reconciled). That rule protects a user's own customizations (their permission settings, any extra hooks they add) while still guaranteeing the file shows up on a fresh install or on an existing user's next update. A new `doctor` check was added that will name, by filename, any hook script sitting unwired — so the gap this task closes for delivery is also closable for detection going forward. The actual content that turns the hooks "on" (the specific wiring rules, and the permission allowlist) is deliberately left for the next two tasks in the plan (#170 and #174) — that narrowing was an explicit, recorded decision at execution time, not something quietly dropped. The one gap this audit adds: the consumer-facing user manual describes the delivered file as something that "wires the shipped hook scripts" without noting that, as shipped by this PR alone, it wires nothing yet — a reader of that page today could be misled about current behavior, even though the internal engineering trail (ADR, task list, issue) is honest about it.

## Per-AC result table

| AC-ID | Description                                                                                                          | Codebase evidence                                                                                                                                                       | Workstream evidence                                                                                                    | Test evidence                                                                                                                                                                                                                                                                    | Result                                            |
| ----- | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| AC-1  | `install --profile claude` into an empty temp dir produces `.claude/settings.json`                                   | `core/distribution/install.ts` calls `deliverInstallIfAbsentFiles`; `templates/claude/settings.json` exists with valid JSON                                             | Task-list 1.3/1.5/1.9 checked; ADR-006 Decision section; issue #169 AC-1 checked with an explicit narrowing annotation | `test/unit/distribution-install.test.ts` "AC-1" — ran, passes; independently re-run (117/117 across the four target files)                                                                                                                                                       | **Pass** (delivery mechanism only — see Drift D1) |
| AC-2  | Re-running `install` / running `update` against a consumer-modified `.claude/settings.json` leaves it byte-identical | `install-if-absent.ts` `fileExists` short-circuit; `update.ts` reconciliation gates on `result.delivered` and excludes install-if-absent targets from manifest tracking | Task-list 1.6/1.10 checked; ADR-006 rejects `ROOT_FILES`-style overwrite specifically because it fails this AC         | `distribution-install.test.ts` "AC-2"; `distribution-update.test.ts` "never overwrites a consumer-modified..."; both pass and assert byte-identical content, not just existence                                                                                                  | **Pass**                                          |
| AC-3  | `doctor` warns on hooks-present/settings-absent, silent when correctly wired                                         | `doctor.ts` `checkClaudeHooksWiring`: readdir hooks, parse settings, substring-match commands against script names                                                      | Task-list 1.7/1.11 checked                                                                                             | `claude-hooks-wiring.test.ts` — 6 cases: none, absent-settings, partial-wiring (asserts partial name isolation, not just "fails"), fully-wired, invalid-JSON, `runDoctor` inclusion; all pass                                                                                    | **Pass**                                          |
| AC-4  | `test:unit`, `test:integration`, `validate` pass                                                                     | N/A                                                                                                                                                                     | Task-list 1.12 checked; PR body claims 114 files / 1930 tests                                                          | Independently ran the four new/extended unit test files directly: 4 files, 117 tests, all pass. Did not re-run the full 1930-test suite (out of scope for a targeted audit; PR body's `validate` claim is consistent with what was independently observed for the changed files) | **Pass**                                          |

## Drift catalog

### D1 — `templates/claude/settings.json` ships with empty `PreToolUse`/`permissions.allow`

- **Impact:** Minor
- **Intent:** **Intended** — confirmed, not silently under-scoped.
- **Evidence:**
  - `workstream/tasks-claude-runtime-parity-plan.md`, parent task 1.0 scope note: "per explicit direction at execution time, `templates/claude/settings.json` ships with a valid, empty-but-documented structure... AC 1.9's literal 'wires every shipped hook script' is therefore satisfied at the delivery-mechanism level by this task; the wiring content lands with task 2.0."
  - `docs/adr/ADR-006-claude-settings-ownership.md` Decision and Follow-up sections state the same narrowing and name task 2.0/6.0(6b) as owners of the deferred content.
  - Issue #169 body's AC-1 checkbox carries the annotation "(delivery mechanism verified; `PreToolUse` wiring _content_ lands with task 2.0 per explicit execution-time scope direction — see PR #180)" — i.e., the issue itself, not just internal docs, discloses the narrowing.
  - `workstream/traceability-matrix-claude-runtime-parity.md` and `workstream/test-plan-claude-runtime-parity.md` (gitignored, not part of the PR diff, but present on disk) still word CP-01/AC-1 as "wires every shipped hook script" / "fully wired file" without the scope-note annotation the task list and issue carry — a reader of the test plan alone, without cross-referencing the task list or ADR, would not know the wiring content was deferred. This is the one place the narrowing wasn't propagated.
- **Consumer-facing functional check (the specific concern raised for this audit):** confirmed non-surprising in the sense that matters most — a consumer installing today gets `.claude/hooks/git-guard.sh` on disk and an empty `PreToolUse`, and the new `checkClaudeHooksWiring` doctor check will name `git-guard.sh` as unwired if the consumer runs `dev-tasks doctor`. The gap is surfaced by name, not silently inert-and-invisible, which is the ADR's stated goal. See D2 for the residual gap in _how_ a consumer discovers this.
- **Non-blocking note:** per Audit Mode rules, this drift does not block PR/issue completion and does not replace `test`/`lint`/`format:check`/`typecheck`/`audit` gates.

### D2 — `dev-tasks doctor` is opt-in, not run automatically by `install`; and the user manual's Install-If-Absent table overstates current behavior

- **Impact:** Minor
- **Intent:** **Unintended** (documentation-fidelity gap, not a code defect) — the self-reported `developer` audit and `qa-engineer` gate did not flag this.
- **Evidence:**
  - `bin/dev-tasks.ts` — `doctor` is a separate CLI subcommand; `install` (`case "install"`) does not invoke `runDoctor`. A consumer running `dev-tasks install --profile claude` today receives no automatic notice that `git-guard.sh` is unwired; they would need to separately think to run `dev-tasks doctor`.
  - `docs/dev-tasks-user-manual.md`, "Install-If-Absent Files" table, `Purpose` column for `.claude/settings.json`: "Wires the shipped Claude hook scripts (`.claude/hooks/*.sh`) into Claude Code's `PreToolUse` lifecycle." As shipped by this PR alone, the delivered file wires nothing (`PreToolUse: []`) — this line describes the file's _end-state_ purpose without a caveat that, as of v0.13 task 1.0, the array is empty pending task 2.0. A reader consulting only this manual page (not the ADR or task list) would reasonably believe hooks are wired today.
  - This is consistent with the pre-existing `doctor` UX pattern (all its checks — Node version, git version, cache dir, version skew — are opt-in/manual today, not new to this PR), so it is not a regression this PR introduced into the CLI's behavior; it is a documentation-wording gap this PR's own new content introduced.
- **Recommendation:** a one-line addition to the manual table (e.g., "as of v0.13 task 1.0, ships with an empty `PreToolUse`/`permissions.allow`; content lands with #170/#174") would close this without any code change. Suitable for `technical-writer`/`developer` as a small follow-up, not a blocker for this PR.
- **Non-blocking note:** this drift does not block PR/issue completion.

## Edge-case and randomized test outcomes

No prior `verifier` Design Mode test plan exists scoped specifically to issue #169/PR #180 as a standalone plan file; `workstream/test-plan-claude-runtime-parity.md` (CP-01) covers the whole 11-task parity plan. CP-01's positive/negative assertions (fresh-install wiring, byte-identical survival under `install`/`update`, doctor warn/silent) were checked against the delivered test files and are satisfied at the level the scope note narrows AC-1 to (see D1). No randomized/fuzz tests are part of task 1.0's scope; none were expected and none were found missing.

## Recommendations

| Item                                                                                                       | Next step                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1 (deferred wiring content, test-plan/traceability wording not updated to match the task-list scope note) | No action needed from `developer` — already reconciled at the task-list/ADR/issue level. Optional: `product-engineer` (`activity-drift-reconciliation`) may propagate the same scope-note annotation into `workstream/test-plan-claude-runtime-parity.md` CP-01 and `workstream/traceability-matrix-claude-runtime-parity.md` Task 1.0 row for internal consistency, since those files currently read as if AC-1's literal wording still applies unqualified. |
| D2 (user manual overstates current wiring state; `doctor` not auto-run on `install`)                       | `developer` follow-up (small doc-only edit) to add a current-state caveat to the Install-If-Absent Files table in `docs/dev-tasks-user-manual.md`. No action needed on the `doctor`-not-auto-run behavior itself — it matches existing product convention and is out of task 1.0's stated scope.                                                                                                                                                              |

## Independent verification performed

- Read full diff of `core/distribution/{profiles,install-if-absent,install,update,doctor,index}.ts`, `bundle-manifest.json`, `templates/claude/settings.json` between `cc05858` (pre-PR) and `origin/issue/169-claude-settings-deliverable`.
- Read `docs/adr/ADR-006-claude-settings-ownership.md` in full.
- Read `workstream/tasks-claude-runtime-parity-plan.md` parent task 1.0 and its scope note, and issue #169's body/AC checklist via `gh issue view`.
- Read `workstream/test-plan-claude-runtime-parity.md` (CP-01) and `workstream/traceability-matrix-claude-runtime-parity.md` (Task 1.0 row) from disk.
- Ran `pnpm vitest run test/unit/distribution-profiles.test.ts test/unit/distribution-install.test.ts test/unit/distribution-update.test.ts test/unit/claude-hooks-wiring.test.ts` directly against the checked-out PR branch: **4 files, 117 tests, all passing.**
- Cross-checked `package.json` `files[]` includes `templates/` (covers `templates/claude/`).
- Read the `developer` subagent's self-posted "verifier audit" and "qa-engineer completion gate" PR comments and compared their claims against the above.

## Output contract

- Mode: Audit
- Source artifact: `workstream/tasks-claude-runtime-parity-plan.md` (task 1.0), issue #169 body, PR #180 diff
- Output file: `/workstream/fidelity-report-169.md` (this file)
- GitHub issue link: to be posted as a comment on issue #169 / PR #180 by the invoking `planner`
- AC coverage: 4/4 covered (AC-1–AC-4), all Pass
- Overall fidelity verdict: **High**
- Highest drift impact: **Minor** (2 items, both non-blocking: D1 Intended, D2 Unintended)
- Blocking gaps: none
