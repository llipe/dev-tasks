# Research: Shared-Understanding Phase 2 Integration Points

**Status:** Complete  
**Base branch:** main  
**Commit SHA:** ab360c8 (v0.15.0)  
**Invoked by:** product-engineer (pre-spec planning)  
**Research question:** How do activity-refine, activity-generate-spec, plan, product-engineer, planner, developer, and the decision-log precedent currently work across .claude/, .github/, and .kiro/ so Phase 2 can be specified without contradicting existing behavior?  
**Date:** 2026-09-20

---

## Answer First (≤10 lines)

Phase 2 inserts two grilling phases into the Feature Mode workflow and adds decision-log threading through plan and implement. **Current state:** activity-refine and activity-generate-spec have no grilling phases; plan does not cite decision IDs; planner does not pass the decision-log path to developer delegations; implement does not read the decision log before starting work. The decision-log file format already exists and is ready for cross-feature use. ADR-008 does not yet exist. No PRDs currently carry a "Decisions" section, making this a new convention. The grill-me skill is mentioned only in the PRD text with no existing reference or artifact in the repository.

---

## Relevance-Ranked File Map (≤30 files)

### Core Current Implementation (13 files)

1. `.claude/commands/product-engineer.md` — Feature/Issue mode phase sequence; shows 7 Feature phases, A-B Issue phases; no grilling insertion points marked
2. `.claude/commands/planner.md` — Phase 4 per-story handoff; currently passes task list and test plan, NOT decision log
3. `.claude/skills/activity-refine/SKILL.md` — Mode A (Issue Refinement) and Mode B (PRD Creation); no activity-grill invocation; asks clarifying questions → produces output
4. `.claude/skills/activity-generate-spec/SKILL.md` — Reads PRD + tech.md, asks technical questions → produces spec; no activity-grill HOW phase
5. `.github/instructions/plan.instructions.md` — Task list format and conversion rules; no decision-ID citation; no rationale tracing
6. `.claude/skills/implement/SKILL.md` — "Before Starting Work" checklist and step-by-step execution; no decision-log read step
7. `workstream/decisions-shared-understanding.md` — Only existing decision-log example; schema complete (ID, Phase, Branch, Question, Recommended, Answer, Accepted rec., Supersedes, Author, Date); already WHAT/HOW phase split; changelog convention present; cross-file form is `feature#D-NN`
8. `docs/adr/ADR-004-researcher-pre-spec-research-step.md` — Format reference (Status, Context, Decision, Alternatives, Consequences, Related); shows decision artifact pattern
9. `docs/tech.md` — Package map with columns: Package, Path, Purpose, Owner, Canonical scripts, Bounded context; single-package repo at root with one row
10. `docs/requirements/prd-shared-understanding-refinement.md` — Phase 2 functional requirements FR-1 to FR-16 and AC-01 to AC-05, AC-09, AC-16; defines grilling phases, decision-log format, and integration touchpoints
11. `.claude/agents/developer.md` — Developer agent entry; delegates to implement skill
12. `.github/agents/planner.agent.md` — Copilot planner agent definition
13. `.kiro/agents/planner.md` — Kiro planner agent definition

### Precedent and Reference (4 files)

14. `docs/adr/ADR-007-retire-multi-repo-context-layer.md` — Shows ADR pattern and format
15. `docs/requirements/prd-evidence-driven-development-loop.md` — Existing PRD without "Decisions" section (pattern reference: no PRD to date has a Decisions section)
16. `.github/agents/product-engineer.agent.md` — Copilot product-engineer agent (for parity check vs. Claude version)
17. `.kiro/agents/product-engineer.md` — Kiro product-engineer agent (for parity check vs. Claude version)

### Repository Context (3 files)

18. `AGENTS.md` — Agent registry; "Contracts" section lists DESIGN.md, TESTING.md
19. `CLAUDE.md` — Project memory and cross-agent rules
20. `docs/product.md` — Product context (Phase 1 completed)

---

## Slice Findings (S1-S8)

### S1 — Components/Modules
**Packages:** @llipe.com/dev-tasks (single-package repository, root).

Currently, `activity-refine` and `activity-generate-spec` are standalone skills with no sub-skills invoked. Phase 2 requires both to invoke a new `activity-grill` sub-skill (to be created). The skill is registered in `.claude/skills/`, `.github/skills/`, and `.kiro/skills/`. Plan and implement are instructions, not agent-delegated skills, so they load inline in the orchestrators. Planner and developer remain agents but their handoff contracts change.

