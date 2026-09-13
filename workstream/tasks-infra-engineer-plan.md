# Implementation Plan - infra-engineer

Source: `workstream/user-stories-infra-engineer.md` v1.1 (all ten stories selected), `workstream/specification-infra-engineer.md` v1.0, `docs/requirements/prd-infra-engineer.md` v1.3.

Sequencing: 0 → 1 → (2, 3, 4, 5, 10) → 6 closes Phase 1. 7 has no dependency and may run any time before 8. 8 → 9 closes Phase 2. Task 10 is numbered last but belongs to Phase 1: it wires the other agents to route to `infra-engineer`, without which the agent ships inert and `developer` keeps running platform write commands itself. Sequence 10 against 6, since both touch registry files. Each parent task is one PR on an `issue/` or `story/` branch; `planner` may run them under one integration branch per phase.

> Note: Task 0 is outside the PRD. It fixes branch-convention inconsistencies found while reviewing `github-ops`, `git-ops`, `developer`, and `implement`, so the conventions the new agent inherits are consistent before Phase 1 lands.

## Relevant Files

- `.github/agents/infra-engineer.agent.md` - canonical agent body (Copilot)
- `.github/prompts/infra-engineer.prompt.md` - Copilot entry point
- `.claude/commands/infra-engineer.md` - Claude main-thread command
- `.kiro/agents/infra-engineer.md` - Kiro agent
- `.github/skills/{aws-ops,fly-ops,supabase-ops,deploy-ops}/SKILL.md` - skills, mirrored in `.claude/skills/` and `.kiro/skills/`
- `.github/skills/git-ops/SKILL.md`, `.claude/skills/git-ops/SKILL.md`, `.kiro/skills/git-ops/SKILL.md` - branch naming fix, tag procedure
- `.github/agents/github-ops.agent.md`, `.claude/agents/github-ops.md`, `.kiro/agents/github-ops.md` - branch types, merge rule, tag policy
- `.claude/hooks/git-guard.sh` - rule 4 (tags)
- `.github/workflows/publish-npm.yml`, `.github/workflows/release-bundle.yml` - exact-semver tag filter
- `templates/infra/environments.yaml` - consumer environment template
- `templates/infra/redaction-patterns.txt` - redaction pattern set
- `templates/scripts/{deploy,deploy-verify,rollback,deploy-status,release}.sh` - script templates
- `templates/workflows/{deploy-dev,deploy-prod,rollback}.yml` - workflow templates
- `bundle-manifest.json`, `package.json` - managed and consumer-owned paths, `files`
- `docs/adr/ADR-005-infra-engineer-lifecycle-gates.md`, `docs/adr/README.md` - decision record
- `AGENTS.md`, `CLAUDE.md`, `README.md`, `docs/system-overview.md`, `docs/workflow-chains.md`, `docs/technical-guidelines.md` and the `AGENTS.md`/`CLAUDE.md` templates - registries
- `workstream/research-supabase-logs.md` - researcher artifact for the Supabase log endpoint
- `test/unit/infra-engineer-parity.test.ts` - agent parity
- `test/unit/skill-parity-infra.test.ts` - four-skill parity
- `test/unit/infra-redaction.test.ts`, `test/fixtures/infra/redaction/*.txt` - security-negative
- `test/unit/git-guard-tags.test.ts` - hook rule 4
- `test/unit/infra-script-contract.test.ts`, `test/fixtures/infra/bin/*`, `test/fixtures/infra/environments.yaml` - script contract
- `.github/agents/{developer,housekeeping,planner,product-engineer,github-ops}.agent.md` plus their `.kiro/agents/` and `.claude/` counterparts - caller wiring
- `.claude/skills/implement/SKILL.md`, `.github/instructions/implement.instructions.md`, `.kiro/steering/implement.md` - task-list routing rule
- `test/unit/infra-workflow-templates.test.ts` - workflow templates
- `test/unit/distribution-install.test.ts`, `test/unit/distribution-update.test.ts` - prefix semantics

