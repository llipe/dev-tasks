# Implementation Plan - infra-engineer

Source: `workstream/user-stories-infra-engineer.md` v1.0 (all nine stories selected), `workstream/specification-infra-engineer.md` v1.0, `docs/requirements/prd-infra-engineer.md` v1.3.

Sequencing: 0 → 1 → (2, 3, 4, 5) → 6 closes Phase 1. 7 has no dependency and may run any time before 8. 8 → 9 closes Phase 2. Each parent task is one PR on an `issue/` or `story/` branch; `planner` may run them under one integration branch per phase.

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
- `test/unit/infra-workflow-templates.test.ts` - workflow templates
- `test/unit/distribution-install.test.ts`, `test/unit/distribution-update.test.ts` - prefix semantics

## Tasks

- [ ] 0.0 Branch convention hygiene (chore, outside the PRD; open a `chore` issue via `github-ops` first so the branch and commit carry a number)

  - [ ] 0.1 In `git-ops` SKILL.md (three trees) replace `integrate/<milestone-or-prd-name>` with `integration/<plan-id>-<short-description>` to match `github-ops` and `planner`
  - [ ] 0.2 In `github-ops` (three trees) drop the `fix`, `chore`, and `docs` branch types so the table matches the `issue/*` and `story/*` check in `developer` and `implement`; keep `issue`, `story`, `integration`
  - [ ] 0.3 In `github-ops` (three trees) add the merge rule: issue and story PRs merge by squash with branch deletion (into integration by `planner`, into `main` by the user); integration PRs merge into `main` by merge commit, by the user; align the `git-ops` merge-strategy table wording
  - [ ] 0.4 Grep all three trees and `docs/` for `integrate/`, `fix/`, `chore/`, `docs/` branch examples and update stragglers
  - [ ] 0.5 Verify Acceptance Criterion: no file in `.github/`, `.claude/`, `.kiro/` mentions `integrate/`; branch type tables are identical across trees
  - [ ] 0.6 Run Tests: `pnpm run test:unit` (existing parity tests), `pnpm run format:check`

- [ ] 1.0 Implement Story S-001: infra-engineer agent contract and environment template

  - [ ] 1.1 Write `test/unit/infra-engineer-parity.test.ts` with the four file paths, Kiro frontmatter checks, and the contract statement list from the spec; confirm it fails
  - [ ] 1.2 Author `.github/agents/infra-engineer.agent.md`: working loop, step schema and state machine, revert rule, backup rule, two-tier model and destroy flow, identity assertion, tool check procedure, tool-routing table, cost rule and sweep, record and inventory formats, tagging, secrets, log-triage rules, Cloudflare DNS and certificate steps, draft-PR record handoff
  - [ ] 1.3 Derive `.claude/commands/infra-engineer.md` (main thread, `description` and `argument-hint` frontmatter) and `.kiro/agents/infra-engineer.md` (`description`, `tools: [read, write, shell]`, `resources`, no `permissions`); add `.github/prompts/infra-engineer.prompt.md`
  - [ ] 1.4 Add `templates/infra/environments.yaml` with `# status: template` first line and the spec schema; add the template-status block rule to the agent body
  - [ ] 1.5 Verify Acceptance Criterion: AC-1 to AC-13 present in all three variants (parity test green)
  - [ ] 1.6 Verify Acceptance Criterion: AC-14 template header and block rule
  - [ ] 1.7 Manual verification: run `/infra-engineer` against a throwaway fly app with a filled `environments.yaml`; confirm one approval per step and a refusal on a template-status file
  - [ ] 1.8 Run Tests: `pnpm run test:unit`, `pnpm run validate`

- [ ] 2.0 Implement Story S-002: aws-ops skill

  - [ ] 2.1 Create `test/unit/skill-parity-infra.test.ts` asserting three-tree identity and declared fields for `aws-ops` (floor, auth probe, backup, revert, log table, sweep categories); confirm it fails
  - [ ] 2.2 Write `.github/skills/aws-ops/SKILL.md`: tool declaration with floor and remediation, command sets per change kind, tier table, cost guidance, backup and revert sources, AWS log table, sweep categories
  - [ ] 2.3 Copy to `.claude/skills/aws-ops/SKILL.md` and `.kiro/skills/aws-ops/SKILL.md`
  - [ ] 2.4 Verify Acceptance Criterion: AC-1 to AC-8 via the parity test
  - [ ] 2.5 Manual verification: dry-run an "IAM policy create and attach" plan in a non-production account; confirm revert detaches and deletes
  - [ ] 2.6 Run Tests: `pnpm run test:unit`

- [ ] 3.0 Implement Story S-003: fly-ops skill

  - [ ] 3.1 Extend `skill-parity-infra.test.ts` for `fly-ops`; confirm it fails
  - [ ] 3.2 Write `.github/skills/fly-ops/SKILL.md`: tool declaration, command sets (apps, deploy, secrets, volumes, certs, scale, machines, destroy), tier table, revert via `fly releases`, volume snapshot backup, log table, cost and sweep
  - [ ] 3.3 Copy to the other two trees
  - [ ] 3.4 Verify Acceptance Criterion: AC-1 to AC-8 via the parity test
  - [ ] 3.5 Manual verification: full plan on a throwaway app (create, secret, deploy, cert, DNS), then run the generated `rollback.sh` to zero
  - [ ] 3.6 Run Tests: `pnpm run test:unit`

