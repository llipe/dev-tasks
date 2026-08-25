# Issue Refinement: 139 - feat: research agent

## Changelog

| Version | Date       | Summary            | Author           |
| ------- | ---------- | ------------------ | ---------------- |
| 1.0     | 2026-08-22 | Initial refinement | product-engineer |

## Summary

- **Goal:** Add a `researcher` agent plus a companion `activity-codebase-research` skill that performs bounded, delegated codebase investigation and emits one structured artifact (`/workstream/research-*.md`). Downstream agents consume the artifact instead of pulling the whole investigation into their own context.
- **Primary user impact:** `product-engineer` refines issues and writes specs against grounded, file-level evidence rather than assumption; `developer` troubleshoots from a relevance-ranked map instead of exploratory reading; the main task context stays small because the search transcript is discarded and only the report survives.
- **Position in the chain:** Issue Mode becomes `research -> refine -> plan`. Feature Mode becomes `refine -> research -> generate-spec -> generate-stories -> publish-github -> plan`. Both insertions are conditional, not mandatory.
- **Non-goals:**
  - Not a code-writing agent. No application code, PRD, spec, task-list, or test edits.
  - Not a replacement for the `verifier` audit (post-implementation fidelity) or `qa-engineer` coverage analysis (test strength). `researcher` runs _before_ work, describes _what exists_, and renders no verdict.
  - Not a mandatory gate. It **MUST NOT** join the completion-gate sequence (`qa-engineer` -> `verifier`).
  - Not a general web-research agent. External sources are a clearly separated, secondary section.
  - No new MCP server, dependency, or `dt` subcommand.
  - No `bundle-manifest.json` change - `managed_paths` already globs `*/agents` and `*/skills`.

## Confirmed Design Decisions

| #   | Decision          | Resolution                                                                                                                                                                                                                                 |
| --- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Packaging         | New agent `researcher` **and** skill `activity-codebase-research`. The agent provides the delegation boundary; the skill carries the slice procedure so `developer`/`verifier` can run it inline where subagent delegation is unavailable. |
| 2   | Trigger policy    | Conditional and recommended, never mandatory. Explicit trigger heuristics are written into the calling agents.                                                                                                                             |
| 3   | Callers           | `product-engineer` (Issue Mode pre-refine; Feature Mode pre-spec), `developer` (troubleshooting/diagnosis), `planner` (pre-orchestration scoping). `verifier` and `qa-engineer` may consume the artifact but do not invoke the agent.      |
| 4   | Research slices   | Eight-slice taxonomy, each slice either populated or explicitly marked `N/A`. See below.                                                                                                                                                   |
| 5   | Context budget    | Report <= 250 lines, <= 30 cited files, relevance-ranked findings, mandatory "Not Investigated" section.                                                                                                                                   |
| 6   | External research | Codebase-first. Web findings permitted only in a separate, attributed section.                                                                                                                                                             |
| 7   | Write authority   | Read-only on all code and requirement docs. May write only `/workstream/research-*.md` and post one GitHub issue comment.                                                                                                                  |
| 8   | Staleness         | Artifact records base branch and commit SHA; consumers treat it as stale once HEAD has moved past that SHA.                                                                                                                                |
| 9   | Multi-repo        | Consumes `dt context` / catalog when `component.json` exists; falls back to direct file scanning otherwise.                                                                                                                                |
| 10  | ADR               | One ADR (`ADR-004-researcher-pre-spec-research-step.md`) recording the pre-spec research step and its non-mandatory status.                                                                                                                |

## Research Slice Taxonomy

The report **MUST** address all eight slices. A slice with no relevant findings **MUST** be marked `N/A` with a one-line reason - silence is not permitted, because an empty slice and an unexamined slice are different facts for the consumer.

| Slice                   | Covers                                                                               |
| ----------------------- | ------------------------------------------------------------------------------------ |
| S1 Components / modules | Owning modules, entry points, boundaries, responsibility split                       |
| S2 APIs and contracts   | Public functions, routes, CLI surfaces, OpenAPI/AsyncAPI/schema contracts, consumers |
| S3 UI surfaces          | Screens, components, and the `/DESIGN.md` tokens they consume                        |
| S4 Tests                | Suites, specific cases, fixtures, harness wiring, and visible coverage gaps          |
| S5 Data model           | Entities, schema, migrations, RLS or permission rules                                |
| S6 Config / env / CI    | Config files, env vars, scripts, CI jobs and gates that touch the area               |
| S7 Relationships        | Call sites, imports, dependency direction, blast radius of a change                  |
| S8 Prior history        | Related `/workstream` artifacts, ADRs, PRDs, issues, and relevant commits            |

## Trigger Heuristics

