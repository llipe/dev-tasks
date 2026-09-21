---
applyTo: "workstream/**/tasks-*.md"
---

# Activity: Implement Task List

> **RFC 2119 Notice:** The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHALL**, **SHALL NOT**, **SHOULD**, **SHOULD NOT**, **RECOMMENDED**, **MAY**, and **OPTIONAL** in this document are to be interpreted as described in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119).

## Goal

Execute a task list step-by-step with strict sequencing, proper branching, PR workflow, GitHub Issue synchronization, and user approval gates.

This is the **single source of truth** for execution rules. All agents and workflows that perform implementation **MUST** follow these rules.

## Context

This activity assumes:

- A task list file exists in `/workstream/tasks-*.md`.
- The corresponding GitHub Issue exists and includes a checklist.
- GitHub is the source of truth for execution status.

## Package Manager and Command Standards

- For JavaScript/TypeScript repositories, you **MUST** prefer `pnpm` over `npm` for dependency and script commands.
- You **MAY** use `npm` only when `pnpm` is unavailable or the project is explicitly npm-locked.
- For JS/TS repositories, quality and test execution **MUST** use canonical `package.json` script names where available: `lint`, `format:check`, `typecheck`, `test`, `audit`, and `validate`.

---

## Package Scope in Commits

In a monorepo the package is the Conventional Commits **scope** (FR-63):

```
feat(api): add token-refresh endpoint
fix(web): stop double-submitting the checkout form
```

- Take the scope from the package map in `docs/tech.md`. Use the short,
  readable form of the package name, not the full specifier: `@acme/api`
  becomes `api`.
- A package name that is not a valid scope — one containing a space, a
  slash after stripping the org prefix, or an uppercase letter — is
  reduced to a lowercase, hyphenated form and the mapping is recorded in
  the package map's row so every commit uses the same one. Never invent
  a different short form per commit.
- A commit spanning packages uses the broadest honest scope, or none. A
  scope that names one package for a change touching four is worse than
  no scope.
- In a **single-package repository the scope is optional**. Omit it —
  `feat: add the endpoint` — rather than writing an empty scope `feat():`,
  which is not valid Conventional Commits and which the commit hook
  rejects.

## Platform-Write Routing

- You **MUST NOT** emit or execute a platform write command (`aws`, `flyctl`, `supabase`, or Cloudflare API writes) while executing a task list.
- When a sub-task's work is a platform write, you **MUST** route it to `infra-engineer` instead of running it yourself, so the approval, revert, and backup gates bind. The sub-task kinds that route are: **secrets**, **deploy**, **DNS**, **certificates**, **IAM policy**, and **migrations against a shared or cloud project**.
- This routing is **conditional**, never mandatory: a story with no platform-write scope invokes nothing, and an infra-shaped but local-only sub-task — such as editing `.env.example` or a config template checked into the repo — stays with the implementing agent.

---

## Before Starting Work

1. You **MUST** confirm the GitHub Issue is open.
2. **Decision-log read (non-mutating — runs before any branch is created):** You **MUST** read `workstream/decisions-<feature>.md` in full, alongside (not replacing) the GitHub-issue-open check in step 1 — both checks run before branch creation. This step is ordered before the branch gate (step 3) precisely because it is non-mutating: reading it first lets you answer your own procedural questions (e.g., "was this file's location already decided?") from the log before touching git. If `workstream/decisions-<feature>.md` does not exist — for example, a pre-Phase-2 feature, or a feature for which grilling never ran — you **MUST** proceed without the read, noting its absence in your status output, rather than failing or blocking. This is an enrichment, never a hard gate: a missing decision log never blocks starting work. A decision log that exists but has zero rows is treated the same as present-and-populated — there is simply nothing to cite.
3. **Branch gate (hard requirement):** You **MUST** verify you are on a feature branch before any implementation work:
   - Run `git rev-parse --abbrev-ref HEAD` to determine the current branch.
   - If HEAD is the default branch (`main`) or does not match `issue/*` or `story/*` pattern, you **MUST** create a new branch from the latest default branch by delegating branch naming and creation to `github-ops` whenever possible.
   - You **MUST NOT** proceed with any implementation sub-task, write any code, create any files, or make any commits until a feature branch is checked out.
   - If HEAD is already a valid feature branch (matching `issue/*` or `story/*`), proceed to step 4.
   - Branch format: `issue/<issue-number>-<short-description>` or `story/<id>-<short-description>`
4. You **MUST** open a **draft Pull Request** by delegating to `github-ops` whenever possible.
   - A PR requires at least one commit. Open it immediately after the first commit on the feature branch — never before — and you **MUST NOT** continue past that first commit without it.
   - Base branch is the default branch unless an orchestrating caller explicitly provides a base-branch override.
   - PR title **MUST** follow Conventional Commits (e.g., `feat: implement issue 37`).
   - PR description **MUST** include `Closes #<issue-number>`.
5. You **MUST** ensure the task list in the GitHub Issue matches the local `/workstream/tasks-*.md` file.

If `github-ops` delegation is unavailable in the current runtime, you **MUST** apply `github-ops` conventions directly and explicitly note that fallback in your status output.

---

## Decision-Log Citation

When `workstream/decisions-<feature>.md` exists and was read per step 2 above:

