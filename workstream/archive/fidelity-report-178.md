# Fidelity Report — Issue #178 (Close GitHub MCP bypass of git-guard)

## 1. Header / Verdict

- **Fidelity: High**
- **Highest drift impact present: Major** (scope gap: Kiro tree carries the identical unenforced-MCP-equivalent bypass, untouched by this PR and untracked as a follow-up)
- **Scope:** Issue #178, PR #189 (draft), branch `issue/178-close-mcp-bypass` → `integration/claude-runtime-parity-plan`

`verifier_audit: run` — result: **Fidelity: High, no Critical/blocking defects found against issue #178's stated ACs.** One Major-impact, out-of-issue-scope gap identified (Kiro parity) and two Minor documentation-bookkeeping items. None of these block PR/issue completion per the non-blocking drift rule.

## 2. Human-Readable Summary

The problem this PR fixes: if you had the GitHub MCP server turned on, Claude could merge, push, or delete files directly on the protected default branch using MCP tools, and the safety hook that's supposed to stop that never even looked at those tool calls — it only watched terminal commands. This PR teaches the same safety hook to also watch the six MCP tools that can write to GitHub (merge PR, enable auto-merge, push files, create/update a file, delete a file, create a branch), reading the tool's actual structured input (which PR, which branch) instead of trying to regex a command string that doesn't exist for MCP calls. It also updates the internal "GitHub agent" reference table so it stops silently advertising an unguarded shortcut, and it adds clear, required-not-optional instructions in three places (README, project setup checklist, and the top-level agent rules) telling anyone using this toolkit that the real, unbypassable safety net is a GitHub branch-protection rule on the server, not this local hook — the hook is just fast local feedback.