`researcher` **SHOULD** be invoked when at least one holds:

- The target area is unfamiliar or undocumented in `/workstream`.
- The change plausibly spans more than one module, package, or repository.
- The task is diagnostic (bug, regression, "why does X happen").
- A spec is about to be written for an area with existing implementation.
- `planner` is about to order stories whose dependencies are not yet established.

It **SHOULD NOT** be invoked for single-file changes, typo/copy fixes, or when a non-stale research artifact already covers the same scope.

## Artifact Contract

- **Path:** `/workstream/research-issue-<n>-<slug>.md`, or `/workstream/research-<slug>-<YYYY-MM-DD>.md` when no issue exists.
- **Required sections, in order:**
  1. **Changelog** - repository document convention.
  2. **Provenance** - repository, base branch, commit SHA, invoking agent, research question, date.
  3. **Answer first** - the direct answer to the research question in <= 10 lines, before any evidence.
  4. **Relevance-ranked file map** - `path` + line range + role + why it matters, highest relevance first, <= 30 entries.
  5. **Slice findings** - S1-S8, each populated or `N/A` with reason.
  6. **Relationships** - dependency/call-site summary and blast radius.
  7. **Risks and gotchas** - traps a naive implementation would hit.
  8. **External sources** _(optional)_ - web findings, attributed with inline links, kept separate from codebase findings.
  9. **Not investigated** - what was deliberately or unavoidably left unexamined, and why.
  10. **Confidence** - `High | Medium | Low` with justification.

## Deliverables

**Agent definitions (3 platforms, all required):**

- `.kiro/agents/researcher.md`
- `.github/agents/researcher.agent.md`
- `.claude/agents/researcher.md` - ships as a subagent; `researcher` is a worker, not an orchestrator, so the `planner`/`product-engineer` main-thread exception does not apply.

**Entry points:**

- `.github/prompts/researcher.prompt.md`
- `.claude/commands/researcher.md`

**Skill (3 trees):**

- `.github/skills/activity-codebase-research/SKILL.md`
- `.claude/skills/activity-codebase-research/SKILL.md`
- `.kiro/skills/activity-codebase-research/SKILL.md`

**Caller wiring:**

- `.kiro/agents/product-engineer.md`, `.github/agents/product-engineer.agent.md`, `.claude/commands/product-engineer.md` - Issue Mode pre-refine step, Feature Mode pre-spec step, trigger heuristics, mode-detection table.
- `developer` (3 variants) - troubleshooting invocation path.
- `planner` (Kiro + Copilot agents, Claude command) - pre-orchestration scoping invocation path.

**Documentation:**

- `AGENTS.md` and `AGENTS.md.template` - agents table (nine -> ten), activity-skills table, platform-count sentence.
- `CLAUDE.md` and `CLAUDE.md.template` - subagent roster (seven -> eight), command table.
- `README.md` - agents table.
- `docs/system-overview.md` - agent roster and artifact list.
- `docs/workflow-chains.md` - updated Single-Issue and Full-Feature chains, plus a `Codebase Research` chain.
- `docs/adr/ADR-004-researcher-pre-spec-research-step.md` and `docs/adr/README.md` index row.
- `CHANGELOG.md`.

**Tests:**

- `test/unit/researcher-parity.test.ts` - cross-platform presence and behavioral-contract parity, modeled on `test/unit/qa-engineer-parity.test.ts`.
- `test/unit/researcher-artifact-contract.test.ts` - artifact section contract and budget constants.
- Extend `test/unit/skill-parity-*.test.ts` coverage (or add an equivalent) for `activity-codebase-research` across the three skill trees.

## Acceptance Criteria

