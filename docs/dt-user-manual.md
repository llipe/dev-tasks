# `dt` User Manual — How It Works

This document explains everything `dt` does, the techniques it uses internally, and how each feature is implemented.

## Overview

`dt` is one of two binaries shipped in the `@llipe.com/dev-tasks` npm package. While `dev-tasks` handles bootstrap and distribution (install, update, pin), `dt` is the runtime tool that extracts structured metadata from your repository's source code and configuration files.

Its core purpose: turn a repository into a machine-readable `component.json` manifest and an `extraction_report.json` quality summary — without running your application, without requiring credentials, and without inventing data.

---

## Architecture

```text
@llipe.com/dev-tasks
├── bin/dt.ts              CLI entrypoint, arg routing
├── adapters/cli/          Wraps core functions, formats human/JSON output
├── core/extract/          Extraction business logic
│   ├── detect.ts          Orchestrator: loads providers, first-match wins
│   ├── provider.ts        ExtractionProvider interface + types
│   ├── providers/         Pluggable stack-specific providers
│   │   └── node-ts.ts     The Node/TypeScript provider (only one shipped)
│   ├── schema.ts          Schema extraction orchestrator
│   ├── orm/               ORM-specific extractors (Prisma, Drizzle, TypeORM)
│   ├── openapi/           OpenAPI extraction (route 1 + route 3)
│   ├── asyncapi/          AsyncAPI extraction (kafkajs topic inventory)
│   ├── component.ts       component.json derivation + provenance
│   ├── report.ts          extraction_report.json generation
│   ├── prompt.ts          Interactive prompt for human-only fields
│   └── render/            Output renderers (schema.md Markdown + Mermaid)
├── core/reconcile.ts      Hash-based reconciliation engine
├── core/catalog/          Catalog artifact schemas + local validation (S-010+)
│   └── validate-component.ts  Offline JSON Schema (2020-12) validator via ajv
└── core/distribution/     Install, update, manifest, doctor
```

Key structural rule: **no business logic in `adapters/`**. The CLI adapter only parses arguments and formats output. All logic lives in `core/`.

---

## Commands

```bash
dt extract detect           # Report stack, framework, ORM, messaging
dt extract schema           # Extract DB schema from ORM definitions
dt extract openapi          # Extract or derive OpenAPI specification
dt extract asyncapi         # Extract Kafka topics from kafkajs usage
dt extract component        # Derive component.json with provenance
dt extract all              # Full pipeline: detect → schema → openapi → asyncapi → component → report
dt validate-component <path> # Validate a component.json manifest against the bundled schema
dt catalog build            # Aggregate manifests and generate catalog/index.yaml
dt catalog validate         # Run referential integrity checks V01-V19
dt catalog resolve          # Resolve text to components (weighted scorer)
dt catalog get              # Get a component by id
dt catalog deps             # List dependencies of a component
dt catalog consumers        # List consumers of a contract
dt catalog flow             # Show flow with participants
dt catalog closure          # Compute transitive dependency closure
dt catalog coverage         # Report extraction quality
dt catalog scaffold         # Generate meta-repo directory layout
```

All commands accept `--json` for machine-readable output.

---

## `dt extract detect` — Stack Detection

### What it does

Inspects your repository to identify the tech stack: language, HTTP framework, ORM, and messaging client. No code execution occurs — this is pure file and config inspection.

### How it works internally

1. **Reads `package.json`** — the primary signal source. Both `dependencies` and `devDependencies` are scanned.
2. **Dependency matching** — checks for known packages with priority ordering:
   - HTTP frameworks: `@nestjs/*` > `fastify` > `hono` > `express`
   - ORMs: `@prisma/client` or `prisma` > `drizzle-orm` or `drizzle-kit` > `typeorm`
   - Messaging: `kafkajs`
