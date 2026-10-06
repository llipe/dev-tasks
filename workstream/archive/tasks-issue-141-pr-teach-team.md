# Implementation Plan - Issue #141: PR should teach your team (MVP)

Source: `workstream/issue-141-pr-teach-team-refinement.md` (v1.0), compliance plan `workstream/test-plan-141.md` (v1.0), traceability `workstream/traceability-matrix-141.md` (v1.0). Phase 1 of `docs/requirements/prd-pr-knowledge-transfer.md` (v1.1).

Scope: documentation/convention change only. Extend the canonical `github-ops` PR Description Template with three teaching sections, mirror across three trees, update the four `developer` shorthand references, guard with a parity unit test. **Out of scope (PRD Phase 2+):** depth tiers, `dt changemap`, `activity-pr-knowledge-transfer` skill, blocking enforcement, docs/memo write-back. A task or test that introduces any of these is scope creep (see 1.9 scope guard).

Test-first: the parity test is authored and confirmed **red** (1.1-1.2) before any template edit, satisfying AC-5 directly.

> Note: This is an extension to an existing codebase — no greenfield Task 0. The template of record is the `### PR Description Template` block in `.github/agents/github-ops.agent.md`; the two mirrors are `.claude/agents/github-ops.md` and `.kiro/agents/github-ops.md`. The `developer` shorthand (`What / Why / How / Testing / Checklist`) appears in four files.

## Relevant Files

- `test/unit/pr-teaching-template-parity.test.ts` - new parity + security-negative + scope-guard test (modeled on `test/unit/researcher-parity.test.ts`)
- `.github/agents/github-ops.agent.md` - canonical PR Description Template (source of truth); extend with three teaching sections + SHOULD/Examples-required rule text
- `.claude/agents/github-ops.md` - identical mirror of the template block
- `.kiro/agents/github-ops.md` - identical mirror of the template block
- `.github/agents/developer.agent.md` - PR-template shorthand reference
- `.kiro/agents/developer.md` - PR-template shorthand reference
- `.claude/agents/developer.md` - PR-template shorthand reference
- `.claude/commands/developer.md` - PR-template shorthand reference
- `workstream/issue-141-pr-teach-team-refinement.md` - refinement (source; not modified by implementation)
- `workstream/test-plan-141.md` - compliance plan (source)
- `workstream/traceability-matrix-141.md` - AC-to-test mapping (update Observed/Result at close)

## Tasks

- [ ] 1.0 Implement Issue #141 - https://github.com/llipe/dev-tasks/issues/141: extend the PR template to teach the reviewer (MVP)

  > Note: User story — "As a reviewer, I want the PR body to teach me how the affected area works and what changed and why, with a concrete example, so I can orient without reverse-engineering the diff." Business rule — teaching sections are SHOULD; **Examples is REQUIRED when the PR changes user-visible or API/contract behavior**; trivial PRs (typo, dependency bump, formatting) may omit all three.

  - [ ] 1.1 Write `test/unit/pr-teaching-template-parity.test.ts` modeled on `test/unit/researcher-parity.test.ts`: a `CONTRACT_STATEMENTS`-style array asserting, across the three github-ops variants, the three new section headings (Context/How it works; What changed & why it matters; Examples), that the existing sections (What/Why/How/Testing/Checklist/Attribution) are still present, the SHOULD-level + Examples-REQUIRED rule text, and flat-`##`/header-row accessibility; plus a normalized three-tree identity check, a four-file `developer` reference check, a secret-shape scan of the template block, and a scope-guard assertion. (CT-1..CT-5, EC-1, EC-4, EC-5, EC-6, EC-7, P-1)
  - [ ] 1.2 Run `pnpm exec vitest run test/unit/pr-teaching-template-parity.test.ts` and confirm it **fails** against the current (un-extended) template (AC-5 pre-condition / CT-5 red).
  - [ ] 1.3 Extend the canonical `### PR Description Template` block in `.github/agents/github-ops.agent.md`: add the three teaching sections appended after the existing set, with a rule paragraph stating SHOULD-level, the Examples-REQUIRED-for-user-visible/API-changes carve-out, and the trivial-PR omission allowance. Examples in the template MUST reference env/config by key name only — no literal secrets (AC-1, AC-2, AC-6; accessibility per EC-4).
  - [ ] 1.4 Mirror the identical template block into `.claude/agents/github-ops.md` and `.kiro/agents/github-ops.md` (behavioral parity, not incidental whitespace) (AC-3).
  - [ ] 1.5 Update the `developer` PR-template shorthand in all four files (`.github/agents/developer.agent.md`, `.kiro/agents/developer.md`, `.claude/agents/developer.md`, `.claude/commands/developer.md`) so it reflects the extended template — either enumerate the teaching sections or point explicitly to the github-ops template of record (AC-4).
  - [ ] 1.6 Verify Acceptance Criterion AC-1/AC-2/AC-3/AC-4/AC-6: run `pnpm exec vitest run test/unit/pr-teaching-template-parity.test.ts` and confirm it is now **green** (CT-1..CT-4, EC-1, EC-4, EC-5, EC-6).
  - [ ] 1.7 Verify Acceptance Criterion AC-5: confirm the fails-before (1.2) / passes-after (1.6) transition is recorded (CT-5).
  - [ ] 1.8 Manual verification (E2E-1..E2E-4, EC-2, EC-3): draft sample PR bodies for a behavioral change (Examples present), a trivial change (three sections omitted, allowed), and a user-visible-no-code change (Examples still required); confirm a reviewer can orient from the body alone. Record outcomes in the traceability matrix.
  - [ ] 1.9 Scope guard (EC-7 / SG-1): confirm no test or template text introduces depth tiers, `dt changemap`, the `activity-pr-knowledge-transfer` skill, blocking enforcement, or docs/memo write-back.
  - [ ] 1.10 Run Tests / quality gates (AC-7): `pnpm run typecheck`, `pnpm run lint`, `pnpm run format:check`, `pnpm run test` (or `pnpm run validate`), `pnpm run audit`.
  - [ ] 1.11 Update `workstream/traceability-matrix-141.md` Observed/Result columns from `pending` to the actual outcomes; confirm every AC maps to a passing positive and negative/edge test.
