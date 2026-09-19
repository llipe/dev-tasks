# ADR-007: Retire the multi-repo context layer (`dt`)

## Status

Accepted

## Context

`dev-tasks` shipped two independent binaries: `dev-tasks` (harness bootstrap and distribution — install, update, status, pin, doctor, migrate) and `dt` (a multi-repo context CLI covering extraction, catalog aggregation, context assembly, and cross-service contract verification, specified in the now-deleted `docs/requirements/prd-multi-repo-context.md`).

`dt` and its supporting layer — `bin/dt.ts`, `adapters/`, `core/{catalog,context,extract,scope,verify,providers}`, `schemas/`, `templates/meta-repo/`, 72 dedicated test files, and the `architecture-change`/cross-repo-partitioning rules in `AGENTS.md` — had no adopted consumer. `workstream/decisions-shared-understanding.md` records the supporting analysis: the layer added the majority of the repository's surface area (dependencies, exit codes, prompt-tree content, generated-file rules) in service of a capability nobody was using, which works directly against the repository's own `SIMPLICITY.md` contract (burden of proof is on adding, not on removing).

Carrying unused code has an ongoing cost independent of whether it is ever exercised: every `core/` and prompt-tree change has to reason about a second binary's invariants, every dependency in that surface is a dependency the `audit` gate has to clear, and every contributor reading `AGENTS.md` or `docs/system-overview.md` has to hold a capability that does nothing for them.

## Decision

Retire the `dt` binary and the entire multi-repo context layer in full, via `docs/requirements/prd-shared-understanding-refinement.md` Phase 0.

Removed in full:

- `bin/dt.ts`, `adapters/` (entire directory), `core/{catalog,context,extract,scope,verify,providers}`, `schemas/`, `templates/meta-repo/`.
- The 72 `dt`-only test files and their fixtures (`test/fixtures/{catalog,context,extract,schemas,verify}`).
- `templates/bitbucket-pipelines.yml` and `.claude/skills/activity-contract-validation/` (and its `.github`/`.kiro` mirrors) — entirely `dt`-scoped.
- The `## Task Types` (`architecture-change`) and `## Cross-Repo Partitioning (RF-63)` sections of `AGENTS.md` and `AGENTS.md.template`, and every prompt-tree passage across `.claude/`, `.github/`, and `.kiro/` that referenced the meta-repo, cross-repo partitioning, or `dt` invocation.
- `docs/dt-user-manual.md`, `docs/data-model.md`, `docs/artifact-formats.md`, `docs/requirements/prd-multi-repo-context.md`.

Kept in full: the `dev-tasks` bootstrap binary, `bin/parse-args.ts` (rewritten to drop the `dt`-only flags `metaRepo`, `strategy`, `interactive`, `dbUrl`), `core/distribution/*`, `core/reconcile.ts` (a generic three-way reconciliation utility, reused as-is by `core/distribution/update.ts`), and `core/exit-codes.ts` (rewritten to the 5-code contract `Success:0, GeneralError:1, InvalidUsage:2, DependencyError:11, ReconciliationConflict:14` — `DependencyError` is promoted from a deprecated `dt`-era alias to the primary name for value `11`, preserving the numeric contract `dev-tasks doctor` already depends on).

A permanent regression guard, `test/unit/dt-retirement-absence.test.ts`, scans the source and prompt trees for word-boundary-anchored `dt`/multi-repo/meta-repo patterns, with an explicit `EXEMPT_FILES` allowlist for legitimate self-references (this ADR, the absence guard's own pattern literals, and test files that assert the retirement by name).

Restore path: tag `v0.13.0` (commit `0a6f35e`) is the last release that shipped the full layer. Restoring it means reverting Phase 0's commits on top of that tag, not cherry-picking individual files — the layer's modules were mutually dependent (`core/catalog` on `core/context`, both on `schemas/`, the CLI on `adapters/`).

## Alternatives Considered

- **Keep as-is.** Rejected: ongoing maintenance cost (dependency surface, audit gate, prompt-tree content, contributor comprehension load) with zero adoption to offset it. `SIMPLICITY.md`'s burden-of-proof rule places the cost of justifying continued existence on keeping the code, not on removing it.
- **Freeze (stop developing, keep shipping as-is).** Rejected: a frozen, untested-by-use surface accumulates silent bit-rot (e.g., the `RateLimit`/`DependencyError` alias drift ADR-002 already had to correct) while still carrying its full dependency and audit-gate weight. Freezing defers the cost without reducing it.
- **Split to its own repository.** Rejected: no consumer exists to justify a second repository's maintenance overhead (its own CI, release process, and versioning), and the layer's internal modules are too interdependent to extract cleanly without first proving there is a user for the extracted result.
- **Remove.** Selected. The layer has no adopted consumer, `git` history preserves it completely, and a tagged release (`v0.13.0`) gives an exact, reproducible restore point if a consumer ever materializes.

## Consequences

Positive:

- Removes the majority of the repository's source surface, dependency count (`ajv`, `pg`, `fast-uri`, `express`, `@types/express`, `eslint-plugin-import-x` dropped), and prompt-tree content that no active workflow exercised.
- `core/exit-codes.ts` collapses to a 5-code contract with no deprecated aliases, closing the follow-up ADR-002 flagged ("remove all `@deprecated` aliases in the next major release").
- One binary, one CLI surface, one set of prompt-tree conventions to keep at parity across `.claude/`, `.github/`, `.kiro/`.

Negative:

- Any future multi-repo context need starts from the `v0.13.0` restore point rather than an incrementally maintained current implementation; the restored code will need re-validation against whatever the codebase has become by then.
- `test/unit/dependency-direction.test.ts` (asserts `core/` does not import `adapters/`) is now vacuously always-passing since `adapters/` no longer exists. Left as-is; out of Phase 0 scope, tracked as a known follow-up rather than fixed inline.

Follow-up:

- If a multi-repo context need re-emerges, start from `v0.13.0` and re-run the PRD/spec/stories cycle against the current codebase rather than reverting Phase 0's commits directly.
- `test/unit/dependency-direction.test.ts` should eventually be retired or repurposed; noted here rather than actioned, per the smallest-change-that-closes-the-task rule.

## Related

- Requirements: `docs/requirements/prd-shared-understanding-refinement.md` (Phase 0), `docs/requirements/prd-multi-repo-context.md` (deleted; restorable at tag `v0.13.0`)
- Workstream: `workstream/decisions-shared-understanding.md`, `workstream/specification-shared-understanding-phase-0.md`, `workstream/user-stories-shared-understanding-phase-0.md`, `workstream/tasks-shared-understanding-phase-0-plan.md`
- Docs updated: `docs/system-overview.md`, `docs/product-context.md`, `docs/README.md`, `docs/workflow-chains.md`, `docs/dev-tasks-user-manual.md`, `TESTING.md`, `README.md`, `AGENTS.md`, `AGENTS.md.template`, `CHANGELOG.md`
- Code: `bin/dt.ts` (removed), `adapters/` (removed), `core/{catalog,context,extract,scope,verify,providers}` (removed), `schemas/` (removed), `core/exit-codes.ts` (rewritten), `bin/parse-args.ts` (rewritten)
- Tests: `test/unit/dt-retirement-absence.test.ts`, `test/unit/exit-codes.test.ts`, `test/integration/binaries.test.ts`, `test/unit/cli-binaries.test.ts`
