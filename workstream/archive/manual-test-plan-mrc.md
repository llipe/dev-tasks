# Manual Test Plan — Multi-Repo Context (MRC)

## Purpose

This plan validates the `@llipe.com/dev-tasks` implementation against the MRC specification and PRD acceptance criteria through hands-on execution on real or pilot repositories. It covers scenarios that automated tests cannot fully verify: real git interactions, actual LLM responses, CLI UX, cross-repo workflows, and end-to-end pipeline behavior.

## Prerequisites

- Node 20+ and git ≥2.37 installed
- `pnpm` available
- The `dev-tasks` repo checked out and built (`pnpm install && pnpm run build`)
- At least 2-3 pilot repos available (Node/TS microservices with Kafka, an ORM, and HTTP routes)
- A meta-repo scaffold (or the ability to generate one)
- An LLM provider configured (for scoping tests)

## Test Environment Setup

```bash
# Build the package
cd dev-tasks && pnpm install && pnpm run build

# Verify binaries resolve
npx tsx bin/dev-tasks.ts --version
npx tsx bin/dt.ts --version

# Run doctor to validate prereqs
npx tsx bin/dev-tasks.ts doctor
```

---

## Section 1: Distribution & Bootstrap (Phase 0)

### T-001: Binary resolution and usage

| Step | Action | Expected |
|------|--------|----------|
| 1 | Run `dev-tasks --version` | Prints version string, exits 0 |
| 2 | Run `dt --version` | Prints same version string, exits 0 |
| 3 | Run `dev-tasks` (no args) | Prints usage, exits 2 |
| 4 | Run `dt` (no args) | Prints usage, exits 2 |
| 5 | Run `dt banana` | Prints "unknown command", exits 2 |
| 6 | Run `dev-tasks banana` | Prints "unknown command", exits 2 |

### T-002: Doctor checks

| Step | Action | Expected |
|------|--------|----------|
| 1 | Run `dev-tasks doctor` on a valid machine | All checks pass (Node ≥20, git ≥2.37, cache dir writable), exit 0 |
| 2 | Run `dev-tasks doctor --json` | JSON output with per-check pass/fail |
| 3 | If possible: run with an old git version | Doctor reports git check failure, exits non-zero |

### T-003: Install, pin, status

| Step | Action | Expected |
|------|--------|----------|
| 1 | Create a temp repo: `git init /tmp/test-repo` | Repo created |
| 2 | Run `dev-tasks install` from inside it | Skills copied; `.dev-tasks/manifest.json` created with `sha256`/`origin_sha256` per file |
| 3 | Inspect `.dev-tasks/manifest.json` | Valid JSON; each skill has correct hashes |
| 4 | Run `dev-tasks pin 1.0.0` | `.dev-tasks/version` contains `1.0.0` |
| 5 | Run `dev-tasks status --json` | Reports installed, pinned, and latest versions |

### T-004: Update with conflict detection (PRD AC-11)

| Step | Action | Expected |
|------|--------|----------|
| 1 | After T-003, edit a skill file in the repo | File content changed |
| 2 | Run `dev-tasks update` | Reports conflict for the edited file; does NOT overwrite; exit 14 |
| 3 | Run `dev-tasks update --force` | Backs up to `.dev-tasks/backup/<ts>/`; overwrites; exit 0 |
| 4 | Verify backup exists | Original file preserved in backup dir |

---

## Section 2: Extraction Pipeline (Phase 1)

### T-005: Stack detection (PRD AC-5)

| Step | Action | Expected |
|------|--------|----------|
| 1 | Navigate to a NestJS + Prisma + KafkaJS pilot repo | — |
| 2 | Run `dt extract detect --json` | Output includes `stack`, `http.framework: nestjs`, `http.openapi_strategy`, `orm.kind: prisma`, `messaging.client: kafkajs`, evidence arrays |
| 3 | Navigate to a plain Express repo (no ORM, no Kafka) | — |
| 4 | Run `dt extract detect --json` | Reports `http.framework: express`; `orm: null`; `messaging: null` |
| 5 | Navigate to a directory without `package.json` | — |
| 6 | Run `dt extract detect --json` | Reports no detection; `requires_human` populated |

### T-006: Schema extraction

