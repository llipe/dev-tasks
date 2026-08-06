# Implementation Plan — Multi-Repo Context (Phase 4: Scoping + Phase 5: Integration + Phase 6: Verification)

## Relevant Files

- `core/scope/scoping.ts` - LLM scoping orchestrator (prompt assembly, schema validation, retry)
- `core/scope/prompt.ts` - Scoping prompt template and input assembler
- `core/scope/calibration.ts` - Per-session calibration data recording
- `core/scope/closure.ts` - Graph closure expansion with source tagging
- `core/scope/gate.ts` - Gate rules G1-G7 with abort/review_flags
- `core/scope/partition.ts` - Partition proposal (producer-before-consumer ordering)
- `core/context/init.ts` - Full dt init orchestration (extends manual-scope from S-017)
- `core/verify/contract-diff.ts` - Breaking-change detection orchestrator
- `core/verify/asyncapi-diff.ts` - Custom AsyncAPI comparator
- `core/verify/impact.ts` - Affected consumer analysis
- `core/verify/drift.ts` - Docs/code recency heuristic
- `core/providers/tracker.ts` - Tracker provider interface stub
- `schemas/scope-output.schema.json` - Scope output schema (created in S-010)
- `adapters/cli/scope.ts` - CLI handler for dt scope commands
- `adapters/cli/init-full.ts` - CLI handler for dt init --task
- `adapters/cli/verify.ts` - CLI handler for dt verify commands
- `bin/dt.ts` - Runtime binary (routing updates)
- `.kiro/skills/activity-init/SKILL.md` - Rewritten init skill (Kiro tree)
- `.github/prompts/activity-init.md` - Rewritten init skill (GitHub tree)
- `.claude/commands/activity-init.md` - Rewritten init skill (Claude tree)
- `AGENTS.md` - Agent contracts (architecture-change task type)
- `test/fixtures/scope/*` - Scope fixtures (candidates, LLM responses, gate scenarios)
- `test/fixtures/verify/*` - Verify fixtures (contract diffs, impact catalogs)

## Tasks

### Phase 4 — Scoping

- [x] 1.0 Implement Story S-018 - https://github.com/llipe/dev-tasks/issues/52: LLM scoping step with schema-validated output and repair retry

  > LLM receives only lexical candidates; returns schema-validated scope JSON with one repair retry. Bounded, explainable, no hallucinated components.

  - [x] 1.1 Implement `core/scope/prompt.ts` — scoping prompt template: system instructions (choose only from candidates, `low` when ambiguous, list unmapped in `unresolved`), input slots for task text, candidates (from S-013 resolve), flows, and domains
  - [x] 1.2 Implement scoping input assembler: accept task text + resolve results → build the constrained input containing only `task`, `candidates`, `flows`, `domains` (spec §7.1); never include the full catalog
  - [x] 1.3 Implement schema validation: validate LLM output against `scope-output.schema.json` (required: `primary` 1-6, `secondary` ≤8, `contracts_crossed`, `confidence`, `unresolved`, `rationale` ≤600 chars; optional: `flow`)
  - [x] 1.4 Implement post-schema id validation: reject any component id not present in the candidates list or full index; if invalid ids found, trigger repair
  - [x] 1.5 Implement single repair retry: on first validation failure, send the error context back to the LLM with a repair prompt; validate the second response; second failure → exit 10
  - [x] 1.6 Implement `core/scope/calibration.ts` — record calibration data per session: proposed scope (primary/secondary ids), confidence, unresolved, timestamp, task text hash; write to `.dev-tasks/calibration/` for later precision/recall analysis
  - [x] 1.7 Implement LLM provider abstraction: define interface for the scoping call (input → JSON string); support mock provider for testing
  - [x] 1.8 Wire `dt scope --task "<text>" --candidates <resolve-output> [--json]` CLI command (or integrate into init pipeline)
  - [x] 1.9 Write unit tests: schema validation (valid/invalid outputs); invented-id rejection; retry logic (first fail → repair → pass; second fail → exit 10); calibration record shape; input assembler excludes full catalog
  - [x] 1.10 Write integration tests: mocked LLM returning valid JSON → pass; invalid JSON (bad schema) → repair → pass; second-invalid → exit 10; non-JSON output → repair attempt
  - [x] 1.11 Write edge-case tests: empty candidates upstream (no resolve results); id present in index but not in candidates → rejected; overlong rationale (>600 chars) → schema error; response with extra fields → schema strictness
  - [x] 1.12 Verify Acceptance Criterion: scoping input contains only task, candidates, flows, domains
  - [x] 1.13 Verify Acceptance Criterion: output validates against scope-output.schema.json with correct constraints
  - [x] 1.14 Verify Acceptance Criterion: post-schema rejects invented ids; single repair retry; second failure → exit 10
  - [x] 1.15 Verify Acceptance Criterion: prompt rules enforced (only candidates, low when ambiguous, unresolved list)
  - [x] 1.16 Verify Acceptance Criterion: calibration data recorded per session
  - [x] 1.17 Run Tests: `pnpm run test:unit && pnpm run test:integration && pnpm run validate`