- An implementation commit whose approach was shaped by a decision **MUST** cite it in the commit body — e.g. a trailing line `Follows D-NN: <short form>.` — using the feature's own unqualified `D-NN` form (the file belongs to one feature; the qualified `<feature>#D-NN` cross-file form is `activity-grill`/`activity-refine`/`activity-generate-spec`'s concern, not `implement`'s).
- The PR body **MUST** reference every consumed decision ID it draws on, in its Completion Report area, alongside the existing `Closes #<issue-number>` line.
- This is **additive only**, mirroring `plan`'s own citation contract: a commit or PR with no traceable decision cites none. You **MUST NOT** fabricate a citation to give a commit or PR one.
- When step 2 found no `workstream/decisions-<feature>.md` (absent or empty), there is nothing to cite — omit the citation, do not fabricate one, and do not treat the omission as a defect.

---

## During Implementation

### Step-by-Step Execution

- You **MUST** execute **one sub-task at a time**.
- You **MUST NOT** start the next sub-task until the user grants permission (says "yes" or "y").
- After completing each sub-task, you **MUST** immediately:
  1. Mark it `[x]` in the local task file.
  2. Mark it `[x]` in the GitHub Issue checklist.
  3. Stop and wait for user approval before proceeding.

### Parent Task Completion

- When **all** sub-tasks under a parent task are `[x]`, you **MUST** also mark the **parent task** as `[x]`.

### Task List Maintenance

- You **MUST** regularly update the task list file after finishing significant work.
- You **MUST** add newly discovered tasks as they emerge.
- You **MUST** keep the "Relevant Files" section accurate and up to date with every file created or modified.
- You **MUST** keep the local task list and the GitHub Issue checklist aligned at all times.
- If drift is detected between local and GitHub, you **MUST** reconcile immediately and report the reconciliation.
- If schema/data-model changes are in scope, migration artifacts **MUST** be tracked in the task list unless an explicit opt-out rationale is documented.

### Progress Updates

- You **SHOULD** add brief issue or PR comments for major milestones or meaningful changes.
- You **SHOULD** route issue/PR comment updates through `github-ops` whenever possible.

---

## Before Closing a Story/Issue

1. All acceptance criteria **MUST** be verified.
2. All tests listed in the checklist **MUST** be completed and passing.
3. The following quality gates **MUST** be completed and passing before completion:
   - `test`
   - `lint`
   - `format:check`
   - `typecheck`
   - `audit`
4. For schema/data-model changes, migration handling **MUST** satisfy all of the following:
   - migration artifact created (unless documented opt-out)
   - rollback/impact notes captured
   - explicit user confirmation obtained before any migration apply command
   - apply step executed only after user confirmation
   - post-apply verification recorded
5. `technical-writer` validation **MUST** include a drift/stale-doc check report, and completion **MUST NOT** proceed while unresolved drift remains.
6. A `qa-engineer` pass **MUST** have run and `coverage_gate` **MUST** be recorded as `PASS`, `FAIL`, or `SKIPPED(<reason>)`. The reason **MUST** be non-empty when skipped; an omitted field is treated as incomplete. A `FAIL` or `SKIPPED` value does not block completion — only omission does.
7. A `verifier` audit in `audit` mode **MUST** have run against the delivered implementation, with its human-readable summary posted to the issue/PR. This gate is mandatory and non-skippable — it **MUST NOT** be skipped regardless of drift findings, and drift findings reported by this audit **MUST NOT** block completion. This condition is satisfied once the audit has run and been posted; any resulting drift is handled by `product-engineer`'s `activity-drift-reconciliation` flow after this gate, not before it.
8. The PR **MUST** be converted from draft to ready for review.
9. The PR **MUST** be approved by the appropriate reviewer per the merge authority policy in `github-ops`:
   - PRs targeting an **integration branch**: `planner` reviews and approves.
   - PRs targeting **`main`**: the **user** reviews and approves.
10. The PR **MUST** be merged by the authorized party (planner for integration branches, user for `main`).
11. You **MUST NOT** close the GitHub Issue until the PR is approved **AND** merged.
12. You **MUST NOT** close the issue while the PR is still in draft or pending review.
13. You **MUST** notify the user when the PR is ready for review — explicitly inform them so they can review and merge.

---

## GitHub Execution Rules Summary

| Phase              | Rule                                                                                                                                                                                                                                                                                               |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Before coding**  | Confirm issue open → Create branch (`github-ops`) → First commit → Open draft PR (`github-ops`) → Sync checklists                                                                                                                                                                                  |
| **During coding**  | One sub-task at a time → Mark `[x]` locally + GitHub → Wait for approval                                                                                                                                                                                                                           |
| **Before closing** | All ACs verified → Quality gates pass (test/lint/format/typecheck/audit) → migration confirmation/apply/verify (when applicable) → docs drift check clear → coverage_gate recorded → verifier audit run + summary posted (non-blocking on drift) → PR ready → Approved → Merged → Then close issue |

---

## Output

- Keep all changes and status updates in GitHub and `/workstream/tasks-*.md`.
- You **MUST** check which sub-task is next before starting work.
- After implementing a sub-task, you **MUST** update the file and then pause for user approval.

## Final Instructions

1. You **MUST** always respect the task list execution order.
2. You **MUST** keep the GitHub Issue updated with checklist and progress comments.
3. You **MUST** ensure branch, PR, and issue naming follow `github-ops` conventions.
4. You **MUST** stop after each sub-task and request user approval.
5. You **MUST NOT** close a GitHub Issue without confirming the PR has been reviewed, approved, and merged.
