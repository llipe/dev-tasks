# Compliance Test Plan - Issue 123: QA agent, testing skills, and /TESTING.md standard

## Changelog

| Version | Date       | Summary                                    | Author   |
| ------- | ---------- | ------------------------------------------ | -------- |
| 1.0     | 2026-08-17 | Initial compliance test plan (Design Mode) | verifier |

## Source Input Summary

| Field                  | Value                                                                              |
| ---------------------- | ---------------------------------------------------------------------------------- |
| **Repository**         | `llipe/dev-tasks`                                                                  |
| **GitHub Issue**       | [#123](https://github.com/llipe/dev-tasks/issues/123)                              |
| **Source artifact**    | `workstream/issue-123-qa-agent-and-testing-standard-refinement.md` (v1.2)          |
| **Input type**         | story (issue refinement)                                                           |
| **Task list**          | `workstream/tasks-issue-123-qa-agent-and-testing-standard.md` (v1.2, 39 sub-tasks) |
| **Mode**               | design                                                                             |
| **GitHub issue fetch** | Unavailable in this runtime — `github-ops` fallback applied, see Publication       |

### System under test

The deliverable is an agent-definition framework, not a running application. Black-box observables are therefore:

- files produced and their content (agent prompts, skills, `/TESTING.md`, reports)
- report content (named defects, ranked gap inventories, `coverage_gate` values)
- CLI outcomes (`dev-tasks install` / `update` results, install manifest content)
- inter-agent payload fields (`developer` closeout → `planner`)
- the repository's own test suite exit status

No scenario in this plan reads implementation internals. Where an AC is about static structure (AC-2, AC-9), the black-box entry point is the test suite run, not the file's internals.

### Constraints carried from the source

- `developer` rule 19 is unchanged — any scenario observing a modified rule 19 is a failure.
- `qa-engineer` may edit test-only config; application source and non-test config are out of bounds.
- Coverage tooling is never installed by the agent; absence triggers the structural path.
- Behavioral parity across `.kiro`/`.github`/`.claude` is required; byte parity is not.
- Kiro frontmatter must not contain a `permissions` block.

### Non-goals excluded from this plan

Integration/E2E-browser testing, Playwright, RLS, migrations, OpenAPI validation, frontend component/a11y/DESIGN.md enforcement, mock-reimplementation detection, mutation testing, Layer 3 evals, coverage-provider installation, load and visual testing.

---

## Acceptance Criteria Extraction

| AC    | Requirement                                                                  |
| ----- | ---------------------------------------------------------------------------- |
| AC-1  | `qa-engineer` exists on three platforms with two entry points and parity     |
| AC-2  | Kiro prompt ≤150 lines, exactly one procedure, no invocation modes           |
| AC-3  | Three skills mirrored; mandatory security-negative category; trap named      |
| AC-4  | `/TESTING.md` placeholder with per-package section and non-JS slot           |
| AC-5  | Existing-project standard establishment plus harness-defect detection        |
| AC-6  | Script check is monorepo- and CI-aware (names plus reachability)             |
| AC-7  | `developer` wiring is exactly five touchpoints; rule 19 unchanged            |
| AC-8  | Coverage gate skippable only as `SKIPPED(<reason>)`; skip preserves analysis |
| AC-9  | Registries, docs, manifest, build script updated; `verifier` pointer added   |
| AC-10 | `/TESTING.md` distributed on both install paths, idempotent, preserved       |
| AC-11 | Gap analysis works with no coverage provider and ranks by risk               |

Business rules extracted: audit independence (writer ≠ grader); no silent skip; no false pass; consumer-owned content never overwritten; simplicity budget (five touchpoints, one line in `planner`).

---

## E2E Scenarios

### SC-1: All five `qa-engineer` files present with equivalent contract

| Field               | Value                                                                   |
| ------------------- | ----------------------------------------------------------------------- |
| **AC(s)**           | AC-1                                                                    |
| **Type**            | happy-path                                                              |
| **Severity**        | critical                                                                |
| **Preconditions**   | Repository at issue-123 branch, implementation complete.                |
| **Steps**           | 1. Run `pnpm run test:unit`. 2. Inspect parity test results.            |
| **Expected Result** | Parity suite passes; all three agent files and both entry points found. |
| **Pass Criteria**   | `qa-engineer-parity.test.ts` exits 0 with no skipped assertions.        |

### SC-2: One platform variant absent

| Field               | Value                                                                    |
| ------------------- | ------------------------------------------------------------------------ |
| **AC(s)**           | AC-1                                                                     |
| **Type**            | negative-path                                                            |
| **Severity**        | critical                                                                 |
| **Preconditions**   | `.claude/agents/qa-engineer.md` removed.                                 |
| **Steps**           | 1. Run `pnpm run test:unit`.                                             |
| **Expected Result** | Parity test fails, naming the missing path.                              |
| **Pass Criteria**   | Non-zero exit; failure message contains `.claude/agents/qa-engineer.md`. |

### SC-3: Behavioral divergence between platform variants

| Field               | Value                                                                                 |
| ------------------- | ------------------------------------------------------------------------------------- |
| **AC(s)**           | AC-1                                                                                  |
| **Type**            | negative-path                                                                         |
| **Severity**        | major                                                                                 |
| **Preconditions**   | Security-negative category present in Kiro variant, removed from the Copilot variant. |
| **Steps**           | 1. Run `pnpm run test:unit`.                                                          |
| **Expected Result** | Parity test fails on contract divergence, not merely on file presence.                |
| **Pass Criteria**   | Failure identifies the divergent contract statement, not just a byte diff.            |

### SC-4: Prompt within the length cap and single-procedure

| Field               | Value                                                                          |
| ------------------- | ------------------------------------------------------------------------------ |
| **AC(s)**           | AC-2                                                                           |
| **Type**            | happy-path                                                                     |
| **Severity**        | major                                                                          |
| **Preconditions**   | `.kiro/agents/qa-engineer.md` authored.                                        |
| **Steps**           | 1. Run the prompt-length assertion.                                            |
| **Expected Result** | Line count ≤150; exactly one procedure declared; no modes section.             |
| **Pass Criteria**   | Assertion passes; no heading matching `Invocation Modes` or `## Modes` exists. |

### SC-5: Prompt reintroduces invocation modes

| Field               | Value                                          |
| ------------------- | ---------------------------------------------- |
| **AC(s)**           | AC-2                                           |
| **Type**            | negative-path                                  |
| **Severity**        | major                                          |
| **Preconditions**   | A `## Modes` section added to the Kiro prompt. |
| **Steps**           | 1. Run `pnpm run test:unit`.                   |
| **Expected Result** | Assertion fails on mode presence.              |
| **Pass Criteria**   | Non-zero exit citing the modes heading.        |

### SC-6: Three skills present across all three trees

| Field               | Value                                                                    |
| ------------------- | ------------------------------------------------------------------------ |
| **AC(s)**           | AC-3                                                                     |
| **Type**            | happy-path                                                               |
| **Severity**        | critical                                                                 |
| **Preconditions**   | Implementation complete.                                                 |
| **Steps**           | 1. Run the skill-presence assertions.                                    |
| **Expected Result** | Nine `SKILL.md` files found (3 skills × 3 trees).                        |
| **Pass Criteria**   | All nine paths resolve and declare frontmatter `name` and `description`. |

### SC-7: Skill mirrored to only two trees

| Field               | Value                                                    |
| ------------------- | -------------------------------------------------------- |
| **AC(s)**           | AC-3                                                     |
| **Type**            | negative-path                                            |
| **Severity**        | major                                                    |
| **Preconditions**   | `.claude/skills/activity-coverage-gap-analysis/` absent. |
| **Steps**           | 1. Run `pnpm run test:unit`.                             |
| **Expected Result** | Failure naming the missing tree.                         |
| **Pass Criteria**   | Non-zero exit identifying the absent path.               |

### SC-8: Auth code path with only positive tests

| Field               | Value                                                                                                      |
| ------------------- | ---------------------------------------------------------------------------------------------------------- |
| **AC(s)**           | AC-3                                                                                                       |
| **Type**            | negative-path                                                                                              |
| **Severity**        | critical                                                                                                   |
| **Preconditions**   | Fixture project with a JWT-parsing module tested only for the valid-token case.                            |
| **Steps**           | 1. Invoke `qa-engineer` against the fixture. 2. Read the report.                                           |
| **Expected Result** | Report lists missing security-negative tests: invalid signature, expired, wrong issuer/audience, tampered. |
| **Pass Criteria**   | All four required negatives named individually; the module is not reported as adequately covered.          |

### SC-9: Passing suite over a permissive implementation

| Field               | Value                                                                                                                                                           |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **AC(s)**           | AC-3                                                                                                                                                            |
| **Type**            | abuse-case                                                                                                                                                      |
| **Severity**        | critical                                                                                                                                                        |
| **Preconditions**   | Fixture reproducing the home-ledger case: token parser that only base64-decodes, tests constructing `alg: 'none'` tokens with a literal signature, suite green. |
| **Steps**           | 1. Invoke `qa-engineer` against the fixture. 2. Read the report.                                                                                                |
| **Expected Result** | Reported as a finding, explicitly framed as tests faithful to insecure code — a green suite is not treated as evidence.                                         |
| **Pass Criteria**   | Report contains a security finding for this module despite 100% of its tests passing.                                                                           |

### SC-10: Placeholder carries the full section contract

| Field               | Value                                                                                                                 |
| ------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **AC(s)**           | AC-4                                                                                                                  |
| **Type**            | happy-path                                                                                                            |
| **Severity**        | major                                                                                                                 |
| **Preconditions**   | `/TESTING.md` created.                                                                                                |
| **Steps**           | 1. Run the section-contract assertion.                                                                                |
| **Expected Result** | Layer taxonomy, coverage thresholds/baseline policy, fixture/mocking strategy, and a per-package section all present. |
| **Pass Criteria**   | Every required heading found; per-package slot includes language, runner, commands, environment, coverage tooling.    |

### SC-11: Placeholder asserts project-specific values

| Field               | Value                                                                     |
| ------------------- | ------------------------------------------------------------------------- |
| **AC(s)**           | AC-4                                                                      |
| **Type**            | negative-path                                                             |
| **Severity**        | minor                                                                     |
| **Preconditions**   | `/TESTING.md` hard-codes `vitest` and an 80% threshold.                   |
| **Steps**           | 1. Run the placeholder assertion.                                         |
| **Expected Result** | Failure — the shipped file must not assert values for a specific project. |
| **Pass Criteria**   | Assertion detects the concrete value where a slot is required.            |

### SC-12: Mixed-language monorepo is describable

| Field               | Value                                                                                                                              |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **AC(s)**           | AC-4, AC-5                                                                                                                         |
| **Type**            | happy-path                                                                                                                         |
| **Severity**        | major                                                                                                                              |
| **Preconditions**   | Fixture monorepo with vitest packages and a pytest package.                                                                        |
| **Steps**           | 1. Run `activity-test-standards`. 2. Read the produced `/TESTING.md`.                                                              |
| **Expected Result** | Each package has its own section naming its language, runner, and commands; the pytest package is not forced into JS script names. |
| **Pass Criteria**   | Every workspace package appears exactly once with a runner appropriate to its language.                                            |

### SC-13: Clean project yields no harness defects

| Field               | Value                                                             |
| ------------------- | ----------------------------------------------------------------- |
| **AC(s)**           | AC-5                                                              |
| **Type**            | happy-path                                                        |
| **Severity**        | major                                                             |
| **Preconditions**   | Fixture with correct environments, configs, aliases, and cleanup. |
| **Steps**           | 1. Run `activity-test-standards`.                                 |
| **Expected Result** | Report states no harness defects and fills `/TESTING.md`.         |
| **Pass Criteria**   | Zero defects reported; no false positives.                        |

### SC-14: All seven harness defect classes detected

| Field               | Value                                                                                                                                                                                                                                                                           |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **AC(s)**           | AC-5                                                                                                                                                                                                                                                                            |
| **Type**            | negative-path                                                                                                                                                                                                                                                                   |
| **Severity**        | critical                                                                                                                                                                                                                                                                        |
| **Preconditions**   | Fixture with: `node` environment for a DOM-requiring package, missing test config, alias present in `tsconfig` but absent from test config, stubbed global never restored, local/CI runtime version mismatch, no locale/timezone fixture policy, an `expect(true)` placeholder. |
| **Steps**           | 1. Run `activity-test-standards`. 2. Read the report.                                                                                                                                                                                                                           |
| **Expected Result** | All seven reported, each with file path and expected state.                                                                                                                                                                                                                     |
| **Pass Criteria**   | Seven distinct findings; each names a file and the expected state; none reported as a generic warning.                                                                                                                                                                          |

### SC-15: Existing filled `/TESTING.md` preserved

| Field               | Value                                                                          |
| ------------------- | ------------------------------------------------------------------------------ |
| **AC(s)**           | AC-5                                                                           |
| **Type**            | negative-path                                                                  |
| **Severity**        | critical                                                                       |
| **Preconditions**   | Fixture with a hand-authored `/TESTING.md` containing custom sections.         |
| **Steps**           | 1. Record a hash of the file. 2. Run `activity-test-standards`. 3. Re-hash.    |
| **Expected Result** | Custom content intact; additions are additive only.                            |
| **Pass Criteria**   | No custom section removed or rewritten; diff is append-only or reported first. |

### SC-16: Fully reachable monorepo passes the script check

| Field               | Value                                                                                    |
| ------------------- | ---------------------------------------------------------------------------------------- |
| **AC(s)**           | AC-6                                                                                     |
| **Type**            | happy-path                                                                               |
| **Severity**        | critical                                                                                 |
| **Preconditions**   | Fixture where the aggregate script reaches every test-bearing package and CI invokes it. |
| **Steps**           | 1. Run the script check.                                                                 |
| **Expected Result** | Reachability reported complete for all packages and gates.                               |
| **Pass Criteria**   | Zero reachability defects; every package listed as reached.                              |

### SC-17: Aggregate script omits a test-bearing package

| Field               | Value                                                                                                                                                           |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **AC(s)**           | AC-6                                                                                                                                                            |
| **Type**            | negative-path                                                                                                                                                   |
| **Severity**        | critical                                                                                                                                                        |
| **Preconditions**   | Fixture reproducing home-ledger Gap 1: aggregate `test:node` lists three of four packages, all script names canonical, omitted package holds the largest suite. |
| **Steps**           | 1. Run the script check. 2. Read the report.                                                                                                                    |
| **Expected Result** | Omission reported as a defect naming the unreached package, despite every script name being canonically correct.                                                |
| **Pass Criteria**   | Defect present; report does not pass on the strength of correct naming alone.                                                                                   |

### SC-18: Deploy gate invokes an incomplete aggregate

| Field               | Value                                                                                               |
| ------------------- | --------------------------------------------------------------------------------------------------- |
| **AC(s)**           | AC-6                                                                                                |
| **Type**            | negative-path                                                                                       |
| **Severity**        | critical                                                                                            |
| **Preconditions**   | Fixture with a deploy workflow whose quality gate runs the incomplete aggregate from SC-17.         |
| **Steps**           | 1. Run the script check. 2. Read the report.                                                        |
| **Expected Result** | Deploy gate reported incomplete, naming the workflow file and the untested package it lets through. |
| **Pass Criteria**   | Report distinguishes the CI gate from the deploy gate and flags both where both are affected.       |

### SC-19: `developer` carries exactly five touchpoints with rule 19 intact

| Field               | Value                                                                                                    |
| ------------------- | -------------------------------------------------------------------------------------------------------- |
| **AC(s)**           | AC-7                                                                                                     |
| **Type**            | happy-path                                                                                               |
| **Severity**        | critical                                                                                                 |
| **Preconditions**   | `developer` wiring complete in all four files.                                                           |
| **Steps**           | 1. Run the wiring assertions. 2. Dry-run a completion gate.                                              |
| **Expected Result** | Five touchpoints present; rule 19 unchanged; order is coverage → verifier → technical-writer → PR ready. |
| **Pass Criteria**   | Assertions pass; rule 19 text matches the pre-change baseline exactly; ordering confirmed.               |

### SC-20: Rule 19 altered

| Field               | Value                                                         |
| ------------------- | ------------------------------------------------------------- |
| **AC(s)**           | AC-7                                                          |
| **Type**            | negative-path                                                 |
| **Severity**        | critical                                                      |
| **Preconditions**   | Rule 19 reworded to delegate test authoring to `qa-engineer`. |
| **Steps**           | 1. Run `pnpm run test:unit`.                                  |
| **Expected Result** | Failure — rule 19 must be byte-identical to baseline.         |
| **Pass Criteria**   | Assertion detects the change and fails.                       |

### SC-21: Procedure duplicated into `developer`

| Field               | Value                                                                                    |
| ------------------- | ---------------------------------------------------------------------------------------- |
| **AC(s)**           | AC-7                                                                                     |
| **Type**            | negative-path                                                                            |
| **Severity**        | major                                                                                    |
| **Preconditions**   | `developer` gains a step-by-step coverage procedure in addition to the five touchpoints. |
| **Steps**           | 1. Run the wiring assertions.                                                            |
| **Expected Result** | Failure — procedural detail belongs in the skill, not the agent.                         |
| **Pass Criteria**   | Assertion detects touchpoints beyond the permitted five.                                 |

### SC-22: Coverage measured and gate passes

| Field               | Value                                                                  |
| ------------------- | ---------------------------------------------------------------------- |
| **AC(s)**           | AC-8                                                                   |
| **Type**            | happy-path                                                             |
| **Severity**        | major                                                                  |
| **Preconditions**   | Fixture with a coverage provider installed and a recorded baseline.    |
| **Steps**           | 1. Run the completion gate. 2. Read the closeout payload.              |
| **Expected Result** | `coverage_gate: PASS` with a measured value and a baseline comparison. |
| **Pass Criteria**   | Payload field present and valued `PASS`; measurement reported.         |

### SC-23: No coverage tooling — skip preserves analysis

| Field               | Value                                                                                                       |
| ------------------- | ----------------------------------------------------------------------------------------------------------- |
| **AC(s)**           | AC-8, AC-11                                                                                                 |
| **Type**            | negative-path                                                                                               |
| **Severity**        | critical                                                                                                    |
| **Preconditions**   | Fixture with no coverage provider in any package.                                                           |
| **Steps**           | 1. Run the completion gate. 2. Read the payload and the report.                                             |
| **Expected Result** | `coverage_gate: SKIPPED(no coverage tooling configured)` **and** a structural gap report is still produced. |
| **Pass Criteria**   | Reason string non-empty and surfaced in the PR; structural report present and non-empty.                    |

### SC-24: Gate field omitted entirely

| Field               | Value                                                       |
| ------------------- | ----------------------------------------------------------- |
| **AC(s)**           | AC-8                                                        |
| **Type**            | negative-path                                               |
| **Severity**        | critical                                                    |
| **Preconditions**   | Closeout payload emitted without `coverage_gate`.           |
| **Steps**           | 1. Present the payload to `planner`'s merge gate.           |
| **Expected Result** | Story treated as incomplete; merge withheld.                |
| **Pass Criteria**   | `planner` reports the missing field rather than proceeding. |

### SC-25: All registries and docs updated

| Field               | Value                                                                                                |
| ------------------- | ---------------------------------------------------------------------------------------------------- |
| **AC(s)**           | AC-9                                                                                                 |
| **Type**            | happy-path                                                                                           |
| **Severity**        | major                                                                                                |
| **Preconditions**   | Documentation pass complete.                                                                         |
| **Steps**           | 1. Run the registry-reference assertions.                                                            |
| **Expected Result** | All nine targets reference the new agent, skills, and `/TESTING.md`; `verifier` names `qa-engineer`. |
| **Pass Criteria**   | Every target asserted; no stale agent or skill count remains.                                        |

### SC-26: One registry left stale

| Field               | Value                                    |
| ------------------- | ---------------------------------------- |
| **AC(s)**           | AC-9                                     |
| **Type**            | negative-path                            |
| **Severity**        | minor                                    |
| **Preconditions**   | `CLAUDE.md` still says six subagents.    |
| **Steps**           | 1. Run `pnpm run test:unit`.             |
| **Expected Result** | Failure naming the stale count and file. |
| **Pass Criteria**   | Assertion detects the stale roster.      |

### SC-27: Fresh install places `/TESTING.md` on every profile

| Field               | Value                                                                                                                           |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **AC(s)**           | AC-10                                                                                                                           |
| **Type**            | happy-path                                                                                                                      |
| **Severity**        | critical                                                                                                                        |
| **Preconditions**   | Bundle built; scratch target repos per profile.                                                                                 |
| **Steps**           | 1. `dev-tasks install --profile copilot`, then `claude`, then `kiro`, each into a clean target. 2. Inspect target and manifest. |
| **Expected Result** | `TESTING.md` present in each target and recorded in the manifest with a `sha256`.                                               |
| **Pass Criteria**   | File exists; manifest entry has `path`, `profile`, `sha256`, `origin_sha256`.                                                   |

### SC-28: `--profile all` installs the root file exactly once

| Field               | Value                                                                         |
| ------------------- | ----------------------------------------------------------------------------- |
| **AC(s)**           | AC-10                                                                         |
| **Type**            | negative-path                                                                 |
| **Severity**        | major                                                                         |
| **Preconditions**   | Clean scratch target.                                                         |
| **Steps**           | 1. `dev-tasks install --profile all`. 2. Count `TESTING.md` manifest entries. |
| **Expected Result** | Exactly one entry, not one per resolved platform.                             |
| **Pass Criteria**   | Manifest contains a single `TESTING.md` entry; file written once.             |

### SC-29: Consumer-filled `/TESTING.md` survives update

| Field               | Value                                                                             |
| ------------------- | --------------------------------------------------------------------------------- |
| **AC(s)**           | AC-10                                                                             |
| **Type**            | negative-path                                                                     |
| **Severity**        | critical                                                                          |
| **Preconditions**   | Installed target whose `TESTING.md` has been filled with project-specific values. |
| **Steps**           | 1. Record content. 2. `dev-tasks update`. 3. Compare.                             |
| **Expected Result** | Filled content preserved byte-for-byte.                                           |
| **Pass Criteria**   | No diff; file listed under `consumer_owned_paths`.                                |

### SC-30: No provider still yields a ranked gap inventory

| Field               | Value                                                                                                                |
| ------------------- | -------------------------------------------------------------------------------------------------------------------- |
| **AC(s)**           | AC-11                                                                                                                |
| **Type**            | happy-path                                                                                                           |
| **Severity**        | critical                                                                                                             |
| **Preconditions**   | Fixture with no coverage provider, one 900-LOC untested service, one 30-LOC untested helper, one well-tested module. |
| **Steps**           | 1. Run `activity-coverage-gap-analysis`. 2. Read the report.                                                         |
| **Expected Result** | Ranked inventory naming the 900-LOC service above the 30-LOC helper; well-tested module absent from gaps.            |
| **Pass Criteria**   | Ranking is by size and risk, not alphabetical or flat; largest untested surface appears first.                       |

### SC-31: Analysis returns "unknown" instead of a gap report

| Field               | Value                                                                 |
| ------------------- | --------------------------------------------------------------------- |
| **AC(s)**           | AC-11                                                                 |
| **Type**            | negative-path                                                         |
| **Severity**        | critical                                                              |
| **Preconditions**   | Same fixture as SC-30.                                                |
| **Steps**           | 1. Run the analysis. 2. Inspect the report for an "unknown" verdict.  |
| **Expected Result** | No "unknown"/"unable to determine" outcome is acceptable.             |
| **Pass Criteria**   | Report contains a concrete inventory; assertion fails if it does not. |

### SC-32: Stale, narrower-than-claimed coverage artifact

| Field               | Value                                                                                                                                                                                              |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **AC(s)**           | AC-11                                                                                                                                                                                              |
| **Type**            | abuse-case                                                                                                                                                                                         |
| **Severity**        | critical                                                                                                                                                                                           |
| **Preconditions**   | Fixture reproducing home-ledger Gap 2: a committed coverage report showing 46.58% whose measured scope is 1 of 8 modules, dated months ago, plus a stale results file understating the test count. |
| **Steps**           | 1. Run the analysis. 2. Read the report.                                                                                                                                                           |
| **Expected Result** | Artifact reported as misleading — stale and narrower than the package it claims to describe — and excluded from evidence.                                                                          |
| **Pass Criteria**   | The 46.58% figure is not reported as the package's coverage; both staleness and scope narrowing are named.                                                                                         |

**AC coverage check:** every AC-1 through AC-11 has ≥1 happy-path and ≥1 negative or abuse scenario. No AC is uncoverable by E2E scenario. AC-2 and AC-9 are static-structure criteria whose black-box entry point is the test-suite run.

---

## Contract Validation Scenarios

The contracts in scope are inter-agent and inter-tool payloads, not HTTP APIs.

### CT-1: Valid closeout payload with coverage gate

| Field               | Value                                                                        |
| ------------------- | ---------------------------------------------------------------------------- |
| **AC(s)**           | AC-7, AC-8                                                                   |
| **Contract type**   | consumer-driven (`planner` is the consumer)                                  |
| **Boundary**        | `developer` closeout payload                                                 |
| **Direction**       | response                                                                     |
| **Input**           | Payload including `coverage_gate: PASS` and all pre-existing required fields |
| **Expected Result** | `planner` accepts and proceeds to the merge gate.                            |
| **Pass Criteria**   | No missing-field error; merge gate evaluates.                                |

### CT-2: Missing required field — `coverage_gate`

| Field               | Value                                  |
| ------------------- | -------------------------------------- |
| **AC(s)**           | AC-8                                   |
| **Contract type**   | consumer-driven                        |
| **Boundary**        | `developer` closeout payload           |
| **Direction**       | response                               |
| **Input**           | Payload omitting `coverage_gate`       |
| **Expected Result** | Treated as incomplete; merge withheld. |
| **Pass Criteria**   | `planner` names the missing field.     |

### CT-3: Type/enum mismatch on `coverage_gate`

| Field               | Value                                              |
| ------------------- | -------------------------------------------------- |
| **AC(s)**           | AC-8                                               |
| **Contract type**   | consumer-driven                                    |
| **Boundary**        | `developer` closeout payload                       |
| **Direction**       | response                                           |
| **Input**           | `coverage_gate: maybe`                             |
| **Expected Result** | Rejected as an invalid value.                      |
| **Pass Criteria**   | Only `PASS`, `FAIL`, `SKIPPED(<reason>)` accepted. |

### CT-4: `SKIPPED` without a reason

| Field               | Value                                                                            |
| ------------------- | -------------------------------------------------------------------------------- |
| **AC(s)**           | AC-8                                                                             |
| **Contract type**   | consumer-driven                                                                  |
| **Boundary**        | `developer` closeout payload                                                     |
| **Direction**       | response                                                                         |
| **Input**           | `coverage_gate: SKIPPED()` and `coverage_gate: SKIPPED`                          |
| **Expected Result** | Both rejected — the reason is mandatory, which is what prevents silent skipping. |
| **Pass Criteria**   | Empty and absent reasons both fail validation.                                   |

### CT-5: `/TESTING.md` satisfies the section contract

| Field               | Value                                                             |
| ------------------- | ----------------------------------------------------------------- |
| **AC(s)**           | AC-4                                                              |
| **Contract type**   | provider-driven (`qa-engineer` writes, other agents read)         |
| **Boundary**        | `/TESTING.md` document schema                                     |
| **Direction**       | response                                                          |
| **Input**           | Placeholder as shipped                                            |
| **Expected Result** | All required sections present and parseable by a reader agent.    |
| **Pass Criteria**   | Every required heading resolves; per-package slot is well-formed. |

### CT-6: `/TESTING.md` missing the per-package section

| Field               | Value                                            |
| ------------------- | ------------------------------------------------ |
| **AC(s)**           | AC-4                                             |
| **Contract type**   | provider-driven                                  |
| **Boundary**        | `/TESTING.md` document schema                    |
| **Direction**       | response                                         |
| **Input**           | Placeholder with the per-package section removed |
| **Expected Result** | Contract violation reported.                     |
| **Pass Criteria**   | Assertion fails naming the missing section.      |

### CT-7: Install manifest entry for a root file

| Field               | Value                                                                                                     |
| ------------------- | --------------------------------------------------------------------------------------------------------- |
| **AC(s)**           | AC-10                                                                                                     |
| **Contract type**   | schema-compat                                                                                             |
| **Boundary**        | install manifest `files[]`                                                                                |
| **Direction**       | response                                                                                                  |
| **Input**           | Manifest produced by an install including `TESTING.md`                                                    |
| **Expected Result** | Entry carries `path`, `profile`, `sha256`, `origin_sha256` in the existing shape.                         |
| **Pass Criteria**   | Root-file entry is schema-identical to platform-file entries; no new required key added to other entries. |

### CT-8: Kiro agent frontmatter conformance

| Field               | Value                                                                         |
| ------------------- | ----------------------------------------------------------------------------- |
| **AC(s)**           | AC-1                                                                          |
| **Contract type**   | provider-driven (Kiro runtime is the consumer)                                |
| **Boundary**        | `.kiro/agents/qa-engineer.md` frontmatter                                     |
| **Direction**       | request                                                                       |
| **Input**           | Frontmatter as authored                                                       |
| **Expected Result** | `description` and `tools` present; **no** `permissions` block.                |
| **Pass Criteria**   | A `permissions` key causes failure, since it prevents the agent from loading. |

### CT-9: Extra unknown field tolerance in the closeout payload

| Field               | Value                                                                                                                    |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **AC(s)**           | AC-7                                                                                                                     |
| **Contract type**   | schema-compat                                                                                                            |
| **Boundary**        | `developer` closeout payload                                                                                             |
| **Direction**       | response                                                                                                                 |
| **Input**           | Payload with `coverage_gate` plus an unrecognized field                                                                  |
| **Expected Result** | Behavior matches the documented policy — the payload spec states every field is required and unknown fields are ignored. |
| **Pass Criteria**   | Consistent with the stated policy; no crash, no silent drop of a required field.                                         |

### CT-10: Cross-platform contract equivalence

| Field               | Value                                                                                        |
| ------------------- | -------------------------------------------------------------------------------------------- |
| **AC(s)**           | AC-1, AC-3                                                                                   |
| **Contract type**   | schema-compat                                                                                |
| **Boundary**        | `qa-engineer` and skill contracts across `.kiro`, `.github`, `.claude`                       |
| **Direction**       | response                                                                                     |
| **Input**           | The three variants of each artifact                                                          |
| **Expected Result** | Behavioral statements equivalent; only frontmatter and platform conventions differ.          |
| **Pass Criteria**   | Every normative statement present in all variants; byte differences confined to frontmatter. |

### CT-11: Version compatibility — older `planner` reads a newer payload

| Field               | Value                                                                                                                                       |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **AC(s)**           | AC-7, AC-8                                                                                                                                  |
| **Contract type**   | schema-compat                                                                                                                               |
| **Boundary**        | `developer` → `planner` payload across bundle versions                                                                                      |
| **Direction**       | response                                                                                                                                    |
| **Input**           | (a) new payload with `coverage_gate` read by a pre-change `planner`; (b) pre-change payload without the field read by the updated `planner` |
| **Expected Result** | (a) tolerated — the extra field does not break the older gate; (b) treated as incomplete by the new gate.                                   |
| **Pass Criteria**   | Neither direction produces a false merge approval.                                                                                          |

**Flagged for clarification:** the closeout payload has no versioned schema file — it is defined in prose inside the agent prompts. CT-11 is therefore verified by inspection rather than schema validation. Recommend `product-engineer` consider extracting it to a versioned schema in a future issue; not blocking for #123.

---

## Edge-Case Catalog

All nine categories evaluated.

### 1. Input Domain

#### EC-1: Repository with no `package.json`

| Field               | Value                                                                    |
| ------------------- | ------------------------------------------------------------------------ |
| **AC(s)**           | AC-5, AC-6                                                               |
| **Category**        | Input Domain                                                             |
| **Input / Setup**   | Target repo containing only source files, no manifest.                   |
| **Expected Result** | Reported as not-applicable with a reason, not a crash and not a pass.    |
| **Risk if Missed**  | Agent errors out on non-JS repos, blocking the completion gate entirely. |

#### EC-2: Package with tests but no source files

| Field               | Value                                                                 |
| ------------------- | --------------------------------------------------------------------- |
| **AC(s)**           | AC-11                                                                 |
| **Category**        | Input Domain                                                          |
| **Input / Setup**   | Fixture package containing only `*.test.ts`.                          |
| **Expected Result** | Ratio reported without error; package not flagged as an untested gap. |
| **Risk if Missed**  | Divide-by-zero or a nonsense ratio discredits the whole report.       |

#### EC-3: Package with source but zero tests

| Field               | Value                                                    |
| ------------------- | -------------------------------------------------------- |
| **AC(s)**           | AC-11                                                    |
| **Category**        | Input Domain                                             |
| **Input / Setup**   | 900-LOC package, no test files.                          |
| **Expected Result** | Ranked at or near the top of the gap inventory.          |
| **Risk if Missed**  | The largest risk surface is the one most easily omitted. |

### 2. State Transitions

#### EC-4: `/TESTING.md` lifecycle transitions

| Field               | Value                                                                                           |
| ------------------- | ----------------------------------------------------------------------------------------------- |
| **AC(s)**           | AC-4, AC-5                                                                                      |
| **Category**        | State Transitions                                                                               |
| **Input / Setup**   | Walk absent → placeholder → filled → stale (a package added after filling).                     |
| **Expected Result** | Each state correctly identified; stale state reported as needing update, not silently accepted. |
| **Risk if Missed**  | A filled-then-stale contract is trusted while describing a repo that has moved on.              |

#### EC-5: Placeholder present but unfilled

| Field               | Value                                                                        |
| ------------------- | ---------------------------------------------------------------------------- |
| **AC(s)**           | AC-4, AC-5                                                                   |
| **Category**        | State Transitions                                                            |
| **Input / Setup**   | Shipped placeholder untouched in a real project.                             |
| **Expected Result** | Reported as unfilled, distinguished from filled.                             |
| **Risk if Missed**  | Empty guidance is read as permission — worse than having no contract at all. |

### 3. Timing & Concurrency

#### EC-6: Concurrent `dev-tasks install` into one target

| Field               | Value                                                                             |
| ------------------- | --------------------------------------------------------------------------------- |
| **AC(s)**           | AC-10                                                                             |
| **Category**        | Timing & Concurrency                                                              |
| **Input / Setup**   | Two installs started against the same target within the same second.              |
| **Expected Result** | No truncated `TESTING.md`; no duplicate manifest entry.                           |
| **Risk if Missed**  | Corrupted managed file or manifest, with no obvious symptom until a later update. |

Remaining Timing & Concurrency cases: `N/A — agent invocations in this workflow are sequential and single-writer; there is no concurrent request surface.`

### 4. Idempotency

#### EC-7: Repeated `dev-tasks install`

| Field               | Value                                                         |
| ------------------- | ------------------------------------------------------------- |
| **AC(s)**           | AC-10                                                         |
| **Category**        | Idempotency                                                   |
| **Input / Setup**   | Install three times into the same target.                     |
| **Expected Result** | One `TESTING.md`, one manifest entry, unchanged content.      |
| **Risk if Missed**  | Manifest bloat and ambiguous reconciliation on later updates. |

#### EC-8: Re-running `qa-engineer` after a fill

| Field               | Value                                                                      |
| ------------------- | -------------------------------------------------------------------------- |
| **AC(s)**           | AC-5                                                                       |
| **Category**        | Idempotency                                                                |
| **Input / Setup**   | Run twice with no intervening repo change.                                 |
| **Expected Result** | Second run adds no duplicate sections and reports no already-fixed defect. |
| **Risk if Missed**  | Duplicated per-package sections; reviewers lose trust in the report.       |

### 5. Failure Modes

#### EC-9: Coverage tool exits non-zero

| Field               | Value                                                                                           |
| ------------------- | ----------------------------------------------------------------------------------------------- |
| **AC(s)**           | AC-8, AC-11                                                                                     |
| **Category**        | Failure Modes                                                                                   |
| **Input / Setup**   | Provider installed but crashes mid-run.                                                         |
| **Expected Result** | `SKIPPED(<reason naming the failure>)`, never `PASS`; structural path still runs.               |
| **Risk if Missed**  | A crashed measurement reported as a pass is the exact false-green this issue exists to prevent. |

#### EC-10: Malformed `package.json`

| Field               | Value                                                              |
| ------------------- | ------------------------------------------------------------------ |
| **AC(s)**           | AC-5, AC-6                                                         |
| **Category**        | Failure Modes                                                      |
| **Input / Setup**   | Trailing comma / invalid JSON.                                     |
| **Expected Result** | Parse failure reported with file and line; no partial silent pass. |
| **Risk if Missed**  | Reachability check silently reports zero packages and passes.      |

#### EC-11: No CI workflow files present

| Field               | Value                                                                          |
| ------------------- | ------------------------------------------------------------------------------ |
| **AC(s)**           | AC-6                                                                           |
| **Category**        | Failure Modes                                                                  |
| **Input / Setup**   | Repo with no `.github/workflows/`.                                             |
| **Expected Result** | Reported as "no CI gate found" — an explicit finding, not an implicit pass.    |
| **Risk if Missed**  | A repo with no CI at all is indistinguishable from one with a correct CI gate. |

#### EC-12: Interrupted install leaves a partial target

| Field               | Value                                                                      |
| ------------------- | -------------------------------------------------------------------------- |
| **AC(s)**           | AC-10                                                                      |
| **Category**        | Failure Modes                                                              |
| **Input / Setup**   | Kill the install after platform dirs are written but before the root file. |
| **Expected Result** | Next install or `doctor` detects and repairs the missing root file.        |
| **Risk if Missed**  | Silent absence of the testing contract in a consumer repo.                 |

### 6. Auth & Permissions

#### EC-13: `qa-engineer` attempts to edit application source

| Field               | Value                                                                        |
| ------------------- | ---------------------------------------------------------------------------- |
| **AC(s)**           | AC-5                                                                         |
| **Category**        | Auth & Permissions                                                           |
| **Input / Setup**   | Fixture where making a test pass would be easiest by changing app code.      |
| **Expected Result** | Refuses; reports the needed change and hands off.                            |
| **Risk if Missed**  | The agent writing tests also edits the code under test — evidence collapses. |

#### EC-14: `qa-engineer` attempts to edit non-test config

| Field               | Value                                                              |
| ------------------- | ------------------------------------------------------------------ |
| **AC(s)**           | AC-5                                                               |
| **Category**        | Auth & Permissions                                                 |
| **Input / Setup**   | Fixture requiring an `eslint.config.js` or `tsconfig.json` change. |
| **Expected Result** | Refuses; authority is test-only config.                            |
| **Risk if Missed**  | Scope creep into build and lint configuration under a QA label.    |

#### EC-15: Authorization path with cross-tenant tests over fakes only

| Field               | Value                                                                                                       |
| ------------------- | ----------------------------------------------------------------------------------------------------------- |
| **AC(s)**           | AC-3                                                                                                        |
| **Category**        | Auth & Permissions                                                                                          |
| **Input / Setup**   | Fixture asserting cross-tenant isolation entirely against in-memory doubles.                                |
| **Expected Result** | Security-negative requirements still reported as unmet; the limitation of fake-based isolation is recorded. |
| **Risk if Missed**  | Isolation appears verified while the real policy layer is untested — the home-ledger RLS situation.         |

### 7. Data Boundaries

#### EC-16: Prompt length at the cap boundary

| Field               | Value                                             |
| ------------------- | ------------------------------------------------- |
| **AC(s)**           | AC-2                                              |
| **Category**        | Data Boundaries                                   |
| **Input / Setup**   | Prompt variants at 149, 150, and 151 lines.       |
| **Expected Result** | 149 and 150 pass; 151 fails.                      |
| **Risk if Missed**  | Off-by-one turns a hard cap into an advisory one. |

#### EC-17: Very large single file skews the ratio

| Field               | Value                                                                        |
| ------------------- | ---------------------------------------------------------------------------- |
| **AC(s)**           | AC-11                                                                        |
| **Category**        | Data Boundaries                                                              |
| **Input / Setup**   | One 10k-LOC generated file alongside normal sources.                         |
| **Expected Result** | Ranking is not dominated by a generated artifact; exclusions are documented. |
| **Risk if Missed**  | The inventory recommends testing generated code and loses credibility.       |

### 8. Resource Exhaustion

#### EC-18: Monorepo with many packages

| Field               | Value                                                                                  |
| ------------------- | -------------------------------------------------------------------------------------- |
| **AC(s)**           | AC-5, AC-6, AC-11                                                                      |
| **Category**        | Resource Exhaustion                                                                    |
| **Input / Setup**   | 60-package workspace.                                                                  |
| **Expected Result** | Completes, or returns a bounded partial result that states what was not analyzed.      |
| **Risk if Missed**  | The gate hangs or silently truncates, and reviewers read a partial report as complete. |

### 9. API Versioning

#### EC-19: `/TESTING.md` contract evolves after a consumer fills it

| Field               | Value                                                                                    |
| ------------------- | ---------------------------------------------------------------------------------------- |
| **AC(s)**           | AC-4, AC-10                                                                              |
| **Category**        | API Versioning                                                                           |
| **Input / Setup**   | Consumer filled v1 sections; bundle ships a v2 section contract.                         |
| **Expected Result** | New sections reported as missing and offered additively; filled content never rewritten. |
| **Risk if Missed**  | Either the consumer's work is destroyed, or the contract silently never advances.        |

#### EC-20: Bundle installed over an older manifest lacking root-file support

| Field               | Value                                                                        |
| ------------------- | ---------------------------------------------------------------------------- |
| **AC(s)**           | AC-10                                                                        |
| **Category**        | API Versioning                                                               |
| **Input / Setup**   | Target with a manifest written before root files existed.                    |
| **Expected Result** | Update adds the root-file entry without invalidating existing entries.       |
| **Risk if Missed**  | Manifest reconciliation breaks and reports spurious conflicts on every file. |

**Flagged:** AC-9 has no meaningful edge case beyond presence and staleness — it is a documentation-consistency criterion, covered by SC-25 and SC-26.

---

## Randomized Tactics and Seed Policy

### Seed policy

```
Seed format: <tactic-type>-<AC-id>-<unix-timestamp>-<random-4-hex>
Example:     fuzz-AC6-1755388800-b7c2

Replay: pnpm vitest run <test-file> --seed=<captured-seed>
```

Every seed **MUST** be recorded in the fidelity report. Environment snapshot required: OS, Node version, pnpm version.

### RT-1: Fuzz repository shapes against the standards check

| Field                  | Value                                                                                                                     |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **AC(s)**              | AC-5, AC-6                                                                                                                |
| **Tactic type**        | fuzz                                                                                                                      |
| **Input surface**      | Generated repo fixtures: random workspace layouts, package counts, script sets, presence/absence of configs and CI files. |
| **Property / Oracle**  | Never throws an unhandled error; always emits a verdict; never emits a pass when a test-bearing package is unreachable.   |
| **Iterations**         | 300                                                                                                                       |
| **Seed**               | `fuzz-AC5AC6-{timestamp}-{hex}`                                                                                           |
| **Replay instruction** | `pnpm vitest run test/unit/qa-standards-fuzz.test.ts --seed=<seed>`                                                       |
| **Shrink strategy**    | Remove packages one at a time, then scripts, to the minimal repo that still misreports.                                   |

### RT-2: Property — reachability reports each test-bearing package exactly once

| Field                  | Value                                                                                    |
| ---------------------- | ---------------------------------------------------------------------------------------- |
| **AC(s)**              | AC-6                                                                                     |
| **Tactic type**        | property-based                                                                           |
| **Input surface**      | Randomly generated workspaces, 1–40 packages, random subsets holding tests.              |
| **Property / Oracle**  | For all inputs, every test-bearing package appears exactly once as reached or unreached. |
| **Iterations**         | 200                                                                                      |
| **Seed**               | `prop-AC6-{timestamp}-{hex}`                                                             |
| **Replay instruction** | `pnpm vitest run test/unit/qa-reachability-prop.test.ts --seed=<seed>`                   |
| **Shrink strategy**    | Reduce package count until the duplicate or omission disappears.                         |

### RT-3: Property — structural analysis never returns "unknown"

| Field                  | Value                                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------------- |
| **AC(s)**              | AC-11                                                                                       |
| **Tactic type**        | property-based                                                                              |
| **Input surface**      | Random repos with no coverage provider, random source/test distributions including 0 tests. |
| **Property / Oracle**  | Output always contains a ranked inventory; the string "unknown" never appears as a verdict. |
| **Iterations**         | 200                                                                                         |
| **Seed**               | `prop-AC11-{timestamp}-{hex}`                                                               |
| **Replay instruction** | `pnpm vitest run test/unit/qa-gap-analysis-prop.test.ts --seed=<seed>`                      |
| **Shrink strategy**    | Reduce to the smallest repo producing an empty or unknown verdict.                          |

### RT-4: Property — install idempotency for root files

| Field                  | Value                                                                     |
| ---------------------- | ------------------------------------------------------------------------- |
| **AC(s)**              | AC-10                                                                     |
| **Tactic type**        | property-based                                                            |
| **Input surface**      | Random profile sequences and repeat counts (1–5 installs).                |
| **Property / Oracle**  | `TESTING.md` manifest entry count is always exactly 1 after any sequence. |
| **Iterations**         | 150                                                                       |
| **Seed**               | `prop-AC10-{timestamp}-{hex}`                                             |
| **Replay instruction** | `pnpm vitest run test/unit/distribution-install.test.ts --seed=<seed>`    |
| **Shrink strategy**    | Reduce the sequence to the shortest producing a duplicate.                |

### RT-5: Stateful random walk over install / update / consumer edit

| Field                  | Value                                                                                                            |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **AC(s)**              | AC-10                                                                                                            |
| **Tactic type**        | stateful-random-walk                                                                                             |
| **Input surface**      | Random sequences of `install`, `update`, `pin`, and consumer edits to `TESTING.md`.                              |
| **Property / Oracle**  | A consumer edit is never lost by any subsequent sequence; the manifest always reconciles without false conflict. |
| **Iterations**         | 100 sequences of length 3–8                                                                                      |
| **Seed**               | `walk-AC10-{timestamp}-{hex}`                                                                                    |
| **Replay instruction** | `pnpm vitest run test/unit/distribution-walk.test.ts --seed=<seed>`                                              |
| **Shrink strategy**    | Delta-debug the action sequence to the minimal losing walk.                                                      |

### RT-6: Fuzz `/TESTING.md` content against reader agents

| Field                  | Value                                                                                                                             |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **AC(s)**              | AC-4                                                                                                                              |
| **Tactic type**        | fuzz                                                                                                                              |
| **Input surface**      | Malformed contract documents: missing headings, duplicated per-package sections, empty sections, non-UTF8 bytes, very long lines. |
| **Property / Oracle**  | Reader never crashes; a malformed contract is always reported as malformed rather than partially trusted.                         |
| **Iterations**         | 200                                                                                                                               |
| **Seed**               | `fuzz-AC4-{timestamp}-{hex}`                                                                                                      |
| **Replay instruction** | `pnpm vitest run test/unit/testing-md-fuzz.test.ts --seed=<seed>`                                                                 |
| **Shrink strategy**    | Restore sections one at a time to find the minimal malformation tolerated.                                                        |

Failure triage follows the `verifier` Failure Triage Workflow: capture, isolate, minimize, classify (spec gap / implementation defect / flaky), report, with a maximum of three reproduction attempts before `inconclusive`.

---

## Execution Checklist

- [ ] All 32 E2E scenarios executed; results recorded per scenario ID
- [ ] All 11 contract scenarios executed
- [ ] All 20 edge cases executed; `N/A` categories confirmed still non-applicable
- [ ] All 6 randomized tactics executed with seeds captured and recorded
- [ ] Fixture projects created for SC-8/SC-9, SC-12, SC-14, SC-17/SC-18, SC-30/SC-32
- [ ] Every AC has at least one positive and one negative result recorded
- [ ] Rule 19 baseline hash captured **before** implementation begins, for SC-20
- [ ] `pnpm run test:unit`, `test:integration`, `validate` green
- [ ] `./scripts/format.sh --check` clean for new and modified Markdown
- [ ] Traceability matrix updated with observed results
- [ ] No scenario result recorded as pass on the strength of naming or presence alone

### Note for implementation

SC-20 requires a hash of `developer` rule 19 taken **before** any edit. This baseline is now captured — see below — so sub-task 1.1 no longer needs to produce it.

## Rule 19 Baseline (captured pre-implementation)

Captured by `verifier` on 2026-08-18, before any implementation work on issue #123.

| File                                | Rule 19 line | `sha256`                                                           |
| ----------------------------------- | ------------ | ------------------------------------------------------------------ |
| `.kiro/agents/developer.md`         | 104          | `27aa0238fc7fa29bf3f68a50fdd3a0f744e96a660cc609fc36462c5567d66876` |
| `.github/agents/developer.agent.md` | 85           | `27aa0238fc7fa29bf3f68a50fdd3a0f744e96a660cc609fc36462c5567d66876` |
| `.claude/agents/developer.md`       | 86           | `27aa0238fc7fa29bf3f68a50fdd3a0f744e96a660cc609fc36462c5567d66876` |
| `.claude/commands/developer.md`     | 89           | `27aa0238fc7fa29bf3f68a50fdd3a0f744e96a660cc609fc36462c5567d66876` |

All four variants are byte-identical, which is itself the AC-7 precondition. SC-20 passes only if all four still hash to this value after implementation. Reproduce with:

```bash
grep -A0 '^19\. \*\*Test-first design' <file> | shasum -a 256
```
