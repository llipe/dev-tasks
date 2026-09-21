# User Stories: infra-engineer

## Changelog

| Version | Date       | Summary                                      | Author           |
| ------- | ---------- | -------------------------------------------- | ---------------- |
| 1.1     | 2026-09-11 | Added S-010 (caller wiring and workflow chains). Phase 2 caller wiring folded into S-009. S-006 no longer authors workflow chains. | product-engineer |
| 1.0     | 2026-09-11 | Initial version, from PRD v1.3 and spec v1.0 | product-engineer |

Source: `docs/requirements/prd-infra-engineer.md` (v1.3), `workstream/specification-infra-engineer.md` (v1.0).

Execution order: S-001 → (S-002, S-003, S-004, S-005, S-010 in any order) → S-006 closes Phase 1. S-007 has no Phase 1 dependency and can run first. S-008 → S-009 close Phase 2.

S-010 is the integration story. Without it the agent ships but no other agent routes to it, and `developer` keeps running platform write commands itself. It is Critical for that reason, not for its size.

Shared definition of done for every story: implemented per `docs/technical-guidelines.md`; tests written first and passing; `pnpm run validate` and `pnpm run audit` green; acceptance criteria mapped to test evidence; `verifier` audit run; `coverage_gate` recorded; PR opened, never self-merged.

---

### Story S-001: infra-engineer agent contract and environment template

**Priority:** Critical
**Estimated Size:** L
**Dependencies:** none

#### User Story

As an operator,
I want an `infra-engineer` agent that plans infrastructure work as numbered steps and applies each one only after my approval, with a revert and, in production, a backup,
So that every change is recorded, reversible, and never runs ahead of me.

#### Context

The agent body is the policy layer for everything else in this feature. Skills, scripts, and workflows hang off it. It ships on three platforms with behavioral parity.

#### Acceptance Criteria

- [ ] AC-1 `.github/agents/infra-engineer.agent.md`, `.github/prompts/infra-engineer.prompt.md`, `.claude/commands/infra-engineer.md`, `.kiro/agents/infra-engineer.md` exist and are non-empty; no `.claude/agents/infra-engineer.md`; Kiro frontmatter has `description` and `tools`, no `permissions`.
- [ ] AC-2 The working loop `discover → plan → approve plan → (approve step → backup → apply → verify → record) → result` is stated with: no skippable phase, no write without `ChangeId` plus step approval, no autonomous or batch mode.
- [ ] AC-3 Step schema (kind, tool, environment, forward, expected result, verify, revert, touches state) and the step state machine from the spec are documented.
- [ ] AC-4 Revert rule: every step has a revert; a production step with no revert is refused; non-production needs explicit "accept no revert" per step. `rollback.sh` is regenerated in reverse order after each applied step.
- [ ] AC-5 Backup rule: production step with `touches state` runs only after a backup id and restore command are recorded in `result.md`.
- [ ] AC-6 Two-tier model, foundation route-not-write with `tier0_tool`, ephemeral `ExpiresAt`, destroy rules (typed environment name, reverse order, production foundation refused).
- [ ] AC-7 Identity assertion procedure names the probe per platform and refuses on mismatch.
- [ ] AC-8 Tool check procedure: presence, version floor from the owning skill, authentication; non-`ok` blocks with remediation; no auto-install, no fallback.
- [ ] AC-9 Tool-routing table present with all rows listed in the spec (change kind, tool, phase, owning skill).
- [ ] AC-10 Cost rule: per-resource monthly estimate with source; at-or-above-threshold items marked `APPROVAL REQUIRED`; read-only cost sweep described.
- [ ] AC-11 Record and inventory formats match the spec (`plan.md`, `commands.sh` blocks, `rollback.sh`, `result.md`, inventory `_generated` header); records committed on a branch with a draft PR via `github-ops`, never merged.
- [ ] AC-12 Tagging, secrets (by ARN, `fly secrets`, `supabase secrets`, `gh secret set`, OIDC preferred), and log-triage rules (bounded, UTC, scope stated before billed query, redaction unconditional, inference labelled) are stated.
- [ ] AC-13 Cloudflare DNS record and certificate steps are described with prior-value capture as revert.
- [ ] AC-14 `templates/infra/environments.yaml` ships with `# status: template` first line and the schema from the spec; the agent treats a template-status file as missing and blocks.
- [ ] AC-15 `test/unit/infra-engineer-parity.test.ts` passes and asserts every contract statement above across the three variants.

#### Business Rules

- No write without `ChangeId` and a per-step approval; log reading is the only exception.
- Agents never create, move, delete, or push tags; never push or merge to `main`.
- A missing or template-status `environments.yaml` blocks.

#### Technical Notes

- Model the Claude command on `.claude/commands/planner.md` (main thread, pauses per step). Model Copilot and Kiro files on `qa-engineer`.
- Guidelines: Authentication and Authorization (per-operation approval), Security Requirements (untrusted input), Design Patterns (fail explicit, bounded autonomy).
- Keep platform command sets out of the agent body; they belong to S-002 to S-004.

#### Testing Requirements

- **Unit Tests:** parity test with the contract statement list; frontmatter checks; absence of `.claude/agents/` entry.
- **Integration Tests:** none.
- **Manual/UI Testing:** invoke `/infra-engineer` with a filled `environments.yaml` for a throwaway fly app; confirm the agent stops after each step and refuses when the file is template-status.
- **Edge-Case Matrix:** template-status file; environment missing a platform block; production step with empty revert; production `touches state` step without backup; `tier0_tool: none` with a foundation change; credentials resolving to another account.
- **Acceptance-Criteria Mapping:** AC-1..AC-13, AC-15 → `infra-engineer-parity.test.ts`; AC-14 → same test reads the template header; manual run covers AC-2, AC-4, AC-5 behaviorally.
- **Execution Commands:** `pnpm run test:unit`, `pnpm run validate`.