| Step | Action | Expected |
|------|--------|----------|
| 1 | On the Prisma pilot repo, run `dt extract schema` | Produces `docs/schema.md` with tables, columns (type+nullability), PK/FK, indexes, Mermaid diagram |
| 2 | Inspect `docs/schema.md` | Each table has a semantic description; no invented columns; `source: introspected` |
| 3 | On a repo without ORM or `--db-url`, run `dt extract schema` | Either skips (no artifact) or produces a low-confidence result from migrations; documents gap in `requires_human` |

### T-007: OpenAPI extraction

| Step | Action | Expected |
|------|--------|----------|
| 1 | On a repo with committed `openapi.yaml`, run `dt extract openapi --strategy 1` | Copies and normalizes the spec; `source: introspected`, `confidence: high` |
| 2 | Validate output against OpenAPI 3.1 schema | Passes |
| 3 | On an Express repo without an OpenAPI spec, run `dt extract openapi --strategy 3` | AST discovers routes; composes paths from router prefixes; marks untyped handlers as low-confidence |
| 4 | Inspect output for `unresolved[]` | Dynamic routes appear in `unresolved[]`, not silently omitted |
| 5 | Confirm LLM wrote only `summary`/`description`/`tags` | No structural fields (paths, params, schemas) from LLM |

### T-008: AsyncAPI extraction

| Step | Action | Expected |
|------|--------|----------|
| 1 | On the KafkaJS pilot repo, run `dt extract asyncapi --json` | Produces AsyncAPI with `provides` (producer topics) and `consumes` (subscriber topics) |
| 2 | Inspect `topic_confidence` per channel | String literals → high; template literals with env vars → medium; unresolvable → low + `unresolved[]` |
| 3 | Inspect `payload_confidence` per channel | Typed send → medium; inline object → low; opaque (`Buffer`) → low + `unresolved[]` |
| 4 | Confirm separate confidence tracking | `topic_confidence` and `payload_confidence` are independent fields on each channel |

### T-009: Full extraction + component.json derivation (PRD AC-5, AC-6)

| Step | Action | Expected |
|------|--------|----------|
| 1 | Run `dt extract all --interactive` on the pilot repo | Prompts for `owner`, `domain`, `criticality`, `lifecycle` |
| 2 | Answer some prompts, leave `owner` blank | `component.json` written; `owner` is empty |
| 3 | Inspect `_provenance` block | Contains `extracted_at`, `extractor`, `repo_sha`, per-field `source`/`confidence`, `field_hashes` |
| 4 | Inspect `extraction_report.json` | Lists strategies, coverage, confidence counts, `unresolved[]`, `requires_human[]` |
| 5 | Run `dt validate-component component.json` | Fails (exit 4) because `owner` is empty (PRD AC-6) |
| 6 | Fill in `owner`, re-validate | Passes (exit 0) |

### T-010: Extraction idempotency and conflict (PRD AC-7)

| Step | Action | Expected |
|------|--------|----------|
| 1 | After T-009, run `dt extract all` again without changes | No fields rewritten (idempotent); exit 0 |
| 2 | Manually edit `description` in `component.json` | Field content changed |
| 3 | Run `dt extract all` | Reports conflict for `description`; does not overwrite; exit 14 |
| 4 | Run `dt extract all --force` | Overwrites with new derivation |

---

## Section 3: Catalog (Phase 2)

### T-011: JSON Schema validation (local, no network)

| Step | Action | Expected |
|------|--------|----------|
| 1 | Run `dt validate-component component.json` (valid file) | Exit 0 |
| 2 | Modify `id` to `INVALID-ID` (uppercase) | — |
| 3 | Run `dt validate-component component.json` | Exit 4; error mentions id pattern |
| 4 | Confirm no network calls were made | Validation is purely local (spec §6.2) |

### T-012: Catalog build

| Step | Action | Expected |
|------|--------|----------|
| 1 | Set up a meta-repo scaffold: `dt catalog scaffold --out /tmp/meta` | Directory created with `architecture.md`, `domains.md`, `glossary.md`, `conventions.md`, `registry.yaml`, etc. |
| 2 | Add 2-3 pilot repos to `registry.yaml` | — |
| 3 | Run `dt catalog build --registry registry.yaml` | Mirrors manifests to `catalog/components/`; generates `catalog/index.yaml` |
| 4 | Inspect `index.yaml` | Has `generated_at`, `generator`, per-component origin SHA, inverted consumer index, `extraction_quality` |
| 5 | Run `dt catalog build` again without changes | Nothing written (idempotent) |
| 6 | Break one repo's URL in `registry.yaml` | — |
| 7 | Run `dt catalog build` | Remaining repos succeed; broken repo in `index.errors[]`; exit 3 |

