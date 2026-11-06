# Lane lifecycle

Phases, the stock dev-tasks command each one runs, who acts, and where the owner must answer. Nothing here replaces a command's own rules; it says who runs it and what to report.

## L0 — Queue (danny)

- Source: `objective.md`, `docs/roadmap.md` rows that are next, open issues without a lane, the owner's requests.
- Each queue entry: lane id, type (prep / wave / issue), why now against the objective, inputs (PRD, task lists, issues), what it conflicts with (modules, schema, shared files), and whether it is ready or what is missing and who is acting on it (`references/coordinator.md` § Keeping what is next ready).
- Sizing: a wave over 5 stories or a PRD over ~8 issues is split before it becomes a lane. Two lanes never touch the same modules or the same tables at the same time; waves of one PRD run in parallel only when the PRD says they are independent. When in doubt, sequence.
- **Owner gate:** opening a lane whose scope is not already on the roadmap.

## L1 — Open (danny)

1. Pick the first idle worker in order (linus → basher → yen; rusty for prep).
2. In the worker's stable worktree (`worktrees.pattern` in config): `git fetch origin main && git switch -c <branch> origin/main` with the branch name the stock command will expect, or leave the branch creation to the command and only ensure the worktree sits on a fresh `main`. Never `git worktree add` a new folder unless the worker has none yet; then copy the files in `worktrees.copy_files` from the owner checkout and run `worktrees.post_install`. Never regenerate secrets or keys. If any copy, install or checkout step fails, the lane does not open: leave the folder as it is, record `blocked` in the registry with the failing step, and tell the owner.
3. Register the lane in `workstream/lanes/registry.md` (state branch). Commit `chore(lanes): open <lane> for <agent>`.
4. **If the worker already has an idle session,** send it the filled-in boot prompt as a message; the owner does nothing. Its session keeps its old name, so record that in the registry. Ask for a fresh session only when its context is nearly full, its permission mode holds danny's messages and the owner cannot change it, or none exists.
5. **Otherwise,** hand the owner one block to paste in a new tab named `<agent>-<lane>`:
   ```
   cd <absolute worktree path> && claude -n <agent>-<lane> "<boot prompt from references/worker.md or references/prep.md, filled in>"
   ```
   Do not add a permission flag; the crew stays in config `crew.session_mode` (`references/shared-state.md` § Messaging). The owner sets that mode in the new tab if it starts in another.

## L2 — Prep (rusty)

Only when the scope has no execution-ready task list.

- Runs `/product-engineer` in Feature Mode (PRD → spec → stories → publish → plan) or Issue Mode (refine → plan), exactly as the command says.
- Runs `/verifier-design` for each story that will become execution work.
- The grill's questions are product decisions: rusty asks the **owner directly** in rusty's tab, one question at a time, as `activity-grill` prescribes. danny is copied on the outcome, not on each question.
- Output message to danny: `DONE` with the list of task-list paths, the wave issues, and a one-line scope statement per task list. danny turns each into a queue entry.

## L3 — Plan (execution worker)

- Wave: `/planner` Phases 0–2. Issue: `/developer` on the task list.
- The worker sends danny a `PLAN` message: story order, dependencies, 1–3 bullets per story, shared files it will touch.
- **Owner gate:** planner's mandatory plan approval. danny's digest names the tab and the reply; the owner answers there.

## L4 — Execute (execution worker)

- Wave: `/planner` Phases 3–4 (developer per story, qa-engineer, verifier audit, story merges into the integration branch). Issue: `/developer` to the PR.
- After each story: `PROGRESS` to danny. Before touching a shared type, contract, config or fixture: `HEADS-UP` to danny, who relays.
- **Owner gates:** only what the stock commands already gate (infra steps, shared-database writes, anything in the "owner" row of SKILL.md § 5).

## L5 — PR ready (worker → danny)

