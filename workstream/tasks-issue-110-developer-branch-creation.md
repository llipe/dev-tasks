# Implementation Plan - Issue #110: developer agent skips branch creation before implementation

## Relevant Files

- `.kiro/agents/developer.md` - Kiro developer agent prompt (tools declaration, execution flow, output contract)
- `.kiro/steering/implement.md` - Kiro implement steering (fileMatchPattern, branch gate language)
- `.kiro/hooks/git-guard.json` - Kiro PreToolUse hook config (matcher regex)
- `.kiro/hooks/scripts/git-guard.sh` - Git guard enforcement script
- `.claude/agents/developer.md` - Claude developer agent prompt
- `.claude/skills/implement/SKILL.md` - Claude implement skill
- `.github/agents/developer.agent.md` - GitHub Copilot developer agent prompt
- `.github/instructions/implement.instructions.md` - GitHub Copilot implement instructions

## Tasks

- [x] 1.0 Fix missing `subagent` tool in developer agent (AC-1, AC-6)

  - [x] 1.1 Edit `.kiro/agents/developer.md` frontmatter: change `tools: [read, write, shell]` to `tools: [read, write, shell, subagent]`
  - [x] 1.2 Verify `.claude/agents/developer.md` already supports subagent delegation (Claude Code uses native subagent routing — confirm no tool-list change needed)
  - [x] 1.3 Verify `.github/agents/developer.agent.md` already supports subagent delegation (Copilot uses native agent references — confirm no change needed)
  - [x] 1.4 Verify Acceptance Criterion: `developer` agent can invoke `github-ops`, `verifier`, and `technical-writer` as sub-agents

- [x] 2.0 Fix `fileMatchPattern` to cover zero-depth task files (AC-2)

  - [x] 2.1 Edit `.kiro/steering/implement.md` frontmatter: change `fileMatchPattern: "workstream/**/tasks-*.md"` to `fileMatchPattern: "workstream/**/tasks-*.md"` (verify current glob works for zero-depth) OR change to array `["workstream/tasks-*.md", "workstream/**/tasks-*.md"]` if Kiro supports it
  - [x] 2.2 If array is not supported by Kiro runtime, document the limitation and keep the single `**` pattern (which per standard glob semantics matches zero segments)
  - [x] 2.3 Update `.github/instructions/implement.instructions.md` `applyTo` pattern for consistency (currently `"workstream/**/tasks-*.md"` — verify it behaves correctly for GitHub Copilot)
  - [x] 2.4 Verify Acceptance Criterion: steering loads when `workstream/tasks-issue-X.md` (zero-depth) is referenced in a Kiro session

- [x] 3.0 Harden branch creation gate in agent prompts (AC-3, AC-6)

  - [x] 3.1 Edit `.kiro/agents/developer.md` Execution Flow step 4: replace `(if not already present)` with explicit branch-check logic — run `git rev-parse --abbrev-ref HEAD`, if HEAD is default branch (`main`) and does not match `issue/*` or `story/*` pattern, MUST create branch before any write/commit. If HEAD is already a valid feature branch, proceed without creating a new one.
  - [x] 3.2 Edit `.kiro/steering/implement.md` "Before Starting Work" section: strengthen step 2 with the same explicit branch verification language and add a blocking condition ("You MUST NOT proceed with any implementation sub-task until a feature branch is checked out")
  - [x] 3.3 Apply the same hardened language to `.claude/agents/developer.md` Execution Flow and `.claude/skills/implement/SKILL.md` "Before Starting Work"
  - [x] 3.4 Apply the same hardened language to `.github/agents/developer.agent.md` Execution Flow and `.github/instructions/implement.instructions.md` "Before Starting Work"
  - [x] 3.5 Verify Acceptance Criterion: branch creation is a hard gate — prompt language leaves no ambiguity that implementation is blocked while on default branch

- [ ] 4.0 Add branch/PR to per-turn output contract (AC-4, AC-6)

  - [ ] 4.1 Edit `.kiro/agents/developer.md` Output Contract "compact status report" section: add "Current branch name" and "PR number and status (draft/ready/none)" as required fields
  - [ ] 4.2 Apply the same output contract update to `.claude/agents/developer.md`
  - [ ] 4.3 Apply the same output contract update to `.github/agents/developer.agent.md`
  - [ ] 4.4 Verify Acceptance Criterion: per-turn output template includes branch name and PR status

- [ ] 5.0 Fix git-guard hook matcher regex (AC-5)

  - [ ] 5.1 Edit `.kiro/hooks/git-guard.json`: change `"matcher": "shell|runCommand"` to `"matcher": "execute_bash|shell|runCommand"`
  - [ ] 5.2 Add a second hook entry in `git-guard.json` for write tools (`fs_write|str_replace|fs_append`) that runs a script checking if HEAD is `main` and blocks with exit 2 (best-effort, same fail-open pattern as existing guard)
  - [ ] 5.3 Create or extend `.kiro/hooks/scripts/git-guard.sh` to handle the write-tool hook case (check current branch, block if on `main`, fail-open on error or empty payload with loud warning)
  - [ ] 5.4 Verify Acceptance Criterion: `git-guard.json` matcher regex includes `execute_bash` and write-tool hook exists

- [ ] 6.0 Final cross-platform consistency check (AC-6)

  - [ ] 6.1 Diff the three developer agent files (`.kiro/`, `.claude/`, `.github/`) for execution flow, output contract, and branch gate language — confirm they express the same semantics adapted to each platform's conventions
  - [ ] 6.2 Diff the three implement instruction files for branch gate language consistency
  - [ ] 6.3 Document any platform-specific deviations that are intentional (e.g., Claude's native subagent vs Kiro's `tools: [subagent]`)
  - [ ] 6.4 Verify all Acceptance Criteria are met
