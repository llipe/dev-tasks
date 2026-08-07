# User Stories: dev-tasks Multi-Repo Context (MRC)

## Changelog

| Version | Date       | Summary                                                                                         | Author           |
| ------- | ---------- | ----------------------------------------------------------------------------------------------- | ---------------- |
| 1.0     | 2026-07-28 | Initial version. 25 stories derived from `specification-multi-repo-context.md` and `prd-multi-repo-context.md`, sequenced by PRD phases 0-6, with full PRD coverage validation. | product-engineer |

## Reference Documents

- PRD: `docs/requirements/prd-multi-repo-context.md`
- Specification: `workstream/specification-multi-repo-context.md`
- Foundation: `docs/product-context.md`, `docs/technical-guidelines.md`

## Reading Notes

- **Repository under change:** `llipe/dev-tasks` (the `@llipe/dev-tasks` TypeScript/Node package). The meta-repo and component repos are consumers configured by the artifacts this package produces.
- **Sequencing assumption:** stories are ordered by PRD phases 0-6. Each phase's stories depend on the prior phase's foundation. Within a phase, dependencies are listed per story.
- **Package manager:** `pnpm`. Canonical scripts: `lint`, `format:check`, `typecheck`, `test`, `test:unit`, `test:integration`, `audit`, `validate`.
- **Migration Requirements:** MRC has no application database. "Migrations" in the app sense do not apply; the closest analogues (JSON Schema versioning, on-disk artifact formats) are called out per story where relevant. Each story documents this as an explicit opt-out.
- **LLM boundary:** every story that touches the LLM enforces the "deterministic first" rule — the LLM never produces structure, only prose over extracted structure or a schema-validated scope decision.

---

## Phase 0 — Distribution

### Story S-001: Package scaffold with two binaries and layered core

**Priority:** Critical
**Estimated Size:** M
**Dependencies:** none (greenfield foundation)

#### User Story

As a maintainer,
I want a single `@llipe/dev-tasks` npm package that exposes a `dev-tasks` bootstrap binary and a `dt` runtime binary over a shared `core/` library,
So that methodology and runtime ship on one version and release train, and the core stays reusable behind future adapters.

#### Context

Establishes the code architecture every later story builds on (spec §4.1). The structural rule — no business logic in `adapters/` — is set here so the MCP adapter can be added later at zero cost.

#### Acceptance Criteria

- [ ] `package.json` declares `bin: { "dev-tasks": "./bin/dev-tasks.js", "dt": "./bin/dt.js" }` and `engines.node >= 20`.
- [ ] Directory layout matches spec §4.1: `bin/`, `core/{catalog,extract,context,scope,providers}`, `adapters/{cli,mcp}`, `skills/`.
- [ ] `core/` modules have no import from `adapters/` (enforced by a dependency-direction lint rule or test).
- [ ] `npx --yes @llipe/dev-tasks dt --version` and `dev-tasks --version` both resolve without prior install.
- [ ] Both binaries print usage and exit 2 on unknown command.

#### Business Rules

- One version number and one release train for skills and runtime (RF-71).
- No business logic in `adapters/`; the core is written as if the MCP adapter already exists.

#### Technical Notes

- TypeScript / Node 20; JSON Schema 2020-12 via `ajv`; `execa` for git (spec §4.6).
- Set up the shared exit-code enum (spec §6.7) as a core constant now so every command reuses it.

#### Testing Requirements

- **Unit Tests:** binary entrypoints resolve; exit-code enum values; unknown-command handling.
- **Integration Tests:** `npx` invocation of both binaries in a clean temp dir.
- **Manual/UI Testing:** run `dev-tasks --version` and `dt --version` locally.
- **Edge-Case Matrix:** missing Node <20 → clear engine error; no-args invocation; unknown subcommand → exit 2.
- **Acceptance-Criteria Mapping:** AC1-2 → structure tests; AC3 → npx integration test; AC4-5 → CLI unit tests.
- **Execution Commands:** `pnpm install`, `pnpm run build`, `pnpm run test:unit`, `pnpm run validate`.

#### Migration Requirements

- Not applicable (no data model). Opt-out rationale: greenfield package scaffold.

#### Implementation Steps

1. Initialize the package, TypeScript config, lint/format/test tooling.
2. Create `bin/dev-tasks.ts` and `bin/dt.ts` command routers.
3. Create the `core/` module skeleton with public interfaces per spec §4.1.
4. Add the dependency-direction guard (no `adapters/` import in `core/`).
5. Wire the shared exit-code enum and base CLI arg parsing (`--json`, `--meta-repo`, `-v`).

#### Files to Create/Modify

- `package.json`, `tsconfig.json`, lint/format config
- `bin/dev-tasks.ts`, `bin/dt.ts`
- `core/index.ts` and module stubs under `core/*`
- `adapters/cli/index.ts`
- `core/exit-codes.ts`, `core/exit-codes.test.ts`

#### Definition of Done Checklist

- [ ] Code implemented per technical guidelines
- [ ] Unit/integration/edge-case tests written and passing
- [ ] Quality gates passing (`lint`, `format:check`, `typecheck`, `test`, `audit`)
- [ ] Code reviewed and approved
- [ ] Acceptance criteria verified and mapped to test evidence
- [ ] Migration opt-out documented
- [ ] Pull Request created and merged

---

### Story S-002: `dev-tasks` bootstrap — install, status, pin, doctor

**Priority:** Critical
**Estimated Size:** M
**Dependencies:** S-001

#### User Story

As a repo owner,
I want `dev-tasks install`, `status`, `pin`, and `doctor` commands,
So that I can install skills into a repo, pin a version, and verify my environment before running the runtime.

#### Context

Bootstrap surface from spec §15. `install` writes skills and the `.dev-tasks/` manifest; `pin` fixes the version per repo (RF-73); `doctor` verifies Node, git ≥2.37, repo access, and skew.

#### Acceptance Criteria

- [ ] `dev-tasks install [--pin <version>]` copies skill files into the repo and writes `.dev-tasks/manifest.json` with `sha256` and `origin_sha256` per file (spec §5.5).
- [ ] `dev-tasks pin <version>` writes `.dev-tasks/version` and subsequent runs honor the pin (RF-73).
- [ ] `dev-tasks status` reports installed vs. pinned vs. latest-published versions.
- [ ] `dev-tasks doctor` checks Node ≥20, git ≥2.37, cache writability, and reports pass/fail per check.
- [ ] All commands support `--json`.

#### Business Rules

- Each repo may pin a version; behavior is identical while the pin is unchanged (RF-73).
- `git sparse-checkout` requires git ≥2.37, verified by `doctor` (spec §16).

#### Technical Notes

- Manifest schema per spec §5.5; hashing utility is shared with S-003 reconciliation.
- `doctor` is the single place that asserts environmental prerequisites (RNF-10).

#### Testing Requirements

- **Unit Tests:** manifest write/read; pin resolution; version comparison; doctor check functions.
- **Integration Tests:** `install` into a temp repo produces the expected file set and manifest.
- **Manual/UI Testing:** run `dev-tasks doctor` on a machine with old git → fails clearly.
- **Edge-Case Matrix:** git <2.37; missing Node; unwritable cache; re-install over an existing install; pin to a nonexistent version.
- **Acceptance-Criteria Mapping:** AC1 → install integration test; AC2 → pin unit test; AC3 → status test; AC4 → doctor tests; AC5 → `--json` snapshot tests.
- **Execution Commands:** `pnpm run test:unit`, `pnpm run test:integration`, `pnpm run validate`.

#### Migration Requirements

- Not applicable. Opt-out rationale: manifest is a generated on-disk artifact, versioned by `manifest.version`, not a database migration.

#### Implementation Steps

1. Implement the manifest read/write module and hashing utility.
2. Implement `install` (copy skills, compute hashes, write manifest).
3. Implement `pin` and `status`.
4. Implement `doctor` checks (Node, git, cache, skew).

#### Files to Create/Modify

- `bin/dev-tasks.ts` (routing)
- `core/distribution/manifest.ts`, `core/distribution/hash.ts`
- `core/distribution/doctor.ts`
- corresponding `*.test.ts`

#### Definition of Done Checklist

- [ ] Code implemented per technical guidelines
- [ ] Unit/integration/edge-case tests written and passing
- [ ] Quality gates passing
- [ ] Code reviewed and approved
- [ ] Acceptance criteria verified and mapped to test evidence
- [ ] Migration opt-out documented
- [ ] Pull Request created and merged

---

### Story S-003: Hash-based reconciliation engine and `dev-tasks update`

**Priority:** Critical
**Estimated Size:** M
**Dependencies:** S-002

#### User Story

As a repo owner who customized a skill,
I want `dev-tasks update` to detect my local edits by hash and report a conflict instead of overwriting,
So that customizations across 20 repos are never clobbered silently.

#### Context

Implements the reconciliation algorithm from spec §15. This is the single reconciliation implementation reused by extraction idempotency (S-009), satisfying RF-72.

#### Acceptance Criteria

- [ ] For each shipped skill file, `update` installs if absent, overwrites if `sha256(local) == origin`, skips if `sha256(local) == sha256(pkg)`, otherwise reports a conflict (RF-72).
- [ ] `--force` overwrites conflicts and writes a backup under `.dev-tasks/backup/<ts>/`.
- [ ] A conflict run exits with code 14 and lists every conflicting path with a diff summary.
- [ ] The reconciliation function is exposed from `core/` and consumed by S-009 without duplication.

#### Business Rules

- A local edit is never overwritten without an explicit declaration (RF-72).
- One reconciliation implementation, two uses (updates and extraction idempotency).

#### Technical Notes

- Reuse `core/distribution/hash.ts` from S-002.
- Conflict output is deterministic and machine-readable via `--json`.

#### Testing Requirements

- **Unit Tests:** all four branches (install/overwrite/skip/conflict); backup path generation.
- **Integration Tests:** update over a repo with one edited and one unedited skill → conflict on the edited only.
- **Manual/UI Testing:** edit a skill, run `update`, confirm conflict; run `update --force`, confirm backup.
- **Edge-Case Matrix:** file deleted locally; file added to package; identical content different mtime; `--force` with unwritable backup dir.
- **Acceptance-Criteria Mapping:** AC1 → branch unit tests; AC2 → force+backup integration test; AC3 → exit-code test; AC4 → shared-module import test.
- **Execution Commands:** `pnpm run test:unit`, `pnpm run test:integration`, `pnpm run validate`.

