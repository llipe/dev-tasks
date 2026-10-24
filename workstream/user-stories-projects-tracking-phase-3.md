# User Stories: projects-tracking — Wave 3, migration of an existing repository

## Changelog

| Version | Date       | Summary                                                                                                              | Author                    |
| ------- | ---------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| 1.1     | 2026-10-24 | Design Mode resolutions (spec v1.3 §16a, D-98 to D-101) annotated on all six stories; no AC text rewritten. | product-engineer |
| 1.0     | 2026-10-23 | Initial story set from `workstream/specification-projects-tracking-phase-3.md` v1.2. Six stories, PRD ids kept. | @llipe / product-engineer |

Source: `docs/requirements/prd-projects-tracking.md` v1.10 (wave 3: FR-17 to FR-22, FR-26) · Specification v1.2 · Decisions `workstream/decisions-projects-tracking.md` D-79 to D-97.

Execution order: S-019 → S-016 → S-013 → S-014 → S-015 → S-017. S-019 and S-016 are prompt-only and independent; S-014 depends on S-013 (snapshot, classification, plan file); S-015 depends on S-014 (batches); S-017 depends on all five, because the runbook documents them and this repository's migration exercises them. Code stories add their tests under `test/unit/migrate-projects/`; prompt stories add their parity pins to a new `test/unit/projects-tracking-wave-3-parity.test.ts`, keeping the wave 1 and 2 suites untouched.

---

### Story S-019: github-ops states one type per issue, a priority scale that names release blockers, and the native blocking link

**Priority:** High
**Estimated Size:** S
**Dependencies:** none

#### User Story

As the owner filtering issues to decide what ships next,
I want every issue to carry exactly one meaningful `type:` and a priority that says whether it blocks a ship,
So that "bugs to fix", "release blockers" and "post-wave follow-ups" are label filters I can trust, with no new label category.

#### Context

The 2026-10-23 survey found `tech-debt` covering refactors and test gaps, `type: other` on one issue, and issues with zero or two `type:` labels (D-85). `priority: critical` means "addressed immediately" and names no ship it holds back (D-84). The owner chose types, priorities and GitHub's native issue dependencies over a `role:` label (D-83). The migration enforces these conventions (S-013), so they are written first.

#### Acceptance Criteria

> **Annotated v1.1 (Design Mode, spec §16a).** AC-5's queries go in product-engineer § Drift Reconciliation (A-86). The audit's type check exempts `level: prd` and `level: wave` issues (A-68). The "blocked issue closed" edge case reads: the relation still exists, so it is not reported (A-72). AC-3 spells the removal as `gh api -X DELETE repos/{o}/{r}/issues/{blocked}/dependencies/blocked_by/{blocker numeric id}` (A-89). The type set is pinned to `core/migrate-projects/conventions.ts` (A-87, PT-81).

- [ ] AC-1: github-ops' Labels section in all three trees lists the `type:` set `enhancement`, `bug`, `security`, `refactor`, `test`, `docs`, `chore`, `tech-debt` with the D-85 definitions, the rule "exactly one `type:` per issue", the tie-break order `security > bug > enhancement > refactor > test > docs > chore > tech-debt`, and `type: other` as retired; the Labels table gains a `type: test` row and `tech-debt`'s description narrows (FR-26, D-85).
- [ ] AC-2: The priority rows state the D-84 scale: `critical` blocks a wave, PRD or release from shipping and carries a native `blocked by` relation from the issue it blocks plus a `**Blocks:** #N — <reason>` body line; `high` current wave or cycle; `medium` next; `low` backlog; and "any issue that blocks another carries the `**Blocks:**` line whatever its priority" (FR-26, D-84).
- [ ] AC-3: The Command Map gains the dependency commands, `gh api -X POST repos/{o}/{r}/issues/{blocked}/dependencies/blocked_by -F issue_id=<blocker numeric id>` and its `DELETE`, with the sentence that issue dependencies are issue data an agent may write, unlike the Project (D-22, spec §8.5).
- [ ] AC-4: github-ops' audit mode reports three findings: a `critical` issue with no blocking relation, an issue with zero or several `type:` labels, and a retired label on an open issue (AC-16).
- [ ] AC-5: product-engineer's Roadmap Maintenance or Drift Reconciliation guidance in all three trees names the aggregation queries: post-wave follow-ups by the `Follow-up to #N` body line, bugs to fix by `type: bug` without `level:`, release blockers by `priority: critical` (D-83).
- [ ] AC-6: activity-publish-github in all three trees requires exactly one `type:` per story issue, from the D-85 set (FR-26).
- [ ] AC-7: Parity pins for AC-1 to AC-6, each pinned line byte-identical across the three copies, and a negative that no copy still lists `type: other` as a valid choice.

