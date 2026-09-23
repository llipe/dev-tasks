# Traceability Matrix — claude-runtime-parity

**Status:** Design complete
**Scope:** Parent tasks 1.0–11.0 / issues #169–#179, milestone `v0.13 — Claude runtime parity and enforcement delivery`
**Source:** `workstream/tasks-claude-runtime-parity-plan.md`; issue bodies for #169–#179 (Acceptance Criteria checklists, treated as authoritative per-task AC)
**Test plan:** `workstream/test-plan-claude-runtime-parity.md`

## Result legend

- **Planned:** Test-first scenario designed; implementation has not supplied evidence yet.
- **Pass / Fail / Drift:** Reserved for Audit Mode after implementation.
- **Blocked:** Required evidence, decision, or safe environment unavailable; state the reason rather than claiming coverage.

Every AC maps to at least one positive and one negative/edge assertion, except where an AC is inherently observational (runtime model selection, a live multi-turn agent session) — those are marked "Manual" and still carry a supplemental automated proxy assertion where one exists. Test IDs refer to the consolidated plan.

## Task 1.0 — Make `.claude/settings.json` deliverable (#169)

| AC                                                                      | Positive test(s)                                                              | Negative / edge test(s)                                                      | Evidence / status   |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------- |
| AC-1 fresh install wires every shipped hook                             | CP-01 fresh-install assertion; CT-01 matcher schema                           | CT-02 `templates/claude` absent from `managed_paths` fails                   | Automated — Planned |
| AC-2 install-if-absent survives update, byte-identical                  | CP-01 modified-file survives install/update; CT-03 install-if-absent category | EC-02 repeated install→update→install cycle; EC-04 idempotent double-install | Automated — Planned |
| AC-3 `doctor` warns on hooks-present/settings-absent, silent when wired | CP-01 `doctor` positive case                                                  | CT-04 false-positive/false-negative negative cases                           | Automated — Planned |
| AC-4 gates pass                                                         | `pnpm run test:unit`, `pnpm run test:integration`, `pnpm run validate`        | Any suite failure blocks completion                                          | Automated — Planned |

## Task 2.0 — Restore deterministic enforcement on Claude (#170, depends on 1.0)

| AC                                                      | Positive test(s)                                                                     | Negative / edge test(s)                              | Evidence / status                                  |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------- | -------------------------------------------------- |
| AC-1 Edit/Write blocked on main, passes on issue branch | CP-02 direct `branch-guard.sh` invocation, both branches; CT-01 matcher registration | CT-05 missing-repo fail-open case                    | Automated + manual (live Claude session) — Planned |
| AC-2 docs describe shipped Claude state accurately      | CP-02 doc-accuracy assertion                                                         | CP-02 stale "Kiro-only" claim left uncorrected fails | Automated (content scan) — Planned                 |
| AC-3 gates pass                                         | `pnpm run test:unit`, `pnpm run validate`                                            | Any suite failure blocks completion                  | Automated — Planned                                |

## Task 3.0 — Deliver Claude root context to consumers (#171, depends on 1.0)

| AC                                                                   | Positive test(s)                                                                                  | Negative / edge test(s)                            | Evidence / status   |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ------------------- |
| AC-1 fresh install yields project memory                             | CP-03 fresh-install produces `CLAUDE.md`/`AGENTS.md` with git invariants; CT-03 install-if-absent | CT-07 profile missing always-on context fails      | Automated — Planned |
| AC-2 existing consumer `CLAUDE.md` survives install/update unchanged | CP-03 unchanged-file assertion                                                                    | EC-02 install→update→install cycle preserves edits | Automated — Planned |
| AC-3 gates pass                                                      | `pnpm run test:integration`, `pnpm run validate`                                                  | Any suite failure blocks completion                | Automated — Planned |

## Task 4.0 — Resolve the Next.js conventions parity claim (#172, independent)

| AC                                                          | Positive test(s)                                | Negative / edge test(s)                                           | Evidence / status                                                                                                            |
| ----------------------------------------------------------- | ----------------------------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| AC-1 no file claims a nonexistent Claude delivery mechanism | CP-04 full-repository scan, resolution-agnostic | CP-04 half-updated doc (one file corrected, its pair stale) fails | Automated (content scan) — Planned; **Blocked** on the 4.1 withdraw-vs-scaffold decision being recorded before final scoring |
| AC-2 gates pass                                             | `pnpm run test:unit`, `pnpm run format:check`   | Any suite failure blocks completion                               | Automated — Planned                                                                                                          |

## Task 5.0 — Remove Kiro-ism / collapse developer command duplication (#173, independent)

