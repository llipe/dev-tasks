# Issue Refinement: 141 - PR should be to teach your team

## Changelog

| Version | Date       | Summary                                              | Author           |
| ------- | ---------- | ---------------------------------------------------- | ---------------- |
| 1.0     | 2026-09-14 | Initial refinement — MVP subset of PR-KT PRD Phase 1 | product-engineer |

## Summary

- **Goal:** Make PR descriptions teach the reviewer, not just describe the diff. Extend the canonical `github-ops` PR description template with lightweight, teaching-oriented sections so a reviewer unfamiliar with the change can understand how the affected area works, what changed and why it matters, and see a concrete example.
- **Primary user impact:** Human reviewers (and future agents/onboarding developers) can orient on a PR without reverse-engineering intent and mechanism from the raw diff.
- **Non-goals:** This is a **deliberately de-scoped MVP**. It is Phase 1 of `docs/requirements/prd-pr-knowledge-transfer.md` (v1.0) and intentionally excludes that PRD's heavier machinery — see "Relationship to the PRD" and "Non-Goals" below.

## Relationship to the PRD (scope decision)

Issue #141 is already backed by a full, approved PRD: `docs/requirements/prd-pr-knowledge-transfer.md` (v1.0, 2026-08-01). That PRD specifies a large feature: a ~14-section tiered PR contract with blocking enforcement, a new `dt changemap` deterministic extractor, a new `activity-pr-knowledge-transfer` skill across three trees, and knowledge write-back to docs and memo.

This refinement is a **conscious narrowing** of that PRD to a shippable MVP, taken by explicit user decision and consistent with issue #148 (prioritize simplicity; an MVP need not be a full phase). The full PRD remains the north star; this MVP delivers its cheapest, highest-value slice — the template contract change alone — without the CLI, skill, tiering, enforcement, or write-back. The PRD has been updated (v1.1) to register this MVP as its Phase 1.

**MVP = template sections only, SHOULD-level, docs/convention change, parity-tested. Nothing else from the PRD.**

## Acceptance Criteria

- [ ] AC-1 The canonical `github-ops` PR Description Template is extended with three teaching-oriented sections, added to (not replacing) the existing What / Why / How / Testing / Checklist / Attribution structure:
  - **Context / How it works** — a short primer on the affected area so a reviewer unfamiliar with it can follow, with a pointer to the relevant files or docs.
  - **What changed & why it matters** — the specific change framed for learning, not a diff restatement.
  - **Examples** — at least one concrete illustration: a before/after snippet, a command with its output, or a usage example of the new behavior.
- [ ] AC-2 The three sections are **SHOULD** (recommended), with one exception: **Examples is REQUIRED when the PR changes user-visible or API/contract behavior.** Trivial PRs (typo, dependency bump, formatting) may omit all three. The template text states this rule explicitly.
- [ ] AC-3 The template change is mirrored **identically** across all three distribution trees: `.github/agents/github-ops.agent.md`, `.claude/agents/github-ops.md`, `.kiro/agents/github-ops.md`.
- [ ] AC-4 The `developer` agent's PR-template reference is updated in all four files (`.github/agents/developer.agent.md`, `.kiro/agents/developer.md`, `.claude/agents/developer.md`, `.claude/commands/developer.md`) so the "What / Why / How / Testing / Checklist" shorthand reflects the extended template.
- [ ] AC-5 A parity unit test asserts the three trees carry identical PR-template content including the three new sections and the Examples-required rule; the test fails before the change and passes after.
- [ ] AC-6 No secret values appear in template examples; example placeholders reference env/config by key name only, consistent with existing `github-ops` and security conventions.
- [ ] AC-7 Quality gates pass: `pnpm run typecheck`, `pnpm run lint`, `pnpm run format:check`, `pnpm run test` (or `pnpm run validate`), `pnpm run audit`.

## Constraints

- **Documentation/convention change only.** No CLI command, no new skill, no enforcement/hook logic, no docs/memo write-back. Those remain in the PRD for later phases.
- **Three-tree parity is mandatory** and is the dominant maintenance cost; the parity test guards it.
- **Proportionality (issue #148):** the additions must not impose ceremony on trivial PRs — hence SHOULD-level with a narrow REQUIRED carve-out.
- Section headings stay flat (`##`), tables carry header rows, no meaning conveyed by emoji/color alone (accessibility, per PRD design guidance).

## Risks and Edge Cases

- **Risk — overlap/confusion with the PRD's fuller contract.** Mitigated by explicitly labelling this the MVP/Phase 1 and registering it in the PRD changelog, so a future implementer of the full feature knows the template already carries a lightweight version to extend rather than duplicate.
- **Risk — section bloat on small PRs.** Mitigated by SHOULD-level default and the trivial-PR omission allowance.
- **Edge case — PR with no meaningful "how it works" (pure config/dependency bump):** all three sections may be omitted; only What/Why/Testing/Checklist remain.
- **Edge case — user-visible change with no code (e.g., copy change):** Examples still required (before/after copy), since it is user-visible.
- **Edge case — three-tree drift:** caught by the parity test; a change to one tree without the others fails CI.

## Dependencies

- Builds on the existing `github-ops` PR Description Template (single source of truth).
- Related (superset, not a blocker): `docs/requirements/prd-pr-knowledge-transfer.md` — this MVP is its Phase 1.
- Adjacent: issue #148 (simplicity prioritization) informs the SHOULD-level scoping.

## Testing Notes

- **Unit tests:** a parity test (e.g. extend or add alongside the existing agent/skill parity suites) asserting the three trees contain the three new sections and the Examples-required rule verbatim/structurally.
- **Integration tests:** none — no runtime behavior changes.
- **Manual checks:** open a sample PR using the extended template on a behavioral change and confirm the teaching sections read as intended and Examples is present; confirm a trivial PR can omit them without violating the template.
- **Edge-case checks:** trivial-PR omission allowed; user-visible-no-code still requires Examples; single-tree edit fails the parity test.
- **Acceptance-criteria-to-test mapping:** AC-1/AC-3/AC-5/AC-6 → parity unit test; AC-2 → parity test asserts the rule text + manual sample PRs; AC-4 → parity/reference assertion across the four developer files; AC-7 → quality-gate run.

## Open Questions

- None blocking. Deferred to the full PRD: tiering, `dt changemap` grounding, enforcement mechanism, and docs/memo write-back (PRD Open Questions 1-7 remain open for later phases).