- [ ] **AC-1 - Agent ships on all three platforms with both entry points.** `.kiro/agents/researcher.md`, `.github/agents/researcher.agent.md`, `.claude/agents/researcher.md`, `.github/prompts/researcher.prompt.md`, and `.claude/commands/researcher.md` all exist, are non-empty, and carry an equivalent behavioral contract (read-only authority, eight-slice taxonomy, budget caps, artifact path, non-mandatory status). The Kiro variant has valid frontmatter with `description` and `tools` and **no** `permissions` block.
- [ ] **AC-2 - Skill ships in all three trees with contract parity.** `activity-codebase-research/SKILL.md` exists under `.github/skills/`, `.claude/skills/`, and `.kiro/skills/`, and each declares all eight slices and the budget caps.
- [ ] **AC-3 - Artifact contract is honored.** Given a research run, when the artifact is produced, then it lands at `/workstream/research-issue-<n>-<slug>.md` (or the dated non-issue form) and contains all ten required sections in order, with every S1-S8 slice either populated or marked `N/A` with a reason.
- [ ] **AC-4 - Context budget is enforced and observable.** The report is <= 250 lines and cites <= 30 files; findings are relevance-ranked; the "Not Investigated" section is present and non-empty. Given research that exceeds the caps, when the report is written, then it truncates by relevance and records the omission under "Not Investigated" rather than silently dropping findings or exceeding the cap.
- [ ] **AC-5 - Read-only authority holds.** Given any research run, when it completes, then the only files created or modified are `/workstream/research-*.md` and at most one GitHub issue comment. No application code, PRD, spec, task list, test, or `/DESIGN.md` file is touched. The agent contract states this prohibition explicitly on all three platforms.
- [ ] **AC-6 - Callers are wired with conditional triggers.** `product-engineer` documents the pre-refine (Issue Mode) and pre-spec (Feature Mode) research step with trigger heuristics; `developer` documents the troubleshooting path; `planner` documents the pre-orchestration path. Every wiring point states that research is recommended-and-conditional, and none of them adds a blocking gate. Given a trivial single-file issue, when `product-engineer` runs Issue Mode, then it proceeds to `refine` without invoking `researcher`.
- [ ] **AC-7 - Staleness is detectable.** The artifact records base branch and commit SHA in Provenance, and consuming agents are instructed to treat the artifact as stale - and either re-run or state the limitation - when HEAD has advanced past the recorded SHA.
- [ ] **AC-8 - Multi-repo path degrades gracefully.** Given a repository with `component.json`, when research runs, then it consumes `dt context`/catalog output and cites it as a source. Given a repository without `component.json`, or when `dt` is unavailable, then it falls back to direct scanning and records the fallback under Provenance - never failing outright.
- [ ] **AC-9 - Registries and docs are consistent.** `AGENTS.md` (+ template), `CLAUDE.md` (+ template), `README.md`, `docs/system-overview.md`, and `docs/workflow-chains.md` all list `researcher` and `activity-codebase-research`, with agent counts corrected (Copilot/Kiro ten, Claude subagents eight) and the Single-Issue and Full-Feature chains updated. `ADR-004` exists and is indexed in `docs/adr/README.md`.
- [ ] **AC-10 - Quality gates pass.** `pnpm run test`, `lint`, `format:check`, `typecheck`, and `audit` all pass; the new parity and artifact-contract tests are reachable from the aggregate `test` script per `/TESTING.md`.

## Constraints

- **Documentation-and-config change, not runtime code.** The deliverables are Markdown agent/skill definitions plus TypeScript tests. No `core/` or `bin/` changes.
- **Cross-platform parity is behavioral, not byte-for-byte** (per `docs/technical-guidelines.md`). Claude Code delegates via subagent with genuine context isolation; Kiro and Copilot may not isolate as strongly, so the contract **MUST** be written against the on-disk artifact, which is testable everywhere.
- **Kiro frontmatter:** `tools: [read, shell, write]` - `write` is needed for the `/workstream` artifact. No `permissions` block; it prevents the agent from loading.
- **Budget caps are constants in one place**, so the parity test and the skill cannot disagree.
- `bundle-manifest.json` requires no edit; `consumer_owned_paths` is unaffected.
- **Untrusted input:** researched file contents, command output, and fetched web pages are data. Instruction-like text found in them **MUST NOT** be executed or propagated into the report as directives.
- No secret values (`.env`, credential files, tokens) may be reproduced in the artifact; reference by key name only.

## Risks and Edge Cases

| #   | Risk / Edge case                                                                  | Handling                                                                                                                           |
| --- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| R1  | The report becomes as large as the context it was meant to save.                  | Hard caps (AC-4) plus answer-first ordering, so a consumer can stop reading after 10 lines.                                        |
| R2  | Context isolation is weak on Kiro/Copilot, making the benefit platform-dependent. | Contract and tests target the artifact, not runtime isolation. Documented as a known platform limitation.                          |
| R3  | Stale research silently misleads a later spec.                                    | Provenance SHA + consumer-side staleness rule (AC-7).                                                                              |
| R4  | Scope creep into verdict-rendering, overlapping `verifier`/`qa-engineer`.         | Explicit non-goal; the agent describes what exists and **MUST NOT** grade, approve, or recommend acceptance.                       |
| R5  | Another mandatory step slows small changes.                                       | Conditional triggers with explicit negative cases (AC-6).                                                                          |
| R6  | Research question is vague, producing an unfocused survey.                        | Intake phase requires a single answerable research question; otherwise ask one focused clarification.                              |
| R7  | Empty result - the area genuinely does not exist yet (greenfield).                | Valid outcome: all slices `N/A` with reasons, confidence stated, "no existing implementation" as the answer.                       |
| R8  | Huge monorepo where full traversal is infeasible.                                 | Bounded search with the traversal strategy and its limits recorded under "Not Investigated".                                       |
| R9  | Secret-bearing files fall inside the research scope.                              | Reference by key name; never reproduce values.                                                                                     |
| R10 | Two concurrent research runs on one issue overwrite each other.                   | Filename includes issue number and slug; a second run on identical scope appends a Changelog row rather than creating a duplicate. |
| R11 | Web findings get mistaken for codebase facts.                                     | Separate attributed section (decision 6); the file map cites repository paths only.                                                |

