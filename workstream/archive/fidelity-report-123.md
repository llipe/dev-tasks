# Fidelity Report — Issue 123: QA agent, testing skills, and /TESTING.md standard

## Verdict

| Field                    | Value                                                                                     |
| ------------------------ | ----------------------------------------------------------------------------------------- |
| **Fidelity**             | **High**                                                                                  |
| **Highest drift impact** | **Major** (5 Major, 6 Minor — all non-blocking)                                            |
| **Scope**                | Issue [#123](https://github.com/llipe/dev-tasks/issues/123), PR #129, branch `issue/123-qa-agent-and-testing-standard` |
| **AC coverage**          | 11 of 11 addressed; 8 Pass, 3 Pass-with-drift                                              |
| **Mode**                 | audit (grey-box)                                                                          |
| **Date**                 | 2026-08-18                                                                                |

Every acceptance criterion has a delivered implementation, and the two invariants most at risk — rule 19 immutability and the five-touchpoint simplicity budget — both hold. The Major findings are concentrated in the **evidence layer**, not the deliverable: the tests that verify this issue exhibit a milder form of the same false-green defect the issue exists to eliminate, and one fixture artifact is absent from version control.

Drift is non-blocking to PR and issue completion. It routes to `product-engineer`'s `activity-drift-reconciliation`.

---

## Human-readable summary

**What was asked for.** A specialist agent that owns testing for a project: it works out how a project tests itself, writes the tests the project is missing, and reports what is untested. Plus a standard document (`TESTING.md`) that each project fills in to record its own testing rules, shipped to every project that installs this toolkit.

**What was delivered.** All of it. The new `qa-engineer` agent exists on all three supported AI platforms with the same instructions. Three new instruction sets cover establishing the standard, writing tests, and reporting gaps. `TESTING.md` ships as a blank-but-structured form with 23 slots to fill and no pre-filled answers, and it now reaches consumer projects through both installation routes. The existing `developer` agent was told to call the new agent at exactly one point in its workflow, and — importantly — its long-standing instruction to write tests first was left completely untouched, verified by cryptographic hash across all four copies.

**Why the design choices hold up.** The new instruction was added at the end of `developer`'s numbered list rather than slotted in beside related items. That was the right call: inserting it mid-list would have renumbered the very instruction the project promised not to change. The order things actually happen in is defined elsewhere in the file, and there it is correct.

**What is worth a second look.** The issue exists because of a real audit that found a test suite reporting good health while proving almost nothing. The tests written to verify this issue have a softer version of that same problem. Most of them check that a document *mentions a word* rather than that it *states the rule*. Concretely: 20 of 22 such checks still pass against a document written to say the exact opposite of what is required. The delivered documents do say the right things — that was confirmed by reading them directly — so nothing shipped is wrong today. But these checks would not notice if a future edit reversed the meaning.

Second, three of the acceptance criteria are about *detecting* problems, and they were signed off by confirming the instructions mention each problem and that example broken projects exist. Nobody ran the agent against those examples to see whether it actually catches them. For criteria whose entire value is detection, that is presence, not proof.

Third, one of those example broken projects is missing its centrepiece. The deliberately misleading coverage report at the heart of one test case is excluded from version control by the example project's own ignore file, so it exists only on the machine where it was written. Anyone else who checks out this branch gets an incomplete example.

None of this blocks the pull request. All of it is worth fixing before the follow-up issue builds on top of it.

---

## Per-AC results

Sources: **CB** = codebase (branch diff, files read directly) · **WS** = `/workstream` artifacts · **T** = test suite

| AC        | Requirement (abbrev.)                              | Codebase evidence                                                                                                                            | Workstream evidence                                                | Test evidence                                                                                           | Result             |
| --------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- | ------------------ |
| **AC-1**  | Agent on 3 platforms + 2 entry points, parity       | All 5 files present; bodies equivalent, frontmatter platform-specific                                                                        | 1.6–1.8, 1.27 recorded PASS                                        | `qa-engineer-parity.test.ts` — 9 contract statements × 3 variants, green                                 | **Pass**           |
| **AC-2**  | ≤150 lines, one procedure, no modes                | `.kiro/agents/qa-engineer.md` = 108 lines, one `## Procedure`, zero mode headings                                                             | 1.28 recorded PASS                                                 | Line-cap + `MODE_HEADING` regex assertions green; EC-16 asserted on the comparator, not on `lineCount()` | **Pass**           |
| **AC-3**  | 3 skills mirrored; security-negatives; trap named   | 9 `SKILL.md` files; 7 security-negative cases (4 required + 3 extra); trap section verbatim; Layer 1–2 `MUST NOT` clauses                     | 1.9–1.14, 1.29 recorded PASS                                       | Green, but by keyword presence — see **D-1**                                                             | **Pass**           |
| **AC-4**  | Per-package placeholder contract, no project values | `TESTING.md`: 23 `<!-- unfilled -->` markers, zero percentages, per-package + non-JS tables, layer boundaries, escalation rule                | 1.5, 1.30 recorded PASS                                            | Section-contract assertions green; placeholder guard catches numeric thresholds only — see **D-1**       | **Pass**           |
| **AC-5**  | Existing-project setup + harness-defect detection   | All 7 checks tabulated with defect condition; failure modes for no-manifest / malformed / no-CI / large workspace / re-run                    | 1.9, 1.31 recorded "PASS by fixture inspection"                    | No runtime execution; fixture inert                                                                     | **Pass** w/ drift  |
| **AC-6**  | Monorepo- and CI-aware script reachability          | 6-item reachability checklist incl. conditional/manual-dispatch gates; worked example of the canonical-names false pass                       | 1.32 recorded "PASS by fixture inspection"                         | Fixture reproduces the omission with both CI and deploy gates affected; not executed                     | **Pass** w/ drift  |
| **AC-7**  | Exactly 5 touchpoints; rule 19 unchanged            | Rule 22, Execution Flow line, Integration row, Completion Gate item 5, `coverage_gate` payload field — exactly 5. Rule 19 `27aa0238…` × 4 ✓   | 1.15–1.17, 1.33 recorded PASS                                      | SC-20 hash guard green in all 4 variants; SC-21 has **no** assertion — see **D-3**                       | **Pass** w/ drift  |
| **AC-8**  | `SKIPPED(<reason>)` only; skip preserves analysis   | `implement` condition 6 before verifier 7 in all 3 variants; gate table maps crashed provider → `SKIPPED`; structural path "always runs"      | 1.18, 1.34 recorded PASS                                           | Prose inspection only — no payload validator exists (flagged non-blocking in the plan)                   | **Pass**           |
| **AC-9**  | Registries, docs, manifest, build script            | 9 agents / 7 Claude subagents / 16 skills on disk match every registry claim; `verifier` Out of Scope names `qa-engineer` × 3; ADR-003 present | 1.21–1.26, 1.35; `technical-writer` found and fixed further drift  | Registry-reference + stale-count assertions green                                                       | **Pass**           |
| **AC-10** | Both install paths, once, idempotent, preserved     | `ROOT_FILES` + `ROOT_PROFILE_TAG`; root install once per run; root tag in merge set; `MANAGED_FILES` + `consumer_owned_paths`                 | 1.20, 1.36 recorded PASS verified end-to-end through the built CLI  | 25 unit assertions (SC-27/28, CT-7, EC-7/12/20) green; **update preservation untested** — see **D-4**    | **Pass** w/ drift  |
| **AC-11** | Gap analysis without a provider, risk-ranked        | Structural path "always runs"; 4-factor risk weighting; divide-by-zero table; artifact validation with the 46.58%/1-of-8 worked example        | 1.13, 1.37 recorded "PASS by fixture inspection"                   | Fixture present but missing its key artifact — see **D-2**                                              | **Pass** w/ drift  |

**Quality gates (re-confirmed):** `pnpm run test:unit` → 1110/1110 pass, 79 files, 30.3s. Reported `validate` and `audit` PASS accepted as recorded.

---

## Drift catalog

Every item below is **non-blocking to PR and issue completion**.

### D-1 — Keyword-presence assertions pass against negated content

**Impact: Major · Intent: Unintended · Source: T, CB**

The requirement-checking assertions in `qa-testing-standard.test.ts` and `qa-engineer-parity.test.ts` match a bare token, not the rule. A probe running the 22 patterns against a stub document that states the opposite of every requirement:

```
20 of 22 assertions pass against a document that states the OPPOSITE of the requirement.
```

Worst individual cases:

| Assertion label                  | Pattern                          | Why it does not measure the requirement                                                                            |
| -------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `never reports unknown`          | `/unknown/i`                     | Asserts the token is **present**. A skill instructing "return `unknown` when no provider exists" passes. Inverted.  |
| `test environment correctness`   | `/environment/i`                 | Matches any prose mentioning environments.                                                                          |
| `path-alias parity with tsconfig` | `/alias/i`                       | Matches "aliases are optional".                                                                                     |
| `false-green placeholder detection` | `/placeholder/i`               | Matches "a placeholder assertion is fine".                                                                          |
| `CI gate invokes the aggregate`  | `/\bCI\b/`                       | Matches any mention of CI, including its absence being acceptable.                                                  |
| `risk-based ranking`             | `/rank/i`                        | Matches "do not rank anything".                                                                                     |
| `SKIPPED reason form` (skill)    | `/SKIPPED/`                      | Weaker than the `/SKIPPED\(<reason>\)/` form used in the `developer` block; a bare `SKIPPED` mention satisfies it.   |
| `verifier owns the audit`        | `/\bverifier\b/i`                | Asserts only that the word `verifier` occurs; redundant with the adjacent statement.                                |
| SC-11 placeholder guard          | `/\b\d{2}%\s*(minimum\|threshold\|required)/i` | Catches a hard-coded threshold but not a hard-coded runner. SC-11's precondition names **both** `vitest` and 80%.    |

The delivered documents do state the requirements correctly — verified by direct reading during this audit — so there is no live defect. The finding is that these assertions cannot detect a future reversal, which is the same class of failure (`expect(true)`, false-green health reporting) that refinement v1.2 was written to eliminate. The two `ROOT_FILES` vacuity guards the implementer added voluntarily are the correct pattern; it was not applied to the content assertions.

**Recommendation:** `developer` — strengthen to anchored phrase or negation-sensitive assertions (e.g. assert the `MUST NOT return unknown` clause, not the token `unknown`). The `MODE_HEADING` regex and the rule-19 hash guard in the same files are good models.

### D-2 — SC-32's stale coverage artifact is excluded from version control

**Impact: Major · Intent: Unintended · Source: CB, WS**

`test/fixtures/qa-standards/no-coverage-provider/README.md` declares that `coverage/index.html` must be reported as misleading — the 46.58%, three-months-stale, one-of-eight-modules artifact reproducing home-ledger Gap 2, which SC-32 exists to catch. The file exists on the authoring machine but is not in the branch:

```
git check-ignore -v .../coverage/index.html
  → .../no-coverage-provider/.gitignore:1:coverage/
git ls-files → .coverage, test_results.txt, README.md, packages/… (no coverage/index.html)
```

The fixture's own `.gitignore` line `coverage/` — added to reproduce the "committed coverage database not ignored" sub-finding — also excludes the artifact the fixture is built around. `.coverage` (107-byte SQLite) and `test_results.txt` survive; the HTML report does not. A fresh clone cannot reproduce SC-32.

**Recommendation:** `developer` — force-add the artifact or rename the path so the fixture ignore rule does not swallow it, and add a fixture-integrity assertion that every file the fixture README names is tracked.

### D-3 — SC-21 has no implementing assertion

**Impact: Major · Intent: Unintended · Source: T, WS**

`qa-testing-standard.test.ts` names SC-21 in its `describe` block — `"developer — SC-19/SC-21/AC-7: five touchpoints, no duplicated procedure"` — but contains only three patterns (`qa-engineer` mentioned, `coverage_gate`, `SKIPPED(<reason>)`) plus the ordering check. SC-21's pass criterion is *"assertion detects touchpoints beyond the permitted five."* No assertion counts touchpoints, and none would fail if a sixth were added or a procedure were duplicated into `developer`.

The simplicity budget in AC-7 has two halves. The immutability half (rule 19) is enforced by a hash and holds. The minimality half is unenforced — its current satisfaction was verified by hand in this audit, not by the suite. The test's naming asserts coverage it does not have, which is itself a false-green.

**Recommendation:** `developer` — either implement a touchpoint count/allow-list assertion, or remove `SC-21` from the `describe` label and record it as `not automated` in the traceability matrix. Silent over-claiming is the worse of the two.

### D-4 — AC-10 update-preservation has no automated regression guard

**Impact: Major · Intent: Undetermined · Source: T, WS, CB**

SC-29 as planned: run `dev-tasks update` against a consumer-filled `TESTING.md`, compare, expect byte-for-byte preservation. As delivered, the `describe` was renamed to `"SC-29: consumer edits are detectable, not silently overwritten"` and asserts two weaker properties: that `sha256` diverges from `origin_sha256` after an edit, and that the path appears in `consumer_owned_paths`. **`update` is never invoked.** Preservation is inferred from registry membership.

Compounding it, the refinement's Testing Notes require *"Integration tests: install/update flow places the new agent and skills per profile, ships `TESTING.md` exactly once under `--profile all`, records it in the manifest, and preserves a consumer-filled `TESTING.md` on update."* The task list's Relevant Files repeats this for `test/integration/`. The only integration change delivered is the profile-pattern widening in `bootstrap-commands.test.ts` — no integration test asserts `TESTING.md` after a real CLI install. `grep -rn "TESTING.md" test/integration/` returns one comment and no assertion.

Task 1.36 records manual end-to-end verification through the built CLI across all five profiles, including the update-refuses-to-overwrite behavior, so the behavior is evidenced. It has no regression guard. Sub-task 1.38 (`test:integration`) is still unchecked.

**Recommendation:** `developer` — add an integration test that installs, edits `TESTING.md`, updates, and compares bytes. This also subsumes the missing RT-5 (D-6).

### D-5 — AC-5, AC-6, AC-11 recorded as PASS on prose plus inert fixtures

**Impact: Major · Intent: Undetermined · Source: WS, T, CB**

Sub-tasks 1.31, 1.32, and 1.37 record "PASS by fixture inspection", with 1.31 adding *"Live agent execution against the fixture is deferred to first real use."* The three fixture projects exist and encode the defect shapes. Nothing executes `qa-engineer` against them, and `vitest.config.ts` deliberately excludes `test/fixtures/**` from collection, so no automated path touches them.

These three ACs are *detection* criteria — their entire value is that the agent finds the defect. The evidence supports "the skill declares a check for each defect class", which is a necessary condition, not the criterion. The fixture README states the standard itself: *"A skill that reports 'pass' against any of these is defective… presence of a heading is not evidence."* The traceability matrix Gap 3 anticipated exactly this: *"if fixtures are skipped, those ACs revert to prose-only verification and the matrix status must be recorded as `blocked`, not `pass`."* The fixtures were built, so `blocked` is too strong — but `PASS` overstates it.

**Answering the implementer's question directly:** these should be recorded as **partially verified**, not PASS. Declared-check coverage is complete and auditable; runtime detection is unproven.

**Recommendation:** `product-engineer` — re-record 1.31 / 1.32 / 1.37 as `PARTIAL (declared-check coverage complete; runtime detection unverified)` and carry the runtime run into the follow-up issue as an explicit acceptance step. No code change needed.

### D-6 — Randomized tactics: one narrowed, five unimplemented, none dispositioned

**Impact: Minor · Intent: Intended (RT-4) / Unintended (disposition) · Source: T, WS**

RT-4 as planned: random profile sequences, 1–5 installs, 150 iterations, seed recorded. As delivered: exhaustive over 5 profiles × repeat counts {1,2,3}, plus one hand-picked mixed sequence of length 4 (`copilot → kiro → all → claude`).

The substitution is sound in kind — deterministic enumeration beats sampling and needs no seed — but the stated justification, that the space is exhaustible, holds only for the repeated-single-profile subspace, and not fully even there. Repeat counts 4 and 5 are uncovered. Sequences over 5 profiles of length ≤5 number 3,905; one is exercised. Practical risk is low: the merge logic is set-based and order-insensitive, which the mixed-sequence case does probe. The claim is what overreaches, not the engineering.

RT-1, RT-2, RT-3, RT-5, RT-6 have no implementation and no recorded disposition. RT-1/2/3/6 target agent-runtime behavior with no executable surface, so `N/A — no executable surface` is the honest disposition; it was simply never written down. **RT-5 is different** — the install/update/consumer-edit walk targets real TypeScript, and its absence is the same gap as D-4.

Environment for the record: macOS 26.5, Node v26.7.0, pnpm 10.11.0. No randomized failures occurred, so no seeds were captured and no triage was needed.

**Recommendation:** `developer` — extend the sweep to repeat counts 1–5 (five extra cases, no new machinery) and correct the in-file comment to describe what is actually enumerated. `product-engineer` — record RT-1/2/3/6 as `N/A — no executable surface` in the traceability matrix so the omission is deliberate rather than silent.

### D-7 — `developer` received two edits outside the five permitted touchpoints

**Impact: Minor · Intent: Intended · Source: CB, WS**

Commit `5f42ce8` reworded the Draft PR sequencing in `developer` (4 variants) and `implement` (3 variants) — create branch, first commit, *then* Draft PR — because the previous rule demanded a PR with zero commits, which GitHub rejects. AC-7 constrains `developer` to exactly five `qa-engineer` touchpoints, and the refinement lists `developer` as "touched, minimally". These are a sixth and seventh modification to the file, unrelated to the coverage gate.

Justified on the merits: it fixes a mechanically impossible instruction that this very run hit at sub-task 1.1, the commit message documents it fully, rule 19 was re-verified byte-identical afterwards, and the safety property is preserved. It is nonetheless unrequested scope inside an issue whose defining constraint is a simplicity budget, and it is not reflected in the refinement changelog.

**Recommendation:** `product-engineer` — record it in the refinement changelog as an intentional in-flight correction, or split it into its own issue retroactively. No revert.

### D-8 — `harness-defects` fixture contains no DOM or browser component

**Impact: Minor · Intent: Unintended · Source: CB**

Defect class 1 is "DOM components under a bare `node` environment". `vitest.config.ts` comments *"renders React components but declares a bare node environment"*, and the README tabulates it. The fixture's only source file is `src/format.ts` — two pure string-formatting functions, no JSX, no DOM API, no React dependency. There is nothing requiring a DOM, so `environment: "node"` is correct for this fixture as written. The defect is asserted in prose and absent in shape.

Defect classes 2–7 are genuinely reproduced and correctly cross-referenced (`.tool-versions` 3.14/24 vs CI 3.11/20; unrestored `vi.stubGlobal`; `expect(true).toBe(true)`; `@/*` in tsconfig with no `resolve.alias`; implicit `es-CL` locale). SC-14 requires all seven.

**Recommendation:** `developer` — add a trivial component file (or a `document.querySelector` call) so the environment mismatch is real. Small edit; without it SC-14 cannot pass against this fixture even once execution is wired.

### D-9 — Missing root file is skipped silently at install time

**Impact: Minor · Intent: Intended · Source: CB, T**

`core/distribution/install.ts`:

```ts
try { content = await readFile(sourcePath, "utf-8"); }
catch { /* A bundle that ships no root file is valid; skip silently. */ continue; }
```

Tested and deliberate (`"does not fail the install when the package ships no root file"`). The consequence: if a future `build-bundle.sh` change drops `TESTING.md`, every install succeeds with no `TESTING.md` and no warning. Static registration is asserted (`MANAGED_FILES`, `consumer_owned_paths`), but nothing asserts the built tarball contains the file — task 1.36 verified that manually. This sits in tension with the `docs/technical-guidelines.md` fail-explicit principle: a missing managed contract is closer to "incomplete install" than to "valid bundle". The widened `bootstrap-commands.test.ts` assertion also cannot catch it, since it only constrains the tags of entries that exist.

**Recommendation:** `developer` — emit a warning in the install result, and assert root-file presence in the bundle smoke test. Keep the non-fatal behavior.

### D-10 — No `stale` status for a filled-then-outdated `/TESTING.md`

**Impact: Minor · Intent: Unintended · Source: CB, WS**

`activity-test-standards` outputs status `created | filled | unfilled | present`. EC-4 requires the full lifecycle — absent → placeholder → filled → **stale** (a package added after filling) — with *"stale state reported as needing update, not silently accepted."* No `stale` status exists and no step compares the per-package table against the detected package inventory. Additionally, *"if it is present but **every** slot is still an unfilled marker, report status `unfilled`"* leaves partial fill (1 of 23) unclassified: not `unfilled` by that test, not meaningfully `filled`.

The risk mirrors the refinement's own stated concern — a contract trusted while describing a repo that has moved on.

**Recommendation:** `developer` — add a `stale` status plus a table-vs-inventory diff step, and relax `every` to `any` for the unfilled determination. Skill-only edit, no agent change.

### D-11 — Fixture README misstates its own line counts

**Impact: Minor · Intent: Unintended · Source: CB**

`no-coverage-provider/README.md` describes `packages/tiny-helper` as 12 LOC; `src/slug.ts` is 3 lines. SC-30's precondition specifies a 30-LOC helper. The 900-LOC service is accurate (899). The size-ranking property the fixture exists to exercise is unaffected — 899 outranks 3 as decisively as 899 outranks 12 — but a fixture whose README does not match its contents is weak evidence for a criterion about accurate size reporting.

**Recommendation:** `developer` — reconcile the README to the files, or pad the helper to the planned size.

---

## Edge-case and randomized outcomes

| Category                 | Planned                          | Observed                                                                                                    |
| ------------------------ | -------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Input domain             | EC-1, EC-2, EC-3                 | Declared in skills (no-manifest → `not applicable`; tests-no-source; source-no-tests top-ranked). Not executed. |
| State transitions        | EC-4, EC-5                       | EC-5 covered (`unfilled` status). **EC-4 stale transition absent** — D-10.                                    |
| Timing & concurrency     | EC-6                             | Not exercised. Remaining category `N/A` as planned.                                                          |
| Idempotency              | EC-7, EC-8                       | EC-7 covered by 15 install cases. EC-8 declared in skill failure modes, not executed.                        |
| Failure modes            | EC-9 – EC-12                     | EC-9 covered (crashed provider → `SKIPPED`, gate table). EC-10, EC-11 declared. EC-12 covered by unit test.  |
| Auth & permissions       | EC-13 – EC-15                    | EC-13, EC-14 explicit in the agent Authority section. EC-15 covered in the trap section.                     |
| Data boundaries          | EC-16, EC-17                     | EC-16 asserted on the comparator, not on real 149/150/151 files. EC-17 covered (generated-code exclusion).   |
| Resource exhaustion      | EC-18                            | Declared in both skills as bounded-partial-result. Not executed.                                             |
| API versioning           | EC-19, EC-20                     | EC-20 covered by unit test (legacy manifest preserved). EC-19 declared additively in the skill.              |
| Randomized RT-1 – RT-6   | 6 tactics, seeds recorded        | RT-4 narrowed (D-6); RT-1/2/3/5/6 unimplemented. No randomized failures, no seeds captured, no triage.       |

---

## Answers to the implementer's six review questions

1. **Rule 22 placement — acceptable, not drift.** AC-7 requires "exactly one new operating rule"; it says nothing about position. The numbered list is not a runtime sequence, and appending preserved rule 19's identifier, which AC-7 and the refinement Constraints both pin. Inserting mid-list would have renumbered the exact thing under protection. Runtime ordering lives in Execution Flow and Completion Gate, and both place the gate before the `verifier` audit. Correct call. The residual cost is that rule-list adjacency no longer reflects gate adjacency — a readability tradeoff, not a fidelity one.

2. **Two of three test corrections were mis-measurement fixes; all three are defensible.** The `does not grade (its|your) own work` widening tracks the prompt's second-person voice and preserves the substance; the requirement is that the separation is stated, not its grammar. Scoping the gate-ordering assertion to Execution Flow is the *correct* fix, not merely an acceptable one — comparing rule 18 against rule 22 measured document position, which is not the ordering AC-7 constrains. Case-insensitivity for the Claude command variant is likewise a voice difference, not a substance change. None weakened an assertion. Note, though, that all three sit inside the broader class described in **D-1**: they remain phrase-presence checks, so "fixed" here means "now measures the intended text", not "now measures the intended behavior".

3. **Widening the pre-existing integration assertion is justified.** `root` is a genuinely new, legitimate member of the profile domain; the original `/^(copilot|claude|kiro)$/` encoded a closed-world assumption that this issue deliberately opens. More importantly, the second change is a net strengthening: `toBe("kiro")` became `toMatch(/^(kiro|root)$/)` **plus** a set-equality check that non-root entries are exactly `{kiro}` — which pins the property that actually mattered (`--profile kiro` must not pull in another platform's files) more tightly than the original did. One residual gap: neither form asserts a root entry is *present*, so the silent-skip path in **D-9** would pass unnoticed here.

4. **AC-5, AC-6, AC-11 should be recorded as partially verified.** See **D-5**. Fixtures plus declared checks establish that every required check exists and is auditable — genuinely more than prose alone. They do not establish detection, which is what those three ACs are about. `PARTIAL` is the honest record; `blocked` would be too strong given the fixtures were built.

5. **RT-4 substitution is sound in kind, overstated in claim.** See **D-6**. Deterministic enumeration is the better instrument here. But repeat counts 4–5 are missing and the sequence space is not exhausted, so the in-file rationale should be corrected to describe what is enumerated. Low practical risk — the merge logic is set-based.

6. **Yes — 20 of 22 remaining assertions can pass without exercising their requirement.** See **D-1**, with the probe result. This is the most consequential finding in the audit, and it is the same failure mode as the two vacuous `ROOT_FILES` assertions the implementer caught, one level up: not empty-collection vacuity, but semantic vacuity. `never reports unknown` → `/unknown/i` is the clearest instance — it asserts the presence of the token whose emission the requirement forbids.

7. **AC-4 placeholder honesty confirmed.** 23 `<!-- unfilled -->` markers; no percentage appears anywhere in the file; no runner, environment, threshold, baseline, or fixture path is asserted. The concrete content is confined to what AC-3 and AC-4 mandate as framework-level constants: the fixed Layer 1–4 taxonomy, the canonical JS/TS script table (explicitly "a JS/TS convention, not a cross-language requirement", with a separate non-JS command table), and the five mandatory security-negative cases. Still usable as a contract: it carries the per-package table, the non-JS slot, the gate-reachability slots, the Layer-1/Layer-2 `must not` boundaries with an escalation rule, and `status: placeholder` in frontmatter as a machine-readable unfilled signal. Two nits: a stray blank line inside the opening HTML comment, and nothing asserts that `status:` flips away from `placeholder` on fill.

---

## Process observations (not AC drift)

- **`coverage_gate` is not recorded for this issue's own execution.** `implement` condition 6 and `developer` rule 22 — both introduced by this PR — require a `qa-engineer` pass before the `verifier` audit, with `coverage_gate` recorded as `PASS`, `FAIL`, or `SKIPPED(<reason>)`. No such value appears in the task list or any `/workstream` artifact, and this audit ran without a gap report to consume as test evidence. `developer` should run `qa-engineer` and record the value before marking PR #129 ready; omission is the one state `planner` treats as incomplete.
- **Task list is 37 of 39.** 1.38 (`test:unit` + `test:integration` + `validate` + Markdown format check) and 1.39 (four follow-up issues cross-referenced) remain open. `test:unit` re-confirmed green during this audit; `test:integration` is unverified here.
- **Traceability matrix is unpopulated.** `Observed Result` and `Status` columns are still empty by Design Mode convention. This report supplies the values; the matrix should be updated to match.
- **`/workstream` is gitignored**, so the four planning artifacts and this report are local-only. The GitHub issue comment is therefore the durable record of this audit — its content, not a link, must carry the verdict.

---

## Recommendations

| ID       | Impact | Owner              | Action                                                                                     |
| -------- | ------ | ------------------ | ------------------------------------------------------------------------------------------ |
| **D-1**  | Major  | `developer`        | Replace token-presence patterns with negation-sensitive phrase assertions                   |
| **D-2**  | Major  | `developer`        | Track the SC-32 coverage artifact; assert fixture-README files are all tracked              |
| **D-3**  | Major  | `developer`        | Implement a touchpoint-count assertion, or drop `SC-21` from the label and record it unautomated |
| **D-4**  | Major  | `developer`        | Add an integration test for install → consumer edit → `update` → byte compare               |
| **D-5**  | Major  | `product-engineer` | Re-record 1.31 / 1.32 / 1.37 as `PARTIAL`; carry runtime detection into the follow-up issue  |
| **D-6**  | Minor  | `developer` + `product-engineer` | Extend the sweep to repeats 1–5 and correct the comment; disposition RT-1/2/3/6 as `N/A` |
| **D-7**  | Minor  | `product-engineer` | Record the Draft PR sequencing fix in the refinement changelog                               |
| **D-8**  | Minor  | `developer`        | Give the `harness-defects` fixture an actual DOM-requiring source file                       |
| **D-9**  | Minor  | `developer`        | Warn on a missing root file; assert bundle presence in the smoke test                        |
| **D-10** | Minor  | `developer`        | Add a `stale` status and a table-vs-inventory diff; relax `every` to `any`                    |
| **D-11** | Minor  | `developer`        | Reconcile the fixture README line counts with the files                                      |

No recommendation blocks PR #129. `verifier` reports findings only and applies none of them; write-back into the task list, GitHub checklists, or the refinement changelog is owned by `product-engineer` via `activity-drift-reconciliation`.

---

## Output contract

| Field                    | Value                                                                                                              |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| Mode / phase             | `audit` / Phase 4 complete                                                                                          |
| Source artifact          | `workstream/issue-123-qa-agent-and-testing-standard-refinement.md` (v1.2, AC-1 – AC-11)                             |
| Task list                | `workstream/tasks-issue-123-qa-agent-and-testing-standard.md` (37 / 39)                                             |
| Prior design artifacts   | `workstream/test-plan-123.md` (v1.0), `workstream/traceability-matrix-123.md` (v1.0)                                |
| PR / branch              | PR #129 (draft), `issue/123-qa-agent-and-testing-standard`, 10 commits `713541b…2a292de`                            |
| Output file              | `workstream/fidelity-report-123.md`                                                                                 |
| GitHub issue             | https://github.com/llipe/dev-tasks/issues/123                                                                       |
| AC coverage status       | **covered** — 11 / 11 addressed; 8 Pass, 3 Pass-with-drift; 0 Fail; 0 uncovered                                     |
| Fidelity verdict         | **High**                                                                                                            |
| Highest drift impact     | **Major** (5 Major, 6 Minor)                                                                                        |
| Blocking gaps            | **None.** Drift is non-blocking and does not replace `test` / `lint` / `format:check` / `typecheck` / `audit`.       |
| Environment              | macOS 26.5, Node v26.7.0, pnpm 10.11.0                                                                              |
