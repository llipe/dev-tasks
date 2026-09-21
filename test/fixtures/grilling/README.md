# Grilling scenario fixtures

Fixture transcripts for the `activity-grill` skill (issue #213, story S-001)
and its callers (issue #214, story S-002; issue #215, story S-003; issue
#216, story S-004).
Grilling sessions are conversational, not scripted — there is no automated
transcript runner (specification §14, D-49/D-48 precedent against adding
machinery `SIMPLICITY.md` A4 would flag). These fixtures are **read and
walked manually during review**: for each one, read `.claude/skills/activity-grill/SKILL.md`
(and, for the caller-integration scenarios, `.claude/skills/activity-refine/SKILL.md`
or `.claude/skills/activity-generate-spec/SKILL.md`)
side by side with the transcript and confirm the skill's stated rules
produce the transcript's outcome, not a different one.

| Fixture                        | Scenario                                                     | Verifies                              |
| ------------------------------- | -------------------------------------------------------------- | -------------------------------------- |
| `codebase-answerable.md`        | A question the codebase already answers is resolved silently  | AC-1, FR-3, S-001-AC-1/3                |
| `cap-reached.md`                 | The question cap is reached mid-session                       | AC-5, FR-9, S-001-AC-4/5                |
| `premature-confirmation.md`      | User replies "sounds good" after the open list empties        | AC-6, FR-8, S-001-AC-6                  |
| `issue-mode-reuse.md`            | Issue Mode reuses a matching prior decision instead of asking  | AC-7, FR-10, S-001-AC-3/7, S-002-AC-2, plus `decisions-other-feature.md` |
| `prd-creation-gate.md`           | `activity-refine` PRD Creation mode blocks drafting until the exit gate is satisfied, then cites decisions inline and populates `## Decisions` | S-002-AC-1, S-002-AC-3, FR-12, FR-14, AC-01, AC-05 |
| `spec-generation-gate.md`        | `activity-generate-spec` blocks drafting until the HOW-phase exit gate is satisfied, confirms the pre-step `researcher` call is sequenced first, then cites decisions inline and populates `## Decisions (HOW phase)` continuing the WHAT phase's ID space | S-003-AC-1, S-003-AC-2, S-003-AC-3, FR-13, FR-14, AC-02 |
| `plan-decision-citations.md`     | `plan` generates a task list from `specification-shared-understanding-phase-2.md` §8, citing D-53-D-56 inline where traceable and populating `## Decisions Consumed`; untraceable sub-tasks cite none | S-004-AC-1, S-004-AC-2, FR-16 |

A skill revision that would make one of these transcripts' outcome
impossible (e.g., removing the exit-gate re-ask, or letting the cap
auto-continue) is a regression, even though nothing here executes it.