- [ ] 2.0 Implement Story S-019 - https://github.com/llipe/dev-tasks/issues/55: Graph closure and dt scope gate with partition proposal

  > Scope expanded by graph closure, gated (G1-G7). Over-broad or ambiguous scopes abort with a partition proposal.

  - [x] 2.1 Implement `core/scope/closure.ts` — graph closure expansion: add `contracts_crossed` consumers and flow neighbors to `secondary`; deduplicate (primary wins over secondary); record `scope.source` per component (`llm` or `closure`)
  - [x] 2.2 Implement deduplication logic: if a component appears in both primary (from LLM) and closure (from graph), primary wins; track source attribution
  - [x] 2.3 Implement `core/scope/gate.ts` — gate rules:
    - [x] 2.3.1 G1: total components (primary + secondary) > `--max-components` (default 4) → abort exit 7 with partition proposal
    - [x] 2.3.2 G2: `confidence: low` in scope output → abort exit 7
    - [x] 2.3.3 G3: non-empty `unresolved` list → abort exit 7
    - [x] 2.3.4 G4: component in scope without `component.json` in catalog → abort exit 7
    - [x] 2.3.5 G5: LLM-selected component absent from candidates+closure (RF-40) → continue with `review_flags`
    - [x] 2.3.6 G6: scope spans >2 domains → continue with `review_flags`
    - [x] 2.3.7 G7: boundary contract has `payload_confidence: low` (RF-41) → continue with `review_flags`
  - [x] 2.4 Implement `core/scope/partition.ts` — partition proposal for G1 abort: group components by domain/boundary; order producer-before-consumers; emit as a suggested task split
  - [x] 2.5 Implement `--max-components` configuration (default 4); wire through CLI
  - [x] 2.6 Wire `dt scope gate --scope <scope.json> [--max-components 4] [--json]` CLI command; output includes `{ passed: bool, abort_reason?, review_flags[], partition_proposal? }`
  - [x] 2.7 Write unit tests: closure dedup + source tagging; each gate rule G1-G7 in isolation; partition proposal ordering
  - [x] 2.8 Write integration tests: scope fixtures triggering each gate outcome (G1 abort with proposal; G2-G4 aborts; G5-G7 continue with flags)
  - [x] 2.9 Write edge-case tests: exactly at max-components limit (no abort); multi-domain but within component limit; low-payload contract present (flag, no abort); LLM-only component not in closure
  - [x] 2.10 Verify Acceptance Criterion: closure adds consumers/flow neighbors to secondary; dedupes; records source
  - [x] 2.11 Verify Acceptance Criterion: G1 aborts with partition proposal; exit 7
  - [x] 2.12 Verify Acceptance Criterion: G2/G3/G4 abort
  - [x] 2.13 Verify Acceptance Criterion: G5/G6/G7 continue with review_flags
  - [x] 2.14 Verify Acceptance Criterion: --max-components configurable (default 4)
  - [x] 2.15 Run Tests: `pnpm run test:unit && pnpm run test:integration && pnpm run validate`