#### Migration Requirements

- Not applicable (no data model). Opt-out rationale: file contracts only.

#### Implementation Steps

1. Write the parity test first with the contract statement list from the spec; confirm it fails.
2. Author `.github/agents/infra-engineer.agent.md` as the canonical body.
3. Derive the Claude command and Kiro agent from it; add the Copilot prompt.
4. Add `templates/infra/environments.yaml`.
5. Run the parity test to green; run `pnpm run validate`.

#### Files to Create/Modify

- `.github/agents/infra-engineer.agent.md` - canonical agent body
- `.github/prompts/infra-engineer.prompt.md` - Copilot entry point
- `.claude/commands/infra-engineer.md` - Claude main-thread command
- `.kiro/agents/infra-engineer.md` - Kiro agent
- `templates/infra/environments.yaml` - consumer template
- `test/unit/infra-engineer-parity.test.ts` - parity test

---

### Story S-002: aws-ops skill

**Priority:** High
**Estimated Size:** M
**Dependencies:** S-001

#### User Story

As an operator,
I want an `aws-ops` skill with the exact AWS CLI commands, tiers, costs, backups, reverts, and log sources per change kind,
So that AWS work follows one playbook instead of improvised commands.

#### Context

AWS has no native plan, so this skill supplies the synthesized plan inputs: discovery commands, delta, exact commands. It also owns the AWS half of the routing table's mechanics.

#### Acceptance Criteria

- [ ] AC-1 `aws-ops/SKILL.md` exists in `.github/skills`, `.claude/skills`, `.kiro/skills` with identical body content.
- [ ] AC-2 Declares tool `aws` with `probe`, `floor` (2.x, exact minor pinned), `auth_probe` (`aws sts get-caller-identity`), and remediation strings.
- [ ] AC-3 Command sets per change kind: discover, build and push image (ECR), create and update ECS service and task definition, IAM policy create and attach, Secrets Manager reference by ARN, ACM certificate request and DNS validation, ALB target health, CloudWatch retention.
- [ ] AC-4 Tier per resource type (VPC, subnets, cluster, ECR = foundation; service, task def, target group, SG, secret, DNS record = application).
- [ ] AC-5 Cost estimation guidance with sources and the always-relevant list (NAT, ALB, RDS, EC2 capacity, interface endpoints).
- [ ] AC-6 Backup commands (RDS snapshot, S3 versioning check) and revert sources (previous task definition revision, previous image tag) per change kind.
- [ ] AC-7 AWS log table: CloudWatch `aws logs tail --since`, ECS `stoppedReason`, ALB access logs, Logs Insights with bounded window, VPC Flow Logs, CloudTrail `lookup-events`, GitHub Actions `gh run view --log-failed`.
- [ ] AC-8 Cost sweep categories: unassociated EIPs, available EBS volumes, stale snapshots, idle NAT, LBs with no healthy targets, zero-scaled services holding an LB, expired `ExpiresAt`, untagged, log groups without retention.
- [ ] AC-9 `test/unit/skill-parity-infra.test.ts` covers this skill and passes.

#### Business Rules

- Every command in the skill references secrets by ARN or name, never by value.
- Foundation resources are discovery-only; the skill provides no apply commands for them.

#### Technical Notes

- JSON output (`--output json`) for anything the agent parses.
- Guidelines: Integration Methods (deterministic tools first), Security Requirements.

#### Testing Requirements

- **Unit Tests:** parity across trees; presence of floor, auth probe, backup, revert, log table, sweep categories.
- **Integration Tests:** none.
- **Manual/UI Testing:** dry-run a plan for "create IAM policy and attach to role" in a non-production account and confirm the commands are complete and the revert detaches and deletes.
- **Edge-Case Matrix:** account mismatch; missing `aws`; `aws` v1 installed; secret referenced by value in a draft command (must be refused).
- **Acceptance-Criteria Mapping:** AC-1..AC-9 → `skill-parity-infra.test.ts`.
- **Execution Commands:** `pnpm run test:unit`.

#### Migration Requirements

- Not applicable.

#### Implementation Steps

1. Extend the skill parity test for `aws-ops` (fails).
2. Write the skill in `.github/skills/aws-ops/SKILL.md`; copy to the other trees.
3. Run tests to green.

#### Files to Create/Modify

- `.github/skills/aws-ops/SKILL.md`, `.claude/skills/aws-ops/SKILL.md`, `.kiro/skills/aws-ops/SKILL.md`
- `test/unit/skill-parity-infra.test.ts`

---

### Story S-003: fly-ops skill

**Priority:** High
**Estimated Size:** S
**Dependencies:** S-001

#### User Story

As an operator,
I want a `fly-ops` skill with `flyctl` commands for apps, machines, volumes, secrets, certificates, deploys, and rollbacks,
So that the platform I deploy to most is covered with the same discipline as AWS.

#### Context

fly.io has release history (`fly releases`) that makes revert concrete and volume snapshots that make backup concrete. It is the cheapest place to run the manual Phase 1 verification.

#### Acceptance Criteria

- [ ] AC-1 `fly-ops/SKILL.md` in three trees, identical bodies.
- [ ] AC-2 Declares tool `flyctl` with probe, floor (current major, exact pinned), `auth_probe` (`flyctl auth whoami`), remediation.
- [ ] AC-3 Command sets: `fly apps create`, `fly deploy` (including `--build-only` and `--image`), `fly secrets set/unset`, `fly volumes create/snapshots create`, `fly certs add/check`, `fly scale`, `fly machine` list and status, `fly apps destroy`.
- [ ] AC-4 Tiers: org = foundation; app, machine, volume, secret, cert = application; throwaway apps = ephemeral with `ExpiresAt`.
- [ ] AC-5 Revert source: `fly releases` plus `fly deploy --image <previous>`; secret revert by re-setting the prior value from its source of truth, never from a transcript.
- [ ] AC-6 Backup: `fly volumes snapshots create` before any production step touching a volume.
- [ ] AC-7 Log table: `fly logs -a <app> --since`, `fly status`, `fly machine status`, `fly releases`.
- [ ] AC-8 Cost entries: machines by size, volumes, dedicated IPs; sweep: stopped machines with volumes, unattached volumes, apps past `ExpiresAt`.
- [ ] AC-9 Skill parity test covers this skill and passes.