#### Migration Requirements

- Not applicable. Opt-out rationale: reconciles files, not schema.

#### Implementation Steps

1. Implement `core/reconcile.ts` (generic hash reconciliation: absent/unedited/current/conflict).
2. Wire `dev-tasks update` to reconcile skill files.
3. Implement `--force` with timestamped backup.
4. Emit conflict report (human + `--json`) and exit 14.

#### Files to Create/Modify

- `core/reconcile.ts`, `core/reconcile.test.ts`
- `bin/dev-tasks.ts` (update command)
- `core/distribution/backup.ts`

#### Definition of Done Checklist

- [ ] Code implemented per technical guidelines
- [ ] Unit/integration/edge-case tests written and passing
- [ ] Quality gates passing
- [ ] Code reviewed and approved
- [ ] Acceptance criteria verified and mapped to test evidence
- [ ] Migration opt-out documented
- [ ] Pull Request created and merged

---

### Story S-004: Migration shim from `dev-tasks.sh`

**Priority:** High
**Estimated Size:** S
**Dependencies:** S-002, S-003

#### User Story

As an existing `dev-tasks.sh` user,
I want a one-grace-version shim that migrates me to the npm package,
So that I move to versioned distribution without losing my installed skills.

#### Context

Spec §15 migration path. The shim installs the package, writes a manifest marking existing files `modified: unknown` (so the first `update` reports a conflict rather than clobbering), and announces that future updates go through npm.

#### Acceptance Criteria

- [ ] The legacy `dev-tasks.sh` is replaced by a shim that detects the legacy version.
- [ ] The shim installs `@llipe/dev-tasks` (global or local) and writes `.dev-tasks/manifest.json` computing hashes of already-installed files with `modified: unknown`.
- [ ] The first `dev-tasks update` after migration reports a conflict for pre-existing files rather than overwriting.
- [ ] The shim prints that future updates go through npm; legacy self-update logic is removed.

#### Business Rules

- One grace version, then archive (RF-74).

#### Technical Notes

- `modified: unknown` maps into the reconciliation engine (S-003) as a conflict branch.

#### Testing Requirements

- **Unit Tests:** legacy detection; manifest generation with `modified: unknown`.
- **Integration Tests:** simulate a legacy install dir → run shim → first `update` yields conflicts.
- **Manual/UI Testing:** run shim against a copy of a legacy repo.
- **Edge-Case Matrix:** no legacy install present; partial legacy install; npm install failure → clear error, no partial manifest.
- **Acceptance-Criteria Mapping:** AC1-2 → shim unit/integration; AC3 → reconciliation integration; AC4 → output assertion.
- **Execution Commands:** `pnpm run test:integration`, `pnpm run validate`.

#### Migration Requirements

- This story *is* the tooling migration. Rollback: keep the archived legacy script for one version; impact documented in `CHANGELOG.md`. No data-model migration involved.

#### Implementation Steps

1. Write the shim replacing `dev-tasks.sh`.
2. Implement legacy detection + package install invocation.
3. Generate the manifest with `modified: unknown`.
4. Print the npm-updates notice; document archival in `CHANGELOG.md`.

#### Files to Create/Modify

- `dev-tasks.sh` (replaced by shim)
- `core/distribution/migrate.ts`, `*.test.ts`
- `CHANGELOG.md`

#### Definition of Done Checklist

- [ ] Code implemented per technical guidelines
- [ ] Tests written and passing
- [ ] Quality gates passing
- [ ] Code reviewed and approved
- [ ] Acceptance criteria verified and mapped to test evidence
- [ ] Migration/rollback note documented
- [ ] Pull Request created and merged

---

## Phase 1 — Extraction

### Story S-005: `dt extract detect` and the pluggable extractor interface

**Priority:** Critical
**Estimated Size:** M
**Dependencies:** S-001

#### User Story

As a repo owner,
I want `dt extract detect` to report my repo's stack, HTTP framework, ORM, and messaging client with evidence,
So that later extraction steps pick the highest-confidence strategy automatically.

#### Context

Spec §8.1 detection + §4.8 pluggable providers. Establishes the `ExtractionProvider` interface and the Node/TS provider that all Phase 1 stories plug into (RF-01, RF-12).

#### Acceptance Criteria

- [ ] `dt extract detect` inspects `package.json`, directory structure, and config files and outputs stack, `http.framework` + `openapi_strategy` + `evidence`, `orm`, `messaging`, and `type_hint` (spec §8.1).
- [ ] Detection reports the per-strategy OpenAPI count even when route 2 is unimplemented (spec §16, open question 1).
- [ ] The `ExtractionProvider` interface declares `id`, `detect()`, `capabilities[]`, and optional extract methods (spec §4.8).
- [ ] A missing capability marks the artifact not-produced and records it in `requires_human`, without failing.
- [ ] Output available via `--json`.

#### Business Rules

- Deterministic first: detection is pure AST/config inspection, no LLM.
- Extractors are pluggable per stack with declared capabilities (RF-12).

#### Technical Notes

- TypeScript Compiler API for AST (spec §4.6); no regex over code.
- Node/TS provider id e.g. `node-nestjs-prisma-kafkajs`.

#### Testing Requirements

- **Unit Tests:** detector functions per signal (nestjs/swagger, prisma, kafkajs, express).
- **Integration Tests:** fixture repos per stack combination → expected detection JSON.
- **Manual/UI Testing:** run `dt extract detect` on a pilot checkout repo.
- **Edge-Case Matrix:** no framework; multiple ORMs; monorepo-shaped dir (should still detect single package); missing `package.json`.
- **Acceptance-Criteria Mapping:** AC1 → detection integration tests; AC2 → strategy-count test; AC3-4 → provider interface unit tests; AC5 → `--json` snapshot.
- **Execution Commands:** `pnpm run test:unit`, `pnpm run test:integration`, `pnpm run validate`.

#### Migration Requirements

- Not applicable. Opt-out rationale: read-only inspection.

#### Implementation Steps

1. Define `ExtractionProvider` and `Capability` types in `core/extract`.
2. Implement config/AST detectors.
3. Implement the Node/TS provider `detect()` and capability declaration.
4. Wire `dt extract detect` output + `--json`.

#### Files to Create/Modify

- `core/extract/provider.ts`, `core/extract/detect.ts`
- `core/extract/providers/node-ts.ts`
- fixtures under `test/fixtures/extract/*`, `*.test.ts`

#### Definition of Done Checklist

- [ ] Code implemented per technical guidelines
- [ ] Tests (incl. fixtures) written and passing
- [ ] Quality gates passing
- [ ] Code reviewed and approved
- [ ] Acceptance criteria verified and mapped to test evidence
- [ ] Migration opt-out documented
- [ ] Pull Request created and merged

---

### Story S-006: `dt extract schema` → `docs/schema.md`

**Priority:** Critical
**Estimated Size:** M
**Dependencies:** S-005

#### User Story

As a repo owner,
I want `dt extract schema` to derive `docs/schema.md` from my ORM (or optional dev-DB introspection),
So that my data model is documented from structure, with provenance, not hand-written.

#### Context

Spec §8.1 schema extraction (RF-02). DB introspection is off by default (open question 5, RNF-08).

#### Acceptance Criteria

- [ ] Prisma/Drizzle/TypeORM schemas are extracted via AST and marked `source: introspected`.
- [ ] With no ORM and `--db-url` pointing at a dev DB, `information_schema` is used (`introspected`); without it, SQL migrations + LLM produce an `inferred`/low result.
- [ ] Output includes tables, columns (type + nullability), PK/FK, indexes, and a Mermaid relationship diagram.
- [ ] Semantic table descriptions are LLM prose over extracted structure; no column is invented.
- [ ] DB introspection is off unless `--db-url` is provided; production credentials are never required (RNF-08).

#### Business Rules

- Explicit provenance on every field.
- Introspection targets local/development only (security §12).

#### Technical Notes

- LLM used only for descriptions; structure is deterministic.

#### Testing Requirements

- **Unit Tests:** per-ORM AST parsing; Mermaid rendering; nullability/PK/FK extraction.
- **Integration Tests:** fixture repos per ORM → expected `schema.md` structure (descriptions stubbed).
- **Manual/UI Testing:** run on a Prisma pilot repo; inspect the diagram.
- **Edge-Case Matrix:** no ORM + no `--db-url`; composite keys; self-referential FK; enum types; `any` columns marked without schema.
- **Acceptance-Criteria Mapping:** AC1-2 → per-source tests; AC3 → structure snapshot; AC4 → "no invented column" assertion; AC5 → default-off test.
- **Execution Commands:** `pnpm run test:unit`, `pnpm run test:integration`, `pnpm run validate`.

#### Migration Requirements

- Not applicable to the app model. `schema.md` is a generated document; regeneration is idempotent (see S-009). Opt-out rationale: read-only derivation.

#### Implementation Steps

1. Implement ORM AST extractors (Prisma/Drizzle/TypeORM).
2. Implement optional `information_schema` reader behind `--db-url`.
3. Render tables + Mermaid; attach provenance.
4. Add the LLM description pass over extracted structure.

#### Files to Create/Modify

- `core/extract/schema.ts`, `core/extract/orm/*.ts`
- `core/extract/render/schema-md.ts`
- fixtures + `*.test.ts`

#### Definition of Done Checklist

- [ ] Code implemented per technical guidelines
- [ ] Tests written and passing
- [ ] Quality gates passing
- [ ] Code reviewed and approved
- [ ] Acceptance criteria verified and mapped to test evidence
- [ ] Migration opt-out documented
- [ ] Pull Request created and merged

---

### Story S-007: `dt extract openapi` (routes 1 and 3)

**Priority:** Critical
**Estimated Size:** L
**Dependencies:** S-005

#### User Story

As a repo owner,
I want `dt extract openapi` to normalize an on-disk spec (route 1) or derive one from route ASTs with LLM-written descriptions (route 3),
So that my HTTP contract is documented with an honest confidence level.

#### Context

Spec §8.1 OpenAPI matrix + route 3 detail (RF-03). Route 2 (isolated framework boot) is deferred pending open question 1; detection still reports its count.

