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
│   ├── validate-component.ts  Offline JSON Schema (2020-12) validator via ajv
│   ├── build.ts           Catalog build orchestrator (registry → index)
│   ├── validate.ts        Referential integrity checks V01-V19
│   ├── graph.ts           Dependency graph utilities
│   ├── resolve.ts         Lexical weighted scorer for text→component
│   ├── queries.ts         Graph reads (get, deps, consumers, flow, closure)
│   ├── coverage.ts        Extraction quality aggregation
│   └── scaffold.ts        Meta-repo scaffold generator
├── core/context/          Multi-repo context generation (S-015+)
│   ├── init.ts            Manual-scope init orchestration (pin → freshness → assemble → lock)
│   ├── session-lock.ts    session.lock.json data model and read/write
│   ├── fetch.ts           Sparse-clone git fetch via execa
│   ├── cache.ts           SHA-keyed immutable cache + LRU GC
│   ├── tokens.ts          Token counting utility (cl100k_base approx)
│   ├── assemble.ts        Layered budgeted bundle assembler
│   ├── layers/            Per-layer renderers (index, flow, arch, docs, contracts)
│   └── index.ts           Module barrel exports
├── core/scope/            LLM-assisted scoping with schema validation (S-018+)
│   ├── scoping.ts         Orchestrator (prompt → LLM → validate → repair retry)
│   ├── prompt.ts          System prompt template + input assembler
│   ├── validate.ts        Schema validation (ajv 2020-12) + post-schema id check
│   ├── calibration.ts     Per-session calibration data recording
│   ├── types.ts           Shared types (ScopeOutput, LlmScopeProvider, etc.)
│   └── index.ts           Module barrel exports
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
dt ctx fetch               # Sparse-clone repos and cache by SHA
dt ctx gc                  # Run cache garbage collection
dt ctx assemble            # Build layered, budgeted context bundle
dt init                    # Initialize a context session (pin, freshness, assemble, lock)
dt scope                   # LLM-assisted scoping (task → components, with repair retry)
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

## `dt ctx fetch` — Sparse Clone and SHA Cache

### What it does

Fetches only the context-relevant content (`component.json`, `docs/`, `contracts/`) from component repositories using a sparse-clone strategy, and caches the result immutably by SHA. Subsequent fetches of the same SHA are instant cache hits — no network calls.

```bash
dt ctx fetch --repos auth-service,payment-service --meta-repo ./my-meta-repo
dt ctx fetch --repos auth-service --meta-repo ./my-meta-repo --refresh --json
dt ctx fetch --repos auth-service --meta-repo ./my-meta-repo --concurrency 4
```

### How it works internally

For each target repository:

1. **Cache check** — looks for `~/.dev-tasks/cache/<host>/<org>/<repo>/<sha>/` with a `.complete` marker file. If present, returns immediately (cache hit).

2. **Sparse clone sequence** (on cache miss):
   ```bash
   git clone --filter=blob:none --no-checkout --depth 1 <url> <tmp-dir>
   git -C <tmp-dir> sparse-checkout set component.json docs contracts
   git -C <tmp-dir> checkout <sha>
   ```

3. **Cache write** — copies the sparse content (excluding `.git/`) into the cache directory and writes a `.complete` marker file. Once marked, the entry is treated as immutable.

4. **Cleanup** — removes the temporary clone directory regardless of success or failure. On failure, also removes any partial cache entry.

### Target resolution

Targets are resolved from the meta-repo's `catalog/index.yaml` (preferred, contains `origin_sha` per component) or `registry.yaml` (fallback, requires explicit SHA). The CLI accepts a comma-separated list of component IDs.

### Concurrency and timeout

- Default concurrency: **8 repos in parallel** (configurable with `--concurrency`)
- Default timeout: **60 seconds per repo**
- Fetch operations are batched — when a batch completes, the next batch starts

### Cache layout