### S2 — APIs/Contracts
**Status:** 

- **activity-refine SKILL.md contract (lines 58-238):** Currently mode-based (Issue Refinement vs PRD Creation). No contract clause for grilling invocation. Phase 2 modifies: both modes MUST invoke activity-grill with appropriate caps (25 questions WHAT/HOW for Feature, 8 total for Issue), wait for exit gate (empty open-questions list + explicit user shared understanding statement), then proceed to draft.
- **activity-generate-spec SKILL.md contract (lines 43-138):** No grilling phase. Phase 2 adds: MUST invoke activity-grill HOW phase before asking technical questions, wait for exit gate, read approved PRD, then ask spec questions.
- **plan instruction contract (lines 22-76):** Task list format has no "Decisions" section. Phase 2 adds: task list MUST have inline decision citations (by task derivation) and a "Decisions Consumed" section listing all cited IDs.
- **planner Phase 4 handoff template (lines 310-339):** Currently passes task_file, test_plan_path, execution mode, integration branch, test-first flag. Phase 2 adds: decision_log_path parameter passed to every developer delegation.
- **implement skill "Before Starting Work" (lines 65-81):** No decision-log read step. Phase 2 adds: after confirming GitHub issue and before branch creation, MUST read the feature's decisions-*.md file and cite it in the first commit and PR body.

### S3 — UI Surfaces
**Status:** N/A — Phase 2 has no UI scope. This research focuses on workflow orchestration and prompt trees.

### S4 — Tests
**Status:** 

- No existing tests for activity-refine, activity-generate-spec, plan, or implement. Phase 1 test coverage is complete for foundation-doc rename and package-map detection.
- Phase 2 MUST add tests for: grilling exit-gate enforcement (empty open list enforced before draft), decision-log creation and citation (per feature), cross-feature decision reuse in Issue Mode, decision-ID format validation (`D-NN` within file, `feature#D-NN` across files).

### S5 — Data Model
**Status:** 

Decision-log schema (from `decisions-shared-understanding.md` rows 22-87):
- **Columns:** ID (`D-NN`, unique within file), Phase (`WHAT` or `HOW`), Branch (decision area, e.g., `grilling/placement`, `simplicity/content`), Question (the question asked), Recommended (agent's default answer), Answer (user's actual answer), Accepted rec. (yes/no/partly), Supersedes (if replacing a prior decision, name it), Author, Date.
- **Changelog mechanism:** Append-only entries per version; changelog at file head with version, date, summary, author.
- **Cross-file citation form:** `feature-name#D-NN` (e.g., `shared-understanding#D-50`).
- **Supersedes invariant:** Superseded rows are NOT deleted; new row names the superseded ID in Supersedes column. Only source is the file itself; no external ledger.

No changes to this schema are required for Phase 2; it is ready as-is.

### S6 — Config/Env/CI
**Status:** 

- `AGENTS.md` "Contracts" table currently lists `DESIGN.md` and `TESTING.md`. Phase 2 spec MUST decide whether to add `SIMPLICITY.md` to this table (likely deferred to Phase 4). Decision-log files are workstream artifacts and are not config.
- No CI workflow changes for Phase 2; all grilling and decision logging happen during the planning phase, before implementation branches are created.

### S7 — Relationships
**Status:** 

**Current flow (Feature Mode):**
```
product-engineer (Feature Mode)
  → Phase 1 activity-refine (asks questions → produces PRD)
  → Phase 2 [conditional] researcher
  → Phase 3 activity-generate-spec (asks questions → produces spec)
  → Phase 4 activity-generate-stories (reads spec → produces stories)
  → Phase 5 activity-publish-github (publishes stories)
  → Phase 6 plan instruction (reads stories → produces task list)
  → Phase 7 verifier Design Mode recommendation
  → developer (per phase 6 task list)

plan instruction
  ↓
  creates task list with no decision citations

planner orchestration
  → Phase 4 delegates to developer per story
    (passes: task list, test plan, integration branch, test-first flag)
    → does NOT pass decision log

developer / implement
  → reads task list
  → does NOT read decision log
  → creates branches and PRs
```