### T-013: Catalog validation (PRD AC-8)

| Step | Action | Expected |
|------|--------|----------|
| 1 | Add a `consumes[].contract` that doesn't match any `provides[].id` | — |
| 2 | Run `dt catalog validate` | V04 error; exit 4 |
| 3 | Fix the reference; add an undeclared cycle | — |
| 4 | Run `dt catalog validate` | Cycle is a warning; exit 0 |
| 5 | Run `dt catalog validate --strict` | Cycle becomes an error; exit 4 |

### T-014: Catalog resolve (lexical routing)

| Step | Action | Expected |
|------|--------|----------|
| 1 | Run `dt catalog resolve --text "procesar pago con tarjeta" --json` | Returns top candidates with scores and matched signals; aliases/domain/description participate |
| 2 | Confirm scoring: exact id match scores highest (100), description words lowest (25) | Scores are weighted per spec §6.2 |
| 3 | Test with accented input: `dt catalog resolve --text "autenticación"` | Normalization handles accents; results returned |

---

## Section 4: Context Pipeline (Phase 3)

### T-015: Sparse fetch and cache

| Step | Action | Expected |
|------|--------|----------|
| 1 | Run `dt ctx fetch --repos payment-service --meta-repo /tmp/meta --json` | Fetches sparse clone; reports cache miss |
| 2 | Inspect `~/.dev-tasks/cache/<host>/<org>/payment-service/<sha>/` | Contains only `component.json`, `docs/`, `contracts/` |
| 3 | Run the same fetch again | Reports cache hit; no git operations |
| 4 | Run with `--refresh` | Re-fetches despite cache existing |
| 5 | Make a repo URL unreachable | — |
| 6 | Run fetch | Exit 5 with per-repo error details |

### T-016: Bundle assembly

| Step | Action | Expected |
|------|--------|----------|
| 1 | Run `dt ctx assemble --scope scope.json --out /tmp/bundle --json` with a valid scope | Bundle directory created with numbered layer files (00-index.md, 01-flow.md, etc.) |
| 2 | Inspect total tokens | ≤60,000 (default budget) |
| 3 | Inspect `bundle.truncated[]` | Lists any truncated layers with original vs. final tokens |
| 4 | Re-run assembly | Produces byte-for-byte identical files (SHA-256 match) |
| 5 | Reduce budget to 1000 tokens (forcing non-truncable overflow) | — |
| 6 | Run assemble with `--budget 1000` | Exit 6 (non-truncable layers exceed budget) |

### T-017: Manual-scope init and session lock (PRD AC-12)

| Step | Action | Expected |
|------|--------|----------|
| 1 | Run `dt init --components payment-service,auth-service --meta-repo /tmp/meta --json` | Pins meta-repo SHA, fetches repos, assembles bundle, emits `session.lock.json` |
| 2 | Inspect `session.lock.json` | Contains `meta_repo_sha`, `index_age_minutes`, `scope` (source: manual), per-repo SHAs, bundle file hashes + tokens |
| 3 | Run the same command again | Produces identical bundle (reproducibility guarantee) |
| 4 | Run `dt init --components nonexistent-svc --meta-repo /tmp/meta` | Exit 12 (unknown component) |
| 5 | Run `dt init --no-llm --meta-repo /tmp/meta` (without --components) | Exit 2 (incorrect usage) |

### T-018: Stale index detection (PRD AC-4)

| Step | Action | Expected |
|------|--------|----------|
| 1 | Set `--max-index-age 0` (force stale) | — |
| 2 | Run `dt init --components payment-service --meta-repo /tmp/meta --max-index-age 0` | Exit 9 (stale index) |

---

## Section 5: Scoping (Phase 4)

### T-019: LLM scoping with valid response (PRD AC-1)

| Step | Action | Expected |
|------|--------|----------|
| 1 | Run `dt init --task "agregar rate limiting al servicio de autenticación" --meta-repo /tmp/meta --json` | LLM returns scope; validates against schema; gate passes; bundle assembled |
| 2 | Inspect scope output | `primary` (1-6 components), `secondary` (≤8), `contracts_crossed`, `confidence`, `rationale` (≤600 chars) |
| 3 | Confirm no invented component ids | All ids exist in the catalog index |
| 4 | Inspect `session.lock.json` | Contains `review_flags` (if any) |