```text
~/.dev-tasks/cache/
├── github.com/
│   ├── acme/
│   │   ├── auth-service/
│   │   │   └── abc123def456/     ← SHA directory (immutable)
│   │   │       ├── .complete     ← marker file (presence = valid entry)
│   │   │       ├── component.json
│   │   │       ├── docs/
│   │   │       └── contracts/
│   │   └── payment-service/
│   │       └── ...
│   └── other-org/
│       └── ...
└── gitlab.com/
    └── ...
```

### Flags

| Flag | Description |
|------|-------------|
| `--repos <ids>` | Required. Comma-separated component IDs to fetch |
| `--meta-repo <path>` | Required. Path to the meta-repo (contains registry/index) |
| `--refresh` | Bypass cache — re-fetch even if SHA directory exists |
| `--concurrency <n>` | Max parallel fetches (default: 8) |
| `--json` | Machine-readable output with per-repo cache hit/miss details |

### Exit codes

| Code | Meaning |
|------|---------|
| 0 | All repos fetched successfully |
| 2 | Usage error — missing required flags |
| 5 | Fetch failure — one or more repos unreachable/timed out (per-repo errors in output) |

### JSON output

```json
{
  "success": true,
  "fetched": 3,
  "cache_hits": 2,
  "cache_misses": 1,
  "errors": [],
  "entries": [
    { "id": "auth-service", "cache_hit": true, "path": "/Users/.../.dev-tasks/cache/..." },
    { "id": "payment-service", "cache_hit": true, "path": "..." },
    { "id": "order-service", "cache_hit": false, "path": "..." }
  ]
}
```

---

## `dt ctx gc` — Cache Garbage Collection

### What it does

Evicts stale or oversized cache entries using LRU (Least Recently Used) policy.

```bash
dt ctx gc                          # defaults: 5GB max, 30-day max age
dt ctx gc --max-size 2GB           # evict if total exceeds 2GB
dt ctx gc --max-age 7d             # evict entries older than 7 days
dt ctx gc --max-size 1GB --max-age 14d --json
```

### Eviction strategy

Two-phase eviction:

1. **Age eviction** — entries with last-access time older than `--max-age` (default: 30 days) are removed first.
2. **Size eviction** — remaining entries sorted by last-access time (oldest first); entries are evicted until total size is within `--max-size` (default: 5 GB).

After eviction, empty parent directories are cleaned up.

### Flags

| Flag | Description |
|------|-------------|
| `--max-size <size>` | Max total cache size (e.g., `5GB`, `500MB`). Default: 5GB |
| `--max-age <age>` | Max entry age (e.g., `30d`, `24h`, `60m`). Default: 30d |
| `--json` | Machine-readable output |

### Exit codes

| Code | Meaning |
|------|---------|
| 0 | GC completed (may have evicted 0 entries if cache is healthy) |

---

## `dt ctx assemble` — Layered, Budgeted, Deterministic Bundle

### What it does

Builds a context bundle — a set of Markdown files in a fixed order, capped to a token budget, with recorded truncation and per-file SHA-256 hashes. The bundle is byte-for-byte reproducible given the same inputs.

```bash
dt ctx assemble --scope scope.json --out ./bundle --meta-repo ./my-meta-repo
dt ctx assemble --scope scope.json --out ./bundle --budget 40000 --json
```

### How it works internally

1. **Load scope** — reads a `scope.json` file (matching the `scope-output.schema.json` format) that specifies primary components, secondary components, contracts crossed, and optional flow.

2. **Load meta-repo content** — reads `catalog/index.yaml`, `architecture.md`, `conventions.md`, per-component docs from cache or catalog directories, and flow definitions.

