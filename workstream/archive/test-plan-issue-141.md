# Compliance Test Plan: Issue #141 — PR should teach your team (MVP)

## Changelog

| Version | Date       | Summary                                        | Author   |
| ------- | ---------- | ---------------------------------------------- | -------- |
| 1.0     | 2026-09-14 | Initial Design-Mode test plan for the #141 MVP | verifier |

## Source Input Summary

- **Mode:** Design (verifier) — test-first, pre-implementation.
- **Repository:** `llipe/dev-tasks`
- **GitHub Issue:** #141
- **Source artifact:** `workstream/issue-141-pr-teach-team-refinement.md` (v1.0), registered as Phase 1 of `docs/requirements/prd-pr-knowledge-transfer.md` (v1.1).
- **Input type:** issue refinement (MVP subset).
- **Nature of scope:** This is a **documentation/convention change**. There is no runtime behavior, HTTP surface, data model, or UI. "Observable behavior" here = the content of the canonical `github-ops` PR Description Template, its identical presence across the three distribution trees, the `developer` shorthand references, and a parity unit test that mechanically enforces it. Assertions are therefore structural/textual (file-content and cross-tree identity), which is the correct black-box surface for a template contract.

### Files in scope (from refinement "In scope")

- `.github/agents/github-ops.agent.md` — canonical PR Description Template (source of truth)
- `.claude/agents/github-ops.md` — mirror
- `.kiro/agents/github-ops.md` — mirror
- `.github/agents/developer.agent.md`, `.kiro/agents/developer.md`, `.claude/agents/developer.md`, `.claude/commands/developer.md` — PR-template shorthand references
- `test/unit/pr-teaching-template-parity.test.ts` (new) — parity test (modeled on `test/unit/researcher-parity.test.ts`)

### Explicitly out of scope (deferred to PRD Phase 2+)

Depth tiers, `dt changemap` extractor, `activity-pr-knowledge-transfer` skill, blocking enforcement, docs/memo write-back. No test in this plan may assert any of these; a test that does is testing the wrong scope.

## Acceptance Criteria Extraction

Numbered from the refinement (AC-1 … AC-7):

- **AC-1** — `github-ops` PR Description Template extended with three teaching sections (Context/How-it-works; What-changed-&-why-it-matters; Examples), **added to** the existing What/Why/How/Testing/Checklist/Attribution structure (not replacing it).
- **AC-2** — The three sections are **SHOULD**, except **Examples is REQUIRED when the PR changes user-visible or API/contract behavior**; trivial PRs may omit all three; the template text states this rule explicitly.
- **AC-3** — Template change mirrored **identically** across the three trees (`.github`, `.claude`, `.kiro`).
- **AC-4** — `developer` PR-template reference updated in all four developer files so the shorthand reflects the extended template.
- **AC-5** — A parity unit test asserts the three trees carry identical PR-template content incl. the three new sections + the Examples-required rule; **fails before, passes after**.
- **AC-6** — No secret values in template examples; env/config referenced by key name only.
- **AC-7** — Quality gates pass: `typecheck`, `lint`, `format:check`, `test`/`validate`, `audit`.

### Business rules / constraints carried into tests