### T-020: Gate abort — too many components (PRD AC-2)

| Step | Action | Expected |
|------|--------|----------|
| 1 | Run `dt init --task "rediseñar todo el flujo de checkout" --max-components 2 --meta-repo /tmp/meta --json` | Gate aborts (scope likely exceeds 2) |
| 2 | Confirm exit code 7 | System decision, not an error |
| 3 | Inspect output for partition proposal | Groups by domain; orders producer-before-consumer |

### T-021: Gate abort — low confidence (PRD AC-3)

| Step | Action | Expected |
|------|--------|----------|
| 1 | Run with an ambiguous task: `dt init --task "mejorar performance" --meta-repo /tmp/meta --json` | If LLM returns `confidence: low`, gate aborts |
| 2 | Confirm exit code 7 | Abort with disambiguation signal |
| 3 | Confirm `unresolved` list or `confidence: low` is reported | Clear indication of why it aborted |

### T-022: Scoping repair retry

| Step | Action | Expected |
|------|--------|----------|
| 1 | Use a mock/instrumented LLM that returns invalid JSON on first call | — |
| 2 | Run `dt init --task "..." --meta-repo /tmp/meta` | First response fails validation; repair retry fires |
| 3 | If second response is valid | Continues normally |
| 4 | If second response also invalid | Exit 10 (invalid scoping after retry) |

### T-023: Calibration data

| Step | Action | Expected |
|------|--------|----------|
| 1 | After a successful `dt init --task` | Check `.dev-tasks/calibration/` |
| 2 | Inspect calibration record | Contains `task_text_hash`, `primary`, `secondary`, `confidence`, `timestamp` |

---

## Section 6: Verification (Phase 6)

### T-024: Contract-diff — breaking change detection (PRD AC-9)

| Step | Action | Expected |
|------|--------|----------|
| 1 | Modify an OpenAPI spec: remove an endpoint | — |
| 2 | Run `dt verify contract-diff --base contracts/openapi/old.yaml --head contracts/openapi/new.yaml --json` | Exit 8; reports `operation-removed` as breaking |
| 3 | Modify an AsyncAPI spec: remove a channel | — |
| 4 | Run the same command | Exit 8; reports `channel-removed` as breaking |
| 5 | Make only additive changes (add optional field) | — |
| 6 | Run the command | Exit 0; reports non-breaking changes |
| 7 | Confirm no LLM was invoked | Purely deterministic |

### T-025: Low-payload exclusion (PRD AC-9)

| Step | Action | Expected |
|------|--------|----------|
| 1 | In an AsyncAPI spec, mark a channel with `payload_confidence: low` | — |
| 2 | Make a breaking change to that channel's payload | — |
| 3 | Run `dt verify contract-diff` | Channel is SKIPPED entirely; exit 0 (no breaking changes reported for that channel) |

### T-026: Impact analysis

| Step | Action | Expected |
|------|--------|----------|
| 1 | Run `dt verify impact --contract orders-v1 --index catalog/index.yaml --json` | Lists all consumers of `orders-v1` with their `criticality` |
| 2 | Confirm consumers match the inverted index | Every `consumes[].contract == orders-v1` appears |
| 3 | Run `dt verify impact --contract orders-v1 --emit-tasks --json` | Degrades gracefully (no tracker configured); reports `tasksEmitted: false` with per-consumer error |

### T-027: Drift detection

| Step | Action | Expected |
|------|--------|----------|
| 1 | Run `dt verify drift --id payment-service --threshold 30 --json` | Reports recency gap between source and docs |
| 2 | Confirm output says "heuristic, not proof" | Drift is a prioritization signal |
| 3 | Run on a component with recently-updated docs | Reports not stale |

---

## Section 7: Integration & Agent Contracts (Phase 5)

### T-028: Init skill mode detection

| Step | Action | Expected |
|------|--------|----------|
| 1 | In a repo with `component.json` at root, invoke the init skill | Detects multi-repo mode; routes through `dt init --task --json` |
| 2 | In a repo with `/docs` but no `component.json` | Detects mono-repo mode; uses current flow (reads docs directly) |
| 3 | In a repo with neither | Detects greenfield/undocumented mode; runs `dt extract detect` → `dt extract all --interactive` |

### T-029: Three-tree parity