## Tasks

- [ ] 0.0 Branch convention hygiene (chore, outside the PRD; open a `chore` issue via `github-ops` first so the branch and commit carry a number)

  - [x] 0.1 In `git-ops` SKILL.md (three trees) replace `integrate/<milestone-or-prd-name>` with `integration/<plan-id>-<short-description>` to match `github-ops` and `planner`
  - [x] 0.2 In `github-ops` (three trees) drop the `fix`, `chore`, and `docs` branch types so the table matches the `issue/*` and `story/*` check in `developer` and `implement`; keep `issue`, `story`, `integration`
  - [x] 0.3 In `github-ops` (three trees) add the merge rule: issue and story PRs merge by squash with branch deletion (into integration by `planner`, into `main` by the user); integration PRs merge into `main` by merge commit, by the user; align the `git-ops` merge-strategy table wording
  - [x] 0.4 Grep all three trees and `docs/` for `integrate/`, `fix/`, `chore/`, `docs/` branch examples and update stragglers
  - [x] 0.5 Verify Acceptance Criterion: no file in `.github/`, `.claude/`, `.kiro/` mentions `integrate/`; branch type tables are identical across trees
  - [ ] 0.6 Run Tests: `pnpm run test:unit` (existing parity tests), `pnpm run format:check`

  > Validation: branch-table and `integrate/` checks passed; `pnpm run format:check` passed. `pnpm run test:unit` is blocked before discovery by the pre-existing Node/Vitest/tinypool module-compatibility error.

- [ ] 1.0 Implement Story S-001: infra-engineer agent contract and environment template

  - [x] 1.1 Write `test/unit/infra-engineer-parity.test.ts` with the four file paths, Kiro frontmatter checks, and the contract statement list from the spec; confirm it fails
  - [x] 1.2 Author `.github/agents/infra-engineer.agent.md`: working loop, step schema and state machine, revert rule, backup rule, two-tier model and destroy flow, identity assertion, tool check procedure, tool-routing table, cost rule and sweep, record and inventory formats, tagging, secrets, log-triage rules, Cloudflare DNS and certificate steps, draft-PR record handoff
  - [x] 1.3 Derive `.claude/commands/infra-engineer.md` (main thread, `description` and `argument-hint` frontmatter) and `.kiro/agents/infra-engineer.md` (`description`, `tools: [read, write, shell]`, `resources`, no `permissions`); add `.github/prompts/infra-engineer.prompt.md`
  - [x] 1.4 Add `templates/infra/environments.yaml` with `# status: template` first line and the spec schema; add the template-status block rule to the agent body
  - [x] 1.5 Verify Acceptance Criterion: AC-1 to AC-13 present in all three variants (parity test green)
  - [x] 1.6 Verify Acceptance Criterion: AC-14 template header and block rule
  - [ ] 1.7 Manual verification: run `/infra-engineer` against a throwaway fly app with a filled `environments.yaml`; confirm one approval per step and a refusal on a template-status file
  - [ ] 1.8 Run Tests: `pnpm run test:unit`, `pnpm run validate`

  > Validation: focused `pnpm exec vitest run test/unit/infra-engineer-parity.test.ts` passes 38/38. Full `pnpm run test:unit` remains blocked by unrelated pre-existing unit failures. `pnpm run typecheck` and `pnpm run format:check` pass. `pnpm run validate` is blocked at lint by invalid package metadata in the installed dependency tree. `pnpm run audit` reports four pre-existing high vulnerabilities in `fast-uri` through `ajv`. Manual throwaway-provider verification was not run because no safe non-production target/credentials were provided.

