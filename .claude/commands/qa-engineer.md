---
description: "Establish the testing standard, author missing tests, and report coverage and structural gaps, via the qa-engineer subagent."
argument-hint: "[package, path, or diff — blank for the whole repository]"
---

Delegate to the **`qa-engineer` subagent** (via the Task tool) for a quality pass.

**Target scope:** $ARGUMENTS

The subagent runs one procedure, in this order:

1. **Standards check** — establishes or refreshes `/TESTING.md`, reports harness defects (wrong test environment, missing config, path-alias mismatch, unrestored global stubs, runtime version mismatch across local/CI/production, missing locale and timezone policy, false-green placeholders), and verifies script reachability: every package with tests must be reachable from the aggregate test command, and the CI and deploy gates must invoke it.
2. **Author or fill missing tests** — writes tests for layers the project lacks a harness for, respecting the layer boundaries in `/TESTING.md`. Security-negative tests are mandatory for every auth path: invalid signature, expired credential, wrong issuer or audience, tampered claims.
3. **Coverage and gap report** — measures coverage when a provider exists; when none does, emits `coverage_gate: SKIPPED(<reason>)` and still produces a risk-ranked structural gap inventory.

The subagent will **not**:

- edit application source, non-test config, or dependencies
- install a missing coverage provider — it reports the absence
- report a pass for anything it could not measure
- audit its own output; `verifier` owns the fidelity audit

Invoked automatically by `developer` at the completion gate, before the `verifier` audit. Use this command for a standalone pass — bootstrapping `/TESTING.md`, backfilling tests on legacy code, or auditing coverage outside a feature.