#### Business Rules

- No AWS Secrets Manager entry for a fly-only workload.
- `fly apps destroy` requires the typed app name and environment name.

#### Technical Notes

- Use `--json` where `flyctl` supports it.

#### Testing Requirements

- **Unit Tests:** parity and declared-field checks.
- **Integration Tests:** none.
- **Manual/UI Testing:** full plan on a throwaway app: create, secret, deploy, cert, DNS; then `rollback.sh` all the way down; confirm the app is gone.
- **Edge-Case Matrix:** wrong org; app already exists; `ExpiresAt` missing on a throwaway app.
- **Acceptance-Criteria Mapping:** AC-1..AC-9 → `skill-parity-infra.test.ts`; manual run → AC-3, AC-5.
- **Execution Commands:** `pnpm run test:unit`.

#### Migration Requirements

- Not applicable.

#### Implementation Steps

1. Extend the parity test for `fly-ops`.
2. Write the skill; copy to trees.
3. Run tests; run the manual plan.

#### Files to Create/Modify

- `.github/skills/fly-ops/SKILL.md`, `.claude/skills/fly-ops/SKILL.md`, `.kiro/skills/fly-ops/SKILL.md`
- `test/unit/skill-parity-infra.test.ts`

---

### Story S-004: supabase-ops skill

**Priority:** High
**Estimated Size:** M
**Dependencies:** S-001

#### User Story

As an operator,
I want a `supabase-ops` skill that uses `db diff` as the plan, confirms before `db push`, reports drift instead of pushing, and never records key material,
So that database changes to my Supabase projects are safe and auditable.

#### Context

Supabase is the one platform with a genuine plan mechanism. Its keys are the highest-value secrets in the stack.

#### Acceptance Criteria

- [ ] AC-1 `supabase-ops/SKILL.md` in three trees, identical bodies.
- [ ] AC-2 Declares tool `supabase` with probe, floor (2.x, exact pinned), `auth_probe` (`supabase projects list`), remediation.
- [ ] AC-3 Tiers: project, plan, compute, replicas, PITR = foundation; schema, migrations, RLS, roles, storage, auth, functions = application; preview branches = ephemeral with `ExpiresAt`.
- [ ] AC-4 Migration flow: `supabase db diff` as plan; destructive statements itemized; confirmation before `db push` to shared or production; `supabase migration list` as verification; non-empty diff with no pending local migration reported as drift and never pushed.
- [ ] AC-5 Backup: `supabase db dump` or recorded PITR point before any production step touching schema or data.
- [ ] AC-6 Discovery prefers Supabase MCP read-only, then CLI, then Management API, and records the path; writes never go through MCP.
- [ ] AC-7 Inventory fields documented; `has_legacy_keys` and `rls_disabled_tables` reported as findings; no key material, masked or otherwise.
- [ ] AC-8 Secrets: Edge Function secrets via `supabase secrets set`; publishable versus secret keys distinguished at each reference; no AWS Secrets Manager entry for a Supabase-only workload.
- [ ] AC-9 Log table for Supabase Cloud (Postgres, API, Auth, Storage, Realtime, Edge Functions) with the short-retention caveat and capture-at-incident-time rule; retrieval endpoint confirmed by a `researcher` pass and cited.
- [ ] AC-10 Cost entries (plan, compute, replicas, PITR, branches, egress) and sweep (branches past `ExpiresAt`, branches without `ExpiresAt`, paid idle projects, replicas without traffic, PITR on non-prod).
- [ ] AC-11 Skill parity test covers this skill and passes.

#### Business Rules

- Drift is reported, never reconciled by pushing.
- Project deletion refused for a production-mapped project.

#### Technical Notes

- Guidelines: Data and Database Guidelines, Supabase reference profile.
- Coordinates with `activity-integration-test-implementation`; this skill does not author tests.

#### Testing Requirements

- **Unit Tests:** parity and declared-field checks including the `db diff` and drift statements and the no-MCP-write rule.
- **Integration Tests:** none here (local Supabase testing stays with `qa-engineer`).
- **Manual/UI Testing:** against a non-production project, produce a `db diff` plan with one `DROP` statement and confirm it is itemized separately and the push waits for confirmation.
- **Edge-Case Matrix:** linked ref differs from environment; diff non-empty with no local migration; legacy-only keys; table with RLS disabled.
- **Acceptance-Criteria Mapping:** AC-1..AC-11 → `skill-parity-infra.test.ts`; AC-7 also → `infra-redaction.test.ts` (S-005) scanning skill content.
- **Execution Commands:** `pnpm run test:unit`.

#### Migration Requirements

- Not applicable to this repo. The skill itself defines the consumer migration flow with confirmation gate, rollback notes, and verification (AC-4, AC-5).

#### Implementation Steps

1. `researcher` pass on the Supabase Cloud log endpoint and retention (open question 1).
2. Extend the parity test for `supabase-ops`.
3. Write the skill; copy to trees.
4. Run tests; run the manual `db diff` check.

#### Files to Create/Modify

- `.github/skills/supabase-ops/SKILL.md`, `.claude/skills/supabase-ops/SKILL.md`, `.kiro/skills/supabase-ops/SKILL.md`
- `workstream/research-supabase-logs.md` - researcher artifact
- `test/unit/skill-parity-infra.test.ts`

---

### Story S-005: redaction pattern set and security-negative test

**Priority:** Critical
**Estimated Size:** S
**Dependencies:** S-001

#### User Story

