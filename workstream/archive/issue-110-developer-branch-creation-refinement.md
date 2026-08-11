# Issue Refinement: #110 - developer agent skips branch creation before implementation

## Changelog

| Version | Date       | Summary            | Author            |
| ------- | ---------- | ------------------ | ----------------- |
| 1.0     | 2025-07-14 | Initial refinement | product-engineer  |

## Summary

- Goal: Ensure the `developer` agent reliably creates a feature branch and opens a draft PR before any implementation work begins.
- Primary user impact: Agents implementing code on `main` risk polluting the default branch, breaking the PR review flow, and bypassing CI/deployment gates.
- Non-goals: Changing `planner` orchestration flows; adding new hooks beyond git-guard; restructuring the agent prompt beyond what is needed for this fix.

## Acceptance Criteria

- [ ] AC-1: `developer` agent declares `subagent` in its Kiro `tools` list, enabling delegation to `github-ops`, `verifier`, and `technical-writer`
- [ ] AC-2: `implement.md` steering `fileMatchPattern` covers both `workstream/tasks-*.md` (zero-depth) and `workstream/**/tasks-*.md` (nested) by using an array pattern
- [ ] AC-3: Branch creation is a hard gate — Execution Flow step 4 includes an explicit branch-check (`git rev-parse --abbrev-ref HEAD`) and blocks write/commit operations when HEAD is the default branch
- [ ] AC-4: Per-turn output contract includes "Current branch name" and "PR number + status"
- [ ] AC-5: `git-guard.json` hook matcher regex includes `execute_bash` to cover Kiro CLI's actual tool name
- [ ] AC-6: All three platform equivalents (`.kiro/`, `.claude/`, `.github/`) are updated consistently for changes that apply cross-platform (tool declarations, execution flow language, output contract)

## Constraints

- Changes must be documentation/config only (agent prompts, steering files, hook config). No application code is affected.
- git-guard hook remains best-effort/fail-open per existing design (with the known upstream Kiro limitation).
- Must not break existing `planner`-delegated flows where `developer` receives a base-branch override.

## Risks and Edge Cases

- **Risk:** Kiro runtime may not respect `subagent` tool declarations even when added — needs manual verification in a live session.
- **Edge case:** `planner` orchestration passes a base-branch override; branch gate must not block when HEAD is an integration branch (only block when HEAD is `main`).
- **Edge case:** User might manually check out a branch before invoking `developer`; the gate should detect this and skip branch creation gracefully.
- **Risk:** Making the `fileMatchPattern` an array may not be supported by Kiro's runtime — need to verify Kiro supports array patterns or use a single broader glob.

## Dependencies

- Kiro upstream behavior for `fileMatchPattern` array support (undocumented).
- Kiro upstream fix for kirodotdev/Kiro#7375 (empty `toolArgs` in PreToolUse hooks) — this issue cannot fully solve that; git-guard remains best-effort.

## Testing Notes

- Unit tests: N/A (config/prompt-only changes)
- Integration tests: N/A
- Manual checks:
  1. Start a `developer` session with a task list, verify it creates branch before writing code.
  2. Verify `implement.md` steering loads when `workstream/tasks-issue-X.md` is referenced.
  3. Verify git-guard hook fires on `execute_bash` tool calls in Kiro CLI.
  4. Verify per-turn status output includes branch name and PR status.
- Edge-case checks: Invoke developer with an already-checked-out feature branch — verify it does not redundantly create a branch.
- Acceptance-criteria-to-test mapping:
  - AC-1 → Check developer.md frontmatter contains `subagent`
  - AC-2 → Open a `workstream/tasks-*.md` file in Kiro, confirm steering loads
  - AC-3 → Start developer on main, confirm it refuses to write until branch is created
  - AC-4 → Read per-turn output, confirm branch/PR fields
  - AC-5 → Inspect `git-guard.json` matcher regex
  - AC-6 → Diff the three platform files for consistency

## Open Questions

- Does Kiro `fileMatchPattern` support array values (e.g., `["pattern1", "pattern2"]`)? If not, what single glob pattern covers zero-depth and nested paths?
- Is `subagent` the correct tool name for the Kiro `tools` frontmatter, or does it need to be listed differently (e.g., `agent`)?
