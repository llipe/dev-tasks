# Shared state and messaging

## Where state lives

| Kind                                                                         | Where                                                                                                                            | Writer                                    | Reaches `main`?                                                                         |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | --------------------------------------------------------------------------------------- |
| Live lane state: objective, registry, locks, migration ledger, log, handover | `workstream/lanes/` on the long-lived branch in config `state.branch` (default `coordination`), checked out in danny's worktree  | danny                                     | **Never.** The branch is pushed for history and for reading on GitHub; it is not merged |
| Durable decisions a lane makes                                               | The repository's own `workstream/decisions-*.md`, through the lane's PR                                                          | The lane's worker, via the stock commands | Yes, in the lane's PR                                                                   |
| Roadmap                                                                      | `docs/roadmap.md`                                                                                                                | danny                                     | Yes, one `chore(roadmap)` PR per merge day                                              |
| Config                                                                       | `.claude/parallel-lanes.json`                                                                                                    | The owner (danny proposes changes by PR)  | Yes                                                                                     |
| Lessons                                                                      | memo banks `<agent>-memory`, which follow the agent to every repository; repository-only lessons in `kb`, some with the crew tag | Each agent                                | n/a                                                                                     |

Why a branch and not an untracked folder: history, a phone-readable view on GitHub, survival across danny handovers, and branch-guard allows the writes because the checkout is not on `main`. Why never merged: a status change must not cost a PR. Commits on it use `chore(lanes): <what>`.

danny refreshes the branch from `main` only when the state files need something new from `main`; the state files never depend on code.

## Files on the state branch

**`workstream/lanes/objective.md`** — the long-term objective, the milestones in order, what is deliberately not now, and a dated list of changes. The owner decides it; danny drafts it and reviews it (config `objective.review_every_days`). See `references/coordinator.md` § The long-term objective.

**`workstream/lanes/registry.md`**

```
| Agent | Lane | Type | Worktree | Branch | Scope (words) | Issues | Current | Status | Holds | Updated |
```

- Status: `idle`, `active`, `blocked`, `review` (PR open), `done`.
- Issues: ordered, finished ones ticked: `#142 ✓, #143 ✓, #144 →, #145`.
- Holds: locks held, or `—`.
- Below the table: **Queue** (ordered lane candidates, each with why now, inputs, conflicts and readiness) and **Waiting on the owner** (the current digest, in plain language, each line with the tab and the suggested reply).

**`workstream/lanes/locks.md`** — one line per lock in config `locks`, with holder, since, purpose, and a short history. Default locks: `e2e` (only one lane runs the full E2E suite at a time), `servers` (who owns the shared local app servers, when `ports.strategy` is `shared`), `production-infra` (one infra-engineer session touches production at a time).

**`workstream/lanes/migrations.md`** — the shared local database's ledger as the lanes see it: `| File | Lane | Applied (UTC) | Branch | Note |`. Updated when a lane applies a migration to the shared stack (owner-approved) and when danny renames a ledger row at merge.

**`workstream/lanes/log.md`** — append-only, one line per event: `YYYY-MM-DD HH:MM · <agent>-<lane> · <event>`. Events: decisions danny took alone (question → answer → source), relays, locks granted and released, owner approvals received (quoted), CI routing calls.

**`workstream/lanes/handover.md`** — written at a danny handover; deleted by the new danny once rebuilt.

## Messaging

Transport: Claude Code peer messages between local sessions, addressed by session name `<agent>-<lane>` (danny is `danny-coordination`). Workers write to danny, never to each other; danny relays. A session keeps its name if it takes a new lane in place, so address it by the name it has.

**Keep the crew in one permission mode.** A session in a different permission mode from the sender holds its messages for the owner to approve, and they expire if nobody does, silently for the sender's lane. Config `crew.session_mode` names the mode. Boot commands do not add a bypass flag. When a lane opens, danny confirms the first message arrives; a `[Cross-session delivery notice]` saying held or expired means the modes differ.

**When a message is held or expired,** use the inbox, and do not wait or resend:

- Write the same message to `<danny's worktree>/workstream/lanes/inbox/to-<recipient>-<sender>-<UTC time>.md`, using the absolute path from config `worktrees.pattern`. This one folder is the exception to "another lane's files". It is local and never committed.
- A file gives no notification. danny reads the inbox before every brief and whenever a worker has gone quiet. Workers look for `to-<agent>-*` before each `PROGRESS` and when they finish a turn. The reader deletes a file after acting on it, and danny logs it.
- Also tell the owner in one line, in your own tab, so the mismatch gets fixed. A hold on a worker's side needs a mode change there.

**danny may read, not act.** danny may read a session's state, screen or transcript to find a report that did not arrive, and say so. danny does not approve a held message, change another session's permission mode, or type into another session unless the owner asks for that specific action, and then logs the owner's words.

Format, both directions: `[<agent>-<lane>] <TYPE>: <text>`. Name the issue or PR as a link when the message is about one.

| Type        | From            | Meaning                                                                                         | danny does                                                                               |
| ----------- | --------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `PLAN`      | worker          | Story order, dependencies, shared files to touch                                                | Checks conflicts with other lanes; records; builds the owner's plan-approval digest line |
| `PROGRESS`  | worker          | A story or sub-task finished, next one started                                                  | Updates the registry                                                                     |
| `QUESTION`  | worker          | A product or technical doubt                                                                    | Answers from issue → spec → decisions → `CLAUDE.md` → code; else escalates               |
| `BLOCKED`   | worker          | Cannot proceed                                                                                  | Resolves or escalates, with the lane's independent next step                             |
| `LOCK`      | worker          | `request <lock> for <purpose>` / `release <lock>`                                               | Grants when free, records                                                                |
| `HEADS-UP`  | worker or danny | A change other lanes must know: shared type, contract, fixture, migration merged, rebase needed | Relays to affected lanes                                                                 |
| `FOLLOW-UP` | worker          | Work found outside the lane's scope                                                             | Files the issue, adds to the queue; the lane does not absorb it                          |
| `DONE`      | worker          | PR open, every issue covered, roadmap row before → after included                               | Verifies, tells the owner in one line                                                    |
| `RETRO`     | worker          | 1–3 procedural lessons                                                                          | Stores; promotes repeats                                                                 |
| `OWNER`     | danny           | A relayed fact ("the owner merged #912") — never a relayed approval                             | —                                                                                        |

Between agents, codes may appear with a plain gloss. In anything the owner reads, plain language only (SKILL.md § 4.1).

## Worktrees

- One stable worktree per agent, a sibling folder of the owner checkout: config `worktrees.pattern`, default `../<repo>-<agent>`; the owner checkout is `worktrees.owner_checkout`, default `../<repo>`. Both are relative and resolve from any sibling. The lane changes; the folder stays.
- First setup of a worker's folder: `git worktree add <path> -b <branch> origin/main`, then copy every file in `worktrees.copy_files` from the owner checkout (never regenerate: a freshly generated signing key breaks every other lane), then run `worktrees.post_install`.
- Between lanes: `git fetch origin main && git switch --detach origin/main` so the next stock command creates its own branch from a fresh `main`. Prune merged local branches.
- The owner checkout stays on `main` and belongs to the owner. Agents only read from it.

## Shared files across lanes

Contracts, shared types, fixtures, CI config, `DESIGN.md`, `TESTING.md`, `docs/tech.md` and any other file two lanes may edit:

- Announce before editing (`HEADS-UP`), add rather than reshape, and keep changelog rows additive.
- **The second lane to merge resolves**: it rebases onto `main`, merges both changes as a union, renumbers its changelog version or pinned count, and re-runs the tests both lanes touched. It never drops the first lane's change.
- A change that cannot be additive (a type reshaped, a row removed) is raised to danny before the branch is pushed; danny sequences the two lanes or escalates.

## Ports and shared services

- `ports.strategy = shared` (default): one set of local app servers, owned by the lane holding the `servers` lock. Everyone else tests at the isolated layers. `ports.strategy = offset`: each worker adds `ports.offsets[<agent>]` to every base port and runs its own servers.
- Everything in config `shared_environment.rules` is binding. The default set: never restart or purge the shared stack; stop only processes you started, by PID; verify a listener's working directory before trusting a port; fixtures are additive and lane-prefixed; integration tests run isolated; a migration already applied to the shared stack is never edited — fix forward.