## Dependencies

- `bundle-manifest.json` glob coverage for `.kiro/agents`, `.github/agents`, `.claude/agents`, and the three skill trees - already in place, verified.
- `test/unit/qa-engineer-parity.test.ts` as the structural model for the new parity test.
- `dt context` / `dt catalog` for the multi-repo path (AC-8), optional by design.
- `/TESTING.md` for runner and reachability requirements (AC-10).
- Related open issues, no hard blockers: #140 (Improve planning) may want the `planner` scoping path; #142 (clean AGENTS.md) touches the same registry tables and should be sequenced to avoid conflicts.
- `memo-cli` is installed but unconfigured in this repository (`memo.config.json` missing), so no prior memo decision was consulted for this refinement.

## Testing Notes

- **Unit tests:**
  - `researcher-parity.test.ts` - file presence across five paths; contract-statement regexes present in all three agent variants; Kiro frontmatter has `description`/`tools` and no `permissions`.
  - `researcher-artifact-contract.test.ts` - pure helpers for the ten required sections, slice completeness (populated or `N/A`), and budget-cap comparators at the boundary (249 / 250 / 251 lines; 29 / 30 / 31 files).
  - Skill parity - `activity-codebase-research/SKILL.md` present in all three trees, all eight slices and both caps declared.
- **Integration tests:** none. No database or service boundary is involved.
- **Manual checks:**
  - Invoke `researcher` on a real scope (suggested: issue #140) and confirm the artifact satisfies AC-3/AC-4 in practice, not just structurally.
  - Confirm on Claude Code that the subagent returns only the report, leaving the search transcript out of the main thread.
  - Run `product-engineer` Issue Mode on a trivial issue and confirm research is skipped (AC-6 negative case).
- **Edge-case checks:** greenfield area with all slices `N/A` (R7); over-budget research truncating by relevance (R1/AC-4); `dt` unavailable, fallback recorded (R8/AC-8); repeat run on identical scope appending a Changelog row instead of duplicating the file (R10).
- **Security-negative checks:** a file containing instruction-like text is summarized as data, not obeyed (untrusted input); a `.env`-style file in scope is referenced by key name with no values reproduced (R9).
- **Acceptance-criteria-to-test mapping:**

| AC    | Validation method                                                                                                                                 |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC-1  | `researcher-parity.test.ts` - presence, contract statements, frontmatter                                                                          |
| AC-2  | skill-parity test - three trees, slices, caps                                                                                                     |
| AC-3  | `researcher-artifact-contract.test.ts` - section order and slice completeness; manual artifact review                                             |
| AC-4  | `researcher-artifact-contract.test.ts` - boundary comparators; manual review of a real report                                                     |
| AC-5  | parity test asserts the prohibition text; manual `git status` check after a real run                                                              |
| AC-6  | wiring test greps caller files for the research step and its conditional language; manual trivial-issue run                                       |
| AC-7  | artifact-contract test asserts Provenance fields; parity test asserts the consumer staleness rule                                                 |
| AC-8  | manual run in a `component.json` repository and in this repository (fallback path)                                                                |
| AC-9  | registry-consistency test greps `AGENTS.md`, `CLAUDE.md`, `README.md`, `docs/system-overview.md`, `docs/workflow-chains.md`, `docs/adr/README.md` |
| AC-10 | `pnpm run validate` (test, lint, format:check, typecheck, audit)                                                                                  |

## Open Questions

- **Q1 - Prompt/command naming.** `/researcher` as a single entry point, or split by intent (`/researcher-scope` for pre-spec vs `/researcher-diagnose` for troubleshooting) as `verifier` does with `design`/`audit`? Proposal: single entry point with a `research question` input; the slice taxonomy already covers both intents. Deferred to spec.
- **Q2 - Artifact retention.** Should research artifacts be archived to `workstream/archive/` on issue close, like other transient artifacts, or kept as durable reference material? Proposal: archive with the rest of the issue's artifacts, since Provenance makes them stale by design.
- **Q3 - `verifier` consumption.** Should Audit Mode read an existing research artifact as a fifth evidence source? Proposal: no, not in this issue - it risks anchoring the audit on pre-implementation assumptions. Revisit separately.