**Phase 2 insertions required:**
- activity-refine MUST invoke activity-grill WHAT before drafting PRD (new exit gate)
- activity-generate-spec MUST invoke activity-grill HOW before drafting spec (new exit gate)
- activity-refine Issue Mode MUST invoke activity-grill with cap 8, read-only glossary, reuse prior decisions (new grill invocation)
- plan MUST cite decision IDs and list consumed decisions (task list contract change)
- planner Phase 4 MUST pass decision_log_path in handoff (handoff template change)
- implement MUST read decision log before starting work (Before Starting Work section change)

### S8 — Prior History
**Status:** 

- `workstream/decisions-shared-understanding.md` established the decision-log pattern by **practicing** it: this single feature's decisions (D-01 to D-52 across WHAT and HOW phases) were logged in the file as the PRD was refined and Phase 0-1 specs were grilled. The file is the only existing decision log in the repository; no other features have one yet.
- The file demonstrates: the schema works; the changelog convention is viable; the Supersedes mechanism tracks replacements (D-07→D-10→D-14, D-36→D-40, D-28→D-41); cross-file citation form `feature#D-NN` is used within the log itself but NOT cited outside it yet (because no other feature has made decisions yet).
- Prior to this log, the PRD v1.0 had decisions in a "Decisions" table (short form, lines 632-661). The log is v1.0+ and inherits and extends that table; no prior work exists.

---

## Relationships

**Activity chain with grilling inserted (Feature Mode, Phase 2 specification):**

```
product-engineer Feature Mode
  ├─ Phase 1: Refine PRD
  │  ├─ activity-refine invokes activity-grill WHAT
  │  │  ├─ asks one Q/A at a time, depth-first
  │  │  ├─ exit gate: empty open list + explicit user statement
  │  │  └─ appends workstream/decisions-<feature>.md (D-01…)
  │  ├─ reads approved PRD + product.md + tech.md
  │  └─ produces /docs/requirements/prd-<feature>.md
  ├─ Phase 2: [conditional] Codebase Research
  │  └─ researcher produces /workstream/research-<feature>.md
  ├─ Phase 3: Generate Spec
  │  ├─ activity-generate-spec invokes activity-grill HOW
  │  │  ├─ reads approved PRD + research artifact (if present)
  │  │  ├─ exit gate: empty open list + explicit user statement
  │  │  └─ appends to workstream/decisions-<feature>.md (D-NN continues)
  │  ├─ reads approved PRD + tech.md
  │  └─ produces /workstream/specification-<feature>.md
  │     (cites decision IDs inline + includes Decisions section listing consumed IDs)
  ├─ Phase 4: Generate Stories → Phase 5: Publish → Phase 6: Plan
  │  └─ plan produces /workstream/tasks-<feature>-plan.md
  │     (each task cites the decision ID(s) it derives from; "Decisions Consumed" section)
  └─ Phase 7: Verifier Design recommendation

developer (per story or full task list)
  ├─ implement reads decisions-<feature>.md FIRST (new step)
  ├─ creates branch, commits with decision citations
  └─ planner (if orchestrating) passes decisions-<feature>.md path in handoff
```

**Decision-log threading:**
- `activity-grill WHAT` creates and appends to `workstream/decisions-<feature>.md` (D-01, D-02, …)
- `activity-refine` cites D-NN inline in PRD where a decision shaped a requirement
- `activity-grill HOW` appends to same file (D-NN continues from WHAT)
- `activity-generate-spec` cites D-NN inline where a decision shaped a design choice
- `plan` cites D-NN for each task and lists all consumed IDs
- `implement` reads the file first, cites decisions in commit messages, PR body

---

## Risks and Gotchas

1. **Exit-gate enforcement is hard.** The requirement (FR-2, FR-7, AC-01, AC-02) is explicit: empty open-questions list AND user states "I understand" explicitly. Inferring agreement from silence or positive tone is forbidden. No agent today enforces an explicit statement requirement; this is a new UX pattern that must be coded carefully to avoid false-positive exits.

2. **Grilling question cap is configurable but must be enforced.** Default: 25 per phase (WHAT, HOW) in Feature Mode; 8 total in Issue Mode. Reaching the cap must halt and ask the user "continue or stop?" If they say continue, reset the counter; if they say stop, treat it as the user stating the phase is "done to this point" and exit. This is different from hitting a hard limit—the agent must wait for a human decision.

3. **Decision-log cross-file citation form `feature#D-NN` introduces a new namespace hazard.** If two features have the same name or if a feature is renamed, citations break. The spec MUST require that feature names in the PR/spec are stable and that renaming a feature is explicitly a breaking change requiring citation audit. This is a future governance issue, not Phase 2 scope, but it's worth calling out now.