- Worker: `/planner` Phase 5 (rollup qa-engineer and verifier audit, consolidated PR) or the developer's PR-ready gate. Local gates green; one push.
- Worker sends `DONE` with the PR link and the roadmap row change (before → after, in words).
- danny checks the PR closes every issue in the lane and reports to the owner in one line: what it delivers, who built it, the link, what to look at first.
- **Owner gate:** review and merge to `main`. Nobody else merges.

## L6 — Close (danny)

1. On merge: the worker runs `/planner` Phase 6 except the roadmap and the `chore(roadmap)` PR (see Deviations), and sends its retro (`RETRO`, 1–3 procedural lessons).
2. danny applies the roadmap row(s) in one `chore(roadmap)` PR to `main`, batched with every other merge of the same day (`roadmap.pr_batching`).
3. danny marks the lane `done`, releases any lock the lane held, sets the worker `idle`, and sends `HEADS-UP` to the other lanes: rebase onto `main`, and sync any fix that rode along to `main` into their integration branches.
4. The worker writes its retro to memory (§ Storing lessons). danny stores coordination lessons in `danny-memory` the same way; a lesson seen in two workers is promoted to `kb` with the tag in `memory.crew_tag` and proposed for `CLAUDE.md`. `kb` stays in this repository: a rule every project should get belongs in this skill, proposed by PR.
5. **Tell the owner the worker is free**, in the same message as the close: `linus is free. Next in the queue: <lane, in words> (ready | waiting on <what>). Say "open it" or name something else.` Next wave of the same PRD waiting? Propose it to the same worker first. A free worker is never left silently idle; if the queue is empty, say so and propose what to prep.

## Storing lessons

Your bank follows you to every repository, so write each lesson for a project that has never heard of this one. Write the retro once, then each lesson that generalises:

```bash
memo write --kind episodic --session <lane> --bank <agent>-memory \
  --rationale "RETRO <lane>: <what happened, in plain language>" \
  --tags "retro,lesson,<lane>" --on-duplicate create-new --json

memo write --kind semantic --bank <agent>-memory --source agent --provenance <id from above> \
  --rationale "<the general rule first>. On <repo>: <the specific case, if it helps>." \
  --tags "<topic>,lesson,<memory.crew_tag>" --entry-type decision --on-duplicate create-new --json
```

- `--kind semantic` is what makes a lesson come back. Episodic entries expire and never appear in `MINE`.
- Always `--on-duplicate create-new`. `consolidate` can merge a lesson into another one and lose its text.
- Leave `--repo`, `--org` and `--domain` to config. They record where the lesson was learned and do not limit where it returns.
- A fact true only of this repository does not go in your bank, because tags and `repo` do not keep it home. Write it to `kb` with `--kind semantic --bank kb --manual --on-duplicate create-new`.

## Deviations from the stock commands

These two behaviours are changed by the boot prompt, not by editing any file.

| Stock behaviour                                                                                              | In a lane                                                                                                                 | Why                                                                                      |
| ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `/planner` Phase 5 step 5 and Phase 6 steps 7 and 11 edit `docs/roadmap.md` and open the `chore(roadmap)` PR | The worker **reports** the row's before → after to danny and does not edit the file. danny applies it                     | One roadmap writer. Each lane editing its row produced a version conflict on every merge |
| `/planner` Phase 6 recommends a fresh session on `main`                                                      | The closeout runs in the worker's own session, in its worktree, on the integration branch; the roadmap part goes to danny | The worker has the context; the owner checkout stays untouched                           |

Expected consequence: the verifier's rollup audit reports a roadmap-mismatch finding until danny's PR lands. It is advisory and never blocks. danny's roadmap PR cites the lane's PR.

## Handovers (context budget)

- **danny** writes `workstream/lanes/handover.md` when her context passes `coordinator.handover_tokens`: open lanes and their next step, what the owner still owes, what she is watching. Commits it. The owner starts a new `danny-coordination` session with the boot prompt in `references/coordinator.md` § Boot. The new danny rebuilds from the state branch and `git worktree list`, never from the old session.
- **Workers** inside a planner run are already covered by planner's checkpoint file: a new session with the same boot prompt resumes. Inside a developer run, finish the current sub-task, push, then hand over.