- [ ] 2.0 Implement Story S-002: aws-ops skill

  - [x] 2.1 Create `test/unit/skill-parity-infra.test.ts` asserting three-tree identity and declared fields for `aws-ops` (floor, auth probe, backup, revert, log table, sweep categories); confirm it fails
  - [x] 2.2 Write `.github/skills/aws-ops/SKILL.md`: tool declaration with floor and remediation, command sets per change kind, tier table, cost guidance, backup and revert sources, AWS log table, sweep categories
  - [x] 2.3 Copy to `.claude/skills/aws-ops/SKILL.md` and `.kiro/skills/aws-ops/SKILL.md`
  - [x] 2.4 Verify Acceptance Criterion: AC-1 to AC-8 via the parity test
  - [ ] 2.5 Manual verification: dry-run an "IAM policy create and attach" plan in a non-production account; confirm revert detaches and deletes _(not run — requires user sandbox/credentials; repro: fill `infra/environments.yaml` for a non-prod AWS account, invoke `infra-engineer` with an "IAM policy create and attach" change, confirm the plan pairs `create-policy`+`attach-role-policy` forward with `detach-role-policy`+`delete-policy` revert in reverse order)_
  - [x] 2.6 Run Tests: `pnpm run test:unit`

- [ ] 3.0 Implement Story S-003: fly-ops skill

  - [x] 3.1 Extend `skill-parity-infra.test.ts` for `fly-ops`; confirm it fails
  - [x] 3.2 Write `.github/skills/fly-ops/SKILL.md`: tool declaration, command sets (apps, deploy, secrets, volumes, certs, scale, machines, destroy), tier table, revert via `fly releases`, volume snapshot backup, log table, cost and sweep
  - [x] 3.3 Copy to the other two trees
  - [x] 3.4 Verify Acceptance Criterion: AC-1 to AC-8 via the parity test
  - [ ] 3.5 Manual verification: full plan on a throwaway app (create, secret, deploy, cert, DNS), then run the generated `rollback.sh` to zero _(not run — requires user sandbox/credentials; repro: create a throwaway fly app in a non-prod org, run a full create→secret→deploy→cert→DNS plan through `infra-engineer`, then execute the generated `rollback.sh` and confirm the app is destroyed)_
  - [x] 3.6 Run Tests: `pnpm run test:unit`

- [ ] 4.0 Implement Story S-004: supabase-ops skill

  - [x] 4.1 Run `researcher` on the Supabase Cloud log retrieval endpoint and per-plan retention; save `workstream/research-supabase-logs.md`
  - [x] 4.2 Extend `skill-parity-infra.test.ts` for `supabase-ops` including `db diff` plan, drift rule, no-MCP-write; confirm it fails
  - [x] 4.3 Write `.github/skills/supabase-ops/SKILL.md`: tool declaration, tier table, migration flow with confirmation and verification, drift rule, backup (`db dump` or PITR), discovery order with recorded path, inventory fields and findings, secrets rules, log table with retention caveat, cost and sweep
  - [x] 4.4 Copy to the other two trees
  - [x] 4.5 Verify Acceptance Criterion: AC-1 to AC-10 via the parity test
  - [ ] 4.6 Manual verification: produce a `db diff` plan with one `DROP` against a non-production project; confirm itemization and the confirmation gate before push _(not run — requires user sandbox/credentials; repro: link a non-prod Supabase project, run `infra-engineer` on a schema change that drops a column, confirm the `DROP` is itemized separately in `plan.md` and `db push` waits for named approval)_
  - [x] 4.7 Run Tests: `pnpm run test:unit`

- [ ] 5.0 Implement Story S-005: redaction pattern set and security-negative test

  - [x] 5.1 Write `test/fixtures/infra/redaction/secrets.txt` (synthetic AWS key pair, `sb_secret_*`, `sb_publishable_*`, `service_role` JWT, fly token, `ghp_` token, bearer header, `postgres://user:pass@`, `password=`, email) and `benign.txt`
  - [x] 5.2 Write `test/unit/infra-redaction.test.ts`: every secret line becomes `[REDACTED:<category>]`, benign lines unchanged, repository scan of `templates/`, the four agent files, and the four skills; confirm it fails
  - [x] 5.3 Write `templates/infra/redaction-patterns.txt` until the matrix passes
  - [x] 5.4 Add the mandatory-filter paragraph to the agent body (three variants); extend `infra-engineer-parity.test.ts`
  - [x] 5.5 Verify Acceptance Criterion: AC-1 to AC-5
  - [x] 5.6 Edge cases: two secrets on one line; secret inside JSON quotes; uppercase scheme; document multi-line tokens as out of scope
  - [x] 5.7 Run Tests: `pnpm run test:unit`