3. **File system checks** — looks for config files and schema files:
   - Prisma: `prisma/schema.prisma`, `schema.prisma`, `src/prisma/schema.prisma`
   - Drizzle: `drizzle.config.ts`, `src/db/schema.ts`, `db/schema.ts`
   - OpenAPI: `openapi.yaml`, `swagger.json`, `docs/openapi.yaml`, etc.
4. **OpenAPI strategy determination** — based on what's available:
   - Route 1 (introspected): an on-disk spec file exists, or `@nestjs/swagger` is present
   - Route 3 (AST inferred): the framework supports route discovery (always available for known frameworks)
   - Route 2 (framework boot): detected but not yet implemented

### Output

```json
{
  "stack": ["node", "typescript", "fastify", "prisma", "kafkajs"],
  "http": {
    "framework": "fastify",
    "openapi_strategy": "route3",
    "strategy_counts": { "route1": 0, "route2": 0, "route3": 1 },
    "evidence": [...]
  },
  "orm": { "kind": "prisma", "schema_path": "prisma/schema.prisma" },
  "messaging": { "client": "kafkajs", "evidence": [...] },
  "type_hint": "node-fastify-prisma-kafkajs"
}
```

### What it does NOT do

- Does not run your code or install dependencies
- Does not look inside source files for imports (that's the job of later extraction steps)
- Does not use AI/LLM — this is fully deterministic

---

## `dt extract schema` — Database Schema Extraction

### What it does

Produces a `docs/schema.md` containing your database tables, columns with types, nullability, primary/foreign keys, indexes, enums, and a Mermaid ER diagram.

### How it works — fallback chain

1. **ORM AST extraction** (preferred) — uses the detection result to pick the right parser:
   - **Prisma**: reads `schema.prisma` with a custom line-based parser (no Prisma CLI required). Extracts models, fields with types and attributes (`@id`, `@unique`, `@default`, `@relation`), enums, and block-level indexes (`@@index`, `@@unique`). Refines relation types (one-to-one vs many-to-one) by checking if FK columns have `@unique`.
   - **Drizzle**: uses the **TypeScript Compiler API** to parse Drizzle table definitions (e.g., `pgTable("users", { ... })`). Extracts column names, types, constraints from the AST.
   - **TypeORM**: uses the TypeScript Compiler API to parse entity classes decorated with `@Entity`, `@Column`, `@PrimaryGeneratedColumn`, `@ManyToOne`, etc.
2. **Database introspection** (opt-in with `--db-url`) — queries `information_schema` of a local/development database. Never runs against production. Returns tables, columns, foreign keys, indexes.
3. **SQL migration inference** (last resort) — if migrations exist (`migrations/`, `prisma/migrations/`, `drizzle/`) but no ORM and no `--db-url`, the LLM is invoked to infer schema. Marked `source: inferred`, `confidence: low`.
4. **None available** — returns null, recorded in `requires_human`.

### Rendering

The `schema-md.ts` renderer produces:
- An ER diagram in Mermaid syntax (tables, columns with PK/FK markers, relationships)
- Per-table Markdown tables showing: column name, type, nullable, key indicator, default value
- Relation listing with source/target fields
- Index listing with uniqueness
- Enum definitions with values

### Example output structure

```markdown
# Database Schema

> Source: `introspected` | ORM: `prisma` | Confidence: `high`

## Entity Relationship Diagram

(mermaid erDiagram block)

## User

| Column | Type | Nullable | Key | Default |
|--------|------|----------|-----|---------|
| id     | Int  | NO       | PK  | autoincrement() |
| email  | String | NO     | UQ  |         |
| name   | String | YES    |     |         |

**Relations:**
- `posts`: one-to-many (id → Post.authorId)
```

---

## `dt extract openapi` — API Specification Extraction

### What it does

Produces an OpenAPI 3.1 specification from your repository, using the best available strategy.

### Strategy selection

Controlled by `--strategy auto|1|3` (default: `auto`, which picks based on detection):

| Strategy | Trigger | Technique | Source | Confidence |
|----------|---------|-----------|--------|------------|
| Route 1 | On-disk spec exists | Copy + normalize | `introspected` | `high` |
| Route 3 | No spec, known framework | TypeScript AST | `inferred` | `medium` or `low` |

### Route 1 — Copy and normalize

1. Searches for spec files in known locations: `openapi.yaml`, `openapi.json`, `swagger.yaml`, `docs/openapi.yaml`, etc.
2. Parses the file (JSON natively, YAML via a lightweight built-in parser)
3. Normalizes: resolves internal `$ref` pointers (JSON Pointer `#/components/schemas/Foo`), sets version to `3.1.0`
4. Validates basic structure (requires a `paths` object)
5. Extracts endpoints with parameters and responses

### Route 3 — AST-based route discovery

This is the most technically interesting part. It uses the **TypeScript Compiler API** to statically analyze your source code:

1. **Find all `.ts` files** — recursively walks the project, skipping `node_modules/`, `dist/`, `.git/`, `.d.ts`, `.test.ts`, `.spec.ts`
2. **Create a TypeScript program** — loads `tsconfig.json` if present, otherwise uses sensible defaults (ES2022, NodeNext module resolution, strict)
3. **Visit AST nodes** looking for route registrations:

   **Express/Fastify/Hono patterns:**
   ```typescript
   app.get("/users/:id", handler)
   router.post("/items", handler)
   ```
   Detected by: `CallExpression` → `PropertyAccessExpression` where the method name is `get|post|put|patch|delete|head|options`

   **NestJS patterns:**
   ```typescript
   @Controller("users")
   class UsersController {
     @Get(":id")
     findOne(@Param("id") id: string) { ... }
   }
   ```
   Detected by: class decorators (`@Controller`) and method decorators (`@Get`, `@Post`, etc.)

4. **Path composition** — composes router prefixes with route paths (e.g., `/api` + `/users/:id` = `/api/users/:id`)

5. **Parameter extraction:**
   - Path params from the route pattern (`:id` → path param)
   - Query/body params from handler type signature via the **type checker**:
     - Express `Request<Params, ResBody, ReqBody, ReqQuery>` generics
     - NestJS `@Query()`, `@Body()` decorators
     - **Zod schemas** (`z.object({...})`) in validation middleware
   - Types are resolved to JSON Schema-like objects

6. **Response type analysis** — inspects the handler's return type. `any`/`unknown` return types are marked schema-less.

7. **Dynamic routes** — if the path argument is not a string literal (e.g., comes from a variable or function call), it's reported in `unresolved[]` instead of being silently dropped.

8. **Confidence assignment:**
   - `medium` if handlers have typed parameters (TypeScript types or Zod)
   - `low` if handlers are untyped

### Route 2 — Framework boot (interface only)

Would invoke the framework's built-in doc generator (e.g., NestJS + `@nestjs/swagger`) in isolation without running the full service. Currently defined as an interface but not implemented.

### Validation

The final spec is validated against the OpenAPI 3.1 JSON Schema structure (paths must be present and well-formed).

---

## `dt extract asyncapi` — Kafka Topic Extraction

### What it does

Extracts an AsyncAPI document describing Kafka topics your service produces to and consumes from, with per-topic confidence tracking.

### How it works

Uses the **TypeScript Compiler API** to find kafkajs usage patterns:

1. **File scanning** — same recursive TypeScript file finder as OpenAPI route 3
2. **Program creation** — creates a full TS program with type checker for reference resolution
3. **AST pattern matching** — visits all `CallExpression` nodes looking for:

   **Producer patterns:**
   ```typescript
   producer.send({ topic: "orders.created", messages: [...] })
   producer.sendBatch({ topicMessages: [{ topic: "...", messages: [...] }] })
   ```
   Detected by: `PropertyAccessExpression.name === "send"` or `"sendBatch"`, confirmed by the presence of `topic` + `messages` properties in the argument object.

   **Consumer patterns:**
   ```typescript
   consumer.subscribe({ topic: "orders.created" })
   consumer.subscribe({ topics: ["orders.created", "orders.updated"] })
   ```
   Detected by: `PropertyAccessExpression.name === "subscribe"` with a `topic` or `topics` property.

4. **Topic resolution with confidence:**

   | Expression type | Technique | `topic_confidence` |
   |-----------------|-----------|-------------------|
   | String literal `"orders.created"` | Direct read | `high` |
   | Constant/enum `Topics.ORDERS` | Follow symbol via type checker → find initializer | `high` |
   | Template literal `` `${prefix}.orders` `` | Extract pattern + variable names | `medium` |
   | Unresolvable expression | Report snippet in `unresolved[]` | `low` |

   For constants and enums, the type checker follows the symbol through imports and aliases to find the string literal initializer.

5. **Payload classification** (separate `payload_confidence`):

   | Payload type | Technique | `payload_confidence` |
   |--------------|-----------|---------------------|
   | Typed generic `producer.send<OrderEvent>({...})` | Derive schema from the type | `medium` |
   | Inline object literal | LLM infers shape | `low` |
   | Opaque (`Buffer`, `JSON.stringify(variable)`) | Mark unresolved | `low` |

### Why two confidence fields?

The topic inventory is what matters for the dependency graph (which services talk to each other). Payloads are separate because they're much harder to resolve without a schema registry. The system uses `topic_confidence` for graph closure and treats `payload_confidence: low` payloads as advisory — they're never treated as firm contracts.

---

## `dt extract component` — Manifest Derivation

### What it does

Combines all prior extraction results into a single `component.json` with full provenance tracking.

### Field categories

Fields are classified by how they're populated:

| Category | Fields | How populated |
|----------|--------|---------------|
| **Derivable** | `name`, `stack`, `type`, `provides`, `datastores`, `paths`, `docs`, `consumes` | Directly from detection + extraction results |
| **Inferable** | `description`, `aliases`, `subdomain`, `consumes[].criticality` | LLM suggestion, but requires human confirmation |
| **Non-derivable** | `owner`, `domain`, `criticality`, `lifecycle` | Interactive prompt only — never invented |

### The `--interactive` flag

Without `--interactive`: non-derivable fields stay empty, listed in `requires_human`. The manifest is technically incomplete (validation would reject it).

With `--interactive`: prompts you for owner, domain, criticality, lifecycle. Also asks you to confirm or reject LLM-inferred values for description, aliases, subdomain.

### Provenance (`_provenance` block)

Every field in `component.json` carries metadata:

```json
{
  "_provenance": {
    "extracted_at": "2026-07-28T10:00:00Z",
    "extractor": "0.6.4",
    "repo_sha": "abc1234",
    "detector": { ... },
    "fields": {
      "stack": { "source": "detected", "confidence": "high" },
      "description": { "source": "inferred", "confidence": "medium", "confirmed_by": "human" },
      "owner": { "source": "prompted", "confidence": "high" }
    },
    "field_hashes": {
      "stack": "sha256-of-json-serialized-value",
      "name": "sha256-of-json-serialized-value",
      ...
    }
  }
}
```

### Idempotency via hash reconciliation

When you re-run `dt extract component` on a repo that already has a `component.json`, the **reconciliation engine** (shared with `dev-tasks update`) decides what to do per field:

| Local hash | Origin hash | Package hash | Action |
|------------|-------------|--------------|--------|
| null (absent) | — | — | **install** — write the field |
| == package | — | — | **skip** — already up to date |
| == origin | != package | — | **overwrite** — you didn't edit it, upstream changed |
| != origin | != package | — | **conflict** — you edited it, can't auto-update |

This means: if you manually edit a field in `component.json`, re-running extraction will not silently overwrite your edit. It reports a conflict instead.

---

## `dt validate-component` — Offline Manifest Validation

### What it does

Validates a `component.json` manifest against the bundled JSON Schema (draft 2020-12), entirely offline. No network access, no external service call — this is a pure, local structural check.

```bash
dt validate-component component.json
dt validate-component component.json --json
```

### How it works internally

1. Loads `schemas/component.schema.json` (walked up from the compiled/source module location so it works in both `core/catalog/` and `dist/core/catalog/` layouts).
2. Compiles it once with ajv's `Ajv2020` class (JSON Schema draft 2020-12) and caches the compiled validator.
3. Parses the target file as JSON and validates it against the compiled schema.
4. Returns a structured result: `{ valid: boolean, errors: [{ path, message, keyword, params }] }`.

The schema enforces, among other things:
- `id` matches `^[a-z][a-z0-9-]{2,49}$`
- `additionalProperties: false` at every object level (unknown top-level or nested keys are rejected)
- manual fields (e.g. `owner`) are required and non-empty
- a `schemaVersion` field (semver pattern) is present for future schema evolution

Cross-catalog checks — contract resolution (`consumes[].contract` → an existing `provides[].id`), domain existence, cycle detection — are **not** performed by this command. Those belong to `dt catalog validate` (planned), which reuses the same schema and validator module.

### Exit codes

| Code | Meaning |
|------|---------|
| 0 | Valid — manifest conforms to the schema |
| 2 | Usage error — no `<path>` argument given |
| 4 | Invalid — one or more schema violations (see `errors[]` in `--json` output) |
| 5 | File not found at the given path |

### Reused by

`core/catalog/validate-component.ts` also exposes a generic `validateArtifact(kind, data)` function for `flow` and `scope-output` artifacts (validated against `schemas/flow.schema.json` and `schemas/scope-output.schema.json` respectively), so the same offline validation machinery backs the catalog's flow definitions and the LLM scoping step's output — not just `component.json`.

---

## `dt catalog scaffold` — Meta-Repo Scaffold

### What it does

Generates the canonical meta-repo directory layout with template files. This provides the starting point for a centralized service catalog that `dt catalog build` populates.

```bash
dt catalog scaffold                        # scaffold in current directory
dt catalog scaffold --out ./my-meta-repo   # scaffold in a specific directory
dt catalog scaffold --out ./my-meta-repo --force  # overwrite existing files
dt catalog scaffold --json                 # machine-readable output
```

### Generated structure

```text
<out-dir>/
├── architecture.md       # High-level architectural overview
├── domains.md            # Business domain registry
├── glossary.md           # Canonical term definitions
├── conventions.md        # Shared development conventions
├── platform.yaml         # Platform/infrastructure configuration
├── registry.yaml         # Service registry for `dt catalog build`
├── adr/                  # Architecture Decision Records
├── catalog/              # Generated catalog output
│   ├── components/       # Mirrored component manifests
│   └── flows/            # Flow definitions
└── schemas/              # Shared JSON schemas
```

### Safety behavior

- **Default (no `--force`):** never overwrites existing files. Reports skipped files.
- **With `--force`:** overwrites all files with fresh templates.
- **Additive only:** never deletes existing files or directories.

### Exit codes

| Code | Meaning |
|------|---------|
| 0 | Success — scaffold generated |

---

## CI Templates — Scheduled Catalog Rebuild

The `dt catalog scaffold` command is complemented by CI templates for automated catalog rebuilds:

### GitHub Actions (`templates/meta-repo/catalog-rebuild.yml`)

A workflow that runs hourly (configurable cron) plus on `repository_dispatch` and `workflow_dispatch`:

1. Checkout → Setup Node 20 → `dt catalog build --registry registry.yaml` → `dt catalog validate --strict`
2. If `catalog/` changed → commit with bot identity (`catalog-bot`) and push
3. If build or validate fails → non-zero exit triggers GitHub notifications

### Bitbucket Pipelines (`templates/bitbucket-pipelines.yml`)

A pipeline with `custom` and `branches` triggers (scheduled via Bitbucket Repository Settings):

1. Verifies Node >= 20 is available in the base image
2. Same build → validate → conditional commit flow
3. Documents the `atlassian/default-image:4` base image (includes Node 20+)

### Alert mechanism

Both templates rely on **non-zero exit codes** for alerting. If `dt catalog build` or `dt catalog validate --strict` fails, the CI step fails, and the platform's native notification system (email, Slack, webhook) alerts the team. This prevents silent catalog staleness — the primary risk identified in the spec.

### Conditional commit logic

```bash
if git diff --quiet catalog/; then
  echo "No catalog changes detected — skipping commit."
else
  git add catalog/
  git commit -m "chore: rebuild catalog [skip ci]"
  git push
fi
```

The `[skip ci]` marker prevents the commit from triggering another rebuild loop.

---

## `dt extract all` — Full Pipeline

Orchestrates the complete extraction in order:

```text
detect → schema → openapi → asyncapi → component → extraction_report.json
```

### Exit codes

| Code | Meaning |
|------|---------|
| 0 | OK — all stages completed |
| 13 | Incomplete: required fields unresolved (non-derivable fields empty) |
| 14 | Reconciliation conflict (you edited a field that extraction wants to update) |

### `extraction_report.json`

Aggregates quality metrics from all stages:

```json
{
  "generated_at": "2026-07-28T10:05:00Z",
  "strategies": [
    { "stage": "schema", "strategy": "prisma-ast", "source": "introspected", "confidence": "high" },
    { "stage": "openapi", "strategy": "route3", "source": "inferred", "confidence": "medium" }
  ],
  "coverage": {
    "endpoints": { "resolved": 12, "unresolved": 2, "total": 14 },
    "topics": { "resolved": 5, "unresolved": 1, "total": 6 },
    "tables": { "resolved": 8, "unresolved": 0, "total": 8 }
  },
  "confidence_counts": { "high": 10, "medium": 5, "low": 3 },
  "unresolved": [
    { "stage": "openapi", "type": "dynamic_route", "location": "src/api/routes.ts:42", "reason": "..." }
  ],
  "requires_human": [
    { "field": "owner", "reason": "Non-derivable field", "category": "non-derivable" }
  ]
}
```

---

## `dev-tasks` — Bootstrap Commands

The companion binary handles distribution and lifecycle:

### `dev-tasks install`

Copies skill/agent/steering files from the npm package into your repo. Writes `.dev-tasks/manifest.json` tracking each file with:
- `sha256`: current hash of the installed file
- `origin_sha256`: hash as shipped (for later reconciliation)
- `profile`: which platform profile it belongs to (copilot, claude, kiro)

### `dev-tasks update`

Reconciles installed files against the new package version using the four-branch algorithm:
- **Install**: file is new in the package, doesn't exist locally
- **Overwrite**: file unchanged locally (hash matches origin), new version in package
- **Skip**: file already matches the new package version
- **Conflict**: file was locally edited AND the package has a new version — reports diff, exit 14

With `--force`: backs up conflicting files to `.dev-tasks/backup/<timestamp>/` then overwrites.

### `dev-tasks doctor`

Validates your environment:
- Node.js >= 20
- git >= 2.37 (needed for sparse-checkout support)
- Cache directory (`~/.cache/dev-tasks`) is writable
- No version skew between installed and pinned versions

### `dev-tasks status`

Compares three versions: installed (from manifest), pinned (from `.dev-tasks/version`), latest published (from npm registry).

### `dev-tasks pin <version>`

Writes a version pin file. Subsequent `install`/`update` commands honor this pin.

### `dev-tasks migrate`

One-shot migration from the legacy `dev-tasks.sh` shell script to the npm package. Detects the old install, computes hashes of existing files (marks all `modified: unknown`), writes the manifest, and prints that future updates go through npm.

---

## Pluggable Provider System

The extraction system is designed for multiple language stacks. Each provider declares:

```typescript
interface ExtractionProvider {
  id: string;                        // e.g., "node-ts"
  capabilities: Capability[];        // what it can extract
  detect(repo: RepoContext): DetectionResult | null;  // does it apply?
  extractSchema?(repo): Promise<...>;
  extractOpenApi?(repo): Promise<...>;
  extractAsyncApi?(repo): Promise<...>;
}
```

Capabilities declared:
- `openapi_native` — can copy an existing spec (route 1)
- `openapi_ast` — can discover routes via AST (route 3)
- `orm_ast` — can parse ORM definitions
- `db_introspection` — can query a database
- `topic_ast` — can find Kafka topics via AST
- `payload_typed` — can derive message payload schemas from types

A missing capability does not fail — it's recorded in `requires_human` and the extraction continues.

Currently only the `node-ts` provider is shipped. Future providers could support Python (Flask/Django/FastAPI), Go (Gin/Echo), Java (Spring Boot), etc.

---

## Design Principles

1. **No LLM for structure.** The LLM is only used for prose descriptions (table summaries, endpoint summary/description/tags). Every structural decision (routes, schemas, topics, relationships) comes from deterministic AST parsing or file inspection.

2. **Explicit confidence.** Every extracted value carries a `source` (introspected, inferred, manual) and `confidence` (high, medium, low). Low-confidence values are never treated as firm contracts by downstream tools.

3. **Fail loudly.** Missing data is reported in `unresolved[]` and `requires_human[]`, never silently omitted. The extraction report makes weak documentation visible.

4. **No credentials required.** Extraction never needs production access. Database introspection is off by default and explicitly targets development databases only.

5. **Idempotent with conflict detection.** Re-running extraction on the same repo produces the same output. Manual edits are detected via hash comparison and protected from overwrite.

6. **No code execution.** Your application is never started, no HTTP servers boot, no database connections are made (unless explicitly opted in via `--db-url`).

---

## Typical Workflow

```bash
# 1. Install dt globally
pnpm add -g @llipe.com/dev-tasks

# 2. Navigate to your service repo
cd my-payment-service

# 3. Run the full extraction
dt extract all --interactive

# 4. Review outputs
cat component.json            # your service manifest
cat extraction_report.json    # quality metrics, unresolved items
cat docs/schema.md            # database schema documentation

# 5. Address unresolved items manually if needed
# (e.g., document dynamic routes, fill in owner/domain)

# 6. Commit
git add component.json extraction_report.json docs/schema.md
git commit -m "feat: add component manifest via dt extract"
```

---

## Known Limitations

- **Route 2 not implemented** — NestJS swagger auto-generation via framework boot exists as interface only
- **Node/TS only** — no providers for Python, Go, Java, Ruby, etc.
- **LLM inference stubbed** — no real LLM provider is wired; description passes produce placeholder output
- **Zod limited to basic `z.object` patterns** — complex compositions (unions, intersections, lazy schemas) are not fully supported
- **Only kafkajs patterns** — other Kafka clients (confluent-kafka, rhea/AMQP, bullmq) not detected
- **YAML parsing is minimal** — the built-in YAML parser handles basic structures; complex YAML features (anchors, merge keys) may not parse correctly

---

## What's Coming Next

| Phase | Capability | Status |
|-------|-----------|--------|
| Phase 0 | Distribution (`dev-tasks install/update/doctor`) | Done |
| Phase 1 | Extraction (`dt extract *`) | Done |
| Phase 2 | Catalog — cross-repo aggregation + validation | In progress (`dt validate-component`, `dt catalog build/validate/query/scaffold` shipped) |
| Phase 3 | Context — sparse-fetch + budget-aware bundle assembly | Planned |
| Phase 4 | Scoping — LLM-assisted component selection per task | Planned |
| Phase 5 | Verify — contract diff + impact analysis | Planned |
| Phase 6 | MCP adapter — expose as agent tools | Planned |