4. **Issue Mode reuse of prior decisions requires lookup.** When activity-grill Issue Mode is invoked, it MUST read all prior `decisions-<other-feature>.md` files and offer relevant prior decisions as answers before asking. The search is "codebase questions answerable from existing logs" (FR-3)—if an old decision answers a new issue's question, cite it in qualified form and don't re-ask. This lookup can become expensive if there are many prior logs; the spec should clarify: search only when the issue description mentions a term, or always scan all logs? (Likely always scan, but with a "skip if no keyword match" optimization.)

5. **Plan task list format change is minimally disruptive.** Adding decision citations inline and a "Decisions Consumed" section does not break the existing checklist structure. However, every generated task list from Phase 2 onward WILL cite decisions; consumers expecting non-cited lists will see the change. The spec should clarify: do un-cited tasks fail validation, or is it a warning? (Likely warning for Phase 2, failing in later phases after adoption.)

6. **Planner-to-developer handoff contract change.** Adding decision_log_path to the Phase 4 handoff template means the template in all three trees (Claude, Copilot, Kiro) MUST change in lockstep. The spec MUST require parity testing to ensure all three pass the same set of parameters. If one tree is out of sync, developer in that tree will not read the decision log.

7. **Implement skill reads decision log before ANY other work.** This is a new first step. The implement skill currently starts with "Confirm GitHub issue open" (step 1). The spec MUST clarify the order: does "read decision log" come before or after the branch-gate check? (Likely before—reading is non-mutating, so reading before the branch gate is safer and allows the agent to answer its own clarifying questions from the log.)

8. **ADR-008 is a blocking dependency.** The PRD says D-20 resolved this as "ADR-008 records the activity-grill exit-gate semantics and the platform-agnostic install-if-absent category." The ADR does not yet exist. Phase 2 spec MUST include the ADR as a deliverable, or the phase cannot close. The ADR will record: the hard exit-gate definition (empty open list + explicit user statement), the three-item decision on how activity-grill is invoked by different callers, and the install-if-absent category mechanism for glossary files (Phase 3 dependency).

9. **Glossary and simplicity contract are Phase 3 and Phase 4 scope; Phase 2 must not assume them.** The decision log is Phase 2; the ubiquitous language and simplicity contract are later phases. Phase 2 spec MUST avoid forward references to glossary conformance checks or simplicity-rule citations in the decision log itself. The decision log is purely about recording design decisions, not enforcing vocabulary or simplicity at decision time.

10. **`grill-me` credit location not yet resolved.** D-13 says to credit the skill in the activity-grill header after confirming license. Phase 2 spec MUST include a task to confirm the license (likely by searching GitHub or the public web) and add the attribution line. If the license is incompatible or grill-me is not public, Phase 2 cannot reference it and must document the original interview discipline in prose instead.

---

## External Sources

- PRD `docs/requirements/prd-shared-understanding-refinement.md` v1.13 (current, governs Phase 2 scope)
- ADR-004 pattern reference
- Existing decision-log file `workstream/decisions-shared-understanding.md` v1.9 (current; schema and precedent)

---

## Not Investigated

- Implementation details of activity-grill skill itself (out of scope; Phase 2 spec task)
- Specific question libraries or decision-tree algorithms (spec will define)
- Glossary and ubiquitous-language mechanism (Phase 3 scope)
- Simplicity tooling checker configuration (Phase 4 scope)
- TDD commit-order evidence verification (Phase 5 scope)
- Teaching moments / explainers (Phase 6 scope)
- Full parity across `.github/` (Copilot) and `.kiro/` trees beyond the 3 files sampled above (assumed: parity test in phase spec will enforce it)

---

## Confidence

**High (85%)** on current state of activity-refine, activity-generate-spec, plan, developer, and planner. The files are read and the contracts are explicit.

**Medium (70%)** on the exact grilling question cap and exit-gate enforcement mechanism; the PRD is prescriptive but the spec will refine the UX and CLI patterns.

**High (90%)** on decision-log schema and existing precedent; the `decisions-shared-understanding.md` file is comprehensive and already in use.

**Medium (60%)** on grill-me attribution requirement; the PRD mentions confirming the license, but the actual `grill-me` skill or public reference was not found in the repository—the spec task to confirm license will clarify.