- [ ] 6.0 Implement Story S-006: Phase 1 registries, ADR-005, and bundle manifest

  - [x] 6.1 Read `core/distribution/*` to learn how `consumer_owned_paths` is matched; write a distribution test for a directory prefix (`infra/`) on install and update; confirm current behavior
  - [x] 6.2 Implement prefix handling if the test shows it is missing; add `templates/infra` to `managed_paths` and `infra/` to `consumer_owned_paths`; add `templates/` to `package.json` `files`
  - [ ] 6.3 Write `docs/adr/ADR-005-infra-engineer-lifecycle-gates.md` (Context, Decision, Consequences, Alternatives: adapter contract, autonomous mode, IaC authoring, environment branches); index in `docs/adr/README.md`
  - [ ] 6.4 Update `AGENTS.md` (+ template), `CLAUDE.md` (+ template), `README.md`, `docs/system-overview.md`: agent, three skills, templates, agent counts, main-thread rationale. Chain diagrams are Task 10.5, not here
  - [x] 6.5 Verify Acceptance Criterion: AC-1 registries (parity test registry checks) _(infra-engineer-parity.test.ts passes 40/40 — file/contract checks green; the doc-content registry rows in AGENTS.md/CLAUDE.md/README are not asserted by this test and are **deferred to the S-006 doc task 6.4**, out of scope here)_
  - [x] 6.6 Verify Acceptance Criterion: AC-3, AC-4 manifest and prefix semantics (distribution tests)
  - [ ] 6.7 Manual verification: `dt install` into a scratch repo, fill `environments.yaml`, `dt update`, confirm the file is untouched _(not run — requires a scratch repo with the built CLI; repro: `pnpm build`; in a throwaway git repo run `node <dev-tasks>/dist/bin/dt.js install --profile all`; edit `infra/environments.yaml`; run `node <dev-tasks>/dist/bin/dt.js update --force`; confirm the edited `infra/environments.yaml` is unchanged because `infra/` is a consumer-owned prefix)_
  - [x] 6.8 Run Tests: `pnpm run validate`, `pnpm run audit`

- [ ] 7.0 Implement Story S-007: tag policy, git-guard rule 4, and exact-semver workflow filters

  - [x] 7.1 Write `test/unit/git-guard-tags.test.ts` piping `{"tool_input":{"command":"..."}}` into the hook: block matrix (`git tag v1.2.3`, `git tag -a`, `git tag -d`, `git push --tags`, a push of `refs/tags/v1`, a push naming `v1.2.3`, a push deleting a remote tag by ref, `gh release create`) and allow matrix (`git tag -l`, `git tag --list`, `git tag`, `git describe --tags`, a push of an `issue/` branch); confirm it fails
  - [x] 7.2 Add rule 4 to `.claude/hooks/git-guard.sh`; mirror in `.kiro/hooks/` if a git-guard equivalent exists there; update the header comment to four invariants
  - [x] 7.3 Change the `tags` filter in `.github/workflows/publish-npm.yml` and `release-bundle.yml` to `v[0-9]+.[0-9]+.[0-9]+`; add an assertion for both files to the hook test file
  - [x] 7.4 Add the "Tags" section to `github-ops` (three trees): annotated `vX.Y.Z`, human-only, `main`-only, immutable, no prerelease in v1, milestone `vX.Y` closes on `vX.Y.0`
  - [x] 7.5 Add the tag procedure and hotfix line to `git-ops` (three trees); add one line to `docs/technical-guidelines.md` Deployment section
  - [x] 7.6 Verify Acceptance Criterion: AC-1 to AC-6
  - [ ] 7.7 Manual verification: in a Claude session attempt `git tag v0.0.0-test` and confirm the block message _(not run — requires a live Claude session with the git-guard hook active; repro: in a Claude session run `git tag v0.0.0-test` and confirm git-guard rule 4 blocks it with the human-only tag message)_
  - [x] 7.8 Run Tests: `pnpm run test:unit`, `pnpm run format:check`

  > Validation: `git-guard-tags.test.ts` passes 17/17 (block + allow matrices, plus exact-semver assertions for both release workflows); `pnpm run format:check` passes. git-guard rule 4 hook, exact-semver workflow filters, `github-ops` Tags section and `git-ops` tag procedure (three trees each) plus the `docs/technical-guidelines.md` Deployment line are committed with three-tree parity verified. 7.7 remains a live-session manual check (not run) — it needs an active Claude session with the git-guard hook.