| Step | Action | Expected |
|------|--------|----------|
| 1 | Compare `.kiro/skills/activity-init/SKILL.md` mode-detection logic across all three trees | Identical behavioral content in `.kiro/`, `.github/`, `.claude/` |
| 2 | Compare architecture-change documentation across trees | Consistent |

### T-030: Architecture-change write authority

| Step | Action | Expected |
|------|--------|----------|
| 1 | Attempt to modify `catalog/index.yaml` outside an `architecture-change` task | Agent refuses with clear message (per AGENTS.md RF-64) |
| 2 | In an `architecture-change` task, attempt without an ADR | Blocked |
| 3 | With an ADR, open a PR | Requires human approval; no auto-merge |

---

## Section 8: CI Behavior (PRD AC-10)

### T-031: npx invocation in CI

| Step | Action | Expected |
|------|--------|----------|
| 1 | In a clean CI-like environment (Docker, no prior install), run: `npx --yes @llipe.com/dev-tasks dt catalog validate` | Installs on demand; validates; exits 0 or 4 |
| 2 | Run `npx --yes @llipe.com/dev-tasks dt validate-component component.json` | Works without prior install |

### T-032: Scheduled catalog rebuild simulation

| Step | Action | Expected |
|------|--------|----------|
| 1 | Run the GitHub Actions workflow steps manually: `dt catalog build --registry registry.yaml` → `dt catalog validate --strict` | Build succeeds; validate succeeds |
| 2 | Verify conditional commit: if nothing changed, no commit | Idempotent |
| 3 | Introduce a validation error | Build exits non-zero (alerting the failure) |

---

## Section 9: Performance & Non-Functional (RNF)

### T-033: Init performance

| Step | Action | Expected |
|------|--------|----------|
| 1 | With warm cache, run `dt init --components a,b` and time it | p50 ≤15s |
| 2 | Clear cache, run again | ≤90s for 20 repos (cold start) |

### T-034: Bundle budget compliance

| Step | Action | Expected |
|------|--------|----------|
| 1 | Run `dt init --task "..." --budget 60000 --json` | Bundle `total_tokens` ≤60,000 |
| 2 | Inspect `truncated[]` if present | Documents what was cut |

### T-035: Reproducibility

| Step | Action | Expected |
|------|--------|----------|
| 1 | Run `dt init --components a,b --meta-repo /tmp/meta` twice | Same `session.lock.json` → same bundle SHA-256 per file |

---

## Section 10: Security

### T-036: No production credentials

| Step | Action | Expected |
|------|--------|----------|
| 1 | Run `dt extract all` without `--db-url` | No database connection attempted; schema extraction skips or uses ORM files only |
| 2 | Inspect all generated artifacts | No secrets, credentials, or production data present |

### T-037: Read-only cross-repo access

| Step | Action | Expected |
|------|--------|----------|
| 1 | Run `dt ctx fetch` | Uses `--filter=blob:none --no-checkout --depth 1`; no push/write operations |
| 2 | Inspect git operations (with `GIT_TRACE=1`) | Only read operations |

---

## Traceability Matrix

| PRD AC | Test ID(s) | Description |
|--------|-----------|-------------|
| AC-1 | T-019 | dt init resolves scope for ≥85% of labeled tasks |
| AC-2 | T-020 | Gate aborts with partition proposal (exit 7) |
| AC-3 | T-021 | Gate aborts on ambiguity (confidence: low) |
| AC-4 | T-018 | Stale index → exit 9 |
| AC-5 | T-005, T-006, T-007, T-008, T-009 | Extract all with source + confidence |
| AC-6 | T-009 | Non-derivable fields prompted; empty → validate rejects |
| AC-7 | T-010 | Re-extraction conflict detection |
| AC-8 | T-013 | Unresolved consumes → catalog validate error |
| AC-9 | T-024, T-025, T-026 | Breaking-change detection, no LLM, low-payload excluded |
| AC-10 | T-031 | npx CI invocation |
| AC-11 | T-004 | Update detects edited skill by hash |
| AC-12 | T-016, T-017, T-034 | Bundle budget compliance |

---

## Execution Notes

- Tests T-019 through T-023 require an LLM provider. If unavailable, use `--no-llm` with `--components` to test the deterministic path, and defer LLM tests to a session with provider access.
- For T-033 (performance), use `time` or equivalent to measure wall-clock time.
- For AC-1 (85% success rate), a labeled task set of ≥20 tasks is needed. This can be built incrementally during pilot usage.
- All `--json` outputs should be valid JSON (parseable by `jq`).