- [x] 3.0 Implement Story S-020 - https://github.com/llipe/dev-tasks/issues/54: Full dt init orchestration (candidates → scope → closure → gate → bundle)

  > `dt init --task "<text>"` runs the full pipeline end-to-end. Wires deterministic and LLM steps into a single command.

  - [x] 3.1 Extend `core/context/init.ts` — add the `--task` path alongside the existing `--components` path (S-017): pin → candidates (resolve from S-013) → LLM scope (S-018) → closure (S-019) → gate (S-019) → fetch (S-015) → assemble (S-016) → session lock
  - [x] 3.2 Implement exit-code mapping for each failure point in the pipeline: 9 (stale index), 11 (no candidates from resolve), 10 (invalid scope after retry), 12 (unknown component post-closure), 7 (gate abort), 6 (budget overflow)
  - [x] 3.3 Implement short-circuit behavior: on gate abort (exit 7), skip fetch/assemble entirely; on stale index (exit 9), skip everything after pin
  - [x] 3.4 Surface `review_flags` from the gate into the emitted result object and into `session.lock.json`
  - [x] 3.5 Wire CLI options: `--task "<text>"`, `--budget <tokens>`, `--max-components <n>`, `--max-index-age <minutes>`, `--flow <flow-id>`, `--out <dir>`, `--json`
  - [x] 3.6 Implement `--json` output shape: `{ session: {...}, bundle: {...}, scope: {...}, review_flags: [...] }`
  - [x] 3.7 Implement `--flow` option: pre-filter candidates and scope to components participating in the specified flow
  - [x] 3.8 Write unit tests: option plumbing (each flag reaches the right module); result shape validation; short-circuit on abort
  - [x] 3.9 Write integration tests: end-to-end happy path over fixtures (mocked LLM) → session lock + bundle emitted; one test per failure exit code (9, 11, 10, 12, 7, 6)
  - [x] 3.10 Write edge-case tests: gate abort mid-pipeline (no fetch occurs); stale index short-circuits immediately; empty candidates → exit 11; --flow with nonexistent flow → exit 2
  - [x] 3.11 Verify Acceptance Criterion: dt init --task runs the full pipeline per spec §8.4
  - [x] 3.12 Verify Acceptance Criterion: each failure maps to its exit code
  - [x] 3.13 Verify Acceptance Criterion: review_flags surfaced in result and session.lock.json
  - [x] 3.14 Verify Acceptance Criterion: --budget, --max-components, --max-index-age, --flow, --out honored
  - [x] 3.15 Verify Acceptance Criterion: --json emits { session, bundle, scope, review_flags }
  - [x] 3.16 Run Tests: `pnpm run test:unit && pnpm run test:integration && pnpm run validate`

### Phase 5 — product-engineer Integration