#### Business Rules

- No `role:` label category is introduced (D-83). The `needs:` labels stay rejected (D-15).
- A blocking link is never invented: an agent adds one only when the user or the issue text names the blocked issue (D-84).

#### Technical Notes

- github-ops copies: `.claude/agents/github-ops.md`, `.github/agents/github-ops.agent.md`, `.kiro/agents/github-ops.md`; Labels section near the `type:` rows (`.claude` ~line 347–380 on main).
- The dependency endpoint was verified to answer on llipe/dev-tasks (`GET .../dependencies/blocked_by` → 200, D-83). It takes the blocker's numeric id, like the sub-issue endpoint.
- Wave 2's follow-up PR #315 already uses `--body-file` throughout the Command Map; the new rows follow it.

#### Testing Requirements

- **Unit Tests:** parity pins per AC in `test/unit/projects-tracking-wave-3-parity.test.ts`.
- **Integration Tests:** none.
- **Manual/UI Testing:** none; prompt text only.
- **Edge-Case Matrix:** an issue with `type: bug` and `type: security` (tie-break picks `security`); a `high` issue that blocks another (carries the `**Blocks:**` line, keeps `high`); a `critical` issue whose blocked issue is closed (still reported until the priority is lowered).
- **Acceptance-Criteria Mapping:** AC-1 → `github-ops > type set`; AC-2 → `github-ops > priority scale`; AC-3 → `github-ops > dependency commands`; AC-4 → `github-ops > audit checks`; AC-5 → `product-engineer > aggregation`; AC-6 → `activity-publish-github > one type`; AC-7 is the file.
- **Execution Commands:** `pnpm run test:unit`, `pnpm run validate`.

#### Migration Requirements

- Not applicable here; the migration that applies these labels to existing issues is S-013 to S-015.

#### Implementation Steps

1. Create the wave 3 parity file with the AC-1 to AC-6 pins; red.
2. Edit github-ops ×3 (Labels section, priority rows, Command Map, audit checks).
3. Edit product-engineer ×3 and activity-publish-github ×3.
4. Green; `pnpm run validate`.

#### Files to Create/Modify

- `.claude/agents/github-ops.md`, `.github/agents/github-ops.agent.md`, `.kiro/agents/github-ops.md`
- `.claude/commands/product-engineer.md`, `.github/agents/product-engineer.agent.md`, `.kiro/agents/product-engineer.md`
- `.claude/skills/activity-publish-github/SKILL.md` and its `.github` and `.kiro` copies
- `test/unit/projects-tracking-wave-3-parity.test.ts` (new)

#### Definition of Done Checklist

- [ ] Code implemented per technical guidelines
- [ ] Unit/integration/manual/edge-case tests written and passing
- [ ] Quality gates passing (`lint`, `format:check`, `typecheck`, `test`, `audit`)
- [ ] Code reviewed and approved
- [ ] Acceptance criteria verified
- [ ] Acceptance criteria explicitly mapped to test evidence
- [ ] Migration lifecycle complete (or documented opt-out) when schema/data-model changes exist
- [ ] Pull Request created and merged

---

### Story S-016: product-engineer converts a narrative roadmap to the canonical table before migration

**Priority:** High
**Estimated Size:** S
**Dependencies:** none

#### User Story

As the owner of a repository whose roadmap is a narrative document,
I want product-engineer to draft the canonical roadmap table for my approval, keeping my narrative,
So that migration can map `phase:` labels to waves exactly, and my roadmap keeps its story.

#### Context

FR-18 resolves a `phase:` label against the roadmap, and FR-21 converts the roadmap; riel's roadmap is a v1.76 narrative with a Mermaid diagram (D-86). Scope lines and statuses need judgment, so product-engineer drafts them and the user approves, before `--plan` runs (D-86). The planner already backfills a state file's `Wave issue:` line on resume, so migration only lists such files (D-89).

#### Acceptance Criteria

> **Annotated v1.1 (Design Mode, spec §16a).** This story owns § Roadmap Maintenance; S-019's aggregation text goes to § Drift Reconciliation (A-86). A "partial table" is a canonical header with at least one row (A-59). AC-3 matches PRD AC-13 as amended in v1.11 (D-99, A-58).

