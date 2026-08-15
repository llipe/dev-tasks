# Manual Test Plan — Extraction Ladder Inversion

> **Issue:** #127
> **Branch:** `claude/dev-tasks-codebase-analysis-oxda22`
> **PR:** #125

---

## Build & Setup

```bash
# In the dev-tasks repo
cd ~/Documents/Documentos\ -\ M-FMALLEAS/Dev/dev-tasks

# Install deps (express is now a devDependency for test fixtures)
pnpm install

# Build the CLI (compiles TS → dist/)
pnpm run build

# Verify the binary works
./dist/bin/dt.js --version

# (Optional) Link globally so `dt` is available anywhere
pnpm link --global
```

### Using `dt` in another repo without global link

```bash
# Option A: invoke directly with full path
/path/to/dev-tasks/dist/bin/dt.js extract all --json

# Option B: add to PATH temporarily
export PATH="/path/to/dev-tasks/dist/bin:$PATH"
dt extract all --json

# Option C: use npx from the dev-tasks dir
npx --prefix /path/to/dev-tasks dt extract all --json
```

### Running inline test scripts

> **Important:** `npx tsx -e "..."` does NOT support top-level `await` because
> it treats `-e` inline code as CJS regardless of the project's `"type": "module"`.
> All manual tests below use **temp script files** instead.

```bash
# Helper: run a TypeScript snippet as an ESM file via tsx
run_ts() {
  local file=$(mktemp /tmp/dt-test-XXXX.ts)
  echo "$1" > "$file"
  npx tsx "$file"
  local code=$?
  rm -f "$file"
  return $code
}
```

Paste this helper into your shell once, then use `run_ts '...'` for each test.

Alternatively, write each snippet to a `.ts` file under the project root and run with `npx tsx <file>`.

---

## Test 1 — OpenAPI Ladder Ordering

### 1A. Declared wins when on-disk spec exists

```bash
run_ts '
import { extractOpenApiLadder } from "./core/extract/openapi/index.js";
import { resolve } from "path";

async function main() {
  const r = await extractOpenApiLadder({ rootDir: resolve("test/fixtures/extract/openapi-on-disk") });
  console.log("Winner:", r.ladder.winningRung);
  console.log("Strategy:", r.extraction?.strategy);
  console.log("Confidence:", r.ladder.confidence);
}
main();
'
```

**Expected:**
```
Winner: declared
Strategy: route1
Confidence: high
```

### 1B. Observed (boot) wins when no spec on disk

```bash
run_ts '
import { extractOpenApiLadder } from "./core/extract/openapi/index.js";
import { resolve } from "path";

async function main() {
  const r = await extractOpenApiLadder({ rootDir: resolve("test/fixtures/extract/express-bootable") });
  console.log("Winner:", r.ladder.winningRung);
  console.log("Confidence:", r.ladder.confidence);
  console.log("Endpoints:", r.extraction?.endpoints.length);
  const paths = r.extraction?.endpoints.map(e => e.method.toUpperCase() + " " + e.path);
  paths?.forEach(p => console.log(" ", p));
}
main();
'
```

**Expected:**
```
Winner: observed
Confidence: high
Endpoints: 10
  GET /users
  GET /users/:id
  POST /users
  GET /health          ← dynamic (invisible to AST)
  GET /metrics         ← dynamic (invisible to AST)
  POST /webhooks/stripe ← dynamic
  POST /webhooks/github ← dynamic
  GET /api/v1/status   ← variable prefix (wrong in AST)
  GET /api/v1/config   ← variable prefix
  POST /api/v1/config  ← variable prefix
```

### 1C. Inferred fallback with noBoot

```bash
run_ts '
import { extractOpenApiLadder } from "./core/extract/openapi/index.js";
import { resolve } from "path";

async function main() {
  const r = await extractOpenApiLadder({ rootDir: resolve("test/fixtures/extract/express-bootable"), noBoot: true });
  console.log("Winner:", r.ladder.winningRung);
  console.log("Confidence:", r.ladder.confidence);
  console.log("All low:", r.extraction?.endpoints.every(e => e.confidence === "low"));
  console.log("Diagnostics:", r.ladder.diagnostics);
}
main();
'
```

**Expected:**
```
Winner: inferred
Confidence: low
All endpoints low: true
Diagnostics: [ 'No on-disk OpenAPI spec found', 'route2 skipped (--no-boot)' ]
```

---

## Test 2 — Workspace Discovery

### 2A. Single-package repo

```bash
run_ts '
import { discoverComponents } from "./core/extract/workspaces.js";
import { resolve } from "path";

const r = discoverComponents(resolve("test/fixtures/extract/express-typed"));
console.log("Count:", r.length);
console.log("Name:", r[0].name);
console.log("Path:", r[0].path);
'
```

**Expected:** Count `1`, name `express-typed-app`.

### 2B. pnpm workspace monorepo

```bash
run_ts '
import { discoverComponents } from "./core/extract/workspaces.js";
import { resolve } from "path";

const r = discoverComponents(resolve("test/fixtures/extract/monorepo-pnpm"));
console.log("Count:", r.length);
r.forEach(c => console.log(" -", c.name, "→", c.path.split("/").slice(-2).join("/")));
'
```

**Expected:**
```
Count: 2
 - @monorepo/api → packages/api
 - @monorepo/worker → packages/worker
```

Root excluded (only devDependencies, no runtime deps).

### 2C. npm workspaces