- Three-tree parity is mandatory (dominant maintenance cost) → every content assertion runs against all three trees.
- Proportionality (issue #148): additions must not force ceremony on trivial PRs → SHOULD default + trivial-omission allowance are themselves assertable.
- Accessibility/format: flat `##` headings, table header rows, no meaning by emoji/color alone.

## Test Strategy

Test-first order: author `test/unit/pr-teaching-template-parity.test.ts` and confirm it **fails** against the current (un-extended) template, then implement the template edits until green. This satisfies AC-5's "fails before / passes after" directly and is the primary compliance vehicle.

### E2E scenarios (black-box, document-contract level)

There is no browser/service E2E surface. The "end-to-end" observable is a reviewer/agent consuming the template. These are validated as manual black-box scenarios plus the automated parity test.

| ID    | Scenario                                                                            | Expected observable result                                                                                          | AC        |
| ----- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | --------- |
| E2E-1 | Author a PR for a **behavioral / user-visible** change using the extended template. | All three teaching sections present; **Examples populated** with a concrete before/after (required for this class). | AC-1,AC-2 |
| E2E-2 | Author a PR for a **trivial** change (typo / dependency bump / formatting).         | All three teaching sections may be omitted; What/Why/Testing/Checklist/Attribution still present; no rule violated. | AC-2      |
| E2E-3 | Author a PR for a **user-visible-but-no-code** change (e.g. copy change).           | Examples still required (before/after copy); other two sections SHOULD.                                             | AC-2      |
| E2E-4 | A reviewer unfamiliar with the area reads only the body of an E2E-1 PR.             | Can state what the area does, what changed and why, and cite the example — without opening the diff first.          | AC-1      |

### Contract validation scenarios (the template _is_ the contract)

| ID   | Contract assertion                                                                                                                                                                                                                | Method                               | AC   |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | ---- |
| CT-1 | Canonical template in `.github/agents/github-ops.agent.md` contains the three new section headings, appended after the existing sections (What/Why/How/Testing/Checklist/Attribution all still present).                          | parity test (regex/section presence) | AC-1 |
| CT-2 | The three trees' PR-template blocks are **structurally identical** — same section set, same order, same rule text (behavioral parity, not incidental whitespace).                                                                 | parity test (normalized compare)     | AC-3 |
| CT-3 | Template text explicitly states the SHOULD level and the "Examples REQUIRED for user-visible/API/contract changes" carve-out, and the trivial-PR omission allowance.                                                              | parity test (rule-text presence)     | AC-2 |
| CT-4 | All four `developer` files' shorthand reference reflects the extended template (no stale "What / Why / How / Testing / Checklist" that omits the teaching sections, or an explicit pointer to the github-ops template of record). | parity test (reference assertion ×4) | AC-4 |
| CT-5 | The parity test fails against the pre-change template and passes after implementation.                                                                                                                                            | run test on base rev, then on branch | AC-5 |

### Edge-case catalog (categorized)

| ID   | Category            | Case                                                                           | Expected                                                                                             | AC        |
| ---- | ------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- | --------- |
| EC-1 | State transition    | One tree edited, the other two not (three-tree drift).                         | Parity test **fails** (drift caught).                                                                | AC-3,AC-5 |
| EC-2 | Boundary            | Trivial PR omits all three teaching sections.                                  | Allowed; no violation.                                                                               | AC-2      |
| EC-3 | Boundary            | User-visible change omits **Examples**.                                        | Violation of the REQUIRED carve-out (manual/reviewer catch; template text must make this checkable). | AC-2      |
| EC-4 | Input domain        | Section headings use a level other than `##`, or a table without a header row. | Accessibility constraint violated; template must use flat `##` + header rows.                        | AC-1      |
| EC-5 | Security (negative) | An example in the template embeds a literal secret/token/connection string.    | **Must not occur** — examples reference env/config by key name only.                                 | AC-6      |
| EC-6 | Security (negative) | Example shows an env var with a real-looking value (`API_KEY=sk-live-...`).    | **Must not occur** — key name only, placeholder value or omitted.                                    | AC-6      |
| EC-7 | Scope guard         | A test asserts a tier, `dt changemap`, skill, enforcement, or write-back.      | **Must not exist** — that is Phase 2+; presence indicates scope creep.                               | scope     |
| EC-8 | Idempotency         | Re-running the parity test after a formatted (`format:check`) template.        | Still green — prettier normalization does not break structural assertions.                           | AC-3,AC-7 |

### Randomized / property tactics

Low applicability (static document contract). One lightweight property is worth encoding:

- **P-1 (three-tree identity property):** For the normalized PR-template block `B_github`, `B_claude`, `B_kiro`, the property `B_github ≡ B_claude ≡ B_kiro` MUST hold. Seed policy: N/A (deterministic; no RNG). If a fuzz variant is added later, record seed and replay per verifier randomized-test policy.

## Security-Negative (mandatory category)

EC-5 and EC-6 are the required security-negative cases: the template's own example content MUST NOT contain secret values — only key names / placeholders. The parity test SHOULD include a scan of the template block for common secret shapes (AWS keys, `sk-`/`ghp_`/`sb_secret_` prefixes, `password=`, `postgres://user:pass@`) and fail if any match, reusing the redaction pattern intuition already established for infra (`templates/infra/redaction-patterns.txt`) without importing that machinery.

## Execution Checklist

1. [ ] Write `test/unit/pr-teaching-template-parity.test.ts` (CT-1…CT-5, EC-1, EC-4, EC-5, EC-6, EC-8; P-1). Model on `test/unit/researcher-parity.test.ts`.
2. [ ] Confirm it **fails** on the current template (AC-5 / CT-5 pre-condition).
3. [ ] Extend the canonical template in `.github/agents/github-ops.agent.md` (AC-1, AC-2, AC-6, accessibility).
4. [ ] Mirror identically into `.claude/agents/github-ops.md` and `.kiro/agents/github-ops.md` (AC-3).
5. [ ] Update the four `developer` files' shorthand references (AC-4).
6. [ ] Run parity test → green (AC-5).
7. [ ] Manual: E2E-1…E2E-4 sample PR bodies (reviewer-comprehension + Examples-required behavior).
8. [ ] Quality gates: `pnpm run typecheck`, `pnpm run lint`, `pnpm run format:check`, `pnpm run test` (or `pnpm run validate`), `pnpm run audit` (AC-7).
9. [ ] Scope guard: confirm **no** test or template text introduces tiers / changemap / skill / enforcement / write-back (EC-7).

## Coverage Confirmation

Every AC maps to ≥1 positive and ≥1 negative/edge test — see the traceability matrix (`workstream/traceability-matrix-141.md`). No AC is uncovered. Status: **covered**.

## Handoff

On completion of this plan, hand off to `developer` (via `plan` → `implement`) to author the test first, then the template edits. After implementation, invoke verifier **Audit Mode** against the delivered branch to confirm fidelity before the PR is marked ready.