- [x] 4.0 Implement Story S-021 - https://github.com/llipe/dev-tasks/issues/56: Rewrite the init skill with mono/multi/greenfield mode detection

  > The init skill detects mono-repo, multi-repo, and undocumented-repo modes. Multi-repo routes through `dt`; the skill never walks repos directly.

  - [x] 4.1 Implement mode-detection logic in the init skill: check for `component.json` at repo root → multi-repo mode; else check `/docs` present → mono-repo (current flow); else → undocumented/greenfield mode
  - [x] 4.2 Document multi-repo mode behavior: invoke `dt init --task --json`; handle exit codes:
    - Exit 7 (partition proposal) → present the proposal to the user, stop
    - Exit 9 (stale catalog) → inform user, stop
    - Exit 0 → load bundle files in numeric order, present `review_flags` before planning
  - [x] 4.3 Document undocumented/greenfield mode behavior: run `dt extract detect` → `dt extract all --interactive` → present extraction report → then conduct the interview for `product-context.md` / `technical-guidelines.md`
  - [x] 4.4 Remove all direct `/docs` reading and repo-walking logic from multi-repo mode (all context resolution passes through `dt`)
  - [x] 4.5 Update `.kiro/skills/activity-init/SKILL.md` with the rewritten mode-detection and routing logic
  - [x] 4.6 Update `.github/prompts/activity-init.md` (or equivalent GitHub tree path) with identical behavioral content
  - [x] 4.7 Update `.claude/commands/activity-init.md` (or equivalent Claude tree path) with identical behavioral content
  - [x] 4.8 Update `product-engineer` agent files across all three trees if flow references changed
  - [x] 4.9 Write structural validation: verify all three platform trees have identical behavioral logic (parity check script or diff assertion)
  - [x] 4.10 Write dry-run walkthrough tests: multi-repo mode (dt init invocation + exit code handling); mono-repo mode (current flow unchanged); undocumented mode (extraction + interview)
  - [x] 4.11 Write edge-case tests: repo with both `component.json` and `/docs` (multi-repo wins); exit 7/9 presentation; interrupted interactive extraction (clear resume path)
  - [x] 4.12 Verify Acceptance Criterion: skill detects all three modes correctly
  - [x] 4.13 Verify Acceptance Criterion: multi-repo invokes dt init --task --json with proper exit code handling
  - [x] 4.14 Verify Acceptance Criterion: undocumented mode runs extract detect → extract all → interview
  - [x] 4.15 Verify Acceptance Criterion: skill no longer reads /docs directly in multi-repo mode
  - [x] 4.16 Verify Acceptance Criterion: all three platform trees updated consistently
  - [x] 4.17 Run Tests: `pnpm run validate`; parity check script

- [ ] 5.0 Implement Story S-022 - https://github.com/llipe/dev-tasks/issues/59: architecture-change task type with meta-repo write authority

  > The only mode allowing meta-repo writes. Requires ADR and human approval. Agents cannot write to the meta-repo outside this task type.

  - [x] 5.1 Define the `architecture-change` task type in agent contracts: document the write scope (may modify `architecture.md`, `domains.md`, `glossary.md`, `conventions.md`, `catalog/flows/`; may NOT modify `catalog/components/` or `catalog/index.yaml`)
  - [x] 5.2 Document the ADR requirement: before any meta-repo PR, an ADR must be produced with context, decision, consequences, and alternatives considered
  - [x] 5.3 Document the human-approval gate: PRs from this task type targeting the meta-repo require explicit human review and approval; no auto-merge into the default branch
  - [x] 5.4 Document the exclusion rule: agents MUST NOT write to the meta-repo outside the `architecture-change` task type (RF-64); any attempt must be refused with a clear message
  - [x] 5.5 Document generated-file prohibition: `catalog/components/*.json` and `catalog/index.yaml` are generated by CI and must never be hand-edited or agent-edited
  - [x] 5.6 Update `AGENTS.md` with the `architecture-change` task-type reference and write-authority rules
  - [x] 5.7 Update `product-engineer` agent files across all three trees (`.kiro/`, `.github/`, `.claude/`)
  - [x] 5.8 Update relevant agent files (`developer`, `planner`) to acknowledge the meta-repo write restriction
  - [x] 5.9 Write structural validation: parity check across three trees for architecture-change documentation
  - [x] 5.10 Write dry-run tests: attempt to edit `index.yaml` outside architecture-change → refused; attempt without ADR → blocked; attempt to auto-merge → blocked
  - [x] 5.11 Verify Acceptance Criterion: architecture-change may modify allowed files only
  - [x] 5.12 Verify Acceptance Criterion: ADR required before PR
  - [x] 5.13 Verify Acceptance Criterion: human approval required; no auto-merge
  - [x] 5.14 Verify Acceptance Criterion: agents cannot write to meta-repo outside this task type
  - [x] 5.15 Verify Acceptance Criterion: documented consistently across three trees
  - [x] 5.16 Run Tests: `pnpm run validate`; parity check