#### Acceptance Criteria

- [ ] Route 1: an on-disk `openapi.yaml/json` (or build-produced) is copied and normalized, `source: introspected`, confidence high.
- [ ] Route 3: AST locates route registrations (Express/Fastify/Hono/Nest*-without-swagger), composes full paths from router prefixes, derives params/body from handler types (incl. zod) when typed, and marks responses without a schema when the return type is `any`/`unknown`.
- [ ] The LLM writes only `summary`/`description`/`tags`; nothing structural.
- [ ] Output validates against the OpenAPI 3.1 JSON Schema.
- [ ] Dynamically registered routes are reported in `extraction_report.unresolved[]`, never silently omitted.
- [ ] `--strategy auto|1|3` selects the route; route selection and confidence are recorded.

#### Business Rules

- No strategy runs the full service (spec §8.1 constraint); route 3 confidence is medium (typed) / low (untyped).

#### Technical Notes

- Route 2 is explicitly out of scope for this story; leave a capability hook.

#### Testing Requirements

- **Unit Tests:** path composition; param/body type resolution; zod handling; response marking.
- **Integration Tests:** Express/Fastify/Hono fixtures → expected OpenAPI (descriptions stubbed) + validation pass.
- **Manual/UI Testing:** run route 3 on a pilot Express repo; review unresolved list.
- **Edge-Case Matrix:** nested routers; dynamic route loop → unresolved; untyped handlers → low confidence; on-disk spec malformed → route 1 normalization error.
- **Acceptance-Criteria Mapping:** AC1 → route-1 test; AC2/AC6 → route-3 tests; AC3 → "descriptions only" assertion; AC4 → schema validation; AC5 → unresolved test.
- **Execution Commands:** `pnpm run test:unit`, `pnpm run test:integration`, `pnpm run validate`.

#### Migration Requirements

- Not applicable. Opt-out rationale: generates a contract artifact; idempotent via S-009.

#### Implementation Steps

1. Implement route-1 copy + normalize + validate.
2. Implement route-3 AST route discovery and path composition.
3. Implement typed param/body/response derivation.
4. Add the LLM description pass and OpenAPI 3.1 validation.
5. Populate `unresolved[]` for dynamic routes.

#### Files to Create/Modify

- `core/extract/openapi/route1.ts`, `route3.ts`, `validate.ts`
- fixtures + `*.test.ts`

#### Definition of Done Checklist

- [ ] Code implemented per technical guidelines
- [ ] Tests written and passing
- [ ] Quality gates passing
- [ ] Code reviewed and approved
- [ ] Acceptance criteria verified and mapped to test evidence
- [ ] Migration opt-out documented
- [ ] Pull Request created and merged

---

### Story S-008: `dt extract asyncapi` (Kafka topic inventory + payloads)

**Priority:** Critical
**Estimated Size:** L
**Dependencies:** S-005

#### User Story

As a repo owner,
I want `dt extract asyncapi` to inventory my Kafka topics (high confidence) separately from message payloads (low confidence),
So that the event `provides`/`consumes` needed for graph closure are captured without pretending payloads are firm contracts.

#### Context

Spec §8.1 AsyncAPI — the core of the schema-registry-free design (RF-04). The `topic_confidence`/`payload_confidence` split is what keeps low-confidence payloads from contaminating downstream (business rule, RF-41).

#### Acceptance Criteria

- [ ] AST over kafkajs `producer.send/sendBatch` yields `provides`; `consumer.subscribe` yields `consumes`.
- [ ] Topic resolution confidence: literal/module-constant → high; env-var template literal → medium (records pattern + variable); unresolvable → low + `unresolved[]`.
- [ ] Payload confidence: typed `send()` → medium from the type; inline object literal → low (LLM infers shape); opaque serialization → low + `unresolved[]`.
- [ ] `topic_confidence` and `payload_confidence` are tracked and emitted separately on each contract.
- [ ] Output validates against the AsyncAPI schema.

#### Business Rules

- A `low` payload is never treated as a firm contract; it is flagged downstream and excluded from breaking-change detection (RF-41, business rule).
- No schema registry is built (non-goal).

#### Technical Notes

- Resolve module constants/enums by following references in the AST.

#### Testing Requirements

- **Unit Tests:** topic literal/constant/template/unresolvable resolution; payload typed/inline/opaque classification.
- **Integration Tests:** kafkajs fixture repos → expected topic inventory + confidence split.
- **Manual/UI Testing:** run on a pilot worker repo; verify topic list vs. code.
- **Edge-Case Matrix:** `subscribe({ topics: [...] })`; topic from config array; `Buffer`/`JSON.stringify(var)` payload → low + unresolved; producer with no consumers.
- **Acceptance-Criteria Mapping:** AC1-2 → topic tests; AC3 → payload tests; AC4 → confidence-split assertion; AC5 → schema validation.
- **Execution Commands:** `pnpm run test:unit`, `pnpm run test:integration`, `pnpm run validate`.

#### Migration Requirements

- Not applicable. Opt-out rationale: generates a contract artifact; idempotent via S-009.

#### Implementation Steps

1. Implement kafkajs call-site AST discovery.
2. Implement topic resolution + confidence rules.
3. Implement payload classification + LLM shape inference for inline literals.
4. Emit AsyncAPI with split confidence + `unresolved[]`; validate.

#### Files to Create/Modify

- `core/extract/asyncapi/topics.ts`, `payloads.ts`, `validate.ts`
- fixtures + `*.test.ts`

#### Definition of Done Checklist

- [ ] Code implemented per technical guidelines
- [ ] Tests written and passing
- [ ] Quality gates passing
- [ ] Code reviewed and approved
- [ ] Acceptance criteria verified and mapped to test evidence
- [ ] Migration opt-out documented
- [ ] Pull Request created and merged

---

### Story S-009: `dt extract component` — provenance, human gate, idempotency, report

**Priority:** Critical
**Estimated Size:** L
**Dependencies:** S-003, S-005, S-006, S-007, S-008

#### User Story

As a repo owner,
I want `dt extract component` to derive `component.json` from prior extraction with declared provenance, prompt me for non-derivable fields, and never overwrite my edits silently,
So that I get a trustworthy manifest without hand-writing it.

#### Context

Spec §8.1 derivation + idempotency + extraction report (RF-05, RF-06, RF-07, RF-08, RF-09). Reuses the reconciliation engine from S-003.

#### Acceptance Criteria

- [ ] Derivable fields (`stack`, `type`, `provides[].path`, `datastores`, `paths`, `docs.*`, `consumes`) come from detection/extraction.
- [ ] Inferable fields (`description`, `aliases`, `subdomain`, `consumes[].criticality`) are LLM-produced and require human confirmation; `aliases` is not persisted without confirmation (RF-08).
- [ ] Non-derivable fields (`owner`, `domain`, `criticality`, `lifecycle`) are prompted via `--interactive`; unanswered ⇒ left empty ⇒ invalid manifest; never invented (RF-07).
- [ ] Every field and artifact carries `source` and `confidence`; `_provenance` records `extracted_at`, `extractor`, `repo_sha`, `detector`, per-field source/confidence, and `field_hashes` (RF-06).
- [ ] Re-running extraction is idempotent: unchanged fields not rewritten; equal values skipped; edited fields produce a conflict with a diff and are not written without `--force` (RF-09).
- [ ] `dt extract all` emits `extraction_report.json` with strategies, coverage, confidence counts, `unresolved[]`, and `requires_human[]`.
- [ ] Missing required fields cause exit 13; conflicts cause exit 14.

#### Business Rules

- One owner per datum; inferences never presented as fact (business rules).
- Reconciliation shares the S-003 implementation.

#### Technical Notes

- `field_hashes` (SHA-256 per field) drive later manual-edit detection.

#### Testing Requirements

- **Unit Tests:** field-category routing; provenance assembly; hash computation; report aggregation.
- **Integration Tests:** full `extract all` on a fixture repo → expected `component.json` + report; re-run → no rewrite; edit a field + re-run → conflict.
- **Manual/UI Testing:** run `dt extract all --interactive` on a pilot repo; answer prompts.
- **Edge-Case Matrix:** unanswered prompts → empty + invalid; `--force` overwrite; alias unconfirmed → not persisted; low-confidence-heavy repo → report reflects it.
- **Acceptance-Criteria Mapping:** AC1-4 → derivation/provenance tests; AC5 → idempotency integration; AC6 → report snapshot; AC7 → exit-code tests.
- **Execution Commands:** `pnpm run test:unit`, `pnpm run test:integration`, `pnpm run validate`.

#### Migration Requirements

- Not applicable to app data. `component.json` regeneration is governed by the idempotency/reconciliation rules above (the analogue of a safe migration). Opt-out rationale: no database.

#### Implementation Steps

1. Implement field-category derivation from prior extraction outputs.
2. Implement the interactive human-gate prompt for non-derivable fields.
3. Assemble `_provenance` incl. `field_hashes`.
4. Wire idempotency through `core/reconcile.ts` (S-003).
5. Implement `dt extract all` orchestration + `extraction_report.json`.

#### Files to Create/Modify

- `core/extract/component.ts`, `core/extract/report.ts`, `core/extract/prompt.ts`
- `bin/dt.ts` (extract commands)
- fixtures + `*.test.ts`

#### Definition of Done Checklist

- [ ] Code implemented per technical guidelines
- [ ] Tests written and passing
- [ ] Quality gates passing
- [ ] Code reviewed and approved
- [ ] Acceptance criteria verified and mapped to test evidence
- [ ] Migration opt-out documented
- [ ] Pull Request created and merged

---

## Phase 2 — Catalog

### Story S-010: JSON Schemas and `dt validate-component`

**Priority:** Critical
**Estimated Size:** S
**Dependencies:** S-009

#### User Story

As CI,
I want JSON Schemas for `component.json`, flows, and scope output, plus a local `dt validate-component`,
So that a component repo's manifest is validated on its own PR without network access.

#### Context

Spec §4.5 `schemas/` + §8 component-repo CI. Establishes the schema artifacts every later validation reuses.

#### Acceptance Criteria

