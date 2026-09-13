# ADR-005: `infra-engineer` approval-gated infrastructure change lifecycle

## Status

Accepted

## Context

Before `infra-engineer`, no agent owned infrastructure change as a distinct, guarded activity. `developer` and other execution agents ran platform write commands directly — `fly secrets set`, `aws iam create-policy`, `supabase db push`, Cloudflare DNS edits — inline while implementing a task. That created three problems the rest of the harness already solves for code but not for infrastructure:

- **No approval boundary.** A platform write is high-impact and often irreversible, yet it happened without a per-operation human gate. The completion-gate discipline the harness applies to merges did not extend to the moment a secret was rotated or a policy attached.
- **No reversibility contract.** A command ran and mutated a live account with nothing recording how to undo it. There was no captured backup, no restore command, and no revert sequence — recovery depended on whoever ran the command remembering what they did.
- **No durable record.** The change left no artifact. There was nothing to audit, nothing to hand to a reviewer, and nothing to reproduce the state a session left behind.

The technical guidelines already require least privilege, per-operation approval for production and destructive work, migration-first evidence, and explicit-failure over optimistic success. Infrastructure work was the gap where those principles were stated but unenforced. The decision is how to close that gap without turning the harness into an infrastructure-as-code tool or granting an agent standing write authority.

## Decision

Add `infra-engineer` as an agent whose entire behavior is a non-skippable lifecycle:

`discover → plan → approve plan → (approve step → backup → apply → verify → record) → result`

with these binding rules:

- **Human owns every approval and all production.** The agent pauses for plan approval and then exactly one approval per step. Approval for one step never carries to the next. Production environments, tag creation, and merges to `main` remain human-only.
- **No autonomous or batch mode exists.** There is no mode that runs steps ahead, bundles two steps into one question, or applies without a fresh approval. This is a deliberate absence, not a default that can be flipped.
- **Every write is tied to a `ChangeId`.** Writes occur only under a `ChangeId` (`infra/changes/<YYYYMMDD>-<slug>/`) with `plan.md`, an append-only `commands.sh`, a `rollback.sh` regenerated in reverse order after each applied step, and a `result.md` recording status, backup id, restore command, and verified-at per step. Reading logs is the only exception to the write gate, and it stays bounded and redacted.
- **Reversibility is a precondition.** A production step with no revert is refused at plan time; a non-production step may waive revert only with explicit per-step acceptance. A production step that touches state records a backup id and restore command before it applies.
- **Identity is asserted before every write phase.** The agent compares the resolved AWS account, fly org, and Supabase project ref against the target environment declaration and treats a mismatch as `blocked`, never a warning.
- **Policy lives in the agent body; mechanism lives in skills.** The loop, gates, tiers, identity, tool check, routing table, and record formats are in the agent contract. Three platform skills — `aws-ops`, `fly-ops`, `supabase-ops` — supply per-surface command sets, version floors, cost inputs, backup commands, revert sources, and log tables. A fourth skill, `deploy-ops`, is planned for Phase 2 to own the script and workflow contract; it is not part of this decision's shipped surface.
- **The handoff is a draft PR.** The agent commits the `ChangeId` records on a feature branch and has `github-ops` open a draft PR carrying the plan, result, rollback, and validation evidence. It never merges the draft.

The agent ships across all three platform trees. On Claude it runs in the main thread as a `.claude/commands/` entry point rather than as a subagent — the same treatment as `planner` and `product-engineer` — because its per-step human approval gate requires a thread that can pause for a "yes", and a Claude subagent runs to completion and only returns a summary.

## Alternatives Considered

- **A capability/adapter contract instead of a dedicated agent** — model each platform as an adapter behind a common interface and let existing agents call it. Rejected: an adapter standardizes commands but not the approval, backup, revert, and record discipline that is the actual point. The risk was never command shape; it was an unguarded write. An interface with no owning agent would leave the gate optional.
- **An autonomous or batch apply mode** — let a trusted operator pre-approve a whole plan and have the agent run it unattended. Rejected: it reintroduces exactly the unguarded-write problem this agent exists to remove, and it conflicts with the guidelines' per-operation approval requirement for production and destructive work. Honest per-step gating is worth the friction.
- **Authoring infrastructure-as-code (Terraform/CDK/CloudFormation)** — have the agent generate and apply IaC. Rejected as the general mechanism: it presumes a foundation-tier toolchain many consumer projects do not run, and applying IaC is itself the high-impact write that needs gating. The two-tier model keeps foundation changes routed to the project's `tier0_tool` for a human to run, rather than applied by the agent.
- **Environment branches for infrastructure state** — track infrastructure per long-lived environment branch. Rejected: it duplicates environment state that already lives in the consumer-owned `infra/environments.yaml` and the platform accounts themselves, adds branch-management overhead, and conflicts with the single-source-of-truth intent of the change-record directories. Change records under `infra/changes/` on ordinary feature branches carry the durable state instead.

## Consequences

Positive:

- Every infrastructure change now has an approval boundary, a captured reversal path, and a durable, auditable record — the same guarantees the harness already gives code changes.
- Platform write commands move out of `developer` and behind a single owning agent, so the "who is allowed to mutate a live account" question has one answer.
- The policy/mechanism split keeps the three platform skills swappable and independently testable without touching the loop, and leaves room for `deploy-ops` to land in Phase 2 without reopening the contract.
- Draft-PR handoff puts human review on the actual gate, consistent with the rest of the harness.

Negative / bounded:

- Per-step approval is deliberately slower than an inline command. Multi-step changes require multiple round-trips; there is no fast path, by design.
- A tenth first-class role (eleventh agent) enlarges the discovery surface for new users and adds three skills plus a consumer-owned `infra/` tree to the registries.
- On Claude the agent must run in the main thread, so it cannot be delegated to as an isolated subagent the way leaf workers are; callers invoke it as a command.
- Enforcement is partly convention: `git-guard` blocks agent tag and `main` operations deterministically, but per-step approval and record discipline are contract-enforced and rely on human PR review as the backstop.

Follow-up:

- Phase 2 adds `deploy-ops`, the script templates (`deploy.sh`, `deploy-verify.sh`, `rollback.sh`, `deploy-status.sh`, `release.sh`), and the GitHub Actions workflow templates; register them then.
- Wire the other agents to route platform-write sub-tasks to `infra-engineer` (Task 10) and add the Infrastructure Change workflow chain (Task 10.5).

## Related

- Requirements: `docs/requirements/prd-infra-engineer.md` (v1.3)
- Workstream: `workstream/specification-infra-engineer.md` (v1.0), `workstream/tasks-infra-engineer-plan.md` (Story S-006)
- Agent: `.github/agents/infra-engineer.agent.md`, `.claude/commands/infra-engineer.md`, `.kiro/agents/infra-engineer.md`
- Skills: `.github/skills/{aws-ops,fly-ops,supabase-ops}/SKILL.md` (mirrored in `.claude/skills/` and `.kiro/skills/`)
- Templates: `templates/infra/environments.yaml`, `templates/infra/redaction-patterns.txt`
- Docs updated: `AGENTS.md`, `AGENTS.md.template`, `CLAUDE.md`, `CLAUDE.md.template`, `README.md`, `docs/system-overview.md`, `docs/adr/README.md`
