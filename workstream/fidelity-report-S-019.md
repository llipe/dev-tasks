# Fidelity Report: S-019 (#318), type set, priority scale, blocking links

**Fidelity: High** | **Highest drift impact: Minor** | **Drift findings: 8 (all non-blocking)**
Scope: S-019 (#318), PR #326, branch `story/S-019-type-priority-conventions` → `integration/projects-tracking-phase-3`. Audited 2026-10-24 by `verifier` (Audit Mode, grey-box).

## Changelog

| Version | Date       | Summary                    | Author   |
| ------- | ---------- | -------------------------- | -------- |
| 1.0     | 2026-10-24 | Initial Audit Mode report. | verifier |

## What changed and why (plain language)

The instructions the agents follow for GitHub labels now say clearly what each issue label means:

- Every issue gets exactly one "type" from a fixed list of eight. When two types fit, a set order picks the winner. The old catch-all type "other" is retired.
- "Critical" now means "this holds back a wave, PRD or release from shipping". A critical issue has to say which issue it blocks.
- Agents can now record "issue A blocks issue B" with GitHub's built-in issue links. That is ordinary issue data, and it does not touch the GitHub Project board, which agents never edit.
- The repository audit now flags three problems: a critical issue that blocks nothing, an issue with no type or several types, and an open issue that still carries a retired label.
- The product-engineer agent gets three ready-made searches: follow-up work after a wave, bugs to fix, and release blockers.
- Publishing stories now gives each story exactly one type.

The wording is the same in all three tool versions (Claude, Copilot, Kiro), and new automated tests check it. The eight findings are small: one deferral that was planned, some planning documents that still describe an older edge case, and a few wording or robustness gaps. None of them blocks the PR.

## Per-AC results

| AC-ID | Description | Codebase evidence | Workstream evidence | Test evidence | Result |
| ----- | ----------- | ----------------- | ------------------- | ------------- | ------ |
| AC-1 | Type set, D-85 definitions, exactly-one rule, tie-break, `type: test` row, `tech-debt` narrowed, `type: other` retired | github-ops ×3 § Labels: `Type tags:` line (8 types, tie-break order), 8 table rows with D-85 definitions, exactly-one bullet with the tie-break literal, `type: other` retired bullet, old `tech-debt` text gone | Spec §8.5, D-85, D-91, D-100; tasks 1.2, 1.8 | `github-ops > type set` (PT-55 to PT-59, EC-158) green | Pass |
| AC-2 | D-84 priority scale, `**Blocks:**` rule | Four priority rows rewritten; `critical` rule bullet with relation plus `**Blocks:** #N — <reason>`; "any issue that blocks another" bullet with the EC-159 example; never-invent bullet | Spec §8.5, D-84; tasks 1.3, 1.9 | `github-ops > priority scale` (PT-60, PT-61, EC-159) green | Pass (see F5) |
| AC-3 | Dependency POST/DELETE, agent-may-write sentence | Command Map rows: POST literal, DELETE literal as A-89 spells it, plus a list row; notes bullet "Issue dependencies are issue data an agent may write, unlike the Project", numeric-id guidance, D-22 cited | Spec §8.5, §16a A-89, A-74; D-22 (PRD FR-6), D-83 | `github-ops > dependency commands` (PT-62, CT-40) green | Pass |
| AC-4 | Audit: three findings | Audit Mode step 2 has three sub-bullets; critical check reads `dependencies/blocking` (A-72), closed-blocked case not reported (A-72); type check exempts `level: prd`/`level: wave`/tracking issues (A-68); report template gains `## Conventions` | Spec §8.5, §16a A-68, A-69, A-72; tasks 1.5, 1.11 | `github-ops > audit checks` (PT-63, EC-160 per A-72) green | Pass (see F3, F6) |
| AC-5 | product-engineer aggregation queries | New `## Drift Reconciliation` section ×3 with three queries; placed per A-86; refers to rule 9, which exists unchanged in all three copies | Spec §8.5, §16a A-86, D-83 | `product-engineer > aggregation` (PT-64) green; roadmap-parity (LT-18) green | Pass (see F4, F8) |
| AC-6 | Publish: exactly one `type:` per story | activity-publish-github step 4 ×3: exactly one type from the set, tie-break, no zero, two or retired | Spec §8.5, D-85 | `activity-publish-github > one type` (PT-65) green | Pass |
| AC-7 | Parity pins byte-identical; `type: other` negative | Added and removed lines are identical across the three trees for all three files (verified by diffing `git diff` hunks) | Test plan PT-66, PT-58, PT-67 | New file 8 tests green; negatives PT-58, PT-67 green | Pass (see F2) |

Quality gates re-run on HEAD `cdbbe09`: `test` 2424/2424, `lint` (eslint plus `core/checks/run.ts`), `format:check`, `typecheck`, `audit`, `validate` all pass. Wave 1 suite `projects-tracking-parity.test.ts` (PT-28, PT-28b, LT-19, LT-27) green.

Constraint checks:

- **D-22 / no Project writes:** the diff adds no `gh project` command and states "No agent writes the Project (D-22)". Dependency commands write issue data only. No conflict.
- **PT-28b:** no `gh project … item-delete` (or any `gh project` verb) in any changed prompt; PT-28b green.
- **product-engineer `## Drift Reconciliation` vs existing drift text:** the new section sits between Roadmap Maintenance and memo-cli in all three copies. It defers routing to rule 9 ("rule 9 below"), which is unchanged and identical in all three. It adds read-only queries and no new route, gate, or write. Roadmap Maintenance's line about correcting rows during drift reconciliation and the Activity Skills row are consistent with it. It is the only heading containing "Drift" in each file. No conflict found.
- **`Follow-up to #N`:** matches the line `activity-drift-reconciliation` Step 7 writes in all three trees.

## Drift catalog

Every item below is **non-blocking to PR readiness and issue completion**, and routes to `product-engineer`'s `activity-drift-reconciliation`.

| # | Description | Impact | Intent | Evidence | Next step |
| - | ----------- | ------ | ------ | -------- | --------- |
| F1 | PT-81 (prompt type set equals `core/migrate-projects/conventions.ts`, A-87) is not implemented, because `conventions.ts` does not exist yet. | Minor | Intended | Task 1.7a note; planner instruction; test plan §PT-81 | `developer` S-013 (#320) adds PT-81 when it creates `conventions.ts`. |
| F2 | Several new lines are identical today but not pinned for byte-identity: the `Retired labels, in full:` line, the `priority: high … medium … low` prose line, the Command Map list row, and the `## Conventions` template table. A later one-tree edit would pass PT-66. | Minor | Unintended | `test/unit/projects-tracking-wave-3-parity.test.ts`: `expectIdenticalLine` markers cover neither; qa-engineer note | `developer`/`qa-engineer`: add `expectIdenticalLine(trees, "Labels", "Retired labels, in full:")` and `"\`priority: high\` lands"`, and optionally the D-91 list content. |
| F3 | The planning text still states the superseded edge case "a `critical` issue whose blocked issue is closed stays/still reported", which contradicts A-72 and the delivered audit text. #318's body also lacks the v1.1 annotation that the story file carries. | Minor | Unintended | #318 body § Testing Requirements; #318 checklist and `workstream/tasks-projects-tracking-phase-3-plan.md` task 1.13; `workstream/user-stories-projects-tracking-phase-3.md` S-019 § Testing Requirements (the annotation above the ACs overrides it) | `product-engineer`: reword the edge case to "relation still exists, not reported (A-72)" in the story file, task 1.13, and the #318 body, or add the v1.1 annotation to #318. |
| F4 | All three aggregation queries use `gh issue list` without `--limit`, so `gh` returns at most 30 issues and drops the rest without warning. The bugs query applies its `level:` filter after that cap. This conflicts with the no-fixed-cap read policy (A-74). | Minor | Unintended | product-engineer ×3 § Drift Reconciliation; `gh issue list --help`: default 30 | `developer`: add `--limit 1000` (or a paginated `gh api` search) to the three queries in all three trees and update PT-64. |
| F5 | The `priority: high` table description says "blocks nothing", but the rule bullet says a `high` issue that blocks another keeps `high` (EC-159). The wording comes from D-84. | Minor | Undetermined | github-ops § Labels table row vs. the "Any issue that blocks another" bullet; D-84 | `product-engineer`: clarify to "blocks no ship" (or similar) in D-84 and the row. The live label description is written from this text later (A-71). |
| F6 | D-84 requires a `critical` issue to carry both the relation and the `**Blocks:**` line. The audit only reports a missing relation, so a critical issue with the relation but no line goes unreported. That scope matches AC-4 and A-72 as written. | Minor | Undetermined | github-ops Audit Mode critical bullet; D-84; §16a A-72 | `product-engineer`: decide whether a fourth check (relation present, `**Blocks:**` line missing) is wanted. Otherwise no action. |
| F7 | The live repository labels still carry the old descriptions (`priority: critical` "Must be addressed immediately", `type: tech-debt` "Refactoring, cleanup…"). §16a A-71 has migration batch 1 rewrite only the `type:` descriptions, so the `priority:` descriptions would stay contradictory after migration. | Minor | Undetermined | `gh label list` on llipe/dev-tasks; spec §16a A-71 (types only); test-plan A-71 recommendation included `priority:` | `product-engineer` for S-014: extend batch 1 to the `priority:` descriptions, or record why not. Outside S-019's code scope. |
| F8 | The bugs query's stated reason is "without `level:`, so tracking issues never count". The filter also drops every `level: story` bug. That fits D-83's standalone-issue intent, but the stated reason is incomplete. | Minor | Undetermined | product-engineer ×3 `**Bugs to fix:**` line | `product-engineer`/`developer`: reword to "so story and tracking issues never count", or confirm the intent. |

## Edge-case and randomized test outcomes

| ID | Case | Outcome |
| -- | ---- | ------- |
| EC-158 | `bug` + `security` → `security` | Stated in Labels; pinned |
| EC-159 | `high` blocking another keeps `high`, carries line | Stated; pinned (see F5 wording) |
| EC-160 | `critical`, blocked issue closed | Resolved by A-72: not reported; pinned (see F3 stale text) |

No randomized tactics apply to this prompt-only story.

Live read-only probes: the three aggregation queries ran against llipe/dev-tasks without error (0 bugs, 0 critical). The bugs `--jq` filter was checked on synthetic input (keeps unlabeled and non-`level:` issues, drops `level: story`). `GET issues/317/dependencies/blocking --paginate` answers 200.

- **Documentation structure:** `checkDocsStructure` reports no failures and no staleness.
- **Vocabulary conformance:** `checkExportedIdentifiers` over the PR's added lines against `docs/domain/ubiquitous-language.md` reports no hits. The diff adds no exported identifiers outside the test file.
- **Runbook coverage (FR-49b):** not triggered. Prompt and test changes only, with no configuration, tooling, credentials or data steps.
- **Roadmap mismatch:** not applicable. S-019 does not complete wave 3 (S-016, S-013 to S-015 and S-017 remain).

## Recommendations

- F1: no action now; S-013 owns PT-81.
- F2, F4: `developer` small follow-up in this PR or the next wave-3 story.
- F3, F5, F6, F7, F8: `product-engineer` via `activity-drift-reconciliation`. F3 and F8 are wording fixes, while F5, F6 and F7 need a decision.