As an operator,
I want one redaction pattern file that the agent applies to every log excerpt and a test that proves it catches known secret shapes,
So that a credential can never reach a transcript, a change record, or git history.

#### Context

`/TESTING.md` is unfilled, so the security-negative test is specified inline with fixtures. The pattern file gives the test one concrete target.

#### Acceptance Criteria

- [ ] AC-1 `templates/infra/redaction-patterns.txt` exists with one extended regex per line and comments; categories: AWS access key id, AWS secret key, `sb_secret_*`, `sb_publishable_*`, JWT, fly token, GitHub token, bearer header, `postgres://` and `postgresql://` with credentials, `password=`/`secret=` pairs, email.
- [ ] AC-2 Applying the set with `sed -E -f` rewrites each fixture line to `[REDACTED:<category>]` and leaves benign lines untouched.
- [ ] AC-3 `test/unit/infra-redaction.test.ts` runs every fixture through the set and asserts AC-2.
- [ ] AC-4 The same test scans every file under `templates/`, the four agent files, and the four skills for fixture-shaped values and finds none.
- [ ] AC-5 The agent body references the pattern file as the mandatory filter for log output and states that raw output is never written.

#### Business Rules

- Redaction is unconditional; it does not depend on `ChangeId` or environment.

#### Technical Notes

- Fixtures are synthetic and shaped like real secrets (`AKIA` + 16 uppercase alphanumerics, `sb_secret_` + 40 chars, `eyJ...` three-part JWT, `fo1_` + 43 chars, `ghp_` + 36 chars).
- Guidelines: Security Requirements (sanitize CI and PR evidence).

#### Testing Requirements

- **Unit Tests:** fixture matrix, benign matrix, repository scan.
- **Integration Tests:** none.
- **Manual/UI Testing:** pipe a `fly logs` sample containing a synthetic token through the filter and inspect.
- **Edge-Case Matrix:** token split across two lines (documented as out of scope for v1); two secrets on one line; secret inside JSON quotes; uppercase `POSTGRESQL://`.
- **Acceptance-Criteria Mapping:** AC-1..AC-4 → `infra-redaction.test.ts`; AC-5 → `infra-engineer-parity.test.ts`.
- **Execution Commands:** `pnpm run test:unit`.

#### Migration Requirements

- Not applicable.

#### Implementation Steps

1. Write the test with fixtures (fails).
2. Write the pattern file until the matrix passes.
3. Add the agent-body reference; extend the parity test.

#### Files to Create/Modify

- `templates/infra/redaction-patterns.txt`
- `test/unit/infra-redaction.test.ts`
- `test/fixtures/infra/redaction/*.txt` - fixture and benign lines
- agent files from S-001 (one paragraph)

---

### Story S-006: Phase 1 registries, ADR-005, and bundle manifest

**Priority:** High
**Estimated Size:** M
**Dependencies:** S-001, S-002, S-003, S-004, S-005

#### User Story

As a `dev-tasks` maintainer,
I want the new agent, skills, and templates registered everywhere the harness documents itself and shipped by the installer without overwriting consumer files,
So that consumers receive Phase 1 through `dt install` and `dt update`.

#### Context

`infra/` is the first directory-prefix entry in `consumer_owned_paths`; prefix semantics must be proven, not assumed. ADR-005 records the decisions.

#### Acceptance Criteria

- [ ] AC-1 `AGENTS.md` (+ template), `CLAUDE.md` (+ template), `README.md`, `docs/system-overview.md` list `infra-engineer`, the three platform skills, and the templates; agent counts updated; the "main-thread command on Claude" rationale is stated. Chain diagrams in `docs/workflow-chains.md` are authored by S-010, not here.
- [ ] AC-2 `docs/adr/ADR-005-infra-engineer-lifecycle-gates.md` added with Context, Decision, Consequences, Alternatives; indexed in `docs/adr/README.md`.
- [ ] AC-3 `bundle-manifest.json` has `templates/infra` as a managed path and `infra/` as consumer-owned; `package.json` `files` includes `templates/`.
- [ ] AC-4 `distribution-install` and `distribution-update` tests prove: managed template files are installed; a consumer-owned directory prefix is never overwritten on update when it exists.
- [ ] AC-5 `pnpm run validate` and `pnpm run audit` pass; all new tests are reachable from `pnpm run test`.

#### Business Rules

- Registry edits are sequenced after all Phase 1 stories to avoid conflicts.

#### Technical Notes

- Read `core/distribution/*` before assuming how `consumer_owned_paths` is matched.

#### Testing Requirements

- **Unit Tests:** distribution tests extended for prefix semantics; parity test registry checks.
- **Integration Tests:** none.
- **Manual/UI Testing:** `dt install` into a scratch repo, fill `environments.yaml`, run `dt update`, confirm the file is untouched.
- **Edge-Case Matrix:** `infra/` absent at update time (must be created); `infra/` present (must not change); `templates/infra` changed upstream (managed copy updates, consumer copy does not).
- **Acceptance-Criteria Mapping:** AC-1 → parity test; AC-3, AC-4 → distribution tests; AC-5 → `pnpm run validate`.
- **Execution Commands:** `pnpm run validate`, `pnpm run audit`.

#### Migration Requirements

- Not applicable.

#### Implementation Steps

1. Write the distribution prefix test (fails or proves current behavior).
2. Implement or adjust prefix handling if needed; update manifest and `package.json`.
3. Write ADR-005; update registries and docs.
4. Run all gates.

#### Files to Create/Modify

- `AGENTS.md`, `CLAUDE.md`, `README.md`, `docs/system-overview.md`, `docs/workflow-chains.md`, templates of `AGENTS.md`/`CLAUDE.md`
- `docs/adr/ADR-005-infra-engineer-lifecycle-gates.md`, `docs/adr/README.md`
- `bundle-manifest.json`, `package.json`
- `test/unit/distribution-install.test.ts`, `test/unit/distribution-update.test.ts`

