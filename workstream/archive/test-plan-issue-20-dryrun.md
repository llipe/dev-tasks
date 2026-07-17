# Test Plan — Issue #20: Kiro Guard Hook (Best-Effort, Fail-Loud)

_Dry-run produced by the `verifier` agent in Design Mode, for AC-7 (Design-mode parity) verification of issue #11. This is a demonstration artifact against a previously closed issue's AC list — not a live pre-implementation trigger._

## Source Input Summary

Story input: issue #20 acceptance criteria (5 ACs covering hook wiring, ported script logic, exit-code/fail-loud behavior, documentation gap disclosure, and no false-equivalence claims).

## Acceptance Criteria Extraction

- AC-1: `.kiro/hooks/git-guard.json` exists, wired to `PreToolUse` for shell/run-command tools.
- AC-2: `.kiro/hooks/scripts/git-guard.sh` is a trimmed port of `.claude/hooks/git-guard.sh`'s matching logic.
- AC-3: Exit 2 only on confirmed violation; exit 0 on no violation; exit 0 + stderr warning on missing/empty context.
- AC-4: `.kiro/steering/` and `README.md` explicitly state the enforcement gap.
- AC-5: Documentation does not claim equivalence to `git-guard.sh`.

## E2E Scenarios

### SC-1: Push to main is blocked

| Field               | Value                                                     |
| ------------------- | --------------------------------------------------------- |
| **AC(s)**           | AC-1, AC-3                                                |
| **Type**            | happy-path                                                |
| **Severity**        | critical                                                  |
| **Preconditions**   | Hook is enabled and receives a non-empty command payload. |
| **Steps**           | 1. Trigger `PreToolUse` with `git push origin main`.      |
| **Expected Result** | Hook exits 2, stderr shows a BLOCKED message.             |
| **Pass Criteria**   | Exit code is 2.                                           |

### SC-2: Safe branch push is allowed

| Field               | Value                                                          |
| ------------------- | -------------------------------------------------------------- |
| **AC(s)**           | AC-3                                                           |
| **Type**            | happy-path                                                     |
| **Severity**        | major                                                          |
| **Preconditions**   | Hook enabled.                                                  |
| **Steps**           | 1. Trigger `PreToolUse` with `git push origin feature-branch`. |
| **Expected Result** | Hook exits 0, no output.                                       |
| **Pass Criteria**   | Exit code is 0.                                                |

### SC-3: Empty payload fails loud

| Field               | Value                                               |
| ------------------- | --------------------------------------------------- |
| **AC(s)**           | AC-3                                                |
| **Type**            | negative-path                                       |
| **Severity**        | critical                                            |
| **Preconditions**   | Hook enabled.                                       |
| **Steps**           | 1. Trigger `PreToolUse` with an empty `{}` payload. |
| **Expected Result** | Hook exits 0 but prints a warning to stderr.        |
| **Pass Criteria**   | Exit code is 0 AND stderr is non-empty.             |

## Contract Validation Scenarios

### CT-1: `PreToolUse` payload shape tolerance

| Field               | Value                                                                                |
| ------------------- | ------------------------------------------------------------------------------------ |
| **AC(s)**           | AC-1, AC-3                                                                           |
| **Contract type**   | consumer-driven                                                                      |
| **Boundary**        | `.kiro/hooks/scripts/git-guard.sh` stdin                                             |
| **Direction**       | request                                                                              |
| **Input**           | JSON payload with command under `.tool_input.command` instead of `.toolArgs.command` |
| **Expected Result** | Script's fallback field extraction still finds the command and evaluates it.         |
| **Pass Criteria**   | Same block/allow outcome as the canonical field name.                                |

## Edge-Case Catalog

- **Input Domain:** Command string containing embedded newlines or shell metacharacters — N/A category evaluated, concrete case: `git commit -m "feat: x\nfix: y"` (multi-line -m). Risk if missed: message-parsing regex could misfire on multi-line input.
- **Auth & Permissions:** N/A — hook has no auth surface.
- **Idempotency:** Running the hook twice on the identical payload — must produce the identical exit code both times (no hidden state). Risk if missed: non-deterministic blocking.

## Randomized Tactics and Seed Policy

### RT-1: Fuzz commit message formats

| Field                  | Value                                                                                                          |
| ---------------------- | -------------------------------------------------------------------------------------------------------------- |
| **AC(s)**              | AC-3                                                                                                           |
| **Tactic type**        | fuzz                                                                                                           |
| **Input surface**      | `-m "<message>"` string                                                                                        |
| **Property/Oracle**    | Only messages matching the Conventional Commits regex are allowed through (exit 0); all others block (exit 2). |
| **Iterations**         | 100                                                                                                            |
| **Seed**               | `fuzz-AC3-{timestamp}-{hex}`                                                                                   |
| **Replay instruction** | `test-runner --seed=<seed> --tactic=RT-1 --iterations=1`                                                       |
| **Shrink strategy**    | Minimize message string while preserving mismatch.                                                             |

## Execution Checklist

- [ ] SC-1, SC-2, SC-3 executed
- [ ] CT-1 executed
- [ ] Edge cases evaluated
- [ ] RT-1 executed with seed capture

## Traceability Matrix

| AC-ID | Test-Case-ID                              | Observed-Result                 | Pass/Fail/Drift                                          |
| ----- | ----------------------------------------- | ------------------------------- | -------------------------------------------------------- |
| AC-1  | Manual JSON structural review             | Matches claim                   | Pass (not re-executed as automated test in this dry-run) |
| AC-2  | Diff against `.claude/hooks/git-guard.sh` | Matches claim                   | Pass (not re-executed in this dry-run)                   |
| AC-3  | SC-1, SC-2, SC-3, RT-1                    | Not re-executed in this dry-run | Pending (would require live synthetic stdin harness)     |
| AC-4  | Manual doc review                         | Matches claim                   | Pass                                                     |
| AC-5  | Manual doc review                         | Matches claim                   | Pass                                                     |