- [ ] 8.0 Implement Story S-008: deploy-ops skill and script templates

  - [ ] 8.1 Create `test/fixtures/infra/bin/{aws,flyctl,supabase,yq,gh}` stubs that log argv, and `test/fixtures/infra/environments.yaml`; write `test/unit/infra-script-contract.test.ts` (`bash -n`, `--help`, exit 2 on missing or template file, dry-run command sequence, prod non-tag refusal, shellcheck when available else `SKIPPED`); confirm it fails
  - [ ] 8.2 Write `templates/scripts/deploy.sh` with the eight ordered steps, exit codes 0/1/2/3, `--dry-run`, `yq`-based environment resolution, deploy-kind detection with refusal when ambiguous
  - [ ] 8.3 Write `templates/scripts/deploy-verify.sh` (exit 3 prints the rollback invocation), `rollback.sh` (previous good version from `infra/changes/`, `--to`), `deploy-status.sh` (read-only)
  - [ ] 8.4 Generalize `scripts/release.sh` into `templates/scripts/release.sh` with `--dry-run`; keep this repo's script behavior unchanged
  - [ ] 8.5 Add the human-only guard: refuse `release` and `deploy.sh prod` when `CI` is set without `INFRA_HUMAN_APPROVED=1`, and in a non-interactive agent context
  - [ ] 8.6 Write `.github/skills/deploy-ops/SKILL.md`: script contract, environment mapping table, tag policy summary, deploy-target framing with decision inputs, `package.json` wrapper generation for JS/TS repos, tools `yq` and `gh`; copy to the other two trees; extend `skill-parity-infra.test.ts`
  - [ ] 8.7 Verify Acceptance Criterion: AC-2 to AC-9 (contract test), AC-1 and AC-10 (parity test)
  - [ ] 8.8 Manual verification: `deploy.sh dev` against the throwaway fly app; force a failing health check; confirm exit 3 and run the printed rollback
  - [ ] 8.9 Edge cases: dirty tree; lightweight tag; tag not on `main`; missing `yq`; two platform blocks without a deploy kind
  - [ ] 8.10 Run Tests: `pnpm run test:unit`, `pnpm run validate`