---

### Story S-007: tag policy, git-guard rule 4, and exact-semver workflow filters

**Priority:** High
**Estimated Size:** S
**Dependencies:** none

#### User Story

As a maintainer,
I want tags to be human-only, `main`-only, and immutable, enforced by the hook and documented next to branch naming,
So that a tag is a trustworthy production trigger.

#### Context

Tags become the production deploy trigger in Phase 2. Today nothing states who may tag, and this repo's release workflows would fire on a prerelease-shaped tag.

#### Acceptance Criteria

- [ ] AC-1 `github-ops` (three trees) gains a "Tags" section: annotated `v<major>.<minor>.<patch>`, human-created, pointing at a `main` commit, immutable, never moved or deleted, no prerelease tags in v1, milestone `vX.Y` closes when `vX.Y.0` exists.
- [ ] AC-2 `git-ops` (three trees) gains the tag procedure (create annotated, push single tag, verify it points at `main`) and the hotfix line.
- [ ] AC-3 `git-guard.sh` rule 4 blocks `git tag <name>`, `git tag -a|-d|-f`, `git push --tags`, `git push <remote> refs/tags/*`, `git push <remote> v<semver>`, `gh release create`; allows `git tag -l`, `git tag --list`, `git describe --tags`.
- [ ] AC-4 `.github/workflows/publish-npm.yml` and `release-bundle.yml` trigger on `v[0-9]+.[0-9]+.[0-9]+`.
- [ ] AC-5 `test/unit/git-guard-tags.test.ts` passes for the block and allow matrices.
- [ ] AC-6 `docs/technical-guidelines.md` Deployment section states the tag policy in one line and references `github-ops`.

#### Business Rules

- Agents never create, move, delete, or push tags.

#### Technical Notes

- The hook receives JSON on stdin; test it by piping `{"tool_input":{"command":"..."}}` and asserting the exit code.
- Kiro hook parity: mirror the rule in `.kiro/hooks/` if a git-guard equivalent exists there.

#### Testing Requirements

- **Unit Tests:** hook matrix; workflow YAML filter assertion.
- **Integration Tests:** none.
- **Manual/UI Testing:** in a Claude session, attempt `git tag v0.0.0-test` and confirm the block message.
- **Edge-Case Matrix:** `git tag` with no args (list, allow); a push that deletes a remote tag by ref (block); a single push naming both the default branch and a tag (block on both rules).
- **Acceptance-Criteria Mapping:** AC-3, AC-5 → `git-guard-tags.test.ts`; AC-4 → `infra-workflow-templates.test.ts` (S-009) or a small assertion added here.
- **Execution Commands:** `pnpm run test:unit`.

#### Migration Requirements

- Not applicable.

#### Implementation Steps

1. Write the hook test (fails).
2. Add rule 4 to `git-guard.sh`; run to green.
3. Fix both workflow filters.
4. Add the `github-ops` and `git-ops` sections in three trees; add the guidelines line.

#### Files to Create/Modify

- `.claude/hooks/git-guard.sh`, `.kiro/hooks/*` if applicable
- `.github/workflows/publish-npm.yml`, `.github/workflows/release-bundle.yml`
- `github-ops` and `git-ops` files in `.github/`, `.claude/`, `.kiro/`
- `docs/technical-guidelines.md`
- `test/unit/git-guard-tags.test.ts`

---

### Story S-008: deploy-ops skill and script templates

**Priority:** High
**Estimated Size:** L
**Dependencies:** S-001, S-007

#### User Story

As an operator,
I want a canonical `deploy`, `deploy-verify`, `rollback`, `deploy-status`, and generalized `release` script set that reads my environments file and records every deploy,
So that deploys and rollbacks are repeatable from any machine and any CI.

#### Context

`scripts/release.sh` is the reference; it is generalized into a template, not reimplemented. Shell is the implementation; `package.json` wrappers are generated only for JS/TS repos.

#### Acceptance Criteria

- [ ] AC-1 `deploy-ops/SKILL.md` in three trees with the script contract table, the environment mapping table (`main` → dev, tag → prod, dev optional), the tag policy summary referencing `github-ops`, the deploy-target framing table with decision inputs, and the workflow scaffolding procedure; declares tools `yq` (4.x) and `gh`.
- [ ] AC-2 `templates/scripts/deploy.sh`, `deploy-verify.sh`, `rollback.sh`, `deploy-status.sh`, `release.sh` exist, are `bash` with `set -euo pipefail`, support `--help`, and `deploy.sh` and `release.sh` support `--dry-run`.
- [ ] AC-3 `deploy.sh <env>` performs preflight (clean tree, ref rules, identity assertion) → `validate` → build artifact tagged `vX.Y.Z` or `main-<short-sha>` → backup when production and migrating → migrate with confirmation for production → deploy → verify → record; exits 2 on any blocked condition; no flag skips `validate` or backup for production.
- [ ] AC-4 Production refuses any ref that is not an annotated tag on `main`; non-production deploys `main` HEAD.
- [ ] AC-5 `deploy-verify.sh` exits 3 on failure and prints the exact `rollback.sh <env>` invocation.
- [ ] AC-6 `rollback.sh <env>` resolves the previous good version from `infra/changes/` with no manual lookup; `--to <version>` overrides.
- [ ] AC-7 `release.sh` is the generalized form of `scripts/release.sh` with `--dry-run` writing nothing; bump type suggested from Conventional Commits and confirmed.
- [ ] AC-8 Environment names and platform blocks are read from `infra/environments.yaml` via `yq`; a missing or template-status file exits 2.
- [ ] AC-9 `test/unit/infra-script-contract.test.ts` passes: `bash -n`, `--help`, blocked-file exit, dry-run command sequence with stub binaries, prod non-tag refusal; shellcheck when available.
- [ ] AC-10 Skill parity test covers `deploy-ops`.