- [ ] 6.0 Implement Story S-023 - https://github.com/llipe/dev-tasks/issues/57: Cross-repo partitioning into per-repo sub-tasks

  > Multi-primary features are partitioned into per-repo sub-tasks. Boundary contract is the interface; producer before consumers.

  - [x] 6.1 Document the partitioning procedure in agent contracts: when scope contains >1 `primary` component, the agent MUST produce one sub-task per repo, scoped exclusively to that repo
  - [x] 6.2 Document contract-as-interface: each sub-task uses the boundary contract (with a target version) as its interface; acceptance criteria reference the contract, not the foreign repo's implementation
  - [x] 6.3 Document ordering rule: sub-tasks MUST be ordered producer-before-consumers (provider implements first, consumer adapts second)
  - [x] 6.4 Document low-payload elevation guard: a boundary contract with `payload_confidence: low` MUST be raised to `medium` (via extraction re-run or manual confirmation) before it can serve as an acceptance boundary
  - [x] 6.5 Consume the partition proposal shape from S-019 (`core/scope/partition.ts`): the agent references the automated proposal when available
  - [x] 6.6 Update `product-engineer` agent files across all three trees with the partitioning behavior
  - [x] 6.7 Update `developer`/`planner` agent files to recognize per-repo sub-task scope and contract-based acceptance
  - [x] 6.8 Write structural validation: parity check across three trees
  - [x] 6.9 Write dry-run tests: two-primary scope → ordered per-repo sub-tasks referencing boundary contracts; single primary → no partition
  - [x] 6.10 Write edge-case tests: low-payload boundary → blocked until raised; circular producer/consumer (both produce and consume from each other) → clear ordering strategy
  - [x] 6.11 Verify Acceptance Criterion: >1 primary → one sub-task per repo
  - [x] 6.12 Verify Acceptance Criterion: sub-tasks use boundary contract as interface
  - [x] 6.13 Verify Acceptance Criterion: producer-before-consumers ordering
  - [x] 6.14 Verify Acceptance Criterion: low-payload boundary must be raised before use
  - [x] 6.15 Verify Acceptance Criterion: documented consistently across three trees
  - [x] 6.16 Run Tests: `pnpm run validate`; parity check

### Phase 6 — Verification and Outer Loop

- [x] 7.0 Implement Story S-024 - https://github.com/llipe/dev-tasks/issues/60: dt verify contract-diff (OpenAPI + AsyncAPI breaking-change detection)

  > Deterministic breaking-change detection. No LLM. Skips low-payload contracts to avoid false positives.

  - [x] 7.1 Integrate `oasdiff` for OpenAPI breaking-change detection: wrap the binary (or use its Node bindings if available); accept base and head spec paths; return structured diff with breaking/non-breaking classification
  - [x] 7.2 Implement `core/verify/asyncapi-diff.ts` — custom AsyncAPI comparator with breaking-change classes:
    - [x] 7.2.1 Removed channel → breaking
    - [x] 7.2.2 New required field in payload → breaking
    - [x] 7.2.3 Changed field type → breaking
    - [x] 7.2.4 Narrowed enum (values removed) → breaking
    - [x] 7.2.5 Widened enum (values added) → non-breaking
    - [x] 7.2.6 New optional field → non-breaking
  - [x] 7.3 Implement low-payload exclusion: contracts with `payload_confidence: low` are excluded from breaking-change evaluation entirely (no false positives from uncertain payloads)
  - [x] 7.4 Implement `core/verify/contract-diff.ts` — orchestrator: detect contract type (OpenAPI/AsyncAPI), load base/head versions, delegate to oasdiff or custom comparator, aggregate results
  - [x] 7.5 Implement exit code logic: detected breaking change → exit 8; no breaking changes → exit 0
  - [x] 7.6 Wire `dt verify contract-diff --base <path> --head <path> [--json]` CLI command
  - [x] 7.7 Author CI template step: trigger on component-repo PRs when `contracts/` directory has changes
  - [x] 7.8 Write unit tests: AsyncAPI comparator per breaking-change class; low-payload skip; oasdiff wrapper with fixture specs
  - [x] 7.9 Write integration tests: OpenAPI base/head fixtures (breaking change → exit 8; non-breaking → exit 0); AsyncAPI likewise; mixed (one breaking, one not)
  - [x] 7.10 Write edge-case tests: additive-only change → non-breaking; enum widened vs. narrowed; low-payload contract change → skipped entirely; malformed spec → clear error (not exit 8)
  - [x] 7.11 Verify Acceptance Criterion: OpenAPI uses oasdiff; AsyncAPI uses custom comparator
  - [x] 7.12 Verify Acceptance Criterion: no LLM used
  - [x] 7.13 Verify Acceptance Criterion: payload_confidence: low excluded
  - [x] 7.14 Verify Acceptance Criterion: breaking change → exit 8
  - [x] 7.15 Verify Acceptance Criterion: runs on component-repo PRs when contracts/ changed
  - [x] 7.16 Run Tests: `pnpm run test:unit && pnpm run test:integration && pnpm run validate`