| AC                                                                              | Positive test(s)                                                             | Negative / edge test(s)                                                  | Evidence / status   |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ------------------- |
| AC-1 `/developer` and subagent resolve to one behavioral contract               | CP-05 size-cap/duplication test on the command; thin-wrapper shape assertion | CP-05 restated Non-Negotiable Operating Rules block in the command fails | Automated — Planned |
| AC-2 no `.claude` file references Kiro steering/`fileMatch`/`applyTo` semantics | CP-05 repository grep sweep                                                  | CP-05 reintroduced "Steering Context Check" block fails                  | Automated — Planned |
| AC-3 existing `developer` parity tests still pass against the reduced command   | CP-05 parity-suite re-run against the collapsed command                      | Parity suite regression on the reduced file fails                        | Automated — Planned |
| AC-4 gates pass                                                                 | `pnpm run test:unit`, `pnpm run validate`                                    | Any suite failure blocks completion                                      | Automated — Planned |

## Task 6.0 — Cost controls: subagent models and permission allowlist (#174, 6b depends on 1.0)

| AC                                                                       | Positive test(s)                                                      | Negative / edge test(s)                                                                       | Evidence / status   |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------- |
| AC-1 delegated mechanical-agent run executes on the smaller model        | Manual observational check (session metadata)                         | N/A — no deterministic negative for a runtime-only property                                   | Manual — Planned    |
| AC-2 no allowlisted command can push/merge/commit/tag/write              | CP-06 allowlist content assertion; CT-06 frontmatter/allowlist schema | CP-06 write-capable pattern injected into `permissions.allow` fails the scan                  | Automated — Planned |
| AC-3 hook guards still block their four invariants with allowlist active | CP-06 guard-still-blocks assertion                                    | EC-06 allowlisted read-only command coexists with a blocked write attempt in the same session | Automated — Planned |
| AC-4 gates pass                                                          | `pnpm run test:unit`, `pnpm run validate`                             | Any suite failure blocks completion                                                           | Automated — Planned |

## Task 7.0 — Tool-declaration parity test (#175, independent, contingent on 7.1 decision)

| AC                                                             | Positive test(s)                                                                             | Negative / edge test(s)                                                               | Evidence / status                                                                                   |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| AC-1 test fails when `Task` is removed from a qualifying agent | CP-07 mutation test (remove `Task`, confirm failure)                                         | N/A — this AC is itself the negative-proof requirement                                | Automated — Planned                                                                                 |
| AC-2 suite green, or single documented+linked expected failure | CP-07 full-suite pass under option (a); CP-07 single-expected-failure check under option (b) | CP-07 more than one red case, or an unlinked/dangling tracking-issue reference, fails | Automated — Planned; **Blocked** on the 7.1 decision (a) vs (b) being recorded before final scoring |
| AC-3 gates pass                                                | `pnpm run test:unit`, `pnpm run validate`                                                    | Any suite failure blocks completion                                                   | Automated — Planned                                                                                 |

## Task 8.0 — Installed-state parity test (#176, depends on 1.0, 2.0, 3.0)

| AC                                                                 | Positive test(s)                                                      | Negative / edge test(s)                                               | Evidence / status   |
| ------------------------------------------------------------------ | --------------------------------------------------------------------- | --------------------------------------------------------------------- | ------------------- |
| AC-1 fails if `.claude/settings.json` removed from install path    | CP-08 enforcement-surface comparison, all profiles                    | CP-08 deliberate settings.json removal fails the test                 | Automated — Planned |
| AC-2 fails if a hook ships without a matching trigger registration | CP-08 hooks-wired assertion                                           | CP-08 stripped `PreToolUse` entry with script still present fails     | Automated — Planned |
| AC-3 passes for all three profiles and `--profile all`             | CP-08 per-profile + `all` sweep; CT-07 asymmetry/ownership assertions | CP-08 undocumented/widened asymmetry fails; EC-... unowned path fails | Automated — Planned |
| AC-4 gates pass                                                    | `pnpm run test:integration`, `pnpm run validate`                      | Any suite failure blocks completion                                   | Automated — Planned |

## Task 9.0 — Fix the `planner` merge path (#177, depends on 1.0 — confirmed live defect)