- [ ] `component.schema.json`, `flow.schema.json`, and `scope-output.schema.json` exist and validate the spec's example artifacts.
- [ ] `dt validate-component component.json` validates against the schema with no network access and exits 0/4.
- [ ] `id` pattern `^[a-z][a-z0-9-]{2,49}$` is enforced by the schema.
- [ ] Schemas carry a version field for future evolution.

#### Business Rules

- The catalog is validated, not trusted (business rule).

#### Technical Notes

- `ajv` (JSON Schema 2020-12), shared with catalog validate (S-012).

#### Testing Requirements

- **Unit Tests:** schema accepts valid examples, rejects malformed (bad id, missing manual field).
- **Integration Tests:** `dt validate-component` on valid/invalid fixtures → exit 0/4.
- **Manual/UI Testing:** validate a pilot repo's manifest.
- **Edge-Case Matrix:** unknown top-level key (additionalProperties); wrong enum value; empty `source: manual` field.
- **Acceptance-Criteria Mapping:** AC1/3/4 → schema unit tests; AC2 → CLI integration test.
- **Execution Commands:** `pnpm run test:unit`, `pnpm run test:integration`, `pnpm run validate`.

#### Migration Requirements

- Schema versioning is the migration analogue: bump `schema_version` and document compatibility. No DB. Opt-out rationale: file-format schema.

#### Implementation Steps

1. Author the three JSON Schemas.
2. Implement `dt validate-component` using `ajv`.
3. Add golden valid/invalid fixtures.

#### Files to Create/Modify

- `schemas/component.schema.json`, `flow.schema.json`, `scope-output.schema.json`
- `core/catalog/validate-component.ts`, `*.test.ts`

#### Definition of Done Checklist

- [ ] Code implemented per technical guidelines
- [ ] Tests written and passing
- [ ] Quality gates passing
- [ ] Code reviewed and approved
- [ ] Acceptance criteria verified and mapped to test evidence
- [ ] Migration/versioning note documented
- [ ] Pull Request created and merged

---

### Story S-011: `dt catalog build` — aggregate manifests and generate the index

**Priority:** Critical
**Estimated Size:** L
**Dependencies:** S-010

#### User Story

As an architect,
I want `dt catalog build` to aggregate component manifests into the meta-repo and generate `catalog/index.yaml`,
So that the product map is generated, never hand-copied, eliminating drift by construction.

#### Context

Spec §5.4 index + §6.2 build (RF-21, RF-22, RF-25). Idempotent; a single repo's failure is recorded, not fatal.

#### Acceptance Criteria

- [ ] `build --registry registry.yaml [--concurrency 8]` mirrors each repo's `component.json` into `catalog/components/` and generates `catalog/index.yaml`.
- [ ] The index includes the component summary, a `contracts` map with an inverted consumer index, `domains`, `flows`, and `extraction_quality` counts (RF-25).
- [ ] The index records `generated_at`, `generator`, and each component's origin SHA.
- [ ] `build` is idempotent — nothing is written when nothing changed.
- [ ] A single repo's failure is recorded in `index.errors[]` and the exit code is 3 (not a full abort).

#### Business Rules

- The meta-repo aggregates, never copies as a source of truth (business rule); generated files are not hand-edited.

#### Technical Notes

- Reuse the sparse-fetch client from S-015 if landed; otherwise a minimal read of registry repos.

#### Testing Requirements

- **Unit Tests:** inverted consumer index; extraction-quality tallying; idempotency (no-write on no-change).
- **Integration Tests:** 20-component fixture registry → generated index; one broken repo → `errors[]` + exit 3.
- **Manual/UI Testing:** build against 3 pilot repos.
- **Edge-Case Matrix:** duplicate ids across repos; empty registry; repo without `component.json`.
- **Acceptance-Criteria Mapping:** AC1-3 → build integration + index snapshot; AC4 → idempotency test; AC5 → error-handling test.
- **Execution Commands:** `pnpm run test:unit`, `pnpm run test:integration`, `pnpm run validate`.

#### Migration Requirements

- Not applicable. Opt-out rationale: `index.yaml` is fully regenerated each build.

#### Implementation Steps

1. Implement registry reading + manifest mirroring.
2. Build the component summary and inverted contract index.
3. Compute domains/flows/quality; write `index.yaml` deterministically.
4. Implement idempotent write + `errors[]` handling.

#### Files to Create/Modify

- `core/catalog/build.ts`, `core/catalog/index-model.ts`
- fixtures (20-component) + `*.test.ts`

#### Definition of Done Checklist

- [ ] Code implemented per technical guidelines
- [ ] Tests written and passing
- [ ] Quality gates passing
- [ ] Code reviewed and approved
- [ ] Acceptance criteria verified and mapped to test evidence
- [ ] Migration opt-out documented
- [ ] Pull Request created and merged

---

### Story S-012: `dt catalog validate` — referential integrity and V01-V19

**Priority:** Critical
**Estimated Size:** M
**Dependencies:** S-011

#### User Story

As CI,
I want `dt catalog validate` to enforce referential integrity and the V01-V19 checks,
So that the catalog fails loudly instead of letting agents operate on a lying map.

#### Context

Spec §6.2 validate checks (RF-23, RF-26, RF-27). Errors abort with exit 4; warnings do not.

#### Acceptance Criteria

- [ ] Every `consumes[].contract` resolves to an existing `provides[].id`; unresolved → V04 error (RF-23).
- [ ] Identity uniqueness (V02/V03), domain existence (V05), doc/path existence (V06/V07), and non-empty manual fields (V11) are enforced as errors.
- [ ] Low-confidence components are flagged: >30% low fields (V17) and low-payload contracts with consumers (V18) as warnings (RF-26).
- [ ] Undeclared cycles are a warning, or an error under `--strict` (V12, RF-27).
- [ ] Exit 0 without errors, 4 with errors; `--json` lists checks with severities.

#### Business Rules

- Fail loudly (business rule); low-confidence extraction is surfaced, never hidden.

#### Technical Notes

- Reuse the schema from S-010 for V01; graph/closure utilities shared with S-013/S-019.

#### Testing Requirements

- **Unit Tests:** each check V01-V19 in isolation with a targeted fixture.
- **Integration Tests:** full catalog fixture with seeded violations → expected report + exit code.
- **Manual/UI Testing:** validate the pilot catalog.
- **Edge-Case Matrix:** cycle with/without `allowed_cycles`; deprecated lifecycle with active consumers (V16); contract with no consumers (V13).
- **Acceptance-Criteria Mapping:** AC1-4 → per-check unit tests; AC5 → exit-code + `--json` tests.
- **Execution Commands:** `pnpm run test:unit`, `pnpm run test:integration`, `pnpm run validate`.

#### Migration Requirements

- Not applicable. Opt-out rationale: read-only validation.

#### Implementation Steps

1. Implement referential-integrity resolution.
2. Implement each V-check with severity.
3. Implement cycle detection + `--strict`.
4. Aggregate report + exit codes + `--json`.

#### Files to Create/Modify

- `core/catalog/validate.ts`, `core/catalog/graph.ts`, `core/catalog/checks/*.ts`
- fixtures + `*.test.ts`

#### Definition of Done Checklist

- [ ] Code implemented per technical guidelines
- [ ] Tests written and passing
- [ ] Quality gates passing
- [ ] Code reviewed and approved
- [ ] Acceptance criteria verified and mapped to test evidence
- [ ] Migration opt-out documented
- [ ] Pull Request created and merged

---

### Story S-013: Catalog query and routing (`resolve`, `get`, `deps`, `consumers`, `flow`, `closure`, `coverage`)

**Priority:** High
**Estimated Size:** L
**Dependencies:** S-011

#### User Story

As `product-engineer`,
I want deterministic catalog queries — especially the lexical `resolve` scorer — plus dependency, consumer, flow, closure, and coverage reads,
So that task text maps to candidate components explainably, without embeddings, before any LLM call.

#### Context

Spec §6.2 resolve scoring + queries (RF-24 flows, RF-28 aliases, RF-53 coverage). Feeds the candidate step of scoping (S-018).

#### Acceptance Criteria

- [ ] `resolve --text` returns the top 12 candidates with score and matched signal, using the weighted scheme (exact id 100 … name/description 25), normalized (lowercase, de-accented, light es/en stemming, stopwords), default threshold 20.
- [ ] `get`, `deps [--depth --direction]`, `consumers --contract`, `flow --id`, and `closure --ids [--include-consumers --max]` return correct graph reads.
- [ ] `coverage` reports extraction quality per component and per confidence (RF-53).
- [ ] Business `aliases` and flow aliases participate in routing (RF-28, RF-24).
- [ ] All commands support `--json`.

#### Business Rules

- Deterministic and explainable; no embeddings in v1 (spec §6.2).

#### Technical Notes

- Graph utilities shared with S-012/S-019.

#### Testing Requirements

- **Unit Tests:** scorer per signal; normalization; threshold; depth/direction traversal.
- **Integration Tests:** labeled resolve cases → expected candidate ordering; closure with/without consumers.
- **Manual/UI Testing:** `dt catalog resolve --text "pago en cuotas"` on the pilot catalog.
- **Edge-Case Matrix:** accented/typo input; alias substring vs. exact; disconnected component; cycle in deps traversal.
- **Acceptance-Criteria Mapping:** AC1 → scorer tests; AC2 → traversal tests; AC3 → coverage snapshot; AC4 → alias-routing tests; AC5 → `--json`.
- **Execution Commands:** `pnpm run test:unit`, `pnpm run test:integration`, `pnpm run validate`.

#### Migration Requirements

- Not applicable. Opt-out rationale: read-only queries.

#### Implementation Steps

1. Implement text normalization + the weighted scorer.
2. Implement graph reads (get/deps/consumers/flow/closure).
3. Implement `coverage` aggregation.
4. Wire `--json` for all.

#### Files to Create/Modify

- `core/catalog/resolve.ts`, `core/catalog/queries.ts`, `core/catalog/coverage.ts`
- `*.test.ts`

#### Definition of Done Checklist

- [ ] Code implemented per technical guidelines
- [ ] Tests written and passing
- [ ] Quality gates passing
- [ ] Code reviewed and approved
- [ ] Acceptance criteria verified and mapped to test evidence
- [ ] Migration opt-out documented
- [ ] Pull Request created and merged

---

### Story S-014: Meta-repo scaffold and scheduled CI rebuild

