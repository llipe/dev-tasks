---
name: runbook-migrate-to-projects-tracking
trigger: An existing repository adopts the projects-tracking conventions (type, priority and level labels, PRD and wave tracking issues, native sub-issues and blocking links), or github-ops' migration mode points here.
owner: github-ops
last_verified: 2026-10-24
related:
  [
    "bin/dev-tasks.ts",
    "core/migrate-projects/plan.ts",
    "core/migrate-projects/apply.ts",
    ".claude/agents/github-ops.md",
    ".claude/commands/product-engineer.md",
  ]
---

# Migrate a repository to projects tracking

This procedure takes an existing repository from its old labels and loose
issues to the projects-tracking conventions: one `type:` per issue, a
described `priority:` scale, `level:` labels, a tracking issue per PRD and
per wave, stories linked as native sub-issues, and the PRD status comment.

Two tools do the work. `dev-tasks migrate projects --plan` reads the
repository and writes a plan file, `workstream/migration-projects.md`, that
lists every proposed write and every question it cannot answer alone.
`dev-tasks migrate projects --apply` runs an approved plan and records each
write's result in that file. github-ops' migration mode is the conversation
around the two commands: it asks you the questions, writes your answers into
the plan and runs `--apply` only after you approve.

Nothing touches the GitHub Project. The plan's last batch lists the Project
steps, and you run them yourself with your own session (D-81).

## Preconditions

- `gh` is installed and authenticated: `gh auth status --hostname github.com`
  passes. The `repo` scope is enough; the CLI never reads or writes the
  Project, so it never needs the `project` scope.
- dev-tasks is at a release that ships `migrate projects`. Check with
  `pnpm exec dev-tasks --help`.
- You run the commands from a clone of the repository being migrated, on an
  up-to-date default branch. `--plan` reads the roadmap and the planner
  state files from the working tree.
- An issue tracks the migration. Its number is the `<issue-number>` in the
  branch name below. Create the branch before you start, because the plan
  file is edited during the review:

  ```bash
  git switch -c chore/<issue-number>-projects-migration
  ```

- You have admin access to the repository's GitHub Project, if it has one,
  for step 7.

## Steps

### 1. Check the roadmap

`--plan` resolves waves against the canonical table in `docs/roadmap.md`
(`PRD | Phase/Wave | Scope (one line) | Status | Issues/PRs | What's missing`)
and exits `2` without it, before reading any issue (D-86).

- If `docs/roadmap.md` already holds the canonical table, this step is a
  no-op: go to step 2.
- Otherwise run product-engineer's Roadmap Conversion (before migration)
  subsection. It drafts the canonical table from the narrative, keeps the
  narrative verbatim below it, flags every status it could not prove, and
  opens its own docs PR. Merge that PR before step 2.

### 2. Generate the plan

```bash
pnpm exec dev-tasks migrate projects --plan
```

Read-only: nothing on GitHub changes. It writes
`workstream/migration-projects.md` with the header `Approved: no`, the review
tables and seven batches. Its exits:

- Exit `1`: a `gh` read failed; run it again.
- Exit `2`: no canonical roadmap table, or `--repo` names another repository than the working tree's.
- Exit `11`: `gh` is missing or unauthenticated, or `gh repo view` failed: run `gh auth login` and try again.
- Exit `14`: the file at `--out` is an applied plan or not a migration plan: keep it, and pass `--out <other path>`.

### 3. Answer the review lists

Each review table has an Answer column. Fill it in the plan file; github-ops'
migration mode asks you one question per row, with a recommendation.

| Table                 | Answer                                                                                                                                 |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Unmapped issues       | `<PRD key> <Phase/Wave>`: the roadmap row's PRD link text, a space, and its `Phase/Wave` cell (`projects-tracking 3`), or `standalone` |
| Needs a type          | one type from the set (the Suggested column is the tie-break winner)                                                                   |
| Needs a blocking link | `#<issue it blocks>`, or `lower priority to high`                                                                                      |
| Information           | `yes` to act on the note, or leave it blank                                                                                            |

For a `#<issue it blocks>` answer, `--apply` writes only the native
`blocked by` link; migration never edits an issue body, so add the critical
issue's `**Blocks:** #N — <reason>` line yourself, as D-84 requires both.

An issue answered `standalone` stays out of the hierarchy: no write is
proposed for it. State files and roadmap notes are for you to fix by hand;
they carry no Answer column.