- [ ] AC-1: product-engineer's Roadmap Maintenance in all three trees gains a conversion step: when `docs/roadmap.md` has no canonical table, draft one (one row per PRD phase or wave, scope, Status from the fixed set, Issues/PRs from the narrative), keep the existing narrative verbatim below it, flag every Status translated from narrative wording for the user, and ship it as its own docs PR before migration runs (FR-21, D-86).
- [ ] AC-2: The step names migration's dependency on it: `dev-tasks migrate projects --plan` refuses to run without the canonical table, and maps `phase: X` only to a row whose `Phase/Wave` cell equals `X` exactly (D-86).
- [ ] AC-3: The step states that active `workstream/planner-state-*.md` files are not edited by migration; the planner's resume adds a missing `Wave issue:` line (D-89).
- [ ] AC-4: Parity pins for AC-1 to AC-3, byte-identical across the three copies.

#### Business Rules

- The narrative is kept verbatim; the table is added above it, never instead of it (FR-21).
- A Status without merged evidence is never upgraded to `Done` by the conversion (D-86).

#### Technical Notes

- product-engineer copies: `.claude/commands/product-engineer.md`, `.github/agents/product-engineer.agent.md`, `.kiro/agents/product-engineer.md`; § Roadmap Maintenance.
- `roadmap-parity.test.ts` already defines what a canonical table is; the step points to its shape rather than restating it.

#### Testing Requirements

- **Unit Tests:** parity pins in the wave 3 parity file.
- **Integration Tests:** none.
- **Manual/UI Testing:** none in this wave; this repository's roadmap is already canonical, so the conversion is exercised by the owner on riel after delivery (D-94).
- **Edge-Case Matrix:** a roadmap with a partial canonical table (treated as canonical, migration reads it); a narrative status "paused" (translated to `Not started`, flagged); two narrative sections describing one wave (one row, both cited).
- **Acceptance-Criteria Mapping:** AC-1 → `product-engineer > roadmap conversion`; AC-2 → `product-engineer > migration dependency`; AC-3 → `product-engineer > state files`; AC-4 is the file.
- **Execution Commands:** `pnpm run test:unit`.

#### Migration Requirements

- Not applicable.

#### Implementation Steps

1. Pins; red.
2. Edit the three product-engineer copies.
3. Green.

#### Files to Create/Modify

- `.claude/commands/product-engineer.md`, `.github/agents/product-engineer.agent.md`, `.kiro/agents/product-engineer.md`
- `test/unit/projects-tracking-wave-3-parity.test.ts`

#### Definition of Done Checklist

- [ ] Code implemented per technical guidelines
- [ ] Unit/integration/manual/edge-case tests written and passing
- [ ] Quality gates passing (`lint`, `format:check`, `typecheck`, `test`, `audit`)
- [ ] Code reviewed and approved
- [ ] Acceptance criteria verified
- [ ] Acceptance criteria explicitly mapped to test evidence
- [ ] Migration lifecycle complete (or documented opt-out) when schema/data-model changes exist
- [ ] Pull Request created and merged

---

### Story S-013: `dev-tasks migrate projects --plan` reads the repository and writes a reviewable migration plan