**Priority:** High
**Estimated Size:** M
**Dependencies:** S-011, S-012

#### User Story

As an architect,
I want a meta-repo scaffold and a scheduled CI rebuild that builds, validates, and commits the catalog,
So that the catalog stays fresh with minimal moving parts on both GitHub and Bitbucket.

#### Context

Spec §4.5 meta-repo layout + §15 CI. Recommendation: hourly scheduled rebuild with `--max-index-age` as the safety net (Bitbucket has no `repository_dispatch`).

#### Acceptance Criteria

- [ ] A scaffold generates the meta-repo layout (`architecture.md`, `domains.md`, `glossary.md`, `conventions.md`, `platform.yaml`, `registry.yaml`, `adr/`, `catalog/`, `schemas/`).
- [ ] A CI job runs `dt catalog build --registry registry.yaml` → `dt catalog validate --strict` → commits `catalog/` if changed (bot, no review).
- [ ] The job is provided for both GitHub (schedule) and Bitbucket (custom/scheduled) with documented Node prerequisite.
- [ ] A build failure raises an alert (silent catalog failure is the primary risk).

#### Business Rules

- Generated `catalog/components/` and `index.yaml` are committed by a bot without review; humans PR only source docs (business rule).

#### Technical Notes

- Verify Node availability in the Bitbucket base image before committing (open risk).

#### Testing Requirements

- **Unit Tests:** scaffold file generation.
- **Integration Tests:** run the build+validate sequence against the fixture registry in a CI-like harness.
- **Manual/UI Testing:** dry-run the scheduled job on a pilot meta-repo.
- **Edge-Case Matrix:** no changes → no commit; validation error → job fails + alert; missing Node → clear failure via `npx`.
- **Acceptance-Criteria Mapping:** AC1 → scaffold test; AC2/4 → CI harness test; AC3 → both pipeline files present + linted.
- **Execution Commands:** `pnpm run test:integration`, `pnpm run validate`.

#### Migration Requirements

- Not applicable. Opt-out rationale: repository scaffolding + CI config.

#### Implementation Steps

1. Implement the meta-repo scaffold command/template.
2. Author the GitHub and Bitbucket pipeline definitions.
3. Wire build → validate → conditional commit + alert.

#### Files to Create/Modify

- `core/catalog/scaffold.ts`, templates under `skills/` or `templates/`
- `.github/workflows/*.yml` and `bitbucket-pipelines.yml` templates
- `*.test.ts`

#### Definition of Done Checklist

- [ ] Code implemented per technical guidelines
- [ ] Tests written and passing
- [ ] Quality gates passing
- [ ] Code reviewed and approved
- [ ] Acceptance criteria verified and mapped to test evidence
- [ ] Migration opt-out documented
- [ ] Pull Request created and merged

---

## Phase 3 — Context

### Story S-015: `dt ctx fetch` — sparse clone and SHA cache

**Priority:** Critical
**Estimated Size:** M
**Dependencies:** S-001

#### User Story

As `product-engineer`,
I want `dt ctx fetch` to sparse-clone only `component.json`, `docs/`, and `contracts/` and cache by SHA,
So that context loading is fast, immutable, and never pulls whole repos.

#### Context

Spec §6.3 fetch (RF-36). Cache is immutable per SHA with LRU GC.

#### Acceptance Criteria

- [ ] Fetch uses `git clone --filter=blob:none --no-checkout --depth 1` + `sparse-checkout set docs contracts` + checkout of the pinned SHA.
- [ ] Cache lives at `~/.dev-tasks/cache/<host>/<org>/<repo>/<sha>/` and is treated as immutable.
- [ ] GC evicts by LRU over 5 GB or 30 days.
- [ ] Concurrency 8, 60s timeout per repo; failure → exit 5.
- [ ] `--refresh` re-fetches; `--json` reports cache hits/misses.

#### Business Rules

- Read-only access; no write to component repos (security §12).

#### Technical Notes

- `execa` git binary; require git ≥2.37 (doctor).

#### Testing Requirements

- **Unit Tests:** cache path derivation; LRU eviction logic; timeout handling.
- **Integration Tests:** fetch a local fixture repo; cache hit on re-fetch; `--refresh` bypass.
- **Manual/UI Testing:** fetch a pilot repo; inspect cache.
- **Edge-Case Matrix:** unreachable repo → exit 5; partial clone interrupted; cache over budget → GC; old git → doctor-guarded failure.
- **Acceptance-Criteria Mapping:** AC1-2 → fetch integration; AC3 → GC unit; AC4 → concurrency/timeout tests; AC5 → refresh/json tests.
- **Execution Commands:** `pnpm run test:unit`, `pnpm run test:integration`, `pnpm run validate`.

#### Migration Requirements

- Not applicable. Opt-out rationale: local cache, no schema.

#### Implementation Steps

1. Implement the sparse-clone git sequence via `execa`.
2. Implement the SHA-keyed cache + hit/miss reporting.
3. Implement LRU GC.
4. Implement concurrency + timeout + exit 5.

#### Files to Create/Modify

- `core/context/fetch.ts`, `core/context/cache.ts`
- `*.test.ts`

#### Definition of Done Checklist

- [ ] Code implemented per technical guidelines
- [ ] Tests written and passing
- [ ] Quality gates passing
- [ ] Code reviewed and approved
- [ ] Acceptance criteria verified and mapped to test evidence
- [ ] Migration opt-out documented
- [ ] Pull Request created and merged

---

### Story S-016: `dt ctx assemble` — layered, budgeted, deterministic bundle

**Priority:** Critical
**Estimated Size:** L
**Dependencies:** S-015

#### User Story

As `product-engineer`,
I want `dt ctx assemble` to build a fixed-order, budget-capped context bundle with recorded truncation,
So that the loaded context stays bounded and byte-for-byte reproducible.

#### Context

Spec §6.3 assemble layers (RF-37, RNF-03, RNF-06, O3). Non-truncable layers are never cut; if the minimum does not fit, exit 6.

#### Acceptance Criteria

- [ ] Layers are written in the fixed order and priority of spec §6.3 with per-layer token caps; `secondary` components contribute only a summary.
- [ ] Total default budget ≤60k tokens (RNF-03); truncation happens in reverse priority and is recorded in `bundle.truncated[]`.
- [ ] Non-truncable layers (index, flow, conventions-delta) are never cut; if the minimum does not fit, exit 6.
- [ ] The bundle is deterministic: fixed order, no in-file timestamps, SHA-256 per file (RNF-06).
- [ ] Boundary contracts render with visible confidence.

#### Business Rules

- If the bundle cannot fit two primaries, the problem is the feature cut / local doc size (spec §16), not the budget.

#### Technical Notes

- Token counting utility shared with `session.lock.json` (S-017).

#### Testing Requirements

- **Unit Tests:** per-layer cap; truncation order; determinism (repeated assemble → identical hashes).
- **Integration Tests:** assemble from a scope + fixtures → expected file set + `truncated[]`.
- **Manual/UI Testing:** assemble a pilot scope; inspect `00-index.md`.
- **Edge-Case Matrix:** oversized architecture doc → truncation recorded; minimum doesn't fit → exit 6; secondary summary only.
- **Acceptance-Criteria Mapping:** AC1/5 → layer tests; AC2 → budget/truncation tests; AC3 → exit-6 test; AC4 → determinism test.
- **Execution Commands:** `pnpm run test:unit`, `pnpm run test:integration`, `pnpm run validate`.

#### Migration Requirements

- Not applicable. Opt-out rationale: produces ephemeral session artifacts.

#### Implementation Steps

1. Implement layer renderers in fixed order with caps.
2. Implement token counting + reverse-priority truncation.
3. Enforce non-truncable layers + exit 6.
4. Emit per-file SHA-256; guarantee determinism.

#### Files to Create/Modify

- `core/context/assemble.ts`, `core/context/layers/*.ts`, `core/context/tokens.ts`
- `*.test.ts`

#### Definition of Done Checklist

- [ ] Code implemented per technical guidelines
- [ ] Tests written and passing
- [ ] Quality gates passing
- [ ] Code reviewed and approved
- [ ] Acceptance criteria verified and mapped to test evidence
- [ ] Migration opt-out documented
- [ ] Pull Request created and merged

---

### Story S-017: `dt init --components` — manual scope, pin, freshness, session lock

**Priority:** Critical
**Estimated Size:** M
**Dependencies:** S-014, S-016

#### User Story

As `product-engineer`,
I want `dt init --components a,b` to pin the meta-repo, check index freshness, assemble a bundle, and emit `session.lock.json`,
So that I can drive a reproducible multi-repo context with manual scope before LLM scoping exists.

#### Context

Spec §5.6 + §6.5 (RF-31, RF-38, RF-39). This is the deterministic init path (no LLM), unblocking Phase 3 value.

#### Acceptance Criteria

- [ ] `init` resolves the meta-repo to a SHA and pins it for the session (RF-31).
- [ ] `init` fails with exit 9 if the index age exceeds `--max-index-age` (default 240) (RF-39).
- [ ] `--components` (or `--no-llm` with `--components`) sets the scope directly; `--no-llm` without components → exit 2.
- [ ] Unknown component in scope → exit 12.
- [ ] `session.lock.json` is emitted with task hash, meta-repo SHA, index age, scope+source, per-repo SHAs, and bundle file hashes/tokens (RF-38); the same lock reproduces the same bundle.

#### Business Rules

- Pin for the whole session; fail loudly on a stale index (business rules).

#### Technical Notes

- Reuses fetch (S-015), assemble (S-016), and catalog reads (S-013).

#### Testing Requirements

- **Unit Tests:** pin resolution; freshness check; session-lock assembly.
- **Integration Tests:** end-to-end `init --components` over local fixture repos → lock + bundle; re-run reproduces byte-for-byte.
- **Manual/UI Testing:** run against the pilot meta-repo + 2 components.
- **Edge-Case Matrix:** stale index → exit 9; unknown component → exit 12; `--no-llm` without components → exit 2.
- **Acceptance-Criteria Mapping:** AC1-4 → init integration + exit-code tests; AC5 → reproducibility test.
- **Execution Commands:** `pnpm run test:unit`, `pnpm run test:integration`, `pnpm run validate`.

#### Migration Requirements

- Not applicable. Opt-out rationale: session artifacts only.

