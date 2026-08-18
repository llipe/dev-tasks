---
name: activity-coverage-gap-analysis
description: "Measure coverage against a baseline when a provider exists, and run risk-ranked structural gap analysis when none does. Validates existing coverage artifacts before trusting them. Use when reporting test coverage and gaps."
---

# Activity: Coverage and Gap Analysis

Report what is tested, what is not, and what that means — with or without a coverage provider installed. Invoked by the `qa-engineer` agent as step 3 of its procedure.

---

> **RFC 2119 Notice:** The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHALL**, **SHALL NOT**, **SHOULD**, **SHOULD NOT**, **RECOMMENDED**, **MAY**, and **OPTIONAL** in this document are to be interpreted as described in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119).

## Goal

Produce a gap report that is honest about its own limits. Two paths exist. The **structural path always runs**; the measured path runs additionally when tooling permits.

You **MUST NOT** return `unknown`, `unable to determine`, or an empty report. Absence of tooling is not absence of gaps.

## Path A — Measured coverage

Runs only when a coverage provider is installed for the package.

1. Run the project's coverage command. Do not install anything to enable it.
2. Compare against the recorded baseline in `/TESTING.md`.
3. Report per package: measured value, baseline, delta, and whether the threshold policy is met.
4. Map uncovered regions to acceptance criteria where a criterion list is available.

### Gate value

| Condition                                       | `coverage_gate`     |
| ----------------------------------------------- | ------------------- |
| Measured, policy satisfied                      | `PASS`              |
| Measured, policy violated or baseline regressed | `FAIL`              |
| No provider installed                           | `SKIPPED(<reason>)` |
| Provider present but the run failed             | `SKIPPED(<reason>)` |
| User declined measurement                       | `SKIPPED(<reason>)` |

The reason string is **REQUIRED** and **MUST** be non-empty — `SKIPPED()` and a bare `SKIPPED` are both invalid. That requirement is what prevents a silent skip.

You **MUST NOT** emit `PASS` for coverage that was not measured. A crashed provider is `SKIPPED`, never `PASS`.

## Path B — Structural gap analysis (always runs)

Requires no coverage provider. This path is what makes a repository with zero coverage tooling still analyzable.

1. **Enumerate untested surfaces.** For every source file, determine whether any test file references it or its exported symbols. List files and exported symbols with no corresponding test.
2. **Report source-to-test size ratio** per package, in lines. A package with 1,600 lines of source and 50 lines of tests is reported as such.
3. **Flag disproportionate surfaces.** A module of 800 lines exercised by one test case has symbolic coverage, not coverage. Report it alongside wholly untested files.
4. **Rank by size and risk**, not alphabetically and not flat. A large untested service outranks a small untested helper. Risk weighting **SHOULD** consider: handles authentication or authorization; touches money or persistent state; is reachable from an external entry point; has no types.
5. **Exclude generated and vendored code**, and state the exclusions. A ranking topped by a generated artifact discredits the report.

### Divide-by-zero and boundary handling

| Situation                     | Required behavior                                                     |
| ----------------------------- | --------------------------------------------------------------------- |
| Package with tests, no source | Report the ratio without error; do not list it as an untested gap.    |
| Package with source, no tests | Rank at or near the top; this is the highest-signal gap.              |
| Package with neither          | Report as empty; exclude from ranking.                                |
| One very large generated file | Exclude and state the exclusion.                                      |
| Very large workspace          | Complete, or return a bounded partial result naming what was skipped. |

## Artifact Validation

Existing coverage artifacts **MUST** be validated before being used as evidence. An unvalidated artifact is worse than no artifact, because it reports a number that reviewers will trust.

Check each artifact for:

| Check               | Finding condition                                                                                                                                                      |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Staleness**       | Generated before the most recent change to the code it describes, or its test count understates reality.                                                               |
| **Scope narrowing** | Measures a narrower scope than the package it appears to describe — for example a coverage command hard-coded to one module while presented as the package's coverage. |
| **Committed state** | A coverage database or report is committed to version control and not ignored.                                                                                         |

A stale or scope-narrowed artifact is reported as **misleading** and **MUST NOT** be used as evidence or carried forward as the package's coverage value.

### Worked example

A package ships an HTML report reading 46.58%, dated three months ago, whose command is hard-coded to one of eight modules. A committed results file lists 18 tests where 112 now exist.

Correct output: the 46.58% figure is **not** reported as the package's coverage. Report two findings — the artifact is stale, and its scope is one eighth of what it appears to cover — plus the structural gap inventory for the seven unmeasured modules, and a note that the committed artifacts are untracked by `.gitignore`.

## Coverage Is Not Confidence

State this in the report when a high percentage coexists with weak assertions. A suite that mocks its data layer everywhere can reach a high percentage while remaining blind to query defects. Where you observe that pattern, report it as a limitation of the measurement, not as a passing grade.

## Output

- `coverage_gate`: `PASS` | `FAIL` | `SKIPPED(<reason>)`
- Measured coverage per package with baseline and delta, when Path A ran
- Reason for skipping measurement, when it did not
- Ranked structural gap inventory, largest and highest-risk first
- Source-to-test ratio per package
- Disproportionately tested surfaces
- Misleading artifacts, with the reason each is untrusted
- Exclusions applied
- What was not analyzed, and why

## Final Instructions

1. You **MUST** run the structural path on every invocation, including when measurement is skipped.
2. You **MUST NOT** return `unknown` or an empty report.
3. You **MUST NOT** emit `PASS` for unmeasured coverage.
4. You **MUST** include a non-empty reason with every `SKIPPED`.
5. You **MUST** rank gaps by size and risk rather than listing them flat.
6. You **MUST** validate coverage artifacts before trusting them, and report stale or scope-narrowed ones as misleading.
7. You **MUST NOT** install a coverage provider — report its absence.