#### Business Rules

- `release` and `deploy.sh prod` refuse to run when `CI` is set without `INFRA_HUMAN_APPROVED=1` exported by the protected environment job, and refuse in a non-interactive agent context.
- No deploy targets a mutable `latest` tag.

#### Technical Notes

- Stub binaries for tests live under `test/fixtures/infra/bin/` and log their argv to a file the test reads.
- Detect deploy kind from the platform blocks present in the environment; refuse when ambiguous (spec open question 3).

#### Testing Requirements

- **Unit Tests:** contract test as above.
- **Integration Tests:** none.
- **Manual/UI Testing:** `deploy.sh dev` against the throwaway fly app from S-003; force a failing health check and confirm exit 3 with the rollback line; run the printed rollback.
- **Edge-Case Matrix:** dirty tree; tag not on `main`; lightweight tag; `yq` missing; environment with two platform blocks and no deploy kind; verify timeout.
- **Acceptance-Criteria Mapping:** AC-2..AC-9 → `infra-script-contract.test.ts`; AC-1, AC-10 → `skill-parity-infra.test.ts`.
- **Execution Commands:** `pnpm run test:unit`, `pnpm run validate`.

#### Migration Requirements

- Not applicable to this repo. The consumer migrate step carries confirmation, backup, and verification by construction (AC-3).

#### Implementation Steps

1. Write the contract test with stubs (fails).
2. Write `deploy.sh`, `deploy-verify.sh`, `rollback.sh`, `deploy-status.sh`.
3. Generalize `release.sh` into the template; keep this repo's script behavior identical.
4. Write the skill; copy to trees; extend parity test.
5. Run tests and the manual fly deploy.

#### Files to Create/Modify

- `.github/skills/deploy-ops/SKILL.md`, `.claude/skills/deploy-ops/SKILL.md`, `.kiro/skills/deploy-ops/SKILL.md`
- `templates/scripts/deploy.sh`, `deploy-verify.sh`, `rollback.sh`, `deploy-status.sh`, `release.sh`
- `test/unit/infra-script-contract.test.ts`, `test/fixtures/infra/bin/*`, `test/fixtures/infra/environments.yaml`
- `test/unit/skill-parity-infra.test.ts`

---

### Story S-009: GitHub Actions workflow templates and Phase 2 registration

**Priority:** High
**Estimated Size:** M
**Dependencies:** S-008

#### User Story

As an operator,
I want workflow templates that deploy dev on push to `main`, deploy prod on a release tag behind a required reviewer, and roll back on demand, all calling the canonical scripts,
So that the pipeline is owned, consistent, and never contains inline deploy logic.

#### Context

The agent owns deploy and release workflows in consumer repos. Templates ship managed; the installed copies are consumer-owned.

#### Acceptance Criteria