#### Implementation Steps

1. Implement meta-repo pin + sparse fetch of `*.md`, `catalog/`, `schemas/`, `adr/`.
2. Implement freshness check + exit 9.
3. Implement manual-scope path + unknown-component guard.
4. Emit `session.lock.json` + verify reproducibility.

#### Files to Create/Modify

- `core/context/init.ts`, `core/context/session-lock.ts`
- `bin/dt.ts` (init command)
- `*.test.ts`

#### Definition of Done Checklist

- [ ] Code implemented per technical guidelines
- [ ] Tests written and passing
- [ ] Quality gates passing
- [ ] Code reviewed and approved
- [ ] Acceptance criteria verified and mapped to test evidence
- [ ] Migration opt-out documented
- [ ] Pull Request created and merged

---

## Phase 4 — Scoping

### Story S-018: LLM scoping step with schema-validated output and repair retry

**Priority:** Critical
**Estimated Size:** M
**Dependencies:** S-013

#### User Story

As `product-engineer`,
I want the LLM to receive only lexical candidates and return schema-validated scope JSON with one repair retry,
So that scoping is bounded, explainable, and never hallucinates unknown components.

#### Context

Spec §7 + §8.2 (RF-32, RF-33). The model sees only candidates/flows/domains, never the full catalog.

#### Acceptance Criteria

- [ ] The scoping input contains only task, `candidates`, `flows`, and `domains` (spec §7.1).
- [ ] Output validates against `scope-output.schema.json` (required `primary` 1-6, `secondary` ≤8, `contracts_crossed`, `confidence`, `unresolved`, `rationale` ≤600; optional `flow`).
- [ ] Post-schema validation rejects any id not present in candidates/index, triggering a single repair retry; a second failure → exit 10 (RF-33).
- [ ] Prompt rules are enforced: choose only from candidates; `low` confidence when ambiguous; list unmapped capabilities in `unresolved`.
- [ ] Calibration data (proposed scope, confidence) is recorded per session for later precision/recall analysis (spec §7.4).

#### Business Rules

- Deterministic first: the LLM only decides scope from candidates; ambiguity → `low` (business rule).

#### Technical Notes

- Candidates come from S-013 `resolve`.

#### Testing Requirements

- **Unit Tests:** schema validation; invented-id rejection; retry logic; calibration record shape.
- **Integration Tests:** mocked LLM returning valid/invalid/second-invalid → pass/repair/exit 10.
- **Manual/UI Testing:** run scoping on a labeled sample task.
- **Edge-Case Matrix:** empty candidates upstream; id in index but not candidates; overlong rationale; non-JSON output.
- **Acceptance-Criteria Mapping:** AC1-2 → input/schema tests; AC3 → retry/exit tests; AC4 → prompt-rule tests; AC5 → calibration test.
- **Execution Commands:** `pnpm run test:unit`, `pnpm run test:integration`, `pnpm run validate`.

#### Migration Requirements

- Not applicable. Opt-out rationale: no persistent data model.

#### Implementation Steps

1. Build the scoping prompt + input assembler.
2. Implement schema + post-schema id validation.
3. Implement the single repair retry + exit 10.
4. Record calibration data per session.

#### Files to Create/Modify

- `core/scope/scoping.ts`, `core/scope/prompt.ts`, `core/scope/calibration.ts`
- `schemas/scope-output.schema.json` (from S-010)
- `*.test.ts`

#### Definition of Done Checklist

- [ ] Code implemented per technical guidelines
- [ ] Tests written and passing
- [ ] Quality gates passing
- [ ] Code reviewed and approved
- [ ] Acceptance criteria verified and mapped to test evidence
- [ ] Migration opt-out documented
- [ ] Pull Request created and merged

---

### Story S-019: Graph closure and `dt scope gate` with partition proposal

**Priority:** Critical
**Estimated Size:** M
**Dependencies:** S-013, S-018

#### User Story

As a tech lead,
I want scope expanded by graph closure and gated (G1-G7), aborting over-broad or ambiguous scopes with a partition proposal,
So that a badly cut feature is caught before tokens are spent.

#### Context

Spec §6.4 + §8.3 (RF-34, RF-35, RF-40, RF-41). Abort exit code 7 is distinct from an error.

#### Acceptance Criteria

- [ ] Closure adds `contracts_crossed` consumers and flow neighbors to `secondary`, dedupes (primary wins), and records `scope.source = {llm, closure}` (RF-34).
- [ ] G1 (>max components) aborts with a producer-before-consumer partition proposal (RF-35); exit 7.
- [ ] G2 (`confidence: low`), G3 (non-empty `unresolved`), G4 (component without `component.json`) abort.
- [ ] G5 (LLM component absent from candidates+closure, RF-40), G6 (>2 domains), G7 (low-payload boundary contract, RF-41) continue with `review_flags`.
- [ ] `--max-components` is configurable (default 4).

#### Business Rules

- Fail loudly; abort is a system decision (exit 7), not an error (business rule).

#### Technical Notes

- Reuse graph utilities from S-012/S-013.

#### Testing Requirements

- **Unit Tests:** closure dedup + source tagging; each gate rule G1-G7.
- **Integration Tests:** scope fixtures triggering each gate outcome → abort/continue + flags.
- **Manual/UI Testing:** run a deliberately broad task; inspect the partition proposal.
- **Edge-Case Matrix:** exactly at the limit; multi-domain but small; low-payload contract present; LLM-only component.
- **Acceptance-Criteria Mapping:** AC1 → closure tests; AC2-4 → abort tests; AC4(cont) → flag tests; AC5 → config test.
- **Execution Commands:** `pnpm run test:unit`, `pnpm run test:integration`, `pnpm run validate`.

#### Migration Requirements

- Not applicable. Opt-out rationale: computation only.

#### Implementation Steps

1. Implement graph closure + source tagging.
2. Implement gate rules G1-G7.
3. Implement the partition proposal (group by domain/boundary, order producer-first).
4. Wire exit 7 + `review_flags`.

#### Files to Create/Modify

- `core/scope/closure.ts`, `core/scope/gate.ts`, `core/scope/partition.ts`
- `*.test.ts`

#### Definition of Done Checklist

- [ ] Code implemented per technical guidelines
- [ ] Tests written and passing
- [ ] Quality gates passing
- [ ] Code reviewed and approved
- [ ] Acceptance criteria verified and mapped to test evidence
- [ ] Migration opt-out documented
- [ ] Pull Request created and merged

---

### Story S-020: Full `dt init` orchestration (candidates → scope → closure → gate → bundle)

**Priority:** Critical
**Estimated Size:** M
**Dependencies:** S-017, S-018, S-019

#### User Story

As `product-engineer`,
I want `dt init --task "<text>"` to run the full pipeline end-to-end,
So that a natural-language task produces a scoped, gated, bounded bundle and a session lock without manual scope.

#### Context

Spec §8.4 orchestration (RF-30). Wires the deterministic and LLM steps into the single command, honoring all exit codes.

#### Acceptance Criteria

- [ ] `dt init --task` runs pin → candidates → LLM scope → closure → gate → fetch → assemble → session lock (spec §8.4).
- [ ] Each failure maps to its exit code (9 stale, 11 no candidates, 10 invalid scope, 12 unknown component, 7 gate abort, 6 budget).
- [ ] `review_flags` from the gate are surfaced in the emitted result and `session.lock.json`.
- [ ] `--budget`, `--max-components`, `--max-index-age`, `--flow`, and `--out` are honored.
- [ ] `--json` emits `{ session, bundle, scope, review_flags }`.

#### Business Rules

- The whole chain is deterministic except the single scoping call (business rule).

#### Technical Notes

- This is integration wiring; most logic lives in S-015..S-019.

#### Testing Requirements

- **Unit Tests:** flag/option plumbing; result shape.
- **Integration Tests:** end-to-end happy path over fixtures; one test per failure exit code.
- **Manual/UI Testing:** run a real pilot task; confirm bundle + flags.
- **Edge-Case Matrix:** gate abort mid-pipeline (no fetch); stale index short-circuit; empty candidates.
- **Acceptance-Criteria Mapping:** AC1 → e2e test; AC2 → exit-code matrix; AC3 → flag surfacing; AC4-5 → option/json tests.
- **Execution Commands:** `pnpm run test:integration`, `pnpm run validate`.

#### Migration Requirements

- Not applicable. Opt-out rationale: orchestration only.

#### Implementation Steps

1. Wire the pipeline per §8.4 pseudocode.
2. Map every failure to its exit code.
3. Surface `review_flags` into result + session lock.
4. Honor all options; emit `--json`.

#### Files to Create/Modify

- `core/context/init.ts` (extend from S-017)
- `bin/dt.ts`
- `*.test.ts`

#### Definition of Done Checklist

- [ ] Code implemented per technical guidelines
- [ ] Tests written and passing
- [ ] Quality gates passing
- [ ] Code reviewed and approved
- [ ] Acceptance criteria verified and mapped to test evidence
- [ ] Migration opt-out documented
- [ ] Pull Request created and merged

---

## Phase 5 — product-engineer Integration

### Story S-021: Rewrite the `init` skill with mono/multi/greenfield mode detection

**Priority:** Critical
**Estimated Size:** M
**Dependencies:** S-009, S-020

#### User Story

As `product-engineer`,
I want the `init` skill to detect mono-repo, multi-repo, and undocumented-repo modes and route accordingly,
So that context resolution always goes through `dt` instead of reading `/docs` directly.

#### Context

Spec §9.1 (RF-60, RF-61, RF-11). The skill stops navigating repos on its own; all context resolution passes through `dt`.

#### Acceptance Criteria

- [ ] The skill detects: `component.json` present → multi-repo; else `/docs` present → mono-repo (current flow); else undocumented/greenfield.
- [ ] Multi-repo mode invokes `dt init --task --json` and handles exit 7 (partition proposal, stop), 9 (stale catalog, stop), 0 (load bundle in numeric order, present `review_flags` before planning) (RF-61).
- [ ] Undocumented mode runs `dt extract detect` → `dt extract all --interactive`, then the interview for `product-context.md`/`technical-guidelines.md`, then presents the extraction report (RF-11).
- [ ] The skill no longer reads `/docs` or walks repos directly in multi-repo mode.
- [ ] The skill is updated consistently across all three platform trees (`.github/`, `.claude/`, `.kiro/`).