- [ ] 4.0 Implement Story S-004: supabase-ops skill

  - [ ] 4.1 Run `researcher` on the Supabase Cloud log retrieval endpoint and per-plan retention; save `workstream/research-supabase-logs.md`
  - [ ] 4.2 Extend `skill-parity-infra.test.ts` for `supabase-ops` including `db diff` plan, drift rule, no-MCP-write; confirm it fails
  - [ ] 4.3 Write `.github/skills/supabase-ops/SKILL.md`: tool declaration, tier table, migration flow with confirmation and verification, drift rule, backup (`db dump` or PITR), discovery order with recorded path, inventory fields and findings, secrets rules, log table with retention caveat, cost and sweep
  - [ ] 4.4 Copy to the other two trees
  - [ ] 4.5 Verify Acceptance Criterion: AC-1 to AC-10 via the parity test
  - [ ] 4.6 Manual verification: produce a `db diff` plan with one `DROP` against a non-production project; confirm itemization and the confirmation gate before push
  - [ ] 4.7 Run Tests: `pnpm run test:unit`

- [ ] 5.0 Implement Story S-005: redaction pattern set and security-negative test

  - [ ] 5.1 Write `test/fixtures/infra/redaction/secrets.txt` (synthetic AWS key pair, `sb_secret_*`, `sb_publishable_*`, `service_role` JWT, fly token, `ghp_` token, bearer header, `postgres://user:pass@`, `password=`, email) and `benign.txt`
  - [ ] 5.2 Write `test/unit/infra-redaction.test.ts`: every secret line becomes `[REDACTED:<category>]`, benign lines unchanged, repository scan of `templates/`, the four agent files, and the four skills; confirm it fails
  - [ ] 5.3 Write `templates/infra/redaction-patterns.txt` until the matrix passes
  - [ ] 5.4 Add the mandatory-filter paragraph to the agent body (three variants); extend `infra-engineer-parity.test.ts`
  - [ ] 5.5 Verify Acceptance Criterion: AC-1 to AC-5
  - [ ] 5.6 Edge cases: two secrets on one line; secret inside JSON quotes; uppercase scheme; document multi-line tokens as out of scope
  - [ ] 5.7 Run Tests: `pnpm run test:unit`

- [ ] 6.0 Implement Story S-006: Phase 1 registries, ADR-005, and bundle manifest

  - [ ] 6.1 Read `core/distribution/*` to learn how `consumer_owned_paths` is matched; write a distribution test for a directory prefix (`infra/`) on install and update; confirm current behavior
  - [ ] 6.2 Implement prefix handling if the test shows it is missing; add `templates/infra` to `managed_paths` and `infra/` to `consumer_owned_paths`; add `templates/` to `package.json` `files`
  - [ ] 6.3 Write `docs/adr/ADR-005-infra-engineer-lifecycle-gates.md` (Context, Decision, Consequences, Alternatives: adapter contract, autonomous mode, IaC authoring, environment branches); index in `docs/adr/README.md`
  - [ ] 6.4 Update `AGENTS.md` (+ template), `CLAUDE.md` (+ template), `README.md`, `docs/system-overview.md`, `docs/workflow-chains.md`: agent, three skills, templates, agent counts, main-thread rationale
  - [ ] 6.5 Verify Acceptance Criterion: AC-1 registries (parity test registry checks)
  - [ ] 6.6 Verify Acceptance Criterion: AC-3, AC-4 manifest and prefix semantics (distribution tests)
  - [ ] 6.7 Manual verification: `dt install` into a scratch repo, fill `environments.yaml`, `dt update`, confirm the file is untouched
  - [ ] 6.8 Run Tests: `pnpm run validate`, `pnpm run audit`

- [ ] 7.0 Implement Story S-007: tag policy, git-guard rule 4, and exact-semver workflow filters

  - [ ] 7.1 Write `test/unit/git-guard-tags.test.ts` piping `{"tool_input":{"command":"..."}}` into the hook: block matrix (`git tag v1.2.3`, `git tag -a`, `git tag -d`, `git push --tags`, a push of `refs/tags/v1`, a push naming `v1.2.3`, a push deleting a remote tag by ref, `gh release create`) and allow matrix (`git tag -l`, `git tag --list`, `git tag`, `git describe --tags`, a push of an `issue/` branch); confirm it fails
  - [ ] 7.2 Add rule 4 to `.claude/hooks/git-guard.sh`; mirror in `.kiro/hooks/` if a git-guard equivalent exists there; update the header comment to four invariants
  - [ ] 7.3 Change the `tags` filter in `.github/workflows/publish-npm.yml` and `release-bundle.yml` to `v[0-9]+.[0-9]+.[0-9]+`; add an assertion for both files to the hook test file
  - [ ] 7.4 Add the "Tags" section to `github-ops` (three trees): annotated `vX.Y.Z`, human-only, `main`-only, immutable, no prerelease in v1, milestone `vX.Y` closes on `vX.Y.0`
  - [ ] 7.5 Add the tag procedure and hotfix line to `git-ops` (three trees); add one line to `docs/technical-guidelines.md` Deployment section
  - [ ] 7.6 Verify Acceptance Criterion: AC-1 to AC-6
  - [ ] 7.7 Manual verification: in a Claude session attempt `git tag v0.0.0-test` and confirm the block message
  - [ ] 7.8 Run Tests: `pnpm run test:unit`, `pnpm run format:check`

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
  - [ ] 9.6 Verify Acceptance Criterion: AC-1, AC-2, AC-6 (workflow test); AC-4 (distribution tests); AC-5 (parity registry checks)
  - [ ] 9.7 Manual verification: install into the scratch repo, push a `main` commit and a tag, confirm the dev job runs and the prod job waits for the reviewer
  - [ ] 9.8 Run Tests: `pnpm run validate`, `pnpm run audit`