```bash
run_ts '
import { discoverComponents } from "./core/extract/workspaces.js";
import { resolve } from "path";

const r = discoverComponents(resolve("test/fixtures/extract/monorepo-npm"));
console.log("Count:", r.length);
r.forEach(c => console.log(" -", c.name));
'
```

**Expected:** Count `2`: `@monorepo-npm/backend`, `@monorepo-npm/frontend`.

---

## Test 3 — Ladder Runner Contract

```bash
pnpm run test:unit -- test/unit/extract-ladder.test.ts --reporter=verbose
```

**Verify visually:**
- First usable result wins (no further rungs attempted)
- Inferred always capped at `low`
- Throwing rung treated as unavailable with diagnostic message
- Diagnostics collected from all attempted rungs

---

## Test 4 — Route2 Failure Handling

### 4A. No entry point → null (graceful)

```bash
run_ts '
import { extractRoute2Express } from "./core/extract/openapi/route2.js";
import { resolve } from "path";

async function main() {
  const r = await extractRoute2Express(resolve("test/fixtures/extract/no-framework"));
  console.log("Result:", r);
}
main();
'
```

**Expected:** `null`

### 4B. Timeout → null (graceful)

```bash
run_ts '
import { extractRoute2Express } from "./core/extract/openapi/route2.js";
import { resolve } from "path";

async function main() {
  const r = await extractRoute2Express(resolve("test/fixtures/extract/express-bootable"), { timeout: 1 });
  console.log("Result:", r);
}
main();
'
```

**Expected:** `null`

---

## Test 5 — LLM Removal Verification

### 5A. No LLM references in extraction modules

```bash
grep -r "LlmProvider\|applyLlmDescriptions\|loadLlmProvider" core/extract/ --include="*.ts"
# Should produce no output
```

### 5B. Deleted files don't exist

```bash
ls core/extract/openapi/llm-descriptions.ts 2>&1
ls core/extract/orm/llm-descriptions.ts 2>&1
ls core/extract/orm/migration-inference.ts 2>&1
# All should say "No such file or directory"
```

---

## Test 6 — Schema Ladder (declared → observed)

### 6A. ORM declared rung works without --db-url

```bash
pnpm run test:unit -- test/unit/extract-schema-orchestrator.test.ts --reporter=verbose
```

### 6B. No ORM + no --db-url → null

```bash
run_ts '
import { extractSchema } from "./core/extract/schema.js";
import { resolve } from "path";

async function main() {
  const r = await extractSchema({ rootDir: resolve("test/fixtures/extract/fastify-no-orm") });
  console.log("Result:", r);
}
main();
'
```

**Expected:** `null`

---

## Test 7 — AsyncAPI Declared Rung

```bash
run_ts '
import { extractAsyncApiDeclared } from "./core/extract/asyncapi/declared.js";
import { resolve } from "path";

const r = extractAsyncApiDeclared(resolve("test/fixtures/extract/component-derivation"));
console.log("Found:", r !== null);
if (r) {
  console.log("Source:", r.source);
  console.log("Confidence:", r.confidence);
  console.log("Channels:", r.channels.length);
  r.channels.forEach(ch => console.log(" -", ch.name));
}
'
```

**Expected:** Source `declared`, Confidence `high`, channels listed.

---

## Test 8 — Testing in Another Repo

After building (`pnpm run build`) and linking or pathing:

```bash
# Go to any Express/Node project
cd ~/my-other-project

# Run the full extraction (uses the built CLI)
/path/to/dev-tasks/dist/bin/dt.js extract all --json | jq .

# Or just OpenAPI extraction
/path/to/dev-tasks/dist/bin/dt.js extract openapi --json | jq .

# Or just detection
/path/to/dev-tasks/dist/bin/dt.js extract detect --json | jq .
```

**What to look for:**
- `strategies[].source` should show `declared`/`observed`/`inferred`
- If the target repo has an `openapi.yaml`, route1 should win
- If it's an Express app with deps installed, route2 should discover routes
- `confidence` should never be `medium` or `high` for inferred results

---

## Test 9 — Full Quality Gate

```bash
pnpm run validate
```

**Expected:** Exit 0. All of typecheck + lint + format:check + test pass.

```bash
pnpm run audit
```

**Expected:** No critical/high vulnerabilities in production deps.

---

## Test 10 — Regression Check

```bash
pnpm run test 2>&1 | tail -3
```

**Expected:**
```
 Test Files  100 passed (100)
      Tests  1179 passed (1179)
```

---

## Quick Reference — All Automated Tests

| Test file | What it covers |
|-----------|---------------|
| `test/unit/extract-openapi-route2.test.ts` | Route2 boot+introspect (Express 5) |
| `test/unit/extract-openapi-ladder.test.ts` | Ladder orchestrator ordering |
| `test/unit/extract-workspaces.test.ts` | Workspace discovery (pnpm/npm) |
| `test/unit/extract-ladder.test.ts` | Ladder runner contract |
| `test/unit/extract-openapi-route3.test.ts` | Route3 AST (existing, unchanged) |
| `test/unit/extract-openapi-route1.test.ts` | Route1 on-disk spec (existing) |
| `test/unit/extract-schema-*.test.ts` | Schema extraction (declared) |
| `test/integration/extract-schema.test.ts` | Schema integration |

Run a subset:
```bash
pnpm run test:unit -- --grep "ladder|route2|workspace"
```