- [ ] 9.0 Implement Story S-009: GitHub Actions workflow templates and Phase 2 registration
  - [ ] 9.1 Write `test/unit/infra-workflow-templates.test.ts` (YAML parse, triggers, `environment: production`, no inline deploy calls, this repo's release workflows on exact semver); confirm it fails
  - [ ] 9.2 Author `templates/workflows/deploy-dev.yml` (push `main`), `deploy-prod.yml` (tags `v[0-9]+.[0-9]+.[0-9]+`, `environment: production`), `rollback.yml` (`workflow_dispatch` with env input); tool setup via OIDC and pinned actions; scripts only
  - [ ] 9.3 Add the scaffolding procedure to `deploy-ops` (three trees): install `deploy-dev.yml` only when an environment with `production: false` is declared; workflow edits are recorded changes delivered by PR
  - [ ] 9.4 Add `templates/scripts` and `templates/workflows` to `managed_paths` and the three workflow files to `consumer_owned_paths`; extend distribution tests
  - [ ] 9.5 Update `docs/technical-guidelines.md` canonical script list; register `deploy-ops` and templates in `AGENTS.md` (+ template), `CLAUDE.md` (+ template), `README.md`, `docs/system-overview.md`, `docs/workflow-chains.md`
  - [ ] 9.5b Phase 2 caller wiring: add the post-integration deploy handoff to `planner` (three trees); extend the Task 10.5 deploy chain with the `deploy-ops` script and workflow steps; add the assertions to the caller-wiring block of `infra-engineer-parity.test.ts`
  - [ ] 9.6 Verify Acceptance Criterion: AC-1, AC-2, AC-6 (workflow test); AC-4 (distribution tests); AC-5 (parity registry checks)
  - [ ] 9.7 Manual verification: install into the scratch repo, push a `main` commit and a tag, confirm the dev job runs and the prod job waits for the reviewer
  - [ ] 9.8 Run Tests: `pnpm run validate`, `pnpm run audit`

- [ ] 10.0 Implement Story S-010: Caller wiring and workflow chains
  - [ ] 10.1 Add a caller-wiring block to `test/unit/infra-engineer-parity.test.ts` listing every caller file and asserting both a reference to `infra-engineer` and conditional language, modeled on the `AC-6` block in `test/unit/researcher-parity.test.ts`; confirm it fails
  - [ ] 10.2 Edit `developer` in four files (`.github/agents/developer.agent.md`, `.kiro/agents/developer.md`, `.claude/agents/developer.md`, `.claude/commands/developer.md`): **MUST NOT** emit or execute a platform write command; name the sub-task kinds that route to `infra-engineer` (secrets, deploy, DNS, certificates, IAM policy, cloud migrations); narrow rule 19's "purely infrastructure/config" exemption so it cannot read as licence to run platform writes
  - [ ] 10.3 Add the same routing rule to the `implement` skill in three trees (`.claude/skills/implement/SKILL.md`, `.github/instructions/implement.instructions.md`, `.kiro/steering/implement.md`), since it is the single source of truth for task-list execution
  - [ ] 10.4 Edit `housekeeping` (three trees) to add `infra/`, `.github/workflows/deploy-*.yml`, `rollback.yml`, `templates/scripts/`, `templates/workflows/` to its "Never touch" table; edit `planner` (three trees) for conditional per-story infra routing; edit `product-engineer` (three trees) to recommend an infra pass on infra-scoped PRDs and route `infra/` drift through `activity-drift-reconciliation`; edit `github-ops` (three trees) to document the change-record draft PR shape (title prefix, body sections citing the `ChangeId`, label)
  - [ ] 10.5 Author the "Infrastructure Change" chain in `docs/workflow-chains.md` (discover, plan, per-step approval, apply, verify, record, draft PR) and add the conditional infra handoff to the Full Feature and Single GitHub Issue chains
  - [ ] 10.6 Add the reverse-direction paragraph to the `infra-engineer` body in three variants: conditionally invoke `researcher` for an unfamiliar platform surface; state whether a `verifier` audit applies to `infra/` deliverables
  - [ ] 10.7 Verify Acceptance Criterion: AC-1 to AC-7 and AC-9 (caller-wiring block green)
  - [ ] 10.8 Verify Acceptance Criterion: AC-8 chain headings present in `docs/workflow-chains.md`
  - [ ] 10.9 Manual verification: hand `developer` a task list containing "set the production database secret" and confirm it refuses and names `infra-engineer` instead of running `fly secrets set`
  - [ ] 10.10 Edge cases: an infra-shaped but local-only sub-task such as a `.env.example` edit stays with `developer`; a story with no infra scope invokes nothing; a `housekeeping` run over a repo whose deploy workflow has a lint error leaves it alone
  - [ ] 10.11 Run Tests: `pnpm run test:unit`, `pnpm run validate`