3. **Render layers in fixed order** — each layer has a numeric priority (lower = higher priority) and a truncable/non-truncable flag:

   | Layer | File | Priority | Truncable | Content |
   |-------|------|----------|-----------|---------|
   | 00-index | `00-index.md` | 0 | No | Catalog index summary for scoped components |
   | 01-flow | `01-flow.md` | 1 | No | Flow definition with participants |
   | 02-conventions-delta | `02-conventions-delta.md` | 2 | No | Conventions relevant to scope domains |
   | 03-architecture | `03-architecture.md` | 3 | Yes | Architecture document |
   | 04-primary-* | `04-primary-<id>.md` | 4+ | Yes | Full docs per primary component |
   | 05-secondary-* | `05-secondary-<id>.md` | varies | Yes | Summary only (id, description, provides/consumes) |
   | 06-contracts | `06-contracts.md` | last | Yes | Boundary contracts with confidence badges |

4. **Budget enforcement** — default 60,000 tokens (configurable via `--budget`):
   - If non-truncable layers alone exceed the budget → **exit 6** with a clear error message.
   - If total exceeds budget → truncate layers in **reverse priority order** (highest priority number first). Each truncation is recorded in the manifest's `truncated[]` array.

5. **Deterministic output** — no in-file timestamps, fixed file order, per-file SHA-256 hash in the bundle manifest (`bundle.json`).

### Token counting

Uses a cl100k_base approximation: ~4 characters per token for prose, ~3.5 for code-heavy content (detected by special character density). Truncation respects line boundaries when possible.

### Secondary component rendering

Secondary components are rendered as **summaries only** — id, description, provides list, consumes list. Full documentation is omitted to conserve token budget. This is by design: secondaries provide context for understanding the primary components, not implementation detail.

### Boundary contract rendering

Contracts include a visible **confidence badge** — `[HIGH]`, `[MEDIUM]`, or `[LOW]` — derived from the provider component's `provides[].confidence` field. This makes confidence visible in the assembled context without requiring consumers to look it up separately.

### Bundle manifest (`bundle.json`)

Written to the output directory alongside the layer files:

```json
{
  "files": [
    { "filename": "00-index.md", "layerId": "00-index", "sha256": "abc...", "tokens": 450 },
    { "filename": "01-flow.md", "layerId": "01-flow", "sha256": "def...", "tokens": 180 }
  ],
  "truncated": [
    { "layerId": "03-architecture", "originalTokens": 12000, "truncatedTo": 5000 }
  ],
  "totalTokens": 45000,
  "budget": 60000
}
```

### Flags

| Flag | Description |
|------|-------------|
| `--scope <path>` | Required. Path to the scope JSON file |
| `--out <dir>` | Required. Output directory for the bundle |
| `--meta-repo <path>` | Path to the meta-repo (default: current directory) |
| `--budget <n>` | Total token budget (default: 60000) |
| `--cache-path <path>` | Override cache path for component content lookup |
| `--json` | Machine-readable manifest output |

### Exit codes

| Code | Meaning |
|------|---------|
| 0 | Success — bundle assembled within budget |
| 2 | Usage error — missing required flags |
| 5 | Not found — scope file or meta-repo content missing |
| 6 | Budget exceeded — non-truncable layers alone exceed the budget |
| 9 | Validation error — scope file cannot be parsed |

### Determinism guarantee

Running `dt ctx assemble` twice with the same inputs produces **identical output**: same files, same content, same SHA-256 hashes. This is achieved by:
- Fixed rendering order (no randomization, no file-system-order dependency)
- No timestamps in generated content
- Deterministic truncation (same budget + same content = same cut point)

---

## `dt init` — Manual-Scope Context Session Initialization

### What it does

Orchestrates the complete context init pipeline in one command: pins the meta-repo to a SHA, checks catalog freshness, validates requested components, sparse-fetches their repos, assembles a budgeted context bundle, and emits a `session.lock.json` that captures everything needed to reproduce the exact same bundle later.

This is the **deterministic init path** — no LLM is involved. Scope is explicitly provided via `--components`.

```bash
dt init --components auth-service,payment-service --meta-repo ./my-meta-repo
dt init --components auth-service --meta-repo ./meta --max-index-age 120 --out ./context
dt init --components auth-service --meta-repo ./meta --json
dt init --no-llm --components auth-service --meta-repo ./meta  # explicit no-LLM marker
```

### How it works internally