**Priority:** Critical
**Estimated Size:** M
**Dependencies:** none (S-019's conventions are encoded as constants here; the prompt text can land in either order)

#### User Story

As the owner of an existing repository,
I want one read-only command that shows me everything migration would change and everything it needs me to decide,
So that I approve a concrete list instead of trusting an agent to improvise writes.

#### Context

The migration logic is code, not a prompt, so the plan is deterministic and testable (D-79). This story builds the read side and the plan file; S-014 adds mapping and batches, S-015 the writes.

#### Acceptance Criteria

> **Annotated v1.1 (Design Mode, spec §16a).**
> - **Reads.** AC-3: local files are read through an injectable `LocalReader`, and `--repo` must match the working tree (A-52). Lists are paginated, with no `--limit` cap, and use REST numeric ids (A-74, A-75). Story parents are read (A-76). Tracking issues are searched with `--state all` (A-91).
> - **Classification.** AC-4 classifies stories first (A-53), with a tolerant `**Story:**` pattern (A-54). Tracking issues are exempt from "needs a type" (A-68). Only D-85 types count, and default labels are listed with a suggestion (A-69, A-70, D-100). The critical check reads `.../dependencies/blocking` (A-72).
> - **Plan file.** AC-5's file gains `Format: 1` and `Plan digest:` headers, one table per review list plus Information, `W-NNN` IDs and escaped cells (A-51, A-77, A-78). `--plan` refuses to overwrite a plan file with non-`pending` rows (A-65).
> - **CLI.** AC-1 adds `bin/parse-args.ts` validation (A-63), and the auth check passes `--hostname github.com` (A-88). CLI tests use a fake `gh` on `PATH` (A-85). Exports are named `MigrationPlan*` (A-92).

- [ ] AC-1: `dev-tasks migrate projects --plan [--repo <owner/repo>] [--out <path>] [--json]` exists; `--repo` defaults from `gh repo view --json nameWithOwner`, `--out` to `workstream/migration-projects.md`; `dev-tasks --help` lists it beside `migrate docs` (spec §6).
- [ ] AC-2: The command runs `gh auth status` first and exits `DependencyError` (11) with a `gh auth login` hint when it fails, reading nothing else (D-96).
- [ ] AC-3: `snapshot.ts` reads, through one injectable `GhRunner`, the repository labels, every open issue (number, title, body, labels, milestone), sub-issues and parent for tracking issues, `docs/roadmap.md` and the `workstream/planner-state-*.md` files present, with `--paginate` or `--limit 1000` on every list (spec §5, §9).
- [ ] AC-4: `classify.ts` marks each open issue story, tracking issue or standalone by D-82 and D-87; lists zero- or multi-`type:` issues under "needs a type" with the Conventional Commits suggestion (`type: other` and `type: prd|wave|story` count as no type, D-85); and lists `priority: critical` issues without a blocking relation or `**Blocks:**` line under "needs a blocking link", never inventing one (D-84).
- [ ] AC-5: `planfile.ts` renders the plan file in the spec §5 shape (header with `Generated`, `Snapshot` hash, `Approved: no`; "Needs your answer" tables; batch tables with write states) and parses it back; render then parse round-trips without loss, and answers typed into the review tables survive the parse.
- [ ] AC-6: `--plan` makes zero write calls: the recording `GhRunner` in tests sees only read commands (D-90).
- [ ] AC-7: The plan file contains issue numbers, titles and label names, never issue bodies (spec §12).

#### Business Rules

- Read only. No label, issue, comment or Project is touched by `--plan` (FR-17).
- Nothing is installed or configured by the command (D-96, tech.md).

#### Technical Notes

- New module `core/migrate-projects/` (`gh.ts`, `snapshot.ts`, `classify.ts`, `planfile.ts`, `index.ts`); the subcommand dispatch sits beside `migrate docs` in `bin/dev-tasks.ts` (`case "migrate"`).
- `GhRunner` is `(args: string[]) => Promise<{ stdout: string; exitCode: number; stderr: string }>`; the real one uses `execFile("gh", args)`, never a shell string.
- Snapshot hash: SHA-256 over sorted, normalized JSON of the snapshot (spec §12).
- Story pattern constant: `/\bStory S-\d+\b/` (D-82), one place.

#### Testing Requirements

- **Unit Tests:** `classify` per rule; `planfile` round-trip; snapshot normalization and hash stability under reordered input.
- **Integration Tests:** the CLI subcommand against a fixture `GhRunner` (no network).
- **Manual/UI Testing:** `pnpm exec tsx bin/dev-tasks.ts migrate projects --plan` on this repository; the plan file lists no writes outside the batches and nothing changes on GitHub.
- **Edge-Case Matrix:** `gh` not on PATH (DependencyError); zero open issues (empty plan, success); an issue with both `Story S-NNN` in the title and no body (story); a title `[PRD-x] Wave 1: …` without `level:` (tracking issue, D-87); body with CRLF line endings; 1,000+ issues (paginated).
- **Acceptance-Criteria Mapping:** AC-1, AC-2 → `cli.test.ts`; AC-3 → `snapshot.test.ts`; AC-4 → `classify.test.ts`; AC-5 → `planfile.test.ts`; AC-6, AC-7 → `plan-readonly.test.ts`.
- **Execution Commands:** `pnpm run test:unit`, `pnpm run typecheck`, `pnpm run validate`.

#### Migration Requirements

- Not applicable; no schema. The plan file format is new and versioned by its header.

#### Implementation Steps

1. Fixtures (D-95) and failing tests for classify, planfile and the read-only guarantee.
2. `gh.ts` runner and `snapshot.ts`; `classify.ts`; `planfile.ts`.
3. Wire `migrate projects --plan` in `bin/dev-tasks.ts`; help text.
4. Green; run once on this repository read-only.

#### Files to Create/Modify

- `core/migrate-projects/gh.ts`, `snapshot.ts`, `classify.ts`, `planfile.ts`, `index.ts` (new)
- `bin/dev-tasks.ts`, `bin/parse-args.ts` (A-63)
- `core/migrate-projects/conventions.ts` (A-87), `core/checks/roadmap.ts` (A-59)
- `test/unit/migrate-projects/*.test.ts`, `test/fixtures/migrate-projects/*.json` (new)

#### Definition of Done Checklist

- [ ] Code implemented per technical guidelines
- [ ] Unit/integration/manual/edge-case tests written and passing
- [ ] Quality gates passing (`lint`, `format:check`, `typecheck`, `test`, `audit`)
- [ ] Code reviewed and approved
- [ ] Acceptance criteria verified
- [ ] Acceptance criteria explicitly mapped to test evidence
- [ ] Migration lifecycle complete (or documented opt-out) when schema/data-model changes exist
- [ ] Pull Request created and merged

---

### Story S-014: The plan maps stories to waves by precedence and batches only the writes the scope rules permit

**Priority:** Critical
**Estimated Size:** M
**Dependencies:** S-013

#### User Story

As the owner reviewing a migration plan,
I want each story mapped to its wave by a fixed precedence, and only permitted writes proposed,
So that nothing is guessed, no shipped wave gets a tracking issue, and no title changes.

#### Context

FR-18's precedence and FR-19's scope rules are the core of the migration (D-18, D-19). The roadmap is canonical by the time this runs (D-86). AC-11 in the PRD is this story's fixture test (D-90).

#### Acceptance Criteria

> **Annotated v1.1 (Design Mode, spec §16a).**
> - **Mapping.** AC-1's rule 3 (milestone) is dropped (D-98, A-57), and rule 2 is scoped to the PRD named in the title prefix (A-56). The slug maps to a PRD by the roadmap link text (A-55).
> - **Fixture.** AC-7's fixture replaces "one by milestone" with one story whose only link is a milestone, which stays unmapped.
> - **Batches.** AC-3's batch 1 creates every missing type and `level:` label and sets descriptions (A-71). Batch 4b writes blocking-link and priority answers (A-73). Batch 6 creates the PRD comment only when absent, otherwise adds missing rows (A-67). Rows carry `Depends on`, and create rows show title and template (A-81, A-84).
> - **Answers and edges.** AC-6's answers feed a fresh `--plan`, which resets approval (A-50). Edge rules follow A-83.

- [ ] AC-1: `map.ts` maps a story by the first rule yielding exactly one roadmap row: the `**Story:**` body line; a `phase: X` label matching a row's `Phase/Wave` cell exactly; the milestone when exactly one row names it; else unmapped with the reason (FR-18, D-86).
- [ ] AC-2: `--plan` exits `InvalidUsage` (2) with a pointer to product-engineer's roadmap conversion when `docs/roadmap.md` has no canonical table (D-86).
- [ ] AC-3: `plan.ts` builds batches 1 to 7 in spec §8.3's order and contents: labels (create missing `level:` and `type: test`; mark retired descriptions), tracking issues (one PRD issue per PRD with a mapped story; one wave issue per wave with an open story or an active planner state file; none for a shipped wave), hierarchy links (skipping links already present), story and type labels, retired-label removals (D-91), PRD status comments with `—` for waves without an issue (D-92, D-73), and the Project cleanup batch with runner `user` (D-81).
- [ ] AC-4: A reused pre-`level:` tracking issue gets `level: prd` or `level: wave` added and its experiment `type:` label removed; two matching tracking issues omit that PRD's batches and list both for the user (D-87).
- [ ] AC-5: No write changes a title, no write targets a standalone issue's hierarchy, and no write sets a Project Status (D-19, D-27, D-82).
- [ ] AC-6: Answers from a previous plan file's review tables (unmapped → wave id or "standalone"; needs a type → type) are read by the next `--plan` and applied before batching.
- [ ] AC-7: The AC-11 fixture (one PRD, two waves, six stories: two by body line, two by `phase:` label, one by milestone, one unmappable; one standalone bug; a `type: prd` tracking issue; retired labels; zero- and two-`type:` issues) yields exactly the expected batches and lists, asserted in one test (PRD AC-11).

#### Business Rules

- Never guess: an issue the precedence cannot map waits for the user (D-18).
- A shipped wave's roadmap row is its record; it gets no tracking issue (FR-19).

#### Technical Notes

- "Shipped wave": roadmap Status `Done`. "Active planner state file": a `workstream/planner-state-*.md` whose Run Info names the wave.
- The Project cleanup batch never reads the Project (D-96, D-97): it prints the `gh project item-list … --jq` query that lists pull-request items, the `gh project item-delete` template, and the two Workflows-page steps (D-81).

#### Testing Requirements

- **Unit Tests:** `map` per rule and per ambiguity; `plan` per batch; answers carried over.
- **Integration Tests:** the AC-11 fixture end to end through `--plan`.
- **Manual/UI Testing:** this repository's plan reviewed by the owner in S-017.
- **Edge-Case Matrix:** a `phase:` label matching two rows (unmapped, reason "ambiguous"); a milestone shared by every wave (rule 3 yields nothing, next rule); a story whose body line and `phase:` label disagree (body line wins, both cited); a wave with only closed stories but an active state file (gets a wave issue); a story already linked to the right wave (no write) or a wrong one (listed for the user, no relink).
- **Acceptance-Criteria Mapping:** AC-1 → `map.test.ts`; AC-2 → `cli.test.ts`; AC-3, AC-4, AC-5 → `plan.test.ts`; AC-6 → `answers.test.ts`; AC-7 → `ac11-fixture.test.ts`.
- **Execution Commands:** `pnpm run test:unit`, `pnpm run validate`.

#### Migration Requirements

- Not applicable.

#### Implementation Steps

1. The AC-11 fixture and failing tests.
2. `roadmap.ts` (canonical table parser, reusing `roadmap-parity`'s definition), `map.ts`, `plan.ts`.
3. Answers carried from the previous plan.
4. Green.

#### Files to Create/Modify

- `core/migrate-projects/roadmap.ts`, `map.ts`, `plan.ts` (new); `planfile.ts`, `index.ts`
- `test/unit/migrate-projects/*.test.ts`, `test/fixtures/migrate-projects/ac11/*.json`

#### Definition of Done Checklist

- [ ] Code implemented per technical guidelines
- [ ] Unit/integration/manual/edge-case tests written and passing
- [ ] Quality gates passing (`lint`, `format:check`, `typecheck`, `test`, `audit`)
- [ ] Code reviewed and approved
- [ ] Acceptance criteria verified
- [ ] Acceptance criteria explicitly mapped to test evidence
- [ ] Migration lifecycle complete (or documented opt-out) when schema/data-model changes exist
- [ ] Pull Request created and merged

---

### Story S-015: `dev-tasks migrate projects --apply` runs only an approved plan and records every write

**Priority:** Critical
**Estimated Size:** M
**Dependencies:** S-014

#### User Story

As the owner who approved a migration plan,
I want the command to apply exactly what I approved, record each result, and resume safely,
So that an interruption or a failed call never leaves me unsure what changed.

#### Context

`--apply` is the only writer (D-79). github-ops runs it only after explicit approval (D-80). Per-write states make it resumable (D-88); the snapshot hash stops a stale plan (spec §8.4).

#### Acceptance Criteria

> **Annotated v1.1 (Design Mode, spec §16a).**
> - **Approval checks.** AC-2's hash check runs only while every row reads `pending`, with per-write target checks after that (D-101, A-49). `--apply` also checks the `Plan digest:` (A-51). Argv is built only from Action, Target and Detail, with `--flag=value` (A-51, A-93).
> - **Edge cases.** The "unanswered review row" edge case is replaced: answers never become writes in `--apply` (A-50).
> - **Write-back and exits.** Write-back is atomic, and a lock file refuses concurrent runs (A-80). AC-6's prefix is `Retired (D-91): `, kept under 100 characters and never doubled (A-82). Exit codes follow A-64.

- [ ] AC-1: `--apply [--plan-file <path>]` exits `ReconciliationConflict` (14), writing nothing, while the plan header reads `Approved: no` (FR-17, D-80).
- [ ] AC-2: `--apply` re-reads the snapshot and exits `ReconciliationConflict` (14) with "regenerate the plan", writing nothing, when its hash differs from the plan's `Snapshot` (spec §8.4).
- [ ] AC-3: Batches 1 to 6 run in order; each write's state (`done`, `failed(<first stderr line>)`, `skipped(already applied)`, `skipped(depends on W-NN)`) is written back to the plan file after its call (D-88).
- [ ] AC-4: A re-run executes only `pending` and `failed` writes; a `done` write is never repeated (D-88).
- [ ] AC-5: Batch 7 is never executed; the summary prints its steps for the user, and the command makes no `gh project` call of any kind (D-81, D-22).
- [ ] AC-6: Retired labels are removed from open issues and their definitions' descriptions prefixed `Retired (projects-tracking#D-91):`; no `gh label delete` call is ever made (D-91, PRD AC-12).
- [ ] AC-7: Every issue body and comment body goes through `--body-file`; the status comment uses the wave 1 marker procedure (spec §6).
- [ ] AC-8: Exit code `GeneralError` (1) when any write ends `failed`, `Success` (0) otherwise; `--json` prints the per-batch counts.

#### Business Rules

- Nothing is deleted: not a label definition, not an issue, not a comment (D-91, spec §15).
- No Project write and no Status write by the command (D-22, D-27, D-81).

#### Technical Notes

- `apply.ts` and `gh.ts` are the only writers. Created issue numbers are recorded in the write's detail so dependent writes (links, comments) can resolve them on a re-run.
- Temporary body files go under the OS temp directory and are removed after the call.

#### Testing Requirements

- **Unit Tests:** a recording `GhRunner` asserts the exact write calls per batch; state transitions per the spec §8.4 diagram.
- **Integration Tests:** an interrupted run (runner throws on write 5) resumed from the plan file repeats writes 1 to 4 zero times (PRD AC-12).
- **Manual/UI Testing:** this repository's migration in S-017.
- **Edge-Case Matrix:** a label already present (`skipped(already applied)`); a wave issue create fails (its links `skipped(depends on W-NN)`); the plan file edited by hand to `Approved: yes` with an unanswered review row (that item's writes stay `pending` and are reported); a write succeeds but the plan-file write-back fails (next run detects the applied state and records `skipped(already applied)`).
- **Acceptance-Criteria Mapping:** AC-1, AC-2 → `apply-gates.test.ts`; AC-3, AC-4 → `apply-states.test.ts`; AC-5, AC-6 → `apply-scope.test.ts`; AC-7 → `apply-bodies.test.ts`; AC-8 → `cli.test.ts`.
- **Execution Commands:** `pnpm run test:unit`, `pnpm run validate`.

#### Migration Requirements

- Rollback notes are part of the runbook (S-017): every write is reversible by hand from the plan file's table.

#### Implementation Steps

1. Failing tests for the gates, states, scope and bodies.
2. `apply.ts`; wire `--apply` in `bin/dev-tasks.ts`.
3. Green.

#### Files to Create/Modify

- `core/migrate-projects/apply.ts` (new); `planfile.ts`, `index.ts`
- `bin/dev-tasks.ts`
- `test/unit/migrate-projects/apply-*.test.ts`

#### Definition of Done Checklist

- [ ] Code implemented per technical guidelines
- [ ] Unit/integration/manual/edge-case tests written and passing
- [ ] Quality gates passing (`lint`, `format:check`, `typecheck`, `test`, `audit`)
- [ ] Code reviewed and approved
- [ ] Acceptance criteria verified
- [ ] Acceptance criteria explicitly mapped to test evidence
- [ ] Migration lifecycle complete (or documented opt-out) when schema/data-model changes exist
- [ ] Pull Request created and merged

---

### Story S-017: A runbook and github-ops' migration mode take a repository through the migration; this repository goes first

**Priority:** High
**Estimated Size:** M
**Dependencies:** S-013, S-014, S-015, S-016, S-019

#### User Story

As an owner adopting the conventions in an existing repository,
I want a runbook and an agent conversation that walk me from roadmap check to merged record,
So that I can migrate any repository the same way, and this one proves it works.

#### Context

The runbook ships in the same PR as the procedure (FR-22, FR-49a). github-ops' migration mode is the conversation around the command (D-79). This repository's migration is the wave's dogfood, and the committed plan file is its evidence (D-93). riel follows after delivery, outside this wave (D-94).

#### Acceptance Criteria

> **Annotated v1.1 (Design Mode, spec §16a).**
> - **Runbook.** AC-1's runbook uses the five FR-48 headings, and `runbook-set.test.ts` gains it (A-62).
> - **Migration mode.** AC-2: after answers, github-ops re-runs `--plan`, and you approve the final batches (A-50). The mode describes the Project batch without quoting `gh project` commands (A-61). PT-80 extends the Project-write guard to `core/migrate-projects/` (A-60).
> - **Dogfood.** AC-3's verification uses `--plan --out <scratch path>` (A-65), and the expected dogfood result is stated in advance (A-90).

- [ ] AC-1: `docs/runbooks/runbook-migrate-to-projects-tracking.md` documents, in order: roadmap check and conversion (S-016), `--plan`, answering the review lists, approval, `--apply`, the Project cleanup batch with each Workflows-page step and the `gh project item-delete` command (D-81), committing the plan file on a `chore/<issue-number>-projects-migration` branch with `git add -f` and opening a PR (D-93), and rollback by hand from the plan file (FR-22).
- [ ] AC-2: github-ops in all three trees gains a migration mode: run `--plan`, present each review item as one question with a recommendation, write the answers into the plan, ask for explicit approval, set `Approved: yes`, run `--apply`, hand the Project batch to the user, then commit the plan file and open the chore PR; it never runs `--apply` without the explicit approval and never writes the Project (D-80, D-81).
- [ ] AC-3: This repository is migrated with the runbook: the plan file, with every write `done` or `skipped(<reason>)` and the Project batch ticked by the owner, is committed in a chore PR referenced from the consolidated PR (D-93).
- [ ] AC-4: `docs/runbooks/README.md` (or the runbook index) lists the new runbook; the `docs-structure` check passes.
- [ ] AC-5: Parity pins for AC-2 across the three github-ops copies; the runbook is the only file in `docs/` that names `gh project item-delete`, and PT-28b still passes (D-81).

#### Business Rules

- The runbook ships in this PR, not a follow-up (FR-49a).
- No dependency on riel (D-94).

#### Technical Notes

- This repository's roadmap is already canonical, so S-016's conversion is a no-op here; the runbook says so for such repositories.
- Project 5 holds issue items only today, so its cleanup batch is the two settings checks.

#### Testing Requirements

- **Unit Tests:** parity pins for the migration mode; a docs check that the runbook exists and is indexed.
- **Integration Tests:** none beyond S-013 to S-015.
- **Manual/UI Testing:** the dogfood run on this repository, with the plan file as evidence.
- **Edge-Case Matrix:** an unmapped issue the owner answers "standalone" (no write); the owner declines approval (nothing written, plan kept); a run interrupted mid-apply and resumed (resumes per D-88).
- **Acceptance-Criteria Mapping:** AC-1 → `docs > runbook sections`; AC-2 → `github-ops > migration mode`; AC-3 → the committed plan file; AC-4 → `docs-structure`; AC-5 → parity file and PT-28b.
- **Execution Commands:** `pnpm run test:unit`, `pnpm run validate`.

#### Migration Requirements

- This story is the migration of this repository: plan artifact, owner approval before apply, apply, and verification by the committed plan file. Rollback per the runbook.

#### Implementation Steps

1. Pins for the migration mode and the runbook; red.
2. Runbook and index; github-ops ×3 migration mode.
3. Green; run the migration on this repository with the owner's approval; commit the plan file in a chore PR.

#### Files to Create/Modify

- `docs/runbooks/runbook-migrate-to-projects-tracking.md` (new), `docs/runbooks/README.md`
- `.claude/agents/github-ops.md`, `.github/agents/github-ops.agent.md`, `.kiro/agents/github-ops.md`
- `test/unit/projects-tracking-wave-3-parity.test.ts`, `test/unit/runbook-set.test.ts` (A-62)
- `workstream/migration-projects.md` (the record, force-added)

#### Definition of Done Checklist

- [ ] Code implemented per technical guidelines
- [ ] Unit/integration/manual/edge-case tests written and passing
- [ ] Quality gates passing (`lint`, `format:check`, `typecheck`, `test`, `audit`)
- [ ] Code reviewed and approved
- [ ] Acceptance criteria verified
- [ ] Acceptance criteria explicitly mapped to test evidence
- [ ] Migration lifecycle complete (or documented opt-out) when schema/data-model changes exist
- [ ] Pull Request created and merged

---

## Coverage Validation

### Summary

- **Total PRD Requirements (wave 3):** 13 (FR-17 to FR-22, FR-26; AC-11, AC-12, AC-13, AC-16; business rule "migration never guesses"; constraint "Done when the consolidated PR merges")
- **Total User Stories:** 6
- **Coverage:** 100%
- **Status:** Complete

### Requirement Mapping

| PRD Requirement                                   | Story ID(s)                | Status     |
| ------------------------------------------------- | -------------------------- | ---------- |
| FR-17 dry-run plan, batches, approval, apply      | S-013, S-014, S-015, S-017 | ✅ Covered |
| FR-18 mapping precedence                          | S-014                      | ✅ Covered |
| FR-19 scope rules, story definition               | S-013, S-014               | ✅ Covered |
| FR-20 retired labels, Project batch by the user   | S-014, S-015, S-017        | ✅ Covered |
| FR-21 roadmap conversion, state-file line         | S-016, S-014               | ✅ Covered |
| FR-22 runbook, this repository migrated           | S-017                      | ✅ Covered |
| FR-26 types, priorities, `**Blocks:**`, audit     | S-019, S-013               | ✅ Covered |
| AC-11 fixture dry run                             | S-014 (AC-7), S-013 (AC-6) | ✅ Covered |
| AC-12 after apply: no retired label, no Project write, no Status | S-015              | ✅ Covered |
| AC-13 roadmap passes parity, state files          | S-014, S-016               | ✅ Covered |
| AC-16 github-ops conventions and audit            | S-019                      | ✅ Covered |
| Migration never guesses (business rule)           | S-013 (AC-4), S-014 (AC-1) | ✅ Covered |
| Done when the consolidated PR merges (D-94)       | S-017                      | ✅ Covered |

### Gaps

- None. AC-12's "the Project holds no pull-request item" is now verified by the owner ticking the Project batch, since no agent reads or writes the Project (D-81); S-017 AC-3 records it.

### Non-Goals Validation

- [x] No agent writes Project Status or Project items — confirmed in no story (S-015 AC-5 asserts the opposite).
- [x] No title is changed — S-014 AC-5.
- [x] No `role:` or `needs:` label category — S-019 business rules.
- [x] No riel migration in this wave — S-017 business rules (D-94).
- [x] No Status backfill — S-014 AC-5 (D-27).