- [ ] AC-1 `templates/workflows/deploy-dev.yml` (on push `main`, calls `deploy.sh <env>`), `deploy-prod.yml` (on push tags `v[0-9]+.[0-9]+.[0-9]+`, `environment: production`, calls `deploy.sh prod`), `rollback.yml` (`workflow_dispatch` with env input, calls `rollback.sh`).
- [ ] AC-2 Workflows set up tools (`aws-actions/configure-aws-credentials` with OIDC, `superfly/flyctl-actions/setup-flyctl`, `supabase/setup-cli`, `yq`) with pinned versions and contain no inline `aws`, `flyctl`, or `supabase` deploy calls.
- [ ] AC-3 The `deploy-ops` scaffolding procedure installs `deploy-dev.yml` only when an environment with `production: false` is declared.
- [ ] AC-4 `bundle-manifest.json` has `templates/scripts` and `templates/workflows` as managed and `.github/workflows/deploy-dev.yml`, `deploy-prod.yml`, `rollback.yml` as consumer-owned; distribution tests cover it.
- [ ] AC-5 `docs/technical-guidelines.md` lists the canonical deploy and release script names next to `lint`, `test`, `validate`; `AGENTS.md` (+ template), `CLAUDE.md` (+ template), `README.md`, `docs/system-overview.md`, `docs/workflow-chains.md` register `deploy-ops` and the templates.
- [ ] AC-5b Phase 2 caller wiring: `planner` (three trees) names the post-integration deploy handoff to `infra-engineer`; the `docs/workflow-chains.md` deploy chain from S-010 is extended with the `deploy-ops` script and workflow steps; assertions added to the caller-wiring block of `infra-engineer-parity.test.ts`.
- [ ] AC-6 `test/unit/infra-workflow-templates.test.ts` passes (YAML parse, triggers, environment, no inline deploy calls, this repo's release workflows on exact semver).
- [ ] AC-7 `pnpm run validate` and `pnpm run audit` pass.

#### Business Rules

- Production deploys run only behind a protected environment with at least one required reviewer.
- A workflow edit in a consumer repo is a change: planned, approved, recorded, delivered by PR.

#### Technical Notes

- Guidelines: Deployment and DevOps (consumer CI remains consumer-owned; templates only).
- Quality-gate CI is out of scope. This repository has no pull-request workflow today; both existing workflows fire only on a tag push. Adding one is a separate decision.

#### Testing Requirements

- **Unit Tests:** workflow template test; distribution tests.
- **Integration Tests:** none.
- **Manual/UI Testing:** install into the scratch repo, push a `main` commit and a tag, watch both workflows run against the throwaway fly app; confirm the reviewer gate stops the prod job.
- **Edge-Case Matrix:** no non-production environment declared (no dev workflow); tag pushed from a non-`main` commit (script refuses); workflow file edited by hand (agent reports drift against the template on next plan).
- **Acceptance-Criteria Mapping:** AC-1, AC-2, AC-6 → `infra-workflow-templates.test.ts`; AC-4 → distribution tests; AC-5 → parity test registry checks; AC-7 → `pnpm run validate`.
- **Execution Commands:** `pnpm run validate`, `pnpm run audit`.

#### Migration Requirements

- Not applicable.

#### Implementation Steps

1. Write the workflow template test (fails).
2. Author the three templates.
3. Add the scaffolding procedure to `deploy-ops`.
4. Update manifest, registries, guidelines.
5. Run gates and the manual pipeline check.

#### Files to Create/Modify

- `templates/workflows/deploy-dev.yml`, `deploy-prod.yml`, `rollback.yml`
- `deploy-ops` skill files (three trees)
- `bundle-manifest.json`, `package.json`
- `AGENTS.md`, `CLAUDE.md`, `README.md`, `docs/system-overview.md`, `docs/workflow-chains.md`, `docs/technical-guidelines.md`
- `test/unit/infra-workflow-templates.test.ts`, distribution tests

---

### Story S-010: Caller wiring and workflow chains

**Priority:** Critical
**Estimated Size:** M
**Dependencies:** S-001

#### User Story

As an operator,
I want the other agents to route infrastructure work to `infra-engineer` and to refuse to run platform write commands themselves,
So that the approval, revert, and backup gates actually bind instead of being bypassed by whichever agent runs first.

#### Context

`researcher` set the precedent under ADR-004: it shipped with a caller-wiring acceptance criterion and a parity test asserting that `product-engineer`, `developer`, and `planner` reference it with conditional language across three trees. Registration alone tells a human the agent exists; wiring is what makes another agent route to it.

The gap is live today. Rule 19 of `developer` exempts sub-tasks that are "purely infrastructure/config", and the `plan` skill's Task 0 template tells it to configure environment variables. Nothing stops `developer` from running a deploy or writing a secret, with no change record, no per-step approval, no revert, and no backup.

#### Acceptance Criteria

- [ ] AC-1 `developer` (`.github/agents/developer.agent.md`, `.kiro/agents/developer.md`, `.claude/agents/developer.md`, `.claude/commands/developer.md`) **MUST NOT** emit or execute a platform write command (`aws`, `flyctl`, `supabase`, Cloudflare API writes) and hands the sub-task to `infra-engineer`. The sub-task kinds that route are named: secrets, deploy, DNS, certificates, IAM policy, and migrations against a shared or cloud project. Rule 19's "purely infrastructure/config" exemption is narrowed so it cannot read as licence to run platform writes.
- [ ] AC-2 The `implement` skill (`.claude/skills/implement/SKILL.md`, `.github/instructions/implement.instructions.md`, `.kiro/steering/implement.md`) carries the same routing rule, since it is the single source of truth for task-list execution and `developer` defers to it.
- [ ] AC-3 `housekeeping` (three trees) adds `infra/`, `.github/workflows/deploy-*.yml`, `rollback.yml`, `templates/scripts/`, and `templates/workflows/` to its "Never touch" table.
- [ ] AC-4 `planner` (three trees) references `infra-engineer` with conditional language for per-story infra routing; the post-integration deploy handoff is added by S-009 AC-5b.
- [ ] AC-5 `product-engineer` (three trees) recommends an `infra-engineer` pass when a PRD or spec has infra scope, with conditional language, and routes drift findings under `infra/` through `activity-drift-reconciliation` like any other drift.
- [ ] AC-6 `github-ops` (three trees) documents the change-record draft PR shape that `infra-engineer` delegates in S-001 AC-11: title prefix, body sections referencing the `ChangeId`, and label.
- [ ] AC-7 Reverse direction: the `infra-engineer` body (three trees) conditionally invokes `researcher` for an unfamiliar platform surface, and states whether a `verifier` audit applies to `infra/` deliverables.
- [ ] AC-8 `docs/workflow-chains.md` gains an "Infrastructure Change" chain showing discover, plan, per-step approval, apply, verify, record, and draft PR; the Full Feature and Single GitHub Issue chains show the conditional infra handoff.
- [ ] AC-9 `test/unit/infra-engineer-parity.test.ts` gains a caller-wiring block modeled on the `researcher` AC-6 assertions: every caller file references `infra-engineer` and uses conditional language, across all three trees.
- [ ] AC-10 `pnpm run validate` passes and the caller-wiring assertions are reachable from `pnpm run test`.

#### Business Rules

- No agent other than `infra-engineer` emits a platform write command.
- Caller wiring is conditional, never mandatory: an issue with no infra scope never invokes `infra-engineer`.
- `housekeeping` never touches `infra/` or a deploy workflow, even to fix formatting.

#### Technical Notes

- Model AC-9 on the `AC-6: Callers wired with conditional triggers` block in `test/unit/researcher-parity.test.ts`, including its conditional-language pattern.
- Caller files: five agents across three trees. `developer` carries a full contract in both `.claude/agents/` and `.claude/commands/`, so both need the rule; `housekeeping` and `github-ops` Claude commands are thin wrappers and need no edit.
- Sequence this story's edits against S-006, which touches the same registry files, to avoid conflicts.

#### Testing Requirements

- **Unit Tests:** caller-wiring block in `infra-engineer-parity.test.ts`; a negative assertion that `housekeeping` lists the infra paths as never-touch.
- **Integration Tests:** none.
- **Manual/UI Testing:** hand `developer` a task list containing a "set the production database secret" sub-task and confirm it refuses and names `infra-engineer` instead of running `fly secrets set`.
- **Edge-Case Matrix:** a sub-task that is infra-shaped but local only, such as a `.env.example` edit, which `developer` still owns; a story with no infra scope, where no caller invokes `infra-engineer`; a `housekeeping` run over a repo whose deploy workflow has a lint error.
- **Acceptance-Criteria Mapping:** AC-1 to AC-7, AC-9 → `infra-engineer-parity.test.ts`; AC-8 → same test asserts the chain heading exists; AC-10 → `pnpm run validate`; manual run covers AC-1 behaviorally.
- **Execution Commands:** `pnpm run test:unit`, `pnpm run validate`.

#### Migration Requirements

- Not applicable.

#### Implementation Steps

1. Write the caller-wiring block in `infra-engineer-parity.test.ts` listing every caller file and the conditional-language pattern; confirm it fails.
2. Edit `developer` in four files and the `implement` skill in three trees with the routing rule and the narrowed rule 19 wording.
3. Edit `housekeeping`, `planner`, `product-engineer`, and `github-ops` across three trees.
4. Add the reverse-direction paragraph to the `infra-engineer` body in three variants.
5. Author the "Infrastructure Change" chain and edit the two existing chains in `docs/workflow-chains.md`.
6. Run the parity test to green; run `pnpm run validate`.

#### Files to Create/Modify

- `.github/agents/developer.agent.md`, `.kiro/agents/developer.md`, `.claude/agents/developer.md`, `.claude/commands/developer.md`
- `.claude/skills/implement/SKILL.md`, `.github/instructions/implement.instructions.md`, `.kiro/steering/implement.md`
- `.github/agents/housekeeping.agent.md`, `.kiro/agents/housekeeping.md`, `.claude/agents/housekeeping.md`
- `.github/agents/planner.agent.md`, `.kiro/agents/planner.md`, `.claude/commands/planner.md`
- `.github/agents/product-engineer.agent.md`, `.kiro/agents/product-engineer.md`, `.claude/commands/product-engineer.md`
- `.github/agents/github-ops.agent.md`, `.kiro/agents/github-ops.md`, `.claude/agents/github-ops.md`
- `infra-engineer` agent files from S-001 (reverse-direction paragraph)
- `docs/workflow-chains.md`
- `test/unit/infra-engineer-parity.test.ts`

---

## Coverage Validation

### Summary

- **Total PRD Requirements:** 26 functional requirements + 9 business rules
- **Total User Stories:** 10
- **Coverage:** 100%
- **Status:** Complete

### Requirement Mapping

| PRD Requirement                                   | Story ID(s)                         | Status     |
| ------------------------------------------------- | ----------------------------------- | ---------- |
| FR-1 Packaging                                    | S-001                               | ✅ Covered |
| FR-2 Working loop                                 | S-001                               | ✅ Covered |
| FR-3 Plan as steps                                | S-001                               | ✅ Covered |
| FR-4 Revert                                       | S-001                               | ✅ Covered |
| FR-5 Backup                                       | S-001, S-002, S-003, S-004          | ✅ Covered |
| FR-6 Two tiers, destroy                           | S-001                               | ✅ Covered |
| FR-7 Identity assertion                           | S-001                               | ✅ Covered |
| FR-8 Tool check with version floors               | S-001, S-002, S-003, S-004, S-008   | ✅ Covered |
| FR-9 Tool-routing table                           | S-001                               | ✅ Covered |
| FR-10 Cost                                        | S-001, S-002, S-003, S-004          | ✅ Covered |
| FR-11 Record and inventory                        | S-001                               | ✅ Covered |
| FR-12 Tagging                                     | S-001                               | ✅ Covered |
| FR-13 Secrets                                     | S-001, S-002, S-003, S-004, S-009   | ✅ Covered |
| FR-14 Log triage                                  | S-001, S-005                        | ✅ Covered |
| FR-15 `aws-ops`                                   | S-002                               | ✅ Covered |
| FR-16 `fly-ops`                                   | S-003                               | ✅ Covered |
| FR-17 `supabase-ops`                              | S-004                               | ✅ Covered |
| FR-18 DNS and certificates                        | S-001, S-002, S-003                 | ✅ Covered |
| FR-19 Script contract                             | S-008                               | ✅ Covered |
| FR-20 Deploy steps                                | S-008                               | ✅ Covered |
| FR-21 Environment mapping                         | S-008, S-009                        | ✅ Covered |
| FR-22 Tag policy                                  | S-007                               | ✅ Covered |
| FR-23 Rollback                                    | S-008                               | ✅ Covered |
| FR-24 Pipeline ownership                          | S-009                               | ✅ Covered |
| FR-25 Authority                                   | S-008, S-009                        | ✅ Covered |
| FR-26 Deploy-target framing                       | S-008                               | ✅ Covered |
| BR No agent push/merge to `main`                  | S-001, S-007 (existing hook rule 1) | ✅ Covered |
| BR Agents never tag                               | S-007                               | ✅ Covered |
| BR No environment branches                        | S-008                               | ✅ Covered |
| BR No write without `ChangeId` + step approval    | S-001                               | ✅ Covered |
| BR No autonomous mode                             | S-001                               | ✅ Covered |
| BR Revert required; prod no revert = no step      | S-001                               | ✅ Covered |
| BR Prod backup before state step                  | S-001                               | ✅ Covered |
| BR No auto-install; below floor blocks            | S-001                               | ✅ Covered |
| BR No secret material; template file blocks       | S-005, S-001                        | ✅ Covered |
| AC Phase 1 (ADR-005, registries, manifest, tests) | S-006                               | ✅ Covered |
| AC Phase 2 (registration, guidelines)             | S-009                               | ✅ Covered |
| Harness integration (caller wiring, chains)       | S-010                               | ✅ Covered |

### Gaps

None.

### Non-Goals Validation

- [x] Foundation IaC authoring — not in any story (S-001 routes only)
- [x] Auto-install, upgrade, authenticate — not in any story
- [x] Quality-gate CI ownership — S-009 touches deploy/release workflows only
- [x] Cost remediation — sweep reports only (S-002, S-003, S-004)
- [x] RLS policies or tests — S-004 reports state only
- [x] Self-hosted Supabase, non-cloud logs — excluded in S-004
- [x] Platform adapter contract — no story defines one
- [x] Environment branches, prerelease tags — S-007 and S-008 exclude them
- [x] New npm dependency, `dt` subcommand, MCP server — none added