### 4. Re-run the plan

```bash
pnpm exec dev-tasks migrate projects --plan
```

It reads the answers from the existing file, rebuilds the batches from them
and resets `Approved: no` (A-50). `--apply` never turns an answer into a
write, so this step is what puts your answers into the batches. An answer it
cannot use stays listed with the reason; fix it and run `--plan` again.

### 5. Approve

Read the rebuilt batches. To approve, change the header line to exactly:

```text
Approved: yes
```

One line, exact case, nothing else edited. Declining approval writes
nothing: the plan stays at `Approved: no` and you can keep it, change your
answers and go back to step 4. Re-running `--plan` always resets the header,
so a plan is approved only after its last rebuild.

### 6. Apply

```bash
pnpm exec dev-tasks migrate projects --apply
```

It runs batches 1 to 6 in order and writes each row's State back to the plan
file after every call: `done` (`done(#N)` for a created issue),
`failed(<reason>)`, `skipped(already applied)` or `skipped(depends on W-NNN)`.
Pass `--plan-file <path>` to apply a plan stored elsewhere.

| Exit | Meaning                                                                                                                                                                                                                                        | What to do                                                                    |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `0`  | Every write applied.                                                                                                                                                                                                                           | Go to step 7.                                                                 |
| `1`  | A write is `failed`, a repository read failed before any write, a state could not be written back, or the run was interrupted (`SIGINT`, `SIGTERM`, `SIGHUP`).                                                                                 | Read the failed rows and the message, fix the cause, and run `--apply` again. |
| `2`  | The plan file is missing or unparsable (a plan with no `Approved:` header at all, such as a lower-case `approved: yes`, is unparsable), the working tree is another repository than the plan's, or `docs/roadmap.md` lost its canonical table. | Fix the file or run from the right clone.                                     |
| `11` | `gh` is missing or unauthenticated, or `gh repo view` failed.                                                                                                                                                                                  | `gh auth login`, then `--apply` again.                                        |
| `14` | The header is not exactly one `Approved: yes` line, a row was edited after the plan was generated, another run holds the lock, the plan file changed while `--apply` was starting, or, while every row is `pending`, the repository changed.   | By cause, in the list below.                                                  |

The gates run before any write, so an exit `2`, `11` or `14` writes nothing.
Exit `14`, by cause (the message names it):

- Not approved: approve it (step 5).
- A row was edited after the plan was generated: undo the edit, or, while every row is still `pending`, re-plan (step 4) and approve again.
- Another run holds the lock: wait for it to finish, then run `--apply` again. Do not re-plan. A lock left by a killed process is covered under Escalation.
- The plan file changed while `--apply` was starting: run `--apply` again.
- The repository changed while every row is `pending`: re-plan (step 4) and approve again.
- Never re-plan over a partly applied plan: `--plan` refuses with exit `14` (A-65), and a partly applied plan only resumes with `--apply`.

An interrupted `--apply` resumes: run it again. It runs the `pending`,
`failed` and `skipped(depends on …)` rows and never repeats a `done` or
`skipped(already applied)` one (D-88). Once any row is recorded, each write
checks its own target just before it runs and records
`failed(target changed)` when someone else changed it.

Recovery from a lost first write-back: if the very first write lands but its
State cannot be written back, every row still reads `pending`, so the next
`--apply` exits `14` (the repository changed). Run `--plan` again (step 4),
approve the new plan (step 5), then `--apply`. The write that landed is no
longer proposed, so no write is repeated.

### 7. Run the Project cleanup batch

Batch 7, "Project cleanup (you run these)", is yours. `--apply` never runs
it and prints its steps at the end. Run each with your own session, which
needs the `project` scope (`gh auth refresh -s project` if it lacks it), then set that row's State to `done` in the plan file. Copy each command from this runbook or the `--apply` summary, never from the plan file: its table cells escape `|` as `\|`.

1. List the Project's pull-request items (`<n>` is the Project number):

   ```bash
   gh project item-list <n> --owner <owner> --limit 500 --format json \
     --jq '.items[] | select(.content.type == "PullRequest") | .id'
   ```

2. Delete each listed item:

   ```bash
   gh project item-delete <n> --owner <owner> --id <item-id>
   ```

   When the list is empty, there is nothing to delete; mark the step `done`.

3. On the Project's Workflows page, set the auto-add workflow's filter to
   `is:issue`, so pull requests are no longer added (FR-20).