| AC                                                                        | Positive test(s)                                                                            | Negative / edge test(s)                                                                                                         | Evidence / status           |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| AC-1 story-PR merge into integration succeeds end to end, PR shows merged | CP-09 base-resolution success case; CP-09 planner post-merge verification confirms `MERGED` | CP-09 raw-git escape (`git merge` into `integration/*`) blocked; EC-03 stale-base timing case; EC-04 idempotent re-verification | Automated — Planned         |
| AC-2 every route into the default branch blocked                          | CP-09 `gh pr merge`/`--admin`/`--auto`/`git merge`-on-default/`git push`-to-default matrix  | RT-01 fuzzed command matrix; EC-05 fail-closed on lookup failure                                                                | Automated + RT-01 — Planned |
| AC-3 `master`/`trunk` default branch receives identical protection        | CP-09 fallback-chain resolution test; RT-03 fallback-chain fuzzing                          | EC-09 each fallback link failing in turn                                                                                        | Automated + RT-03 — Planned |
| AC-4 gates pass                                                           | `pnpm run test:unit`, `pnpm run validate`                                                   | Any suite failure blocks completion; RT-02 rule-4 anchoring regression                                                          | Automated — Planned         |

## Task 10.0 — Close the MCP bypass, establish branch-protection gate (#178, depends on 9.0)

| AC                                                                     | Positive test(s)                                              | Negative / edge test(s)                                                                               | Evidence / status           |
| ---------------------------------------------------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | --------------------------- |
| AC-1 MCP merge attempt blocked by hook                                 | CP-10 matcher-coverage test; RT-04 fuzzed `tool_input` shapes | CP-10 non-mutating MCP call must not be blocked (overreach guard); RT-04 malformed payload fails safe | Automated + RT-04 — Planned |
| AC-2 branch protection fails the merge server-side with hooks disabled | Manual live test on a disposable protected repo               | N/A — inherently requires a real GitHub server-side control                                           | Manual — Planned            |
| AC-3 gates pass                                                        | `pnpm run test:unit`, `pnpm run validate`                     | Any suite failure blocks completion                                                                   | Automated — Planned         |

## Task 11.0 — Never route around a blocked guard — behavioral rules (#179, lands with/after 9.0)

| AC                                                                                   | Positive test(s)                                                      | Negative / edge test(s)                                                                                 | Evidence / status   |
| ------------------------------------------------------------------------------------ | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------- |
| AC-1 `/planner` run against a blocked merge stops and reports, integration untouched | Manual live `/planner` run against an injected block                  | N/A — requires a live multi-turn agent session                                                          | Manual — Planned    |
| AC-2 every guard block message names a permitted path or owner                       | CP-11 message-content scan, all four rules including corrected rule 3 | CP-11 rule-3-style nonexistent-flag message fails (direct regression guard for the task 9.0 root cause) | Automated — Planned |
| AC-3 gates pass                                                                      | `pnpm run test:unit`, `pnpm run format:check`                         | Any suite failure blocks completion                                                                     | Automated — Planned |

## Coverage summary

| Scope            | ACs mapped | Positive coverage   | Negative/edge coverage                  | Status                                           |
| ---------------- | ---------: | ------------------- | --------------------------------------- | ------------------------------------------------ |
| Task 1.0 (#169)  |          4 | CP-01, CT-01–CT-04  | CP-01, EC-02, EC-04, CT-02, CT-04       | Covered / Planned                                |
| Task 2.0 (#170)  |          3 | CP-02, CT-01        | CP-02, CT-05                            | Covered / Planned                                |
| Task 3.0 (#171)  |          3 | CP-03, CT-03        | CP-03, EC-02, CT-07                     | Covered / Planned                                |
| Task 4.0 (#172)  |          2 | CP-04               | CP-04                                   | Covered / Planned (Blocked pending 4.1 decision) |
| Task 5.0 (#173)  |          4 | CP-05               | CP-05                                   | Covered / Planned                                |
| Task 6.0 (#174)  |          4 | CP-06, CT-06        | CP-06, EC-06                            | Covered (AC-1 manual) / Planned                  |
| Task 7.0 (#175)  |          3 | CP-07               | CP-07                                   | Covered / Planned (Blocked pending 7.1 decision) |
| Task 8.0 (#176)  |          4 | CP-08, CT-07        | CP-08                                   | Covered / Planned                                |
| Task 9.0 (#177)  |          4 | CP-09, RT-01, RT-03 | CP-09, EC-03, EC-05, EC-09, RT-01–RT-03 | Covered / Planned                                |
| Task 10.0 (#178) |          3 | CP-10, RT-04        | CP-10, RT-04                            | Covered (AC-2 manual) / Planned                  |
| Task 11.0 (#179) |          3 | CP-11               | CP-11                                   | Covered (AC-1 manual) / Planned                  |

**AC coverage status:** 100% designed; 0% executed. Two rows (Task 4.0, Task 7.0) carry a `Blocked` qualifier pending their respective decision points being recorded — this reflects the design honestly rather than presupposing an outcome. Audit Mode MUST replace each `Planned` status with observed evidence after implementation, or mark it `Blocked` with missing evidence, per parent-task PR.
