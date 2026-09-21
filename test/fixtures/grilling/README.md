# Grilling scenario fixtures

Fixture transcripts for the `activity-grill` skill (issue #213, story S-001).
Grilling sessions are conversational, not scripted — there is no automated
transcript runner (specification §14, D-49/D-48 precedent against adding
machinery `SIMPLICITY.md` A4 would flag). These fixtures are **read and
walked manually during review**: for each one, read `.claude/skills/activity-grill/SKILL.md`
side by side with the transcript and confirm the skill's stated rules
produce the transcript's outcome, not a different one.

| Fixture                        | Scenario                                                     | Verifies                              |
| ------------------------------- | -------------------------------------------------------------- | -------------------------------------- |
| `codebase-answerable.md`        | A question the codebase already answers is resolved silently  | AC-1, FR-3, S-001-AC-1/3                |
| `cap-reached.md`                 | The question cap is reached mid-session                       | AC-5, FR-9, S-001-AC-4/5                |
| `premature-confirmation.md`      | User replies "sounds good" after the open list empties        | AC-6, FR-8, S-001-AC-6                  |
| `issue-mode-reuse.md`            | Issue Mode reuses a matching prior decision instead of asking  | AC-7, FR-10, S-001-AC-3/7, plus `decisions-other-feature.md` |

A skill revision that would make one of these transcripts' outcome
impossible (e.g., removing the exit-gate re-ask, or letting the cap
auto-continue) is a regression, even though nothing here executes it.
