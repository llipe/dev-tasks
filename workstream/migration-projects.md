# Migration plan: llipe/dev-tasks

Format: 1
Generated: 2026-10-25T22:02:33Z
Snapshot: 959fd76a2554a4c5f9276c1e4e35437dfc0741d72c4e7303c02e5a2b137c3206
Plan digest: 1d68731a40c5ad8b1d15e6b0094ce717966a2c5071abf3909ad612adb90f0c1f
Approved: yes

## Needs your answer

Answer in the Answer column, then run `dev-tasks migrate projects --plan` again: it reads your answers, rebuilds the batches from them and resets `Approved: no`, so you approve the rebuilt plan. Nothing is written to GitHub until the plan reads `Approved: yes` and `--apply` runs.

### Unmapped issues (FR-18)

| Issue | Title | Why | Answer (wave id, or "standalone") |
| --- | --- | --- | --- |

### Needs a type (D-85)

| Issue | Title | Current type labels | Suggested | Answer |
| --- | --- | --- | --- | --- |
| #108 | [chore] Enforce mandatory technical-writer invocation in developer agent |  | chore | chore |
| #244 | Add mirror-parity test coverage for memo-cli-usage skill and the four PR #240 agent files |  | bug | test |
| #262 | [chore] Re-run Phase 3 closure gates with coverage enabled |  | chore | chore |
| #263 | [chore] Decide whether the decision-log splitRow should understand \\\| escapes |  | chore | chore |

### Needs a blocking link (D-84)

| Issue | Title | Priority | Answer (#issue it blocks, or "lower priority to high") |
| --- | --- | --- | --- |

### State files (D-89)

| File | Note |
| --- | --- |

### Roadmap notes (D-86)

| Row | Note |
| --- | --- |

### Information

| Ref | Note | Answer |
| --- | --- | --- |
| [PRD-shared-understanding-refinement] | no mapped story and no open PRD tracking issue; answer `yes` to create its PRD tracking issue (A-83) |  |
| [PRD-infra-engineer] | no mapped story and no open PRD tracking issue; answer `yes` to create its PRD tracking issue (A-83) |  |
| [PRD-kiro-dev-support] | no mapped story and no open PRD tracking issue; answer `yes` to create its PRD tracking issue (A-83) |  |
| [PRD-evidence-driven-development-loop] | no mapped story and no open PRD tracking issue; answer `yes` to create its PRD tracking issue (A-83) |  |
| [PRD-factory-board] | no mapped story and no open PRD tracking issue; answer `yes` to create its PRD tracking issue (A-83) |  |

## Batches

Each row is one write. `--apply` runs batches 1 to 6 in order and records each row's State; batch 7 is yours to run.

### 1. Labels (cli)

| ID | Action | Target | Detail | Depends on | State |
| --- | --- | --- | --- | --- | --- |
| W-001 | create-label | label:type: refactor | color: D4C5F9; description: Code restructure, no behavior change |  | done |
| W-002 | create-label | label:type: test | color: BFDADC; description: Test-only work |  | done |
| W-003 | edit-label | label:type: bug | description: Behavior that differs from the spec or intent |  | done |
| W-004 | edit-label | label:type: enhancement | description: New or changed behavior |  | done |
| W-005 | edit-label | label:type: chore | description: Maintenance, dependencies, tooling, or CI |  | done |
| W-006 | edit-label | label:type: tech-debt | description: Deferred engineering work that fits no other type |  | done |
| W-007 | edit-label | label:priority: critical | description: Blocks a wave, PRD, or release from shipping |  | done |
| W-008 | edit-label | label:priority: high | description: Lands in the current wave or cycle; blocks no ship |  | done |
| W-009 | edit-label | label:priority: medium | description: Lands in the next wave or cycle |  | done |
| W-010 | edit-label | label:priority: low | description: Backlog |  | done |

### 2. Tracking issues (cli)

| ID | Action | Target | Detail | Depends on | State |
| --- | --- | --- | --- | --- | --- |

### 3. Hierarchy (cli)

| ID | Action | Target | Detail | Depends on | State |
| --- | --- | --- | --- | --- | --- |

### 4. Story and type labels (cli)

| ID | Action | Target | Detail | Depends on | State |
| --- | --- | --- | --- | --- | --- |
| W-011 | add-label | #108 | type: chore |  | done |
| W-012 | add-label | #244 | type: test | W-002 | done |
| W-013 | add-label | #262 | type: chore |  | done |
| W-014 | add-label | #263 | type: chore |  | done |

### 4b. Blocking links and priorities (cli)

| ID | Action | Target | Detail | Depends on | State |
| --- | --- | --- | --- | --- | --- |

### 5. Retired labels (cli)

| ID | Action | Target | Detail | Depends on | State |
| --- | --- | --- | --- | --- | --- |

### 6. Status comments (cli)

| ID | Action | Target | Detail | Depends on | State |
| --- | --- | --- | --- | --- | --- |

### 7. Project cleanup (you run these)

| ID | Step | State |
| --- | --- | --- |
| W-015 | List the Project's pull-request items with your own session: gh project item-list <n> --owner llipe --limit 500 --format json --jq '.items[] \| select(.content.type == "PullRequest") \| .id' (<n> is the Project number) | done |
| W-016 | Delete each listed item: gh project item-delete <n> --owner llipe --id <item-id> | done |
| W-017 | On the Project's Workflows page, set the auto-add workflow's filter to `is:issue`, so pull requests are no longer added (FR-20) | done |
| W-018 | On the Project's Workflows page, turn the default workflows back on (Item closed, Pull request merged), so Status follows issues and pull requests natively (D-27) | done |