4. On the Project's Workflows page, turn the default workflows back on (Item
   closed, Pull request merged), so Status follows issues and pull requests
   natively (D-27).

No API exists for steps 3 and 4. A batch 7 State is only `pending` or
`done`; a repository without a Project has nothing to clean up, so mark all
four `done`.

### 8. Commit the plan file and open a PR

The plan file, with every write's State, is the record of what the migration
changed (D-93). `workstream/` may be git-ignored, so force-add it on the
`chore/<issue-number>-projects-migration` branch. Commit it only once every batch 7 row reads `done`.

```bash
git switch chore/<issue-number>-projects-migration
git add -f workstream/migration-projects.md
git commit -m "chore: record the projects-tracking migration (#<issue-number>)"
git push -u origin chore/<issue-number>-projects-migration
gh pr create --base <base> --title "chore: record the projects-tracking migration" --body-file <body file>
```

`<base>` is the default branch for a standalone migration, and only you merge it. A migration run inside a planner wave targets that wave's integration branch instead, so the record ships in the wave's consolidated PR, which only you merge (D-112).

## Verification

Re-plan to a scratch path, never to the record itself (`--plan` refuses to
overwrite an applied plan, A-65):

```bash
pnpm exec dev-tasks migrate projects --plan --out /tmp/migration-check.md
```

The migration is complete when every batch 1 to 6 row in the check plan is
absent or `skipped(already applied)` (A-66); batch 7 is always printed. In
the committed record, every batch 1 to 6 row reads `done` or `skipped(...)`
and every batch 7 row reads `done`. Spot-check with
`gh label list`, `gh issue view <n> --json labels` and the PRD tracking
issue's status comment.

## Rollback

Rollback is by hand, row by row, from the record in
`workstream/migration-projects.md`, newest row first. Undo only `done` rows;
`skipped` rows changed nothing. Nothing is ever deleted: no label definition,
issue or comment.

- Retired label removed from an issue (batch 5): re-add it,
  `gh issue edit <n> --add-label "<label>"`.
- Label removed from an issue (batch 4 `remove-label`, a retired or second `type:` label): re-add it,
  `gh issue edit <n> --add-label "<label>"`.
- Priority lowered (batch 4b, `priority: critical` to `priority: high`): set it back, `gh issue edit <n> --add-label "priority: critical" --remove-label "priority: high"`.
- `level:` or `type:` label added (batch 4): remove it,
  `gh issue edit <n> --remove-label "<label>"`.
- Story linked as a sub-issue (batch 3): remove the link, leaving both issues,
  `gh api -X DELETE repos/<owner>/<repo>/issues/<parent>/sub_issue -F sub_issue_id=<child numeric id>`
  (the numeric id is `gh api repos/<owner>/<repo>/issues/<child> --jq .id`).
- Blocking link added (batch 4b): remove it,
  `gh api -X DELETE repos/<owner>/<repo>/issues/<blocked>/dependencies/blocked_by/<blocker numeric id>`.
- Tracking issue created (batch 2, `done(#N)`): close it,
  `gh issue close <N> --reason "not planned"`.
- Label description set or prefixed `Retired (D-91): ` (batch 1): set it back
  with `gh label edit "<label>" --description "<previous>"`. A created label
  stays; unused, it does no harm.
- PRD status comment written (batch 6): edit it back by hand, or leave it.
- Project steps (batch 7): re-add an item with the Project's own UI, and
  revert the Workflows page settings there.

Commit the edited record with a note of what was rolled back, on the same
chore branch.

## Escalation

- An `--apply` that exits `14` because another run holds `workstream/.migration-projects.lock`, when no run is alive: a killed process or a crash left the lock behind. First check that no `--apply` is still running (`ps -ef | grep "migrate projects"`, on every machine sharing the working tree). Only when none is, remove the file by hand (`rm workstream/.migration-projects.lock`) and run `--apply` again; it resumes.
- An exit `1` whose failed rows keep failing with the same `gh` error: check
  the token's `repo` scope and the repository's permissions, then attach the
  plan file's failed rows and `--apply --json` output to an issue at
  https://github.com/llipe/dev-tasks.
- A `failed(target changed)` row: someone changed the issue during the
  migration. Look at it, then re-run `--plan` and approve the rebuilt plan.
- A roadmap the conversion cannot make canonical: stop and ask
  product-engineer; `--plan` never guesses a wave (D-18).