What I independently verified: the new guard logic works as described, tested it myself with real subprocess calls and real JSON payloads (not just the shipped 38 tests, which do the same), and tried several deliberately malformed/edge-case inputs (numbers vs. strings, missing fields, nested payload shapes) without finding an exploitable bypass — the code consistently fails safe (blocks) whenever it can't confidently tell a write is safe. The one thing worth flagging for follow-up: this exact bypass class — an agent's own docs advertising an MCP GitHub shortcut with zero enforcement behind it — still exists, unchanged, on Kiro. This PR is legitimately scoped to Claude Code (that's what issue #178 asked for), so it isn't a defect in this PR, but nobody has opened a follow-up ticket for the Kiro side yet, and it's the same security-relevant gap.

## 3. Per-AC Result Table

| AC-ID | Description | Codebase evidence | Workstream evidence | Test evidence | Result |
| --- | --- | --- | --- | --- | --- |
| AC-1 | An attempted merge into the default branch via the MCP tool is blocked by the hook | `.claude/hooks/git-guard.sh` Rule 5 (lines 78-178) dispatches on exact `tool_name` match for the 6 mutating MCP tools; `merge_pull_request`/`enable_pr_auto_merge` resolve base via `gh pr view` and block on match; `.claude/settings.json` and `templates/claude/settings.json` both add the second `PreToolUse` matcher | Task 10.1-10.3 checked off; CP-10 in test-plan/traceability matrix maps AC-1 to matcher-coverage + behavioral tests | `test/unit/git-guard-mcp.test.ts` (38/38 passing, verified independently via `vitest run --reporter=verbose`); own adversarial payloads (numeric vs. string `pullNumber`, missing `tool_input`, nested shapes, whitespace/case in `tool_name`) confirm fail-safe behavior, no exploitable bypass found | **Pass** |
| AC-2 | With branch protection configured, the same merge fails server-side even with every hook disabled | Not code-testable; correctly out of automated scope | Task 10.6 explicitly marks this manual/documentary; test-plan CP-10 "Pass criteria" states this is manual since it needs a real GitHub repo with branch protection; README §3, `activity-init` SKILL.md (all 3 platform trees), and `AGENTS.md` § Hooks document the exact `gh api ... /protection` invocation and the required settings (PR required, ≥1 review, passing checks, force-push/deletion disabled) | No automated test claims to cover this (confirmed by reading `git-guard-mcp.test.ts` — none of the 38 tests reference server-side protection); manual steps in README are concrete and sufficient for a human to execute and verify (the `gh api` command is copy-paste-ready and the "what to configure" list is unambiguous) | **Pass (manual, correctly marked as such — not silently claimed as automated)** |
| AC-3 | `pnpm run test:unit` and `pnpm run validate` pass | N/A | Task 10.7 checked off, claims "2364 tests" green plus `pnpm run audit` clean | Independently ran `pnpm run lint`, `pnpm run typecheck`, `pnpm run format:check`, `pnpm run audit` — all pass on this branch; full `pnpm run test:unit` run (98 files / 2139 tests, includes the 38 MCP tests) — all green | **Pass** |
| (Implicit) Reconcile github-ops.md table vs. guard | `github-ops.md` stops advertising an unguarded MCP equivalent, or guard covers it | `.claude/agents/github-ops.md` diff adds a note under the operations table naming `git-guard.sh` Rule 5 coverage of `merge_pull_request` and the other 5 tools, referencing #178 | Task 10.3 checked off | `test/unit/git-guard-mcp.test.ts` "table/guard agreement" describe block (2 tests) passing | **Pass** |

## 4. Drift Catalog

### D-1 — Kiro tree carries the identical unguarded-MCP-equivalent bypass, unaddressed and untracked

- **Description:** `.kiro/agents/github-ops.md` contains the exact same "MCP equivalent: `merge_pull_request`" table row as the pre-fix `.claude/agents/github-ops.md` did, with no reconciliation note. `.kiro/hooks/git-guard.json`'s matcher (`execute_bash|shell|runCommand`) has zero coverage of any GitHub MCP tool surface — `.kiro/hooks/scripts/git-guard.sh` was not touched by this PR. This is the same root-cause bypass class issue #178 closes for Claude, left fully open on Kiro.
- **Impact class:** Major (it is a live, real security-relevant gap — a consumer on the Kiro profile with GitHub MCP enabled has zero enforcement on merge/push/delete-file/create-branch MCP calls today).
- **Intent class:** Undetermined — plausibly deliberate scope-narrowing (issue #178's own body and "Relevant Files" list are Claude-specific; this is explicitly a "Claude Runtime Parity" initiative), but nothing in the PR, the task list, or `AGENTS.md`'s updated Hooks table flags this as a known, tracked, deferred gap for Kiro. `AGENTS.md`'s Hooks table header ("Matcher (Claude Code)") is honest about being Claude-scoped, so there is no false parity claim — but there is also no cross-reference to a tracked follow-up.
- **Evidence source(s):** Codebase (`.kiro/agents/github-ops.md`, `.kiro/hooks/git-guard.json`, `.kiro/hooks/scripts/git-guard.sh` — no diff in `main...HEAD` for any of these), issue #178 body (Relevant Files list is Claude-only).
- **Non-blocking note:** This drift does not block PR #189 or issue #178 completion — #178's own scope and ACs are Claude-specific and are fully satisfied.

### D-2 — PR #189 body's "Docs updated" checkbox is unchecked despite docs already being in the diff

- **Description:** PR body's Checklist section has `- [ ] Docs updated (README/AGENTS.md/github-ops.md — follow-up commits in this PR)` unchecked, but commits `702f862` (docs) and `b35f08b` (test mirroring across platforms) are already present on the branch and included in the diff (`README.md`, `AGENTS.md`, all three `activity-init/SKILL.md` copies, `.claude/agents/github-ops.md`).
- **Impact class:** Minor (bookkeeping only; does not affect delivered behavior).
- **Intent class:** Unintended (stale checklist item, most likely written before the follow-up doc commits landed and never refreshed — PR is still draft).
- **Evidence source(s):** `gh pr view 189` body vs. `git log main..HEAD` and `git diff main...HEAD --stat`.
- **Non-blocking note:** Cosmetic; does not block completion. Worth a one-line edit before marking the PR ready for review.

### D-3 — PR body references a "completion comment" that does not exist yet

- **Description:** PR body's Testing section says "Full suite: ... (see completion comment)" but the PR currently has zero comments (`gh pr view 189 --json comments` → length 0).
- **Impact class:** Minor.
- **Intent class:** Intended-but-not-yet-executed — consistent with the PR still being in draft state; the completion comment is presumably posted at ready-for-review time, per this repo's conventions.
- **Evidence source(s):** `gh pr view 189 --json comments`.
- **Non-blocking note:** Not a defect if resolved before the PR leaves draft; flagging so it isn't forgotten.

## 5. Edge-Case and Randomized Test Outcomes

Test-plan CP-10 (this scope) and RT-04 (fuzzed `tool_input` shapes) were consulted. `RT-04` is marked "Planned" in the traceability matrix (not yet implemented) — no randomized/fuzz harness for `tool_input` shapes exists yet in `test/unit/git-guard-mcp.test.ts`; the 38 tests are deterministic/example-based only. This is consistent with the matrix's own "Planned" status, not a false claim of coverage.

Independent adversarial probing performed in this audit (beyond the shipped test file), all against the live script via subprocess with real JSON:

| Adversarial input | Observed behavior | Assessment |
| --- | --- | --- |
| `tool_name` with trailing whitespace (`"...merge_pull_request "`) | Falls through the `case` statement untouched (exit 0) | Not exploitable in practice — `tool_name` is emitted by the Claude Code runtime itself, not attacker/model-controlled text; no real invocation path produces a malformed `tool_name` while still running the real tool. Documented as a theoretical/informational note, not a defect. |
| `tool_name` uppercased | Same as above (exit 0, falls through) | Same reasoning — informational only. |
| `pullNumber` as a JSON string (`"5"`) vs. number (`5`) | Identical behavior; `jq -r` normalizes both to the same raw string | No bug — correctly handled either way. |
| `tool_input` with an unexpected extra nesting level (`{"params":{"branch":"main"}}`, no top-level `branch`) | Treated as `branch` absent → blocked (same as omitted-branch case, fail-closed) | Correct, safe-by-default behavior. |
| `create_branch` with `tool_input` entirely missing | Falls through, allowed (exit 0) | Consistent with documented contract: no plausible unsafe interpretation exists for a nameless branch-creation call (unlike write-tools' "omitted branch defaults to default branch" API semantics), so fail-open here is reasonable, not a gap. |
| `branch` as a JSON number (`123`) for `push_files` | Allowed (compares as string "123" ≠ "main") | Correct — not the default branch. |
| Extra trailing newlines in the raw JSON payload | Parses and blocks correctly | No parser fragility found. |

No reproducible security bypass was found in this round of adversarial testing. Per the Failure Triage Workflow, no failures were captured/isolated/minimized because none occurred.

## 6. Recommendations

| Item | Recommended next step |
| --- | --- |
| D-1 (Kiro parity gap) | `product-engineer`: open a follow-up issue scoping the identical MCP-bypass fix to `.kiro/hooks/scripts/git-guard.sh` + `.kiro/hooks/git-guard.json` + `.kiro/agents/github-ops.md`, referencing this report and issue #178 as precedent. Not a blocker for #178/PR #189. |
| D-2 (stale "Docs updated" checkbox) | `developer`: check the box in the PR body before requesting review — the work is already done and merged into the branch. |
| D-3 (dangling "completion comment" reference) | `developer`: post the promised completion comment (test/gate results) before converting the PR out of draft, or remove the dangling reference. |
| AC-1, AC-2, AC-3 | No action needed — all satisfied with correct evidence and correctly-scoped manual/automated split. |
| RT-04 (fuzz harness, "Planned") | No action needed for this PR's completion; `qa-engineer`/`verifier` may pick this up as a future hardening pass per the existing traceability matrix status — not a gap introduced by this PR. |

---

*Generated by `verifier` (Audit Mode). Sources: `.claude/hooks/git-guard.sh`, `.claude/settings.json`, `templates/claude/settings.json`, `.claude/agents/github-ops.md`, `.kiro/agents/github-ops.md`, `.kiro/hooks/git-guard.json`, `README.md`, `AGENTS.md`, `.claude/skills/activity-init/SKILL.md` (+ `.github`/`.kiro` copies), `workstream/tasks-claude-runtime-parity-plan.md`, `workstream/test-plan-claude-runtime-parity.md`, `workstream/traceability-matrix-claude-runtime-parity.md`, `test/unit/git-guard-mcp.test.ts`, issue #178 body, PR #189 body/metadata, independent subprocess execution of `git-guard.sh` with adversarial payloads, and `pnpm run lint|typecheck|format:check|audit|test:unit` executed live on branch `issue/178-close-mcp-bypass`.*