#### Business Rules

- All context resolution passes through `dt` (business rule).

#### Technical Notes

- This edits skill/agent Markdown, not TypeScript; keep behavioral parity across trees.

#### Testing Requirements

- **Unit Tests:** n/a (documentation artifact) — use structural checks instead.
- **Integration Tests:** a scripted dry-run walkthrough per mode confirming the documented branch + `dt` invocation.
- **Manual/UI Testing:** run `product-engineer` init against a multi-repo pilot and an undocumented pilot.
- **Edge-Case Matrix:** repo with both `component.json` and `/docs`; exit 7/9 handling; interrupted interactive extraction.
- **Acceptance-Criteria Mapping:** AC1-4 → dry-run walkthroughs; AC5 → three-tree parity check.
- **Execution Commands:** `pnpm run validate`; parity/structure check script.

#### Migration Requirements

- Not applicable. Opt-out rationale: skill content change.

#### Implementation Steps

1. Rewrite the `init` skill mode-detection logic.
2. Document multi-repo `dt init` handling incl. exit codes.
3. Document undocumented-mode extraction + interview flow.
4. Mirror across `.github/`, `.claude/`, `.kiro/`.

#### Files to Create/Modify

- `.kiro/skills/activity-init/SKILL.md` and platform equivalents
- `product-engineer` agent files (all trees) if flow references change

#### Definition of Done Checklist

- [ ] Content implemented per guidelines
- [ ] Dry-run walkthroughs + parity check passing
- [ ] Quality gates passing
- [ ] Reviewed and approved
- [ ] Acceptance criteria verified and mapped to evidence
- [ ] Migration opt-out documented
- [ ] Pull Request created and merged

---

### Story S-022: `architecture-change` task type with meta-repo write authority

**Priority:** High
**Estimated Size:** M
**Dependencies:** S-021

#### User Story

As an architect,
I want an `architecture-change` task type that is the only mode allowing meta-repo writes, requires an ADR, and needs human approval,
So that the semantic layer stays coherent and generated artifacts are never hand-edited.

#### Context

Spec §9.2 (RF-62, RF-64). Enforces meta-repo write authority and the ADR requirement.

#### Acceptance Criteria

- [ ] `architecture-change` may modify `architecture.md`, `domains.md`, `glossary.md`, `conventions.md`, and `catalog/flows/`, but not `catalog/components/` or `catalog/index.yaml` (RF-62).
- [ ] It requires an ADR (context, decision, consequences, alternatives) before the PR.
- [ ] It requires human approval before the PR; no auto-merge into the default branch.
- [ ] Agents cannot write to the meta-repo outside this task type (RF-64).
- [ ] Documented consistently across the three platform trees.

#### Business Rules

- Meta-repo writes are privileged; generated files are never hand-edited (business rule).

#### Technical Notes

- Aligns with existing branch/PR discipline (AGENTS.md, git-guard).

#### Testing Requirements

- **Unit Tests:** n/a (agent contract) — structural checks.
- **Integration Tests:** dry-run confirming write scope + ADR + approval gate; attempt to edit `index.yaml` → refused.
- **Manual/UI Testing:** run an `architecture-change` task on a pilot meta-repo.
- **Edge-Case Matrix:** attempt outside the task type → blocked; missing ADR → blocked; attempt to auto-merge → blocked.
- **Acceptance-Criteria Mapping:** AC1-4 → dry-run + refusal tests; AC5 → parity check.
- **Execution Commands:** `pnpm run validate`; parity check.

#### Migration Requirements

- Not applicable. Opt-out rationale: agent contract change.

#### Implementation Steps

1. Define the `architecture-change` task type in the agent contracts.
2. Document write scope + generated-file prohibition.
3. Document ADR + approval requirements.
4. Mirror across trees.

#### Files to Create/Modify

- `product-engineer` (and relevant agent) files across trees
- `AGENTS.md` (task-type reference)

#### Definition of Done Checklist

- [ ] Content implemented per guidelines
- [ ] Dry-run + parity check passing
- [ ] Quality gates passing
- [ ] Reviewed and approved
- [ ] Acceptance criteria verified and mapped to evidence
- [ ] Migration opt-out documented
- [ ] Pull Request created and merged

---

### Story S-023: Cross-repo partitioning into per-repo sub-tasks

**Priority:** Medium
**Estimated Size:** M
**Dependencies:** S-019, S-021

#### User Story

As `product-engineer`,
I want multi-`primary` features partitioned into per-repo sub-tasks with the boundary contract as the interface,
So that cross-repo work is executed per repo, producer before consumers, against contracts rather than foreign implementations.

#### Context

Spec §9.3 (RF-63). Connects to contract testing: a cross-repo scenario runs as a consumer test and a provider verification.

#### Acceptance Criteria

- [ ] With >1 `primary` component, the agent produces one sub-task per repo, scoped to that repo.
- [ ] Each sub-task uses the boundary contract (with target version) as its interface and expresses acceptance against the contract, not the foreign implementation.
- [ ] Sub-tasks are ordered producer-before-consumers.
- [ ] A boundary contract with `payload_confidence: low` must be raised to `medium` before use as an acceptance boundary (spec §9.3).
- [ ] Documented consistently across the three platform trees.

#### Business Rules

- Execution stays per repo; MRC produces the partition, not orchestration (non-goal).

#### Technical Notes

- Consumes the partition proposal shape from S-019.

#### Testing Requirements

- **Unit Tests:** n/a (agent contract) — structural checks.
- **Integration Tests:** dry-run over a two-primary scope → ordered per-repo sub-tasks referencing the contract.
- **Manual/UI Testing:** run on a pilot cross-repo feature (e.g., checkout + payment).
- **Edge-Case Matrix:** low-payload boundary → blocked until raised; single primary → no partition; circular producer/consumer.
- **Acceptance-Criteria Mapping:** AC1-3 → dry-run tests; AC4 → low-payload guard; AC5 → parity check.
- **Execution Commands:** `pnpm run validate`; parity check.

#### Migration Requirements

- Not applicable. Opt-out rationale: agent contract change.

#### Implementation Steps

1. Document the partitioning procedure in the agent contracts.
2. Specify contract-as-interface acceptance and ordering.
3. Add the low-payload elevation guard.
4. Mirror across trees.

#### Files to Create/Modify

- `product-engineer` (and relevant agent) files across trees

#### Definition of Done Checklist

- [ ] Content implemented per guidelines
- [ ] Dry-run + parity check passing
- [ ] Quality gates passing
- [ ] Reviewed and approved
- [ ] Acceptance criteria verified and mapped to evidence
- [ ] Migration opt-out documented
- [ ] Pull Request created and merged

---

## Phase 6 — Verification and Outer Loop

### Story S-024: `dt verify contract-diff` (OpenAPI + AsyncAPI breaking-change detection)

**Priority:** High
**Estimated Size:** M
**Dependencies:** S-011

#### User Story

As CI,
I want `dt verify contract-diff` to detect breaking changes in OpenAPI (via `oasdiff`) and AsyncAPI (via a custom comparator) without an LLM,
So that boundary breakage is caught deterministically before merge.

#### Context

Spec §6.6 + §8 (RF-50). Skips `payload_confidence: low` payloads to avoid constant false positives.

#### Acceptance Criteria

- [ ] OpenAPI diffs use `oasdiff`; AsyncAPI diffs use the custom comparator (removed channel, new required field, changed type, narrowed enum).
- [ ] No LLM is used in any case (RF-50).
- [ ] Contracts with `payload_confidence: low` are excluded from breaking-change evaluation.
- [ ] A detected breaking change exits 8.
- [ ] Runs on component-repo PRs when `contracts/` changed.

#### Business Rules

- A low-confidence payload is never treated as a firm contract (business rule).

#### Technical Notes

- Wrap `oasdiff`; implement the AsyncAPI comparator in `core/`.

#### Testing Requirements

- **Unit Tests:** AsyncAPI comparator per breaking-change class; low-payload skip.
- **Integration Tests:** OpenAPI base/head fixtures (breaking/non-breaking) → exit 8/0; AsyncAPI likewise.
- **Manual/UI Testing:** run on a pilot contract change.
- **Edge-Case Matrix:** additive-only change → non-breaking; enum widened vs. narrowed; low-payload change → skipped.
- **Acceptance-Criteria Mapping:** AC1-2 → comparator tests; AC3 → skip test; AC4 → exit-8 test; AC5 → CI integration.
- **Execution Commands:** `pnpm run test:unit`, `pnpm run test:integration`, `pnpm run validate`.

#### Migration Requirements

- Not applicable. Opt-out rationale: read-only diff.

#### Implementation Steps

1. Integrate `oasdiff` for OpenAPI.
2. Implement the AsyncAPI comparator.
3. Add the low-payload skip + exit 8.
4. Wire the component-repo PR CI step.

#### Files to Create/Modify

- `core/verify/contract-diff.ts`, `core/verify/asyncapi-diff.ts`
- CI template step
- `*.test.ts`

#### Definition of Done Checklist

- [ ] Code implemented per technical guidelines
- [ ] Tests written and passing
- [ ] Quality gates passing
- [ ] Code reviewed and approved
- [ ] Acceptance criteria verified and mapped to test evidence
- [ ] Migration opt-out documented
- [ ] Pull Request created and merged

---

### Story S-025: `dt verify impact` and `dt verify drift`

**Priority:** Medium
**Estimated Size:** M
**Dependencies:** S-011, S-024

#### User Story

As a contract consumer,
I want `dt verify impact` to list affected consumers (optionally emitting per-repo tasks) and `dt verify drift` to flag stale docs,
So that a contract change surfaces its blast radius and documentation rot is prioritized.

#### Context

Spec §6.6 (RF-51, RF-52, RF-54). `impact` reads the inverted consumer index; `drift` is a `git log` heuristic.

#### Acceptance Criteria

- [ ] `impact --contract <id>` lists consumers from the inverted index with each consumer's `criticality` (RF-51).
- [ ] `--emit-tasks` produces per-consumer derived tasks via the tracker provider (RF-54).
- [ ] `drift [--id --threshold]` computes a docs/code recency heuristic over `paths.source` vs `docs.root` and reports it as a prioritization signal, not a proof (RF-52).
- [ ] Both support `--json`.
- [ ] `--emit-tasks` is gated behind the Platform Providers dependency and degrades gracefully when unavailable.

