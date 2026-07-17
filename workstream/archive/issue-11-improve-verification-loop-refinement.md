# Issue Refinement: 11 - Improve verification loop

## Changelog

| Version | Date       | Summary                                                                                                    | Author           |
| ------- | ---------- | ------------------------------------------------------------------------------------------------------------ | ---------------- |
| 1.0     | 2026-07-14 | Initial refinement                                                                                            | product-engineer |
| 1.1     | 2026-07-14 | Resolved Q1 (eliminate `black-box-tester`, full merge into `verifier`) and Q4 (drift-driven task-list expansion via `product-engineer` instead of direct developer defect handoff) | product-engineer |
| 1.2     | 2026-07-14 | Confirmed Q4 closed-task-list follow-up behavior. Split scope per Q5: this issue (#11) now covers only the `verifier` agent + report format + `black-box-tester` elimination. Trigger wiring (developer/planner mandatory audit calls) and drift reconciliation wiring (product-engineer task-list/PRD/spec updates, github-ops issue creation) moved to a new linked issue. | product-engineer |

## Summary

- **Goal:** Replace `black-box-tester` with a single, consistently-triggered **`verifier`** agent that owns both test-plan design and post-implementation fidelity auditing. `black-box-tester` is eliminated because its results were not surfacing reliably — folding design + audit into one agent with mandatory trigger points removes the "forgot to invoke it" failure mode. The verifier judges whether delivered work is _faithful_ to what was intended by cross-checking four sources: the codebase implementation, the `/workstream` artifacts, the test suite (tests vs. acceptance criteria), and the originating PRD/spec. When drift is detected, it is classified by impact and intent. Unintended drift is routed back into the **task list** (expanded by `product-engineer`, with a corresponding GitHub issue/sub-task) rather than handed directly to `developer` as an ad hoc defect. Intended drift is written back into PRD/spec by `product-engineer`. The loop also emits human-readable "what changed and why" summaries.
- **Primary user impact:** Teams get one reliable, mandatorily-triggered fidelity check instead of an optional, easily-skipped one. Drift is surfaced clearly (with impact classification) and flows through the same task-list/issue mechanism already used to track work, so nothing gets lost outside of GitHub. PRD/spec stay aligned with reality when drift is accepted.
- **Non-goals:**
  - The verifier **MUST NOT** edit application code, PRD, or spec directly (task-list expansion and defect framing is proposed by verifier but applied by `product-engineer`; PRD/spec write-back is performed by `product-engineer`).
  - Drift detection **MUST NOT** be a hard blocker of PR/issue completion (see AC-7).
  - Not building a new CI system; this is an agent-workflow capability layered on the existing GitHub-as-source-of-truth model.
  - `black-box-tester` as a standalone agent is removed from the framework (superseded by `verifier`), not deprecated-in-place.

## Scope

> **Split notice (v1.2):** This issue (#11) is now scoped to delivering the `verifier` agent itself, its report format, and the elimination of `black-box-tester`. Wiring `verifier` into `developer`/`planner` as a mandatory trigger, and the drift-reconciliation flow into `product-engineer`/`github-ops` (task-list expansion, PRD/spec write-back, new-issue creation), are moved to a linked follow-up issue (see **Dependencies**). The two issues are tagged to make the split traceable and avoid duplicate work.

### In scope (this issue, #11)

1. **New agent: `verifier`.** Fully replaces `black-box-tester`. Owns both test-plan design (E2E/contract/edge/random test design — the skills `black-box-tester` used) and post-implementation fidelity auditing, as two invocation modes (`design` and `audit`) of one agent.
2. **Eliminate `black-box-tester`.** Its agent file is removed from `.kiro/agents/` (and platform mirrors). Its design-time skills (`activity-e2e-test-design`, `activity-contract-test-design`, `activity-edge-case-refinement`, `activity-random-test-tactics`) are retargeted to `verifier` as their primary consumer. No agent is left invoking `black-box-tester`.
3. **Grey-box audit capability.** The verifier reads implementation source + tests (not observable behavior only) and cross-checks them against acceptance criteria and the PRD/spec, producing a fidelity report with per-AC results.
4. **Drift classification (non-blocking) — report schema.** Every detected drift is classified by impact (e.g., Critical / Major / Minor) and by intent (Intended / Unintended / Undetermined). Results are surfaced prominently in the report. (The *routing* of that classification into task-list/PRD/spec updates is the follow-up issue's scope; this issue defines the classification and report itself.)
5. **Human-readable summary format.** Plain-language "what changed and why" summary section, part of the report artifact format.
6. **Framework doc updates.** `AGENTS.md`, agent/skill tables, and workflow chains updated to remove `black-box-tester` and add `verifier` (delegated to `technical-writer`).

### In scope (follow-up issue — see Dependencies)

- Mandatory two-level trigger wiring (`developer` per-issue, `planner` per-story and rollup).
- Drift reconciliation flow: unintended drift → `product-engineer` expands task list + GitHub checklist (+ new issue via `github-ops` when warranted); intended drift → `product-engineer` updates PRD/spec with changelog bump.
- Publishing the summary to GitHub issue/PR comments (this issue defines the format; the follow-up issue wires the actual posting as part of the trigger flow).
- Closed-task-list edge case: `product-engineer` opens a new follow-up issue/task list instead of reopening a closed one.

### Out of scope

- Editing application code, PRD, spec, or the task list directly by the verifier itself — it reports findings; `product-engineer` applies task-list/PRD/spec changes, `developer` applies code changes.
- Hard-gating completion on drift.
- Replacing existing quality gates (test/lint/format/typecheck/audit); the fidelity audit is additive.
- Retaining `black-box-tester` in any form (fully superseded, not deprecated-in-place).

## Acceptance Criteria

> Scoped to this issue (#11): the `verifier` agent, its report format, and `black-box-tester` elimination. Triggering and reconciliation-flow ACs live in the linked follow-up issue.

- [ ] **AC-1 — Verifier agent exists.** A `verifier` agent definition is added under `.kiro/agents/` (and mirrored per platform conventions), with `design` and `audit` invocation modes, phases, and output contract. _Validation: file present + AGENTS.md registry row; manual review._
- [ ] **AC-2 — black-box-tester eliminated.** Given the current `black-box-tester`, when `verifier` is introduced, then `black-box-tester`'s agent file is deleted, no workflow chain or agent references it, and `AGENTS.md` reflects `verifier` in its place. _Validation: file absence + repo-wide reference search + AGENTS.md parity check._
- [ ] **AC-3 — Grey-box fidelity audit.** Given a completed implementation with its PRD/spec and tests, when the verifier runs `audit` mode, then it produces a fidelity report cross-checking (a) codebase implementation, (b) `/workstream` artifacts, (c) tests vs. acceptance criteria, and (d) PRD/spec intent, with per-AC results. _Validation: sample audit run produces a report covering all four sources._
- [ ] **AC-4 — Drift classification schema, non-blocking by design.** Given detected drift, when the audit reports, then each drift item carries an impact class (Critical/Major/Minor) and an intent class (Intended/Unintended/Undetermined), and the report format explicitly states drift is non-blocking to completion. _Validation: report schema/template includes both classifications and the non-blocking statement._
- [ ] **AC-5 — Human-readable summary format.** Given any audit run, when the report is produced, then it includes a plain-language "what changed and why" summary section, readable without implementation jargon. _Validation: sample report reviewed for jargon-free summary section._
- [ ] **AC-6 — Clarity of verdict.** Given any audit run, when the report is produced, then the overall fidelity verdict and highest drift impact are crystal clear at the top of the artifact. _Validation: manual review of report header._
- [ ] **AC-7 — Design-mode parity.** Given a spec or story input, when `verifier` runs `design` mode, then it produces the same test-plan and traceability-matrix artifacts `black-box-tester` used to produce, with no loss of capability. _Validation: sample design-mode run compared against prior `black-box-tester` design-mode output structure._
- [ ] **AC-8 — Follow-up issue linkage.** Given this issue's scope boundary, when the refinement is published, then a linked follow-up issue exists covering trigger wiring and drift reconciliation, cross-referenced from both issue bodies. _Validation: both issues exist and reference each other._

## Constraints

- Must conform to `github-ops` conventions for any issue/PR/label/comment changes.
- Outputs are English-only; documents carry a changelog table.
- Must preserve the existing approval-gated nature of PRD/spec — write-back requires human confirmation of intent.
- Must align with the existing GitHub-as-source-of-truth and step-gated `implement` workflow; the audit is additive and must not bypass existing quality gates.
- For JS/TS target repos, any commands referenced in audit tasks use `pnpm` and canonical script names.

## Risks and Edge Cases

- **Dangling references to `black-box-tester`** after elimination — any agent/skill/prompt still mentioning it would break the chain. Mitigation: AC-2 requires a repo-wide reference search as part of validation.
- **Overlap with technical-writer drift check** — technical-writer checks `/docs` drift; verifier checks implementation-vs-PRD/spec fidelity. Boundaries must be stated to avoid duplicate/conflicting reports.
- **Intent misclassification** — agent marks drift Intended without human confirmation. Mitigation: the report only classifies; the human-confirmation gate before any write-back is enforced in the follow-up issue's reconciliation flow, not in this issue's report generation.
- **Edge: no PRD/spec exists** (single-issue quick-fix path) — verifier should degrade gracefully to auditing against the refined issue + ACs, and say so.
- **Edge: no tests exist** — audit must report the tests-vs-AC gap explicitly rather than passing silently.
- **Edge: drift with Undetermined intent** — must be surfaced clearly, not auto-routed to Intended or Unintended.
- **Scope-split risk:** without cross-referencing, the follow-up issue could be started/implemented against a `verifier` report format that later changes. Mitigation: AC-8 requires explicit cross-referencing between the two issues, and the follow-up issue should not start implementation until this issue's report format is merged.
- **Deferred to follow-up issue:** task-list churn from Unintended drift, partial-multi-story rollup scoping, and closed-task-list reopening — these depend on trigger wiring, which is out of scope here.

## Dependencies

- `technical-writer` — updates `AGENTS.md`, tables, workflow chains, and `/docs`; removes `black-box-tester` references.
- Design-time test skills (`activity-e2e-test-design`, `activity-contract-test-design`, `activity-edge-case-refinement`, `activity-random-test-tactics`) — retargeted from `black-box-tester` to `verifier`.
- **Follow-up issue (to be created):** "Wire `verifier` into developer/planner and drift reconciliation flow" — depends on this issue's `verifier` agent and report format being delivered first. Tagged to cross-reference this issue to avoid duplicate/confused scope. Owns: mandatory trigger wiring in `developer`/`planner`, drift reconciliation in `product-engineer` (task-list/PRD/spec updates), and `github-ops` issue-creation flow for drift-driven sub-tasks.

## Testing Notes

- **Unit / structural:** Verify new `verifier` agent file, deletion of `black-box-tester`, and AGENTS.md registry parity (agent row, workflow chains reference only existing activities).
- **Integration (dry-runs):** Run `verifier` in `design` mode against a sample spec/story and confirm parity with prior `black-box-tester` output structure; run `verifier` in `audit` mode against a sample completed implementation and confirm the report covers all four sources with correct drift classification.
- **Manual checks:** Review a sample fidelity report for all four audit sources; confirm verdict + highest drift impact are crystal clear at the top; confirm the report explicitly states non-blocking behavior; confirm the human-readable summary section is jargon-free.
- **Edge-case checks:** no-PRD, no-tests, and Undetermined-intent scenarios each produce a clear, correct report from the `verifier` agent itself (trigger-level edge cases like partial-multi-story and closed-task-list are follow-up-issue concerns).
- **Acceptance-criteria-to-test mapping:** AC-1/AC-2 → structural + repo-wide reference search + AGENTS.md review; AC-3/AC-6 → sample audit report review; AC-4 → report schema/template review; AC-5 → summary section jargon review; AC-7 → design-mode output comparison; AC-8 → cross-reference check between both issues.

## Open Questions

- **Q1 — Resolved.** `black-box-tester` is eliminated; fully merged into `verifier` as `design` + `audit` modes.
- **Q2 — Impact scale wording:** Confirm the impact taxonomy (Critical/Major/Minor) and intent taxonomy (Intended/Unintended/Undetermined), or prefer High/Medium/Low. Also confirm whether low-impact Unintended drift still mandates a task-list entry, or can be logged-only below a configurable impact threshold. (Carried to follow-up issue since it affects the reconciliation flow, but the taxonomy itself is defined in this issue's report schema — needs confirmation before AC-4 is finalized.)
- **Q3 — Summary destination for single-issue path:** For quick-fix issues with no PRD, is the issue comment + `/workstream` artifact sufficient, or is a PR comment required too? (Carried to follow-up issue — publishing/destination is a trigger-flow concern.)
- **Q4 — Resolved.** Drift handling during an active task list: Unintended drift → `product-engineer` expands `/workstream/tasks-*.md` + GitHub checklist (+ new issue if warranted) → `developer` executes the new sub-task(s). Intended drift → `product-engineer` updates PRD/spec with changelog bump, no new task created. When the originating task list is already closed/merged (PRD-level rollup finds drift after the fact), `product-engineer` opens a new follow-up issue/task list rather than reopening a closed one. Confirmed by user; carried into the follow-up issue's scope.
- **Q5 — Resolved.** Split into two issues: this issue (#11, `verifier` agent + report format + `black-box-tester` elimination) and a new follow-up issue (trigger wiring + drift reconciliation flow), cross-tagged to avoid confusion.
