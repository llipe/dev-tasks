# Implementation Plan - projects-tracking Wave 3 (migration of an existing repository)

Source: `workstream/user-stories-projects-tracking-phase-3.md` v1.0 — all 6 stories selected (#318 to #323).
Wave issue: #317
Spec: `workstream/specification-projects-tracking-phase-3.md` v1.3 (§16a wins over earlier sections)
Test plan: `workstream/test-plan-projects-tracking-phase-3.md`, `workstream/traceability-matrix-projects-tracking-phase-3.md`
Decisions: `workstream/decisions-projects-tracking.md` (wave 3 HOW rows D-79 to D-101)
Repository shape: single-package — package brackets omitted per `docs/tech.md`.
Order: 1.0 (S-019) → 2.0 (S-016) → 3.0 (S-013) → 4.0 (S-014) → 5.0 (S-015) → 6.0 (S-017). Prompt stories pin in the new `test/unit/projects-tracking-wave-3-parity.test.ts`; code stories test under `test/unit/migrate-projects/` with synthetic fixtures under `test/fixtures/migrate-projects/` (D-95). Each behavioral sub-task writes its test first and sees it fail.

## Relevant Files

- `.claude/agents/github-ops.md`, `.github/agents/github-ops.agent.md`, `.kiro/agents/github-ops.md` - type set, priority scale, `**Blocks:**` line, dependency commands, audit checks (S-019); migration mode (S-017)
- `.claude/commands/product-engineer.md`, `.github/agents/product-engineer.agent.md`, `.kiro/agents/product-engineer.md` - aggregation queries (S-019); roadmap conversion step, `### Roadmap Conversion (before migration)` under § Roadmap Maintenance (S-016)
- `.claude/skills/activity-publish-github/SKILL.md` and its `.github` and `.kiro` copies - one `type:` per story (S-019)
- `core/migrate-projects/gh.ts` - injectable `GhRunner` and the real `execFile("gh")` runner (S-013)
- `core/migrate-projects/snapshot.ts` - read-only snapshot and its hash (S-013)
- `core/migrate-projects/classify.ts` - story, tracking issue, standalone; needs a type; needs a blocking link (S-013)
- `core/migrate-projects/planfile.ts` - render and parse the migration plan (S-013, S-014, S-015)
- `core/migrate-projects/roadmap.ts` - canonical roadmap table parser (S-014)
- `core/migrate-projects/map.ts` - FR-18 precedence (S-014)
- `core/migrate-projects/plan.ts` - batches 1 to 7 and 4b, the row grammar, the batch 7 builder (S-014)
- `core/migrate-projects/answers.ts` - previous plan answers and their grammar (S-014, task 4.7)
- `core/migrate-projects/apply.ts` - gated, recorded, resumable writes; the lock file; the apply summary and `--json` (S-015)
- `core/migrate-projects/summary.ts` - per-batch and per-list counts shared by `--plan` and `--apply`, split out of `index.ts` (S-015)
- `core/migrate-projects/snapshot.ts` - `SNAPSHOT_ERROR_EXIT`, the exit code per snapshot failure, shared by both modes (S-015)
- `test/unit/migrate-projects/apply-gates.test.ts`, `apply-states.test.ts`, `apply-scope.test.ts`, `apply-bodies.test.ts` - `--apply` AC-1 to AC-7, RT-11, RT-12, RT-14 (S-015)
- `test/unit/migrate-projects/apply-hardening.test.ts`, `apply-writeback.test.ts`, `apply-paths.test.ts` - the qa-pass safety properties, EC-140 under a simulated crash, the remaining paths (S-015 tasks 5.18 to 5.24)
- `test/unit/migrate-projects/helpers/fake-github-writes.ts`, `apply-run.ts`, `random-repo.ts` - the model's write half, the in-process apply run, the RT-11 generator (S-015)
- `.gitignore` - ignores `workstream/.migration-projects.lock` (S-015, A-80)
- `core/migrate-projects/index.ts` - module entry (S-013 to S-015)
- `bin/dev-tasks.ts` - `migrate projects --plan | --apply` dispatch and help; `--apply` releases the lock on SIGINT/SIGTERM (S-013, S-015)
- `bin/parse-args.ts` - flag validation (S-013, A-63); `--apply` usage line (S-015)
- `core/migrate-projects/local-reader.ts` - injectable `LocalReader` for the roadmap, PRD and state files (S-013, A-52)
- `core/migrate-projects/conventions.ts` - the type set, tie-break and suggestions, defined once (S-013, A-87)
- `core/checks/roadmap.ts`, `core/checks/index.ts` - exported canonical-table parser (S-013, A-59), used by S-014
- `test/unit/runbook-set.test.ts` - gains the new runbook (S-017, A-62)
- `test/unit/projects-tracking-wave-3-parity.test.ts` - prompt pins (S-019, S-016, S-017)
- `test/unit/migrate-projects/*.test.ts` - module and CLI tests (S-013 to S-015)
- `test/unit/migrate-projects/helpers/*.ts` - fake GitHub model, recording runner, test-side write oracle, seeded PRNG (S-013); issue comments, `model-apply.ts` (test-side plan replay for RT-12) and `plan-run.ts` (S-014)
- `test/fixtures/migrate-projects/ac11/` - the AC-11 fixture and its `SOURCE.md` (S-014, RV-3)
- `test/unit/projects-tracking-wave-3-parity.test.ts` - PT-80 narrowed to plan.ts's batch 7 builder, PT-81 pins label colours and level/priority descriptions (S-014)
- `test/fixtures/migrate-projects/fake-gh/gh` - fake `gh` for the Layer 2 CLI tests (S-013, A-85); `<file>` body keys, `FAKE_GH_BODIES`, `FAKE_GH_DELAY_MS` (S-015)
- `test/unit/roadmap-parity.test.ts` - imports the shared roadmap parser (S-013, A-59)
- `test/unit/parse-args.test.ts`, `test/unit/cli-flags.test.ts`, `CHANGELOG.md` - flag handling for every command (S-013 task 3.16); `--apply` entry (S-015)
- `README.md`, `docs/dev-tasks-user-manual.md`, `TESTING.md` - `migrate projects --plan` reference and the test harness note (S-013); `--apply` reference, exit codes and the apply harness note (S-015)
- `test/fixtures/migrate-projects/**/*.json` - synthetic `gh` output, including the AC-11 fixture (S-013, S-014)
- `docs/runbooks/runbook-migrate-to-projects-tracking.md`, `docs/runbooks/README.md` - the runbook and its index entry (S-017)
- `README.md`, `docs/dev-tasks-user-manual.md` - point to the migration runbook and github-ops' Migration Mode (S-017)
- `workstream/migration-projects.md` - this repository's migration record, force-added (S-017)

## Tasks

- [x] 1.0 Implement Story S-019: github-ops states one type per issue, a priority scale that names release blockers, and the native blocking link (#318)

  - [x] 1.1 Create `test/unit/projects-tracking-wave-3-parity.test.ts` with pins for the type set and tie-break, the priority scale, the dependency commands, the three audit checks, product-engineer's aggregation queries and activity-publish-github's one-type rule, each line byte-identical across the three copies, plus the negative that no copy lists `type: other` as a valid choice; run `pnpm run test:unit`, confirm red
  - [x] 1.2 In the three github-ops copies' Labels section, list the eight types with their definitions, the "exactly one `type:` per issue" rule, the tie-break order, and `type: other` as retired; add a `type: test` row and narrow `tech-debt`'s description (D-85)
  - [x] 1.3 Rewrite the priority rows to the D-84 scale, with the `blocked by` relation and the `**Blocks:** #N — <reason>` body line for `critical`, and the rule that any issue blocking another carries the line (D-84)
  - [x] 1.4 Add the dependency commands (`POST` and `DELETE` on `repos/{o}/{r}/issues/{blocked}/dependencies/blocked_by`) to the Command Map, with the sentence that issue dependencies are issue data an agent may write, unlike the Project (D-22, D-83)
  - [x] 1.5 Add the three audit checks: `critical` without a blocking relation, zero or several `type:` labels, a retired label on an open issue
  - [x] 1.6 Add the aggregation queries to product-engineer ×3: follow-ups by `Follow-up to #N`, bugs by `type: bug` without `level:`, release blockers by `priority: critical` (D-83)
  - [x] 1.7 Require exactly one `type:` from the set in activity-publish-github ×3 (D-85)
  - [x] 1.7a Put the aggregation queries in product-engineer § Drift Reconciliation (A-86); exempt `level: prd` and `level: wave` from the audit's type check (A-68); spell the dependency `DELETE` command exactly (A-89); PT-81 pins the prompt's type set to `core/migrate-projects/conventions.ts` (A-87) — done here: A-86, A-68, A-89; PT-81 deferred to S-013 (#320), which creates `conventions.ts`
  - [x] 1.8 Verify Acceptance Criterion: AC-1 type set, definitions, tie-break, `type: test` row, `type: other` retired
  - [x] 1.9 Verify Acceptance Criterion: AC-2 priority scale and `**Blocks:**` rule
  - [x] 1.10 Verify Acceptance Criterion: AC-3 dependency commands and the agent-may-write sentence
  - [x] 1.11 Verify Acceptance Criterion: AC-4 the three audit checks
  - [x] 1.12 Verify Acceptance Criterion: AC-5 aggregation queries; AC-6 one type per story
  - [x] 1.13 Edge cases: `bug` plus `security` resolves to `security`; a `high` issue blocking another keeps `high` and carries the line; a `critical` issue whose blocked issue is closed: the relation still exists, so it is not reported (A-72)
  - [x] 1.14 AC-to-test mapping: AC-1 → `github-ops > type set`; AC-2 → `github-ops > priority scale`; AC-3 → `github-ops > dependency commands`; AC-4 → `github-ops > audit checks`; AC-5 → `product-engineer > aggregation`; AC-6 → `activity-publish-github > one type`; AC-7 is the file
  - [x] 1.15 Run Tests: `pnpm run test:unit`, `pnpm run validate` green
  - [x] 1.16 Pin byte-identity across the three trees for the `Retired labels, in full:` line, the `priority: high … medium … low` sentence, the Command Map "List what an issue blocks" row and the `## Conventions` report-template table (finding 2). Test first.
  - [x] 1.17 Add `--limit 1000` to all three aggregation queries in product-engineer § Drift Reconciliation (all three trees) and update PT-64 (finding 4, A-74).
  - [x] 1.18 Reword the bugs-query reason from "so tracking issues never count" to "so story and tracking issues never count" (finding 8), three trees.
  - [x] 1.19 Reword the `priority: high` table row and the priority sentence from "blocks nothing" to "blocks no ship", so a `high` issue may block another issue while keeping `high` (finding 5; D-102)
  - [x] 1.20 Add a fourth github-ops audit check: a `priority: critical` issue that has a native `blocking` relation but no `**Blocks:** #N — <reason>` body line is reported (finding 6; D-102). Add it to the audit list and the `## Conventions` report table; extend PT-63

- [x] 2.0 Implement Story S-016: product-engineer converts a narrative roadmap to the canonical table before migration (#319)

  - [x] 2.1 Add pins for the conversion step, the migration dependency and the state-file sentence to the wave 3 parity file; confirm red
  - [x] 2.2 In product-engineer ×3 Roadmap Maintenance, add the conversion step: draft the canonical table when none exists, keep the narrative verbatim below it, flag every translated Status, ship it as its own docs PR before migration (FR-21, D-86)
  - [x] 2.3 State that `migrate projects --plan` refuses to run without the table and maps `phase: X` only to an exactly equal `Phase/Wave` cell, among the rows of the PRD named in the story's `[PRD-<name>]` title prefix (D-86, D-98)
  - [x] 2.4 State that migration edits no planner state file; the planner's resume adds a missing `Wave issue:` line (D-89)
  - [x] 2.4a Define a "partial table" as a canonical header with at least one row (A-59), and match PRD AC-13 as amended (D-99)
  - [x] 2.5 Verify Acceptance Criterion: AC-1 conversion step; AC-2 migration dependency; AC-3 state files
  - [x] 2.6 Edge cases in the step's text: a partial canonical table counts as canonical; a narrative "paused" translates to `Not started` and is flagged; two narrative sections for one wave give one row citing both
  - [x] 2.7 AC-to-test mapping: AC-1 → `product-engineer > roadmap conversion`; AC-2 → `product-engineer > migration dependency`; AC-3 → `product-engineer > state files`; AC-4 is the file
  - [x] 2.8 Run Tests: `pnpm run test:unit` green
  - [x] 2.9 Scope the exact match to the PRD (F1, D-98, A-56): append ", among the rows of the PRD named in the story's `[PRD-<name>]` title prefix (D-98)" to the `phase: X` sentence; extend PT-69. Test first.
  - [x] 2.10 Harden the pins (F2): make PT-72's negative check sentence-based and case-insensitive, allowing only the never-`Done` sentence and the citation sentence; pin "never instead of it", "from the fixed set", "the user approves the draft", "never inside the migration's own PR", "never fuzzy-matched" with the unmapped listing, and "as information" for `--plan` and state files; prove the pins catch the verifier's probes M1 to M8. Test first.
  - [x] 2.11 In the conversion's Status step, before writing `Done`, confirm on GitHub that the cited PR merged or the issue closed (`gh pr view <n> --json state` / `gh issue view <n> --json state`); otherwise keep the translated Status and flag it (D-104). Amend the "Never mark a row `Done` yourself" bullet in Roadmap Maintenance so it names the conversion as the second exception, only on confirmed merged evidence (D-104). Pin both, and pin ", with the original word, for the user to confirm or correct" (probe M9). Test first.

- [x] 3.0 Implement Story S-013: `dev-tasks migrate projects --plan` reads the repository and writes a reviewable migration plan (#320)

  - [x] 3.1 Write synthetic fixtures under `test/fixtures/migrate-projects/` shaped like the 2026-10-23 survey: `Story S-NNN` titles without a body line, `phase:` labels on stories and follow-ups, one shared milestone, a `type: prd` tracking issue, retired `status:` and `needs:` labels, zero- and two-`type:` issues (D-95)
  - [x] 3.2 Write failing tests: `classify.test.ts` per rule, `planfile.test.ts` round-trip with answers, `snapshot.test.ts` hash stable under reordering, `plan-readonly.test.ts` asserting zero write calls and no issue bodies in the file (D-90)
  - [x] 3.3 `gh.ts`: the `GhRunner` type and the real runner over `execFile("gh", args)`, never a shell string (D-79, D-90)
  - [x] 3.4 `snapshot.ts`: labels, open issues, tracking issues' sub-issues and parent, `docs/roadmap.md`, `workstream/planner-state-*.md`; `--paginate` or `--limit 1000` on every list; SHA-256 over sorted, normalized JSON
  - [x] 3.5 `classify.ts`: story by `/\bStory S-\d+\b/` or the `**Story:**` line (D-82); tracking issue by the D-36 prefix with or without its `level:` label (D-87); standalone otherwise; "needs a type" with the Conventional Commits suggestion, counting `type: other` and `type: prd|wave|story` as none (D-85); "needs a blocking link" for `critical` without a relation or `**Blocks:**` line, never inventing one (D-84)
  - [x] 3.6 `planfile.ts`: render and parse the spec §5 shape (header with `Generated`, `Snapshot`, `Approved: no`; review tables; batch tables with states); issue numbers, titles and label names only
  - [x] 3.6a `conventions.ts`: the D-85 type set, tie-break and D-100 suggestions, defined once (A-87); `core/checks/roadmap.ts`: export the canonical-table parser and make `roadmap-parity.test.ts` import it (A-59)
  - [x] 3.6b Reads per §16a: an injectable `LocalReader` for roadmap and state files, `--repo` checked against the working tree, both files hashed (A-52); `gh api --paginate` with REST numeric ids, no `--limit` cap (A-74, A-75); story parents read (A-76); tracking issues searched `--state all` (A-91)
  - [x] 3.6c Classification per §16a: stories first, then tracking issues by the A-53 rule, the tolerant `**Story:**` pattern (A-54), tracking issues exempt from "needs a type" (A-68), only D-85 types counted and D-100 suggestions (A-69, A-70), the critical check on `.../dependencies/blocking` (A-72)
  - [x] 3.6d Plan file per §16a: `Format: 1` and `Plan digest:` headers, one table per review list plus Information, `W-NNN` IDs, escaped cells (A-51, A-77, A-78); `--plan` refuses to overwrite a file with non-`pending` rows (A-65); `MigrationPlan*` export names (A-92)
  - [x] 3.6e CLI per §16a: `bin/parse-args.ts` rejects unknown flags and both or neither of `--plan`/`--apply` with exit 2 (A-63); exit codes and the `--json` schema of A-64; `gh auth status --hostname github.com` (A-88); CLI tests against a fake `gh` on a purpose-built `PATH` with an injected clock (A-85)
  - [x] 3.7 `bin/dev-tasks.ts`: `migrate projects --plan [--repo] [--out] [--json]`, `--repo` from `gh repo view --json nameWithOwner`; `gh auth status` first, `DependencyError` (11) with the `gh auth login` hint on failure (D-96); help text beside `migrate docs`
  - [x] 3.8 Verify Acceptance Criterion: AC-1 command and defaults; AC-2 auth check and exit 11
  - [x] 3.9 Verify Acceptance Criterion: AC-3 snapshot reads through the injectable runner, paginated
  - [x] 3.10 Verify Acceptance Criterion: AC-4 classification and both review lists
  - [x] 3.11 Verify Acceptance Criterion: AC-5 render then parse round-trips with answers; AC-6 zero write calls; AC-7 no bodies in the file
  - [x] 3.12 Edge cases: `gh` not on PATH; zero open issues; a story with an empty body; a `[PRD-x] Wave 1:` title without `level:`; CRLF bodies; more than 1,000 issues
  - [x] 3.13 Manual check: `pnpm exec tsx bin/dev-tasks.ts migrate projects --plan` on this repository; nothing changes on GitHub
  - [x] 3.14 AC-to-test mapping: AC-1, AC-2 → `cli.test.ts`; AC-3 → `snapshot.test.ts`; AC-4 → `classify.test.ts`; AC-5 → `planfile.test.ts`; AC-6, AC-7 → `plan-readonly.test.ts`
  - [x] 3.15 Run Tests: `pnpm run test:unit`, `pnpm run typecheck`, `pnpm run validate` green
  - [x] 3.16 parse-args regression (High, qa-engineer gate on PR #328): every command exits 2 (`InvalidUsage`) on an unknown flag, naming it, and on a value flag without a value (`--profile`, `--pin`, `--repo`, `--out`, `--plan-file`, including an empty `--flag=`); `dev-tasks migrate --plan`/`--apply` without the `projects` sub-verb exits 2 with a hint to use `migrate projects` and never runs the legacy migration; `pin -x` keeps exiting 2. Add `test/unit/parse-args.test.ts` (Layer 1, imports `parseArgs`) and CLI tests across install, update, status, pin, migrate docs and migrate; add a CHANGELOG line under the unreleased section. Test first.
  - [x] 3.17 EC-110 / mutant M1 (High): tests where a story also carries a tracking signal (`[PRD-alpha] Story S-001: x` with `level: wave`; the same with `type: prd`; `[PRD-alpha] Wave 1: x` with a `**Story:**` body line) assert the story wins; RT-13 asserts which kind wins, not only "exactly one". Test first.
  - [x] 3.18 Error paths (Medium): snapshot parent read failing with a non-404 and with unreadable JSON, and unreadable `repo view` JSON, report the named call and never crash (EC-157); planfile parse guards (missing column, cell-count mismatch, bad `Generated:`, unexpected `##` section) and the missing separator in `core/checks/roadmap.ts`; classify's "search incomplete" and "roadmap missing" notes asserted; a CLI test for exit 1 on a failed read; `isRetiredLabel` used or removed. Test first.
  - [x] 3.19 (F-5, verifier audit on PR #328) Align `docs/dev-tasks-user-manual.md`'s Exit Codes table with `core/exit-codes.ts` (0, 1, 2, 11, 14; drop the stale 3 and 4) and document that a file at `--out` that is not a migration plan exits 14.
  - [x] 3.20 (F-7) Make PT-81's retired-label check two-way: parse the prompt's retired list into a set and compare it with `RETIRED_LABELS` both ways, exact names (no suffix matching for `needs:`); show that removing `"needs: merge"` from `RETIRED_LABELS` now fails. Test first.
  - [x] 3.21 (F-8) Extend PT-80's line check to `/ProjectV2|projectV2|\/projects\b/` so GraphQL ProjectV2 mutations and REST `/projects` paths in `core/migrate-projects/` are caught; prove it with a scratch probe. PT-28 unchanged. Test first.

- [x] 4.0 Implement Story S-014: The plan maps stories to waves by precedence and batches only the writes the scope rules permit (#321)

  - [x] 4.1 Write the AC-11 fixture (one PRD, two waves, six stories: two by body line, two by `phase:` label, one by milestone, one unmappable; one standalone bug; a `type: prd` tracking issue; retired labels; zero- and two-`type:` issues) and failing tests `map.test.ts`, `plan.test.ts`, `answers.test.ts`, `ac11-fixture.test.ts` (D-90)
  - [x] 4.2 `roadmap.ts`: parse the canonical table, reusing `roadmap-parity`'s definition of it; `--plan` exits `InvalidUsage` (2) with a pointer to product-engineer's conversion when it is missing (D-86)
  - [x] 4.3 `map.ts`: the `**Story:**` line, then an exactly matching `phase:` label, then a milestone named by exactly one row, else unmapped with the reason; never fuzzy (FR-18, D-18, D-86)
  - [x] 4.3a Mapping per §16a: drop rule 3 (D-98, A-57); scope rule 2 to the title prefix's PRD (A-56); map story-file slugs to PRDs by the roadmap link text, `All` rows for single-wave PRDs (A-55); in the AC-11 fixture, replace the milestone-mapped story with one whose only link is a milestone, which stays unmapped
  - [x] 4.4 `plan.ts`: batches 1 to 7 in spec §8.3's order: labels; tracking issues (none for a shipped wave, FR-19); hierarchy links skipping existing ones; story and type labels; retired-label removals (D-91); PRD status comments with `—` for waves without an issue (D-92, D-73); the Project batch with runner `user`, printing the `gh project item-list` query, the `item-delete` template and the two Workflows-page steps (D-81, D-97)
  - [x] 4.4a Batches per §16a: batch 1 creates every missing type and `level:` label and sets descriptions (A-71); batch 4b writes blocking-link and priority answers (A-73); batch 6 creates the PRD comment only when absent, else adds missing rows (A-67); every row carries `Depends on`, and create rows show title and template (A-81, A-84); edge rules of A-83; prefix `Retired (D-91): ` under 100 characters, never doubled (A-82); answers feed a fresh `--plan` that resets `Approved: no` (A-50)
  - [x] 4.4b Batch 1 also sets the four `priority:` label descriptions to the D-84 and D-102 meanings (D-103)
  - [x] 4.5 Reused pre-`level:` tracking issues: add `level: prd` or `level: wave`, remove the experiment `type:` label; two matches omit that PRD's batches and list both (D-87)
  - [x] 4.6 Guard the scope: no title write, no hierarchy write on a standalone issue, no Status write (D-19, D-27, D-82)
  - [x] 4.7 Carry answers from the previous plan file's review tables into the next `--plan`
  - [x] 4.8 Verify Acceptance Criterion: AC-1 precedence; AC-2 missing table exits 2
  - [x] 4.9 Verify Acceptance Criterion: AC-3 batches and order; AC-4 reused tracking issues
  - [x] 4.10 Verify Acceptance Criterion: AC-5 scope guards; AC-6 answers carried over
  - [x] 4.11 Verify Acceptance Criterion: AC-7 the AC-11 fixture yields exactly the expected batches and lists (PRD AC-11)
  - [x] 4.12 Edge cases: a `phase:` label matching two rows (unmapped, "ambiguous"); a milestone shared by every wave; body line and label disagree (body line wins, both cited); a wave with only closed stories but an active state file (gets a wave issue); a story linked to a wrong wave (listed, never relinked)
  - [x] 4.13 AC-to-test mapping: AC-1 → `map.test.ts`; AC-2 → `cli.test.ts`; AC-3 to AC-5 → `plan.test.ts`; AC-6 → `answers.test.ts`; AC-7 → `ac11-fixture.test.ts`
  - [x] 4.14 Run Tests: `pnpm run test:unit`, `pnpm run validate` green
  - [x] 4.15 (qa gap 1, surviving mutant) A `Done` roadmap row that already has an open wave issue, plus an open unlinked story mapped to it: assert zero `link-sub-issue` rows for that story and the Information note; also cover the kept-wave-issue branch of the `Done` row in `plan.ts`. Test first.
  - [x] 4.16 (qa gap 2) Fix MU-54's oracle in `plan.test.ts`: build the standalone set from "no `Story S-NNN` title, no `**Story:**` line, not a tracking title", so `[PRD-x]`-prefixed standalones are guarded; make RT-13's generator produce prefixed standalones.
  - [x] 4.17 (qa gap 3) RT-12 also replays rows produced from answers (batch 4 type rows; batch 4b `add-blocked-by` and the switch to `priority: high`) and runs 200 random repositories, including some with a pre-existing PRD status comment.
  - [x] 4.18 (EC-117, D-106) Match label names case-insensitively everywhere in the module, as GitHub does: an existing label in a different case (e.g. `Type: Bug`) is reused, with no `create-label` row, and its description is set on the existing name; same for answers and classification. Test first.
  - [x] 4.19 (qa gap 5) Tests for the unrun branches: wave tracking issue without `Wave <id>:`; tracking issue with no roadmap row (roadmap-mismatch notes); unmapped story whose prefix names an omitted PRD; needed PRD with no H1; wave needing an issue whose PRD has none; `Phase/Wave` with a space or colon; several marker comments; "cannot block itself"; a state file without `-phase-N`; EC-129 (one closed and one open PRD match); EC-131 (all rows `Done`).
  - [x] 4.20 (verifier F-3) An unmapped answer naming a real wave of a PRD whose batches are omitted (two tracking-issue matches, D-87) gets its own reason, "names wave X of PRD p, whose batches are omitted (D-87)", and the typed answer is kept, not cleared. Test first.
  - [x] 4.21 (verifier F-1, D-107) Add `not started` to github-ops' PRD State vocabulary in all three trees (the § Status comment PRD table states and the sentence after it), meaning a roadmap wave not yet published, with `—` for its wave issue; `prdState` keeps writing it; extend the wave 3 parity pins, with PT-81-style agreement if the module holds the vocabulary. Test first.
  - [x] 4.22 (verifier F-4, D-108) When an open story's parent is a closed wave issue of its own roadmap row, create no new wave issue and no link for that wave if no other mapped story needs one; list the story in Information ("parent #N is a closed wave issue; never relinked"). A new wave issue is created only if at least one mapped story would actually be linked under it. Test first.
  - [x] 4.23 (verifier F-6, D-109) A PRD tracking issue whose title would exceed github-ops' 80-character limit is not created: list the PRD in Information asking the owner to shorten the PRD file's H1; the rows of its waves that depend on it are omitted, with the reason. Test first.

- [x] 5.0 Implement Story S-015: `dev-tasks migrate projects --apply` runs only an approved plan and records every write (#322)

  - [x] 5.1 Write failing tests `apply-gates.test.ts`, `apply-states.test.ts`, `apply-scope.test.ts`, `apply-bodies.test.ts` against a recording `GhRunner` (D-90)
  - [x] 5.2 `apply.ts`: refuse with `ReconciliationConflict` (14), writing nothing, while the header reads `Approved: no` (FR-17, D-80)
  - [x] 5.3 Re-read the snapshot; refuse with 14 and "regenerate the plan" when the hash differs
  - [x] 5.3a Resume check per D-101: compare the hash only while every row is `pending`; afterwards check each write's target just before it runs, `skipped(already applied)` or `failed(target changed)` (A-49); verify the `Plan digest:` and build argv from Action, Target and Detail only, as `--flag=value` (A-51, A-93); atomic write-back and a lock file against concurrent runs (A-80); answers never become writes here (A-50)
  - [x] 5.4 Run batches 1 to 6 in order; write each state (`done`, `failed(<first stderr line>)`, `skipped(already applied)`, `skipped(depends on W-NN)`) back to the plan file after each call; record created issue numbers so dependent writes resolve on a re-run (D-88)
  - [x] 5.5 A re-run executes only `pending` and `failed` writes (D-88)
  - [x] 5.6 Never execute batch 7 and never call `gh project`; print its steps in the summary (D-81, D-22)
  - [x] 5.7 Retired labels: remove from open issues, prefix each definition's description `Retired (projects-tracking#D-91):`, never call `gh label delete` (D-91)
  - [x] 5.8 Every body through `--body-file` in the OS temp directory, removed after the call; the PRD status comment by the wave 1 marker procedure (D-92)
  - [x] 5.9 Exit `GeneralError` (1) when any write is `failed`, else 0; `--json` per-batch counts; wire `--apply [--plan-file]` in `bin/dev-tasks.ts`
  - [x] 5.10 Verify Acceptance Criterion: AC-1 unapproved refused; AC-2 stale snapshot refused
  - [x] 5.11 Verify Acceptance Criterion: AC-3 batch order and recorded states; AC-4 resume repeats no `done` write
  - [x] 5.12 Verify Acceptance Criterion: AC-5 no Project call; AC-6 retired labels kept as definitions (PRD AC-12)
  - [x] 5.13 Verify Acceptance Criterion: AC-7 bodies through files; AC-8 exit codes and `--json`
  - [x] 5.14 Edge cases: a label already present; a failed wave-issue create skipping its links; `Approved: yes` with an unanswered review row (those writes stay `pending`, reported); a write that succeeds but whose write-back fails (next run records `skipped(already applied)`)
  - [x] 5.15 Integration: a runner that throws on write 5, resumed from the plan file, repeats writes 1 to 4 zero times (PRD AC-12)
  - [x] 5.16 AC-to-test mapping: AC-1, AC-2 → `apply-gates.test.ts`; AC-3, AC-4 → `apply-states.test.ts`; AC-5, AC-6 → `apply-scope.test.ts`; AC-7 → `apply-bodies.test.ts`; AC-8 → `cli.test.ts`
  - [x] 5.17 Run Tests: `pnpm run test:unit`, `pnpm run validate` green
  - [x] 5.18 (qa D15, D15b) resolveRef title check: a create row hand-edited to `done(#N)` where #N's title differs → dependent rows `failed(target changed)`, never written against #N. Test first.
  - [x] 5.19 (qa G2b) Gate order: an unapproved plan with failing auth exits 11, not 14; pin the full order unparsable → 2, auth → 11, approval → 14, digest → 14, lock → 14, stale-while-pending → 14 in one table-driven test. Test first.
  - [x] 5.20 (qa R2c, D3b, D9b, D13, D13b, D11, D5) Targets that change between runs: `skipped(already applied)` rows are never re-run even if the target later changes; edit-label on a label deleted since → `failed(target changed)`; add-blocked-by on a blocked issue that no longer exists → `failed(target changed)`; planned `add:` with the marker comment gone → `failed(target changed)`, never a new marker comment; planned `create:` when a marker appeared since → `failed(target changed)`, no PATCH; the comment gaining a row between `--plan` and `--apply` → only still-missing rows added; create-issue dedupe requires the matching `level:` label (a same-titled issue without it is not adopted). Extend RT-11 to change targets between runs. Test first.
  - [x] 5.21 (qa D3, D6, D9) Lost write-back for edit-label, add/remove-label and add-blocked-by: a re-run detects the applied state as `skipped(already applied)`; add-blocked-by checks the blocking list before POSTing, so a duplicate never produces a 422 `failed` and exit 1. Test first.
  - [x] 5.22 (qa S5, S5b, BD1, BD3, SG4, S2, G7) Atomic write-back and body cleanup: EC-140 (a crash between write and rename leaves the old file intact; never a truncated file); each body file gone right after its call (MU-77), the run's temp dir removed, `bin` removing it in `finally`; the in-memory state reset after a failed write-back; the plan file changing after the lock is taken → 14. Test first.
  - [x] 5.23 (qa SG2, CT-34) Signals and exits: SIGINT and SIGTERM both release the lock and exit 1 (`GeneralError`), matching the user manual and CT-34; test both signals. Test first.
  - [x] 5.24 (qa) Tighten: MU-61 near-miss asserts exactly 14; CT-25 a fenced `Approved: yes` does not approve; RT-14 asserts writes exactly match the unmutated plan's and gets an explicit timeout like RT-11's; the comma guard (C1) tested; the post-failed-write-back message states that the next run may need a regenerated plan.
  - [x] 5.25 (qa) Signal tests (cli.test.ts): wait for a readiness signal (the first writes in the gh log) before signalling, and if the deadline passes assert `writesInLog().length >= 3` with a clear message instead of signalling anyway; install the signal handlers as early as possible in `bin/dev-tasks.ts` (before the first write) so a signal before any write still releases the lock and exits 1.
  - [x] 5.26 (qa) `run()` in cli.test.ts uses `spawnSync`, which blocks the event loop so vitest's timeout cannot fire: pass spawnSync's own `timeout` option (killing the child), so a hung child fails the test instead of hanging the suite; this also covers S-013's `--plan` CLI tests.
  - [x] 5.27 (qa) Small gaps: RT-14 asserts `writes.length === ids.length`; the apply-level lower-case `approved: yes` test also asserts the plan file is byte-identical and zero writes; a test for the lock-acquire rethrow of a non-EEXIST error (e.g. EACCES), `apply.ts` 114-115.
  - [x] 5.28 (verifier F-6) When a write-back fails, restore the row's previous in-memory state instead of resetting it to `pending`, so the summary and `--json` counts match the plan file on disk; test with a failing write-back on a row that ends `failed(...)`. Test first.
  - [x] 5.29 (verifier F-8, D-111) Handle SIGHUP exactly like SIGINT/SIGTERM (release the lock, remove the temp dir, exit 1), and on any of the three signals kill the in-flight `gh` child process before exiting, so no write can land after the lock is released; test SIGHUP, and test that a signal during a slow `gh` call leaves no write recorded after exit (fake `gh` that sleeps then writes). Test first.
  - [x] 5.30 (verifier F-3, F-5, D-110) User manual and README wording: the per-write target check uses the start-of-run snapshot plus the run's own writes, with status comments, parents and blocking lists read live just before their write; a header that is not exactly one `Approved: yes` line exits 14, and a plan with no `Approved:` header at all (e.g. lower-case `approved: yes`) exits 2 as an unparsable plan.
  - [x] 5.31 (verifier F-7, F-10) Document recovery from a lost first write-back (the next `--apply` exits 14; run `--plan` again, re-approve, then `--apply`; no write is repeated) in README and the user manual; complete the `--apply` exit-code rows: 2 for an unparsable plan file, a repository mismatch or a missing canonical roadmap table; 14 when the plan file changes while `--apply` is starting.

- [ ] 6.0 Implement Story S-017: A runbook and github-ops' migration mode take a repository through the migration; this repository goes first (#323)

  - [x] 6.1 Add pins for github-ops' migration mode (three copies, byte-identical) and a docs check that the runbook exists, is indexed, and is the only file in `docs/` naming `gh project item-delete`; confirm red
  - [x] 6.2 Write `docs/runbooks/runbook-migrate-to-projects-tracking.md`: roadmap check and conversion, `--plan`, answering the review lists, approval, `--apply`, the Project batch (query, delete template, Workflows-page steps), committing the plan file with `git add -f` on `chore/<issue-number>-projects-migration` and opening a PR, and rollback by hand (FR-22, D-81, D-93, D-97)
  - [x] 6.3 Index the runbook in `docs/runbooks/README.md`; `docs-structure` check green
  - [x] 6.3a Use the five FR-48 headings and add the runbook to `runbook-set.test.ts` (A-62); PT-80 extends the Project-write guard to `core/migrate-projects/` (A-60); the migration mode describes the Project batch without quoting `gh project` commands (A-61); github-ops re-runs `--plan` after answers before asking approval (A-50); state the expected dogfood result in advance (A-90)
  - [x] 6.4 Add the migration mode to github-ops ×3: run `--plan`; one question per review item with a recommendation; write answers into the plan; ask for explicit approval; set `Approved: yes`; run `--apply`; hand the Project batch to the user; commit the plan file and open the chore PR; never `--apply` without approval, never write the Project (D-79, D-80, D-81)
  - [ ] 6.5 Migrate this repository under #323 (branch `chore/323-projects-migration`): run `--plan`, walk the owner through the review lists, **ask the owner for explicit approval before `--apply`**, run `--apply`, hand over the Project batch, and wait for the owner to tick it (D-80, D-81)
  - [ ] 6.6 Verify the applied state: re-run `--plan --out <scratch path>` and confirm it proposes no further writes as A-66 defines it; commit `workstream/migration-projects.md` with `git add -f` on the chore branch and open the PR, referenced from the consolidated PR (D-93)
  - [x] 6.7 Verify Acceptance Criterion: AC-1 runbook sections; AC-2 migration mode in three copies
  - [ ] 6.8 Verify Acceptance Criterion: AC-3 this repository migrated, plan file committed with every write `done` or `skipped`
  - [x] 6.9 Verify Acceptance Criterion: AC-4 runbook indexed; AC-5 PT-28b still green
  - [x] 6.10 Edge cases exercised or stated in the runbook: an unmapped issue answered "standalone"; approval declined (nothing written, plan kept); an interrupted apply resumed
  - [x] 6.11 AC-to-test mapping: AC-1 → `docs > runbook sections`; AC-2 → `github-ops > migration mode`; AC-3 → the committed plan file; AC-4 → `docs-structure`; AC-5 → the parity file and PT-28b
  - [x] 6.12 Run Tests: `pnpm run test`, `pnpm run lint`, `pnpm run format:check`, `pnpm run typecheck`, `pnpm run audit`, `pnpm run validate` green

## Decisions Consumed

| ID   | Decision (short form)                                                            |
| ---- | -------------------------------------------------------------------------------- |
| D-18 | Migration never guesses; unmapped issues wait for the user                       |
| D-19 | No tracking issue for shipped waves; titles unchanged                             |
| D-22 | No agent writes the Project                                                       |
| D-27 | No Status backfill                                                                |
| D-36 | Tracking issues found by label and title prefix                                   |
| D-73 | Pre-hierarchy waves keep a PRD status row with `—`                                |
| D-79 | Hybrid: `migrate projects --plan/--apply` CLI with a github-ops conversation      |
| D-80 | `--apply` only after explicit approval                                            |
| D-81 | The Project batch is run by the user                                              |
| D-82 | Only stories become sub-issues                                                    |
| D-83 | Aggregation by type, priority and native dependencies; no `role:` labels          |
| D-84 | `critical` blocks a ship and carries a blocking link and a `**Blocks:**` line     |
| D-85 | Exactly one `type:` from a defined set                                            |
| D-86 | Roadmap converted first; exact label-to-row matching                              |
| D-87 | Pre-`level:` tracking issues reused by title prefix                               |
| D-88 | Per-write states; `--apply` resumes                                               |
| D-89 | The planner backfills state files                                                 |
| D-90 | Injectable `gh` runner, fixture unit tests                                        |
| D-91 | Retired labels removed from open issues; definitions kept                         |
| D-92 | Migration writes the PRD status comment                                           |
| D-93 | The plan file committed as the record                                             |
| D-95 | Synthetic fixtures                                                                |
| D-96 | `repo` scope only; auth checked first                                             |
| D-97 | The Project batch prints the item query and delete template                       |
| D-98 | Milestone rule dropped; `phase:` scoped to the title's PRD |
| D-99 | PRD AC-13 amended |
| D-100 | Default labels not retired, not counted as types |
| D-101 | Hash only while all pending; then per-write target checks |
| D-102 | `high` blocks no ship; audit checks `critical` for the `**Blocks:**` line |
| D-103 | Migration batch 1 sets the `priority:` descriptions too |