#### Business Rules

- Impact analysis may emit derived tasks (RF-54, P2); drift is a heuristic, not a gate.

#### Technical Notes

- Tracker emission depends on the (separate) Platform Providers spec; stub the interface here.

#### Testing Requirements

- **Unit Tests:** consumer lookup + criticality; drift heuristic computation.
- **Integration Tests:** impact over a fixture catalog → expected consumer list; `--emit-tasks` with a mock provider.
- **Manual/UI Testing:** run impact on a pilot contract.
- **Edge-Case Matrix:** contract with no consumers; provider unavailable → graceful skip; threshold boundary.
- **Acceptance-Criteria Mapping:** AC1 → impact test; AC2 → mock-provider test; AC3 → drift test; AC4 → `--json`; AC5 → provider-unavailable test.
- **Execution Commands:** `pnpm run test:unit`, `pnpm run test:integration`, `pnpm run validate`.

#### Migration Requirements

- Not applicable. Opt-out rationale: read-only analysis.

#### Implementation Steps

1. Implement `impact` over the inverted index + criticality.
2. Implement `--emit-tasks` against the tracker provider interface.
3. Implement the `drift` heuristic.
4. Wire `--json` + graceful provider degradation.

#### Files to Create/Modify

- `core/verify/impact.ts`, `core/verify/drift.ts`
- `core/providers/tracker.ts` (interface stub)
- `*.test.ts`

#### Definition of Done Checklist

- [ ] Code implemented per technical guidelines
- [ ] Tests written and passing
- [ ] Quality gates passing
- [ ] Code reviewed and approved
- [ ] Acceptance criteria verified and mapped to test evidence
- [ ] Migration opt-out documented
- [ ] Pull Request created and merged

---

## Coverage Validation

### Summary

- **Total PRD Requirements:** 75 (49 functional RF items, 10 non-functional RNF, 10 business rules, 12 acceptance criteria; plus data requirements and non-goals validated separately)
- **Total User Stories:** 25
- **Coverage:** 100% of functional and non-functional requirements mapped
- **Status:** Complete

### Requirement Mapping — Functional (RF)

| PRD Requirement                         | Story ID(s)   | Status     |
| --------------------------------------- | ------------- | ---------- |
| RF-01 stack/framework/ORM/msg detection | S-005         | ✅ Covered |
| RF-02 schema.md                         | S-006         | ✅ Covered |
| RF-03 OpenAPI                           | S-007         | ✅ Covered |
| RF-04 AsyncAPI topics/payloads          | S-008         | ✅ Covered |
| RF-05 derive component.json             | S-009         | ✅ Covered |
| RF-06 source + confidence               | S-009         | ✅ Covered |
| RF-07 prompt non-derivable fields       | S-009         | ✅ Covered |
| RF-08 aliases confirmation              | S-009         | ✅ Covered |
| RF-09 idempotent extraction             | S-009         | ✅ Covered |
| RF-10 no full service / prod access     | S-006, S-007  | ✅ Covered |
| RF-11 product-context/tech-guidelines   | S-021         | ✅ Covered |
| RF-12 pluggable extractors              | S-005         | ✅ Covered |
| RF-20 component.json at root            | S-009, S-010  | ✅ Covered |
| RF-21 aggregate into catalog            | S-011         | ✅ Covered |
| RF-22 generate index.yaml               | S-011         | ✅ Covered |
| RF-23 referential integrity             | S-012         | ✅ Covered |
| RF-24 model flows                       | S-013, S-010  | ✅ Covered |
| RF-25 generated_at + origin SHA         | S-011         | ✅ Covered |
| RF-26 flag low-confidence               | S-012         | ✅ Covered |
| RF-27 detect cycles                     | S-012         | ✅ Covered |
| RF-28 aliases for routing               | S-013         | ✅ Covered |
| RF-30 NL task input                     | S-020         | ✅ Covered |
| RF-31 pin meta-repo SHA                 | S-017         | ✅ Covered |
| RF-32 lexical candidates                | S-013, S-018  | ✅ Covered |
| RF-33 validated LLM JSON + retry        | S-018         | ✅ Covered |
| RF-34 graph closure                     | S-019         | ✅ Covered |
| RF-35 abort >4 + partition              | S-019         | ✅ Covered |
| RF-36 sparse fetch                      | S-015         | ✅ Covered |
| RF-37 deterministic budgeted bundle     | S-016         | ✅ Covered |
| RF-38 session.lock.json                 | S-017         | ✅ Covered |
| RF-39 stale-index abort                 | S-017         | ✅ Covered |
| RF-40 flag LLM-only components          | S-019         | ✅ Covered |
| RF-41 flag low-payload contracts        | S-019, S-008  | ✅ Covered |
| RF-50 breaking-change detection no-LLM  | S-024         | ✅ Covered |
| RF-51 affected consumers list           | S-025         | ✅ Covered |
| RF-52 docs/code drift                   | S-025         | ✅ Covered |
| RF-53 extraction coverage report        | S-013, S-009  | ✅ Covered |
| RF-54 derived tasks per consumer        | S-025         | ✅ Covered |
| RF-60 init mode detection               | S-021         | ✅ Covered |
| RF-61 invoke dt init in multi-repo      | S-021         | ✅ Covered |
| RF-62 architecture-change task type     | S-022         | ✅ Covered |
| RF-63 cross-repo sub-tasks              | S-023         | ✅ Covered |
| RF-64 no meta-repo writes otherwise     | S-022         | ✅ Covered |
| RF-70 one package, two binaries         | S-001         | ✅ Covered |
| RF-71 single version/release train      | S-001         | ✅ Covered |
| RF-72 hash-based update conflicts       | S-003         | ✅ Covered |
| RF-73 per-repo pin                      | S-002         | ✅ Covered |
| RF-74 dev-tasks.sh shim                 | S-004         | ✅ Covered |
| RF-75 npx without install               | S-001, S-014  | ✅ Covered |

### Requirement Mapping — Non-Functional (RNF)

| PRD Requirement                     | Story ID(s)         | Status     |
| ----------------------------------- | ------------------- | ---------- |
| RNF-01 init p50 ≤15s / cold ≤90s    | S-015, S-016, S-020 | ✅ Covered |
| RNF-02 extract ≤5 min/repo          | S-009               | ✅ Covered |
| RNF-03 bundle ≤60k tokens           | S-016               | ✅ Covered |
| RNF-04 `--json` everywhere          | S-001 (+ all)       | ✅ Covered |
| RNF-05 stable exit codes            | S-001               | ✅ Covered |
| RNF-06 reproducible bundle          | S-016, S-017        | ✅ Covered |
| RNF-07 no server state              | S-015               | ✅ Covered |
| RNF-08 no prod credentials          | S-006               | ✅ Covered |
| RNF-09 core adapter-independent     | S-001               | ✅ Covered |
| RNF-10 Node 20+ / git ≥2.37         | S-002               | ✅ Covered |

### Requirement Mapping — Business Rules, Acceptance Criteria, Data

| PRD Requirement                                  | Story ID(s)          | Status     |
| ------------------------------------------------ | -------------------- | ---------- |
| Business rules (deterministic-first, provenance, fail-loud, one-owner, payload-confidence gating, privileged meta-repo writes) | S-005, S-009, S-012, S-019, S-022, S-024 | ✅ Covered |
| PRD Acceptance Criteria 1-4 (init/gate/stale)    | S-020, S-019, S-017  | ✅ Covered |
| PRD Acceptance Criteria 5-8 (extract/provenance/idempotency/integrity) | S-009, S-012 | ✅ Covered |
| PRD Acceptance Criteria 9 (breaking change)      | S-024                | ✅ Covered |
| PRD Acceptance Criteria 10 (npx CI)              | S-001, S-014         | ✅ Covered |
| PRD Acceptance Criteria 11 (update conflict)     | S-003                | ✅ Covered |
| PRD Acceptance Criteria 12 (budget/truncation)   | S-016                | ✅ Covered |
| Data: component.json/flow/index/manifest/session-lock | S-009, S-010, S-011, S-002, S-017 | ✅ Covered |

### Non-Goals Validation

- [x] Developer-experience portal (Backstage/Port/Cortex) — Confirmed NOT in any story.
- [x] Auto-generated narrative documentation — Confirmed NOT in any story (LLM writes prose over extracted structure only).
- [x] Cross-repo execution orchestration — Confirmed NOT in any story (S-023 produces the partition only).
- [x] Monorepo support — Confirmed NOT in any story.
- [x] Schema registry — Confirmed NOT in any story (S-008 splits confidence instead).
- [x] Platform Providers specification — Confirmed NOT specified here; only referenced as a dependency stub in S-014, S-022, S-025.

### Deferred / Dependency Notes

- **OpenAPI route 2** (isolated framework boot) is intentionally deferred (PRD open question 1); S-005 reports its strategy count and S-007 leaves a capability hook. A follow-up story should be created once the measurement in Phase 1 decides build vs. degrade.
- **Platform Providers** operations (tracker task emission, PR comments, rebuild triggers) are stubbed behind an interface in S-014/S-022/S-025 and fully realized only when the separate Platform Providers spec is implemented.

---

## Execution Plan (High Level)

- **Phase 0 (S-001 → S-004):** distribution foundation; must land first.
- **Phase 1 (S-005 → S-009):** extraction; S-009 depends on S-005/S-006/S-007/S-008 and the S-003 reconciliation engine.
- **Phase 2 (S-010 → S-014):** catalog; S-010 first (schemas), then build/validate/query, then meta-repo CI.
- **Phase 3 (S-015 → S-017):** context; fetch → assemble → manual-scope init.
- **Phase 4 (S-018 → S-020):** scoping; LLM step → closure/gate → full init.
- **Phase 5 (S-021 → S-023):** product-engineer integration (skill/agent content across three trees).
- **Phase 6 (S-024 → S-025):** verification and outer loop.

Critical path: S-001 → S-003 → S-009 → S-011 → S-012 → S-016 → S-017 → S-020 → S-021. Standalone value lands at the end of Phase 1 (documents 20 repos) and again at the end of Phase 2 (verifiable product map).
