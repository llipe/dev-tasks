# ADR-003: `qa-engineer` coverage gate in the documented golden path

## Status

Accepted

## Context

Issue #123 introduced a `qa-engineer` coverage gate as a normative step of the execution workflow — `developer` rule 22 and `implement` completion condition 6 both require it and both require `coverage_gate` to be recorded — along with `/TESTING.md` as the per-project testing contract that declares the layer taxonomy, per-package runners, thresholds, fixture strategy, and mandatory security-negative cases.

`docs/technical-guidelines.md` described neither. Its § Development Workflow listed the golden path from refinement through merge without the coverage gate, and its § Testing Strategy defined a coverage-and-confidence policy without naming where a project records its own instantiation of that policy.

Because the constitution is the stated source of truth for engineering policy in this repository, its silence was not neutral: it contradicted rules that agents already enforce at the completion gate. A reader following the documented workflow would arrive at PR readiness having skipped a step the runtime treats as mandatory.

## Decision

Reflect the coverage gate in the constitution, minimally and in the document's existing normative voice.

- § Development Workflow gains an explicit step: run the `qa-engineer` coverage gate and record `coverage_gate` as `PASS`, `FAIL`, or `SKIPPED(<reason>)`. Subsequent steps are renumbered.
- The gate is positioned **after** the broader quality/mutation/acceptance checks and **before** the independent `verifier` fidelity audit, so the audit can consume the coverage and structural gap report as test evidence rather than re-deriving it.
- § Testing Strategy names `/TESTING.md` as the per-project instantiation of the coverage-and-confidence policy that section already describes, and restates that an unfilled placeholder means "no standard established", never permission.

No other section is restructured. The constitution continues to define required outcomes rather than prescribing a specific coverage tool.

## Alternatives Considered

- **Leave the constitution silent and rely on the agent rules alone** — zero documentation churn. Rejected: the constitution is the stated source of truth for engineering policy, so a contradiction between it and the enforced agent rules is exactly how drift becomes permanent. The next reader has no way to tell which document is stale.
- **Make the gate hard-blocking** — strongest guarantee that coverage is measured. Rejected: many consumer projects have no coverage provider installed. A hard block would either stall those projects at the completion gate or pressure the agent into reporting a fabricated pass, which is worse than an honest `SKIPPED(<reason>)`.
- **Fold coverage measurement into the existing `verifier` audit** — one fewer gate to sequence. Rejected: `verifier` owns independent fidelity auditing, and the separation of duties matters here — the agent that authors tests must not be the agent that grades them. Merging the two would let a single agent both produce and certify its own test evidence.

## Consequences

Positive:

- Every consumer project now has a declared place for its testing contract, so `/TESTING.md` is discoverable from the constitution rather than only from agent definitions.
- The documented golden path matches the rules the runtime enforces, so `planner` and `developer` completion conditions are traceable to a constitutional step.
- Positioning the gate before the fidelity audit gives the audit a concrete evidence artifact to consume.

Negative / bounded:

- The gate is skippable as `SKIPPED(<reason>)` with a non-empty reason. `FAIL` and `SKIPPED` do not block completion — only **omission** of the field does, which `planner` treats as incomplete. This is a deliberate trade of enforcement strength for honest reporting.
- Coverage measurement is not required where no provider is installed, but risk-ranked structural gap analysis still runs, so absence of tooling is never reported as absence of gaps.
- One more recorded field per completion cycle, and one more sequencing constraint between `qa-engineer` and `verifier`.

Follow-up:

- Revisit hard-blocking thresholds per project once `/TESTING.md` is filled and a coverage baseline exists, per the baseline/no-regression policy already in § Testing Strategy.

## Related

- Issue: #123
- Docs updated: `docs/technical-guidelines.md` (§ Testing Strategy, § Development Workflow, Changelog v1.1)
- Contract: `/TESTING.md`
- Agents: `qa-engineer`, `developer`, `planner`, `verifier`