The init orchestration executes these steps in strict sequence:

1. **Pin meta-repo** — resolves the meta-repo directory to a git SHA (`git rev-parse HEAD`). This SHA is fixed for the entire session, ensuring reproducibility even if the meta-repo is updated during work.

2. **Check index freshness** — reads the `generated_at` timestamp from `catalog/index.yaml` and computes its age in minutes. If the age exceeds `--max-index-age` (default: 240 minutes = 4 hours), the command aborts with exit 9. This prevents sessions built on stale catalog data.

3. **Validate components** — checks that every component ID in `--components` exists in the catalog index. If any ID is unknown, aborts with exit 12 listing the unrecognized IDs.

4. **Fetch component repos** — uses the `ctx fetch` infrastructure (S-015) to sparse-clone each component's repository content into the SHA cache. Respects the same cache, concurrency, and timeout rules as `dt ctx fetch`.

5. **Assemble bundle** — invokes the layered bundle assembler (S-016). For manual scope, all specified components are treated as primary (no secondary distinction without LLM ranking). Contracts crossed by the component set are automatically included.

6. **Emit session lock** — writes `session.lock.json` to the output directory with full reproducibility metadata.

### Session lock structure (`session.lock.json`)

```json
{
  "task_hash": "sha256-of-sorted-component-list",
  "meta_repo_sha": "abc123def456789...",
  "index_age_minutes": 42,
  "scope": {
    "components": ["auth-service", "payment-service"],
    "source": "manual"
  },
  "repo_shas": {
    "auth-service": "abc123...",
    "payment-service": "def456..."
  },
  "bundle": [
    { "filename": "00-index.md", "sha256": "...", "tokens": 450 },
    { "filename": "04-primary-auth-service.md", "sha256": "...", "tokens": 1200 }
  ],
  "total_tokens": 3500,
  "created_at": "2024-07-28T10:00:00.000Z"
}
```

Key fields:
- **`task_hash`**: SHA-256 of the sorted component list (deterministic regardless of input order)
- **`meta_repo_sha`**: Exact git commit the session is pinned to
- **`index_age_minutes`**: How old the index was at init time (for auditability)
- **`scope.source`**: Always `"manual"` for `--components`; future LLM scoping will produce `"llm"`
- **`repo_shas`**: Per-component pinned SHAs from the catalog index
- **`bundle`**: Per-file SHA-256 and token counts — enables byte-for-byte reproducibility verification

### Reproducibility guarantee

Running `dt init --components X --meta-repo Y` twice produces **identical output** if the meta-repo hasn't changed. The session lock captures all inputs (component list, meta-repo SHA, per-repo SHAs) and all outputs (per-file SHA-256), so reproducibility can be verified by comparing lock files.

### The `--no-llm` flag

The `--no-llm` flag explicitly opts out of LLM-based scoping. When specified:
- `--components` **must** be provided (the scope must come from somewhere)
- Without `--components` → exit 2 with a clear error

This flag exists for forward compatibility: when LLM scoping (Phase 4) is implemented, `dt init` without `--no-llm` will use the LLM to select components from a task description. The `--no-llm` flag ensures the deterministic path remains available.

### Flags

| Flag | Description |
|------|-------------|
| `--components <ids>` | Required. Comma-separated component IDs to include in scope |
| `--meta-repo <path>` | Path to the meta-repo (default: current directory) |
| `--max-index-age <n>` | Max allowed index age in minutes (default: 240) |
| `--no-llm` | Explicit no-LLM marker (requires `--components`) |
| `--out <dir>` | Output directory for bundle + lock (default: `.dt-context`) |
| `--budget <n>` | Total token budget for the bundle (default: 60000) |
| `--concurrency <n>` | Max parallel fetch operations (default: 8) |
| `--json` | Machine-readable output |

### Exit codes