- [ ] 8.0 Implement Story S-025 - https://github.com/llipe/dev-tasks/issues/61: dt verify impact and dt verify drift

  > Impact lists affected consumers with criticality. Drift flags stale docs as a prioritization signal. Both support --json.

  - [ ] 8.1 Implement `core/verify/impact.ts` — `impact --contract <id>`: read the inverted consumer index from the catalog; return list of consumers with each consumer's `criticality` field
  - [ ] 8.2 Implement `--emit-tasks` option: when enabled, produce per-consumer derived task descriptions via the tracker provider interface; emit as structured output
  - [ ] 8.3 Implement `core/providers/tracker.ts` — tracker provider interface stub: define `createTask(component_id, contract_id, change_summary): TaskRef`; implement a no-op/mock provider that logs but does nothing; document that the real implementation comes from the Platform Providers spec
  - [ ] 8.4 Implement graceful degradation for `--emit-tasks`: when the tracker provider is unavailable (no config, no connection), skip task emission with a warning; do not fail
  - [ ] 8.5 Implement `core/verify/drift.ts` — `drift [--id <component-id>] [--threshold <days>]`: compute a docs/code recency heuristic:
    - [ ] 8.5.1 For each component, compare last-modified date of `paths.source` files vs. `docs.root` files via `git log --format=%at -1 <path>`
    - [ ] 8.5.2 Compute the gap in days; report as a prioritization signal ("likely stale" if gap > threshold)
    - [ ] 8.5.3 Emphasize in output that drift is a heuristic, not a proof
  - [ ] 8.6 Wire `dt verify impact --contract <id> [--emit-tasks] [--json]` CLI command
  - [ ] 8.7 Wire `dt verify drift [--id <component-id>] [--threshold 30] [--json]` CLI command
  - [ ] 8.8 Write unit tests: consumer lookup from inverted index + criticality extraction; drift heuristic computation (mock git log dates); tracker provider interface mock
  - [ ] 8.9 Write integration tests: impact over a fixture catalog → expected consumer list with criticality; `--emit-tasks` with mock provider → task descriptions emitted; drift over fixture → expected staleness report
  - [ ] 8.10 Write edge-case tests: contract with no consumers → empty list; provider unavailable → graceful skip with warning; threshold boundary (exactly at/above threshold); component with no docs path → skip drift for that component
  - [ ] 8.11 Verify Acceptance Criterion: impact lists consumers with criticality
  - [ ] 8.12 Verify Acceptance Criterion: --emit-tasks produces per-consumer derived tasks
  - [ ] 8.13 Verify Acceptance Criterion: drift computes recency heuristic, reports as signal not proof
  - [ ] 8.14 Verify Acceptance Criterion: both support --json
  - [ ] 8.15 Verify Acceptance Criterion: --emit-tasks degrades gracefully when provider unavailable
  - [ ] 8.16 Run Tests: `pnpm run test:unit && pnpm run test:integration && pnpm run validate`