| Code | Meaning |
|------|---------|
| 0 | Success — bundle assembled, session lock emitted |
| 2 | Invalid usage — `--no-llm` without `--components`, or missing `--components` entirely |
| 6 | Budget exceeded — non-truncable layers alone exceed the budget |
| 9 | Stale index — catalog index age exceeds `--max-index-age` |
| 12 | Unknown component — one or more component IDs not found in the catalog |

### JSON output (success)

```json
{
  "success": true,
  "meta_repo_sha": "abc123def456789...",
  "index_age_minutes": 42,
  "scope": { "components": ["auth-service"], "source": "manual" },
  "bundle_files": 6,
  "total_tokens": 3500,
  "budget": 60000,
  "lock_file": "/path/to/.dt-context/session.lock.json",
  "repo_shas": { "auth-service": "abc123..." }
}
```

### JSON output (error — stale index)

```json
{
  "error": "Catalog index is stale: 300 minutes old (max allowed: 240 minutes)",
  "age_minutes": 300,
  "max_minutes": 240
}
```

### JSON output (error — unknown component)

```json
{
  "error": "Unknown component(s): foo-service, bar-service",
  "unknown_components": ["foo-service", "bar-service"]
}
```

---

## `dt scope` — LLM-Assisted Component Scoping

### What it does

Given a task description and a set of candidate components (from `dt catalog resolve`), asks an LLM to select which components are affected. The response is schema-validated against `scope-output.schema.json`, and invented component IDs are rejected. If the first LLM response fails validation, a single repair retry is attempted with error context. A second failure exits with code 10.

```bash
dt scope --task "Add rate limiting to auth" --candidates resolve-output.json --meta-repo ./meta
dt scope --task "Add rate limiting" --candidates candidates.json --meta-repo ./meta --json
dt scope --task "Fix bug" --candidates c.json --meta-repo ./meta --skip-calibration
```

### How it works internally

1. **Build constrained input** — assembles a scoping input containing *only* `task`, `candidates`, `flows`, and `domains`. The full catalog is never sent to the LLM. Candidates come from the `dt catalog resolve` step. Flows and domains are filtered to only those containing candidate components.

2. **System prompt** — instructs the LLM to:
   - Only choose from the provided candidates list (never invent IDs)
   - Set confidence to `"low"` when ambiguous
   - List any capability it cannot map to a candidate in `unresolved`
   - Classify components as primary (need code change) or secondary (context only)
   - Return raw JSON (no markdown wrapping)

3. **LLM call** — sends the system prompt + serialized input to the configured LLM provider.

4. **Parse and validate** — three-step validation:
   - **JSON parsing** — strips markdown fences if present, parses JSON
   - **Schema validation** — validates against `scope-output.schema.json` (enforces: `primary` 1–6 unique items, `secondary` ≤8, `rationale` ≤600 chars, valid `confidence` enum, `schemaVersion` semver, no additional properties)
   - **Post-schema ID validation** — checks that every component ID in `primary` and `secondary` exists in either the candidates list or the full catalog index. Any "invented" ID triggers failure.

5. **Repair retry** — on first validation failure:
   - Sends a repair prompt containing the specific validation errors back to the LLM
   - Validates the second response identically
   - Second failure → returns failure result (caller exits 10)

6. **Calibration recording** — on success, records a calibration entry to `.dev-tasks/calibration/` containing: proposed scope (primary/secondary IDs), confidence, unresolved items, timestamp, and task text hash. This data enables later precision/recall analysis.

### Scope output structure

The LLM must return a JSON object conforming to this schema:

```json
{
  "schemaVersion": "1.0.0",
  "primary": ["auth-service"],
  "secondary": ["user-service"],
  "contracts_crossed": ["auth-api"],
  "confidence": "high",
  "unresolved": [],
  "rationale": "Auth service handles the login flow directly.",
  "flow": "login-flow"
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `schemaVersion` | string | Yes | Semver pattern `^[0-9]+\.[0-9]+\.[0-9]+$` |
| `primary` | string[] | Yes | 1–6 unique items, non-empty strings |
| `secondary` | string[] | Yes | 0–8 unique items |
| `contracts_crossed` | string[] | Yes | Contract IDs touched by the task |
| `confidence` | enum | Yes | `"high"`, `"medium"`, or `"low"` |
| `unresolved` | string[] | Yes | Capabilities not mappable to candidates |
| `rationale` | string | Yes | Max 600 characters |
| `flow` | string | No | Optional flow ID |

### LLM provider abstraction

The scoping call is mediated through an `LlmScopeProvider` interface:

```typescript
interface LlmScopeProvider {
  scopeCall(systemPrompt: string, userInput: string): Promise<string>;
}
```

This enables mock providers for testing and supports any LLM backend that can return raw text.

### Calibration data

Each successful scoping session writes a calibration record:

```json
{
  "timestamp": "2026-07-28T10:00:00.000Z",
  "taskTextHash": "a1b2c3d4e5f67890",
  "primary": ["auth-service"],
  "secondary": ["user-service"],
  "confidence": "high",
  "unresolved": []
}
```

Filenames use the pattern `<timestamp-millis>-<task-hash>.json`. The calibration directory can be analyzed to evaluate scoping accuracy over time.

### Flags

| Flag | Description |
|------|-------------|
| `--task "<text>"` | Required. The task description |
| `--candidates <path>` | Required. Path to the resolve output JSON (array of `ResolveCandidate`) |
| `--meta-repo <path>` | Path to the meta-repo (default: current directory) |
| `--out <dir>` | Output directory for calibration data (default: current directory) |
| `--skip-calibration` | Skip writing calibration data |
| `--json` | Machine-readable output |

### Exit codes

| Code | Meaning |
|------|---------|
| 0 | Success — scope determined and validated |
| 2 | Invalid usage — missing required flags |
| 5 | Not found — candidates file or catalog index not found |
| 10 | Invalid scope — validation failed after repair retry |
| 11 | No candidates — resolve output is empty |

### JSON output (success)

```json
{
  "success": true,
  "scope": {
    "schemaVersion": "1.0.0",
    "primary": ["auth-service"],
    "secondary": ["user-service"],
    "contracts_crossed": ["auth-api"],
    "confidence": "high",
    "unresolved": [],
    "rationale": "Auth service handles the login flow directly."
  },
  "repair_attempted": false,
  "calibration_path": "/path/to/.dev-tasks/calibration/1722160800000-a1b2c3d4.json"
}
```

### JSON output (failure)

```json
{
  "error": "Invalid scope after retry",
  "errors": ["Invented component id \"fake-service\" is not in candidates or index"],
  "repair_attempted": true
}
```

### What it does NOT do

- Does not expand scope via graph closure (that's the job of `dt scope gate`, planned in S-019)
- Does not run gate rules (G1–G7) — those are a separate post-scoping step
- Does not fetch or assemble context — it's purely a selection step
- Does not require real LLM connectivity for testing — the provider interface enables full unit/integration testing with mocks

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
- **Git >= 2.37 required for ctx fetch** — sparse-checkout in cone mode requires modern git; use `dev-tasks doctor` to verify
- **rsync required for ctx fetch** — the cache write step uses `rsync` to copy sparse content; available by default on macOS and most Linux distributions

---

## What's Coming Next

| Phase | Capability | Status |
|-------|-----------|--------|
| Phase 0 | Distribution (`dev-tasks install/update/doctor`) | Done |
| Phase 1 | Extraction (`dt extract *`) | Done |
| Phase 2 | Catalog — cross-repo aggregation + validation | Done (`dt validate-component`, `dt catalog build/validate/query/scaffold` shipped) |
| Phase 3 | Context — sparse-fetch + budget-aware bundle assembly + session init | Done (`dt ctx fetch/gc/assemble` + `dt init --components` shipped) |
| Phase 4 | Scoping — LLM-assisted component selection per task | In Progress (`dt scope` shipped; closure + gate planned) |
| Phase 5 | Verify — contract diff + impact analysis | Planned |
| Phase 6 | MCP adapter — expose as agent tools | Planned |
