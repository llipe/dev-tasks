/**
 * Unit tests for core/context/assemble.ts and core/context/tokens.ts
 *
 * Tests: token counting, per-layer cap enforcement, truncation order,
 * determinism, non-truncable guard.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { countTokens, truncateToTokenBudget } from "#core/context/tokens.js";
import {
  assemble,
  buildLayerDefinitions,
  BudgetExceededError,
  DEFAULT_BUDGET,
  type ScopeInput,
  type MetaRepoContent,
} from "#core/context/assemble.js";
import type { CatalogIndex } from "#core/catalog/index-model.js";

/* ─── Test Helpers ────────────────────────────────────────────────────── */

function makeTmpDir(): string {
  return mkdtempSync(join(tmpdir(), "dt-assemble-test-"));
}

function makeScope(overrides?: Partial<ScopeInput>): ScopeInput {
  return {
    primary: ["auth-service"],
    secondary: ["user-service"],
    contracts_crossed: ["auth-api"],
    confidence: "high",
    flow: "user-login",
    ...overrides,
  };
}

function makeIndex(): CatalogIndex {
  return {
    generated_at: "2024-01-15T10:00:00Z",
    generator: "dt@0.6.7",
    components: [
      {
        id: "auth-service",
        name: "Auth Service",
        description: "Handles authentication and authorization",
        repo: "https://github.com/acme/auth-service.git",
        type: "service",
        domain: "identity",
        owner: "team-security",
        criticality: "critical",
        lifecycle: "active",
        stack: ["typescript", "express"],
        aliases: ["auth"],
        provides: [{ id: "auth-api", kind: "rest", source: "manual", confidence: "high" }],
        consumes: [{ contract: "user-api", criticality: "high" }],
        datastores: ["auth-db"],
        origin_sha: "abc123",
      },
      {
        id: "user-service",
        name: "User Service",
        description: "Manages user profiles and accounts",
        repo: "https://github.com/acme/user-service.git",
        type: "service",
        domain: "identity",
        owner: "team-platform",
        criticality: "high",
        lifecycle: "active",
        stack: ["typescript", "nestjs"],
        aliases: ["users"],
        provides: [{ id: "user-api", kind: "rest", source: "manual", confidence: "high" }],
        consumes: [],
        datastores: ["user-db"],
        origin_sha: "def456",
      },
    ],
    contracts: {
      "auth-api": { provider: "auth-service", kind: "rest", consumers: ["user-service"] },
      "user-api": { provider: "user-service", kind: "rest", consumers: ["auth-service"] },
    },
    domains: [{ name: "identity", components: ["auth-service", "user-service"] }],
    flows: [
      {
        id: "user-login",
        name: "User Login Flow",
        description: "End-to-end authentication",
        aliases: ["login-flow"],
        participants: ["auth-service", "user-service"],
      },
    ],
    extraction_quality: {
      total: { high: 8, medium: 4, low: 1 },
      per_component: [
        { component_id: "auth-service", counts: { high: 5, medium: 2, low: 1 }, unresolved: 0 },
        { component_id: "user-service", counts: { high: 3, medium: 2, low: 0 }, unresolved: 0 },
      ],
    },
    errors: [],
  };
}

function makeMetaRepo(overrides?: Partial<MetaRepoContent>): MetaRepoContent {
  return {
    basePath: "/tmp/meta-repo",
    index: makeIndex(),
    architectureMd: "# Architecture\n\nMicroservices platform.",
    conventionsMd: "# Conventions\n\nUse REST + JSON.",
    componentContent: new Map([
      [
        "auth-service",
        {
          docs: "# Auth Docs\n\nLogin and token management.",
          contracts: [{ id: "auth-api", content: "OpenAPI spec for auth", confidence: "high" }],
        },
      ],
      [
        "user-service",
        {
          docs: "# User Docs\n\nProfile management.",
          contracts: [{ id: "user-api", content: "OpenAPI spec for users", confidence: "high" }],
        },
      ],
    ]),
    flowContent: new Map([["user-login", "1. Client → auth\n2. auth → user\n3. JWT issued"]]),
    ...overrides,
  };
}

/* ─── Token Counting ──────────────────────────────────────────────────── */

describe("countTokens", () => {
  it("returns 0 for empty string", () => {
    expect(countTokens("")).toBe(0);
  });

  it("returns 0 for undefined-like input", () => {
    expect(countTokens("")).toBe(0);
  });

  it("estimates tokens for prose text", () => {
    // "Hello world" = 11 chars, ~3 tokens at 4 chars/token
    const tokens = countTokens("Hello world");
    expect(tokens).toBeGreaterThan(0);
    expect(tokens).toBeLessThanOrEqual(5);
  });

  it("estimates tokens for code-heavy text", () => {
    const code = "function foo() { return bar[0] && baz(x); }";
    const tokens = countTokens(code);
    expect(tokens).toBeGreaterThan(0);
    // Code-heavy uses 3.5 chars/token, should be higher token count per char
    expect(tokens).toBeGreaterThanOrEqual(10);
  });

  it("is proportional to text length", () => {
    const short = countTokens("short text");
    const long = countTokens("a ".repeat(1000));
    expect(long).toBeGreaterThan(short);
  });
});

/* ─── Token Truncation ────────────────────────────────────────────────── */

describe("truncateToTokenBudget", () => {
  it("returns full text if under budget", () => {
    const text = "Hello world";
    const result = truncateToTokenBudget(text, 1000);
    expect(result.text).toBe(text);
    expect(result.tokens).toBe(countTokens(text));
  });

  it("truncates text exceeding budget", () => {
    const text = "Line one.\nLine two.\nLine three.\nLine four.\nLine five.";
    const fullTokens = countTokens(text);
    const result = truncateToTokenBudget(text, Math.floor(fullTokens / 2));
    expect(result.tokens).toBeLessThanOrEqual(Math.floor(fullTokens / 2));
    expect(result.text.length).toBeLessThan(text.length);
  });

  it("preserves line boundaries", () => {
    const text = "Line one.\nLine two.\nLine three.\nLine four.";
    const result = truncateToTokenBudget(text, 5);
    // Should truncate at a line boundary
    expect(result.text).not.toContain("Line four");
  });
});

/* ─── Layer Definitions ───────────────────────────────────────────────── */

describe("buildLayerDefinitions", () => {
  it("produces layers in fixed order", () => {
    const scope = makeScope();
    const layers = buildLayerDefinitions(scope);

    expect(layers[0].id).toBe("00-index");
    expect(layers[1].id).toBe("01-flow");
    expect(layers[2].id).toBe("02-conventions-delta");
    expect(layers[3].id).toBe("03-architecture");
    // Primary
    expect(layers[4].id).toBe("04-primary-auth-service");
    // Secondary
    expect(layers[5].id).toBe("05-secondary-user-service");
    // Contracts
    expect(layers[6].id).toBe("06-contracts");
  });

  it("marks non-truncable layers correctly", () => {
    const scope = makeScope();
    const layers = buildLayerDefinitions(scope);

    expect(layers[0].truncable).toBe(false); // index
    expect(layers[1].truncable).toBe(false); // flow
    expect(layers[2].truncable).toBe(false); // conventions
    expect(layers[3].truncable).toBe(true); // architecture
    expect(layers[4].truncable).toBe(true); // primary
    expect(layers[5].truncable).toBe(true); // secondary
    expect(layers[6].truncable).toBe(true); // contracts
  });

  it("generates one layer per primary component", () => {
    const scope = makeScope({ primary: ["auth-service", "user-service"] });
    const layers = buildLayerDefinitions(scope);
    const primaries = layers.filter((l) => l.id.startsWith("04-primary-"));
    expect(primaries).toHaveLength(2);
    expect(primaries[0].id).toBe("04-primary-auth-service");
    expect(primaries[1].id).toBe("04-primary-user-service");
  });

  it("generates one layer per secondary component", () => {
    const scope = makeScope({ secondary: ["user-service", "notification-service"] });
    const layers = buildLayerDefinitions(scope);
    const secondaries = layers.filter((l) => l.id.startsWith("05-secondary-"));
    expect(secondaries).toHaveLength(2);
  });

  it("handles empty secondary list", () => {
    const scope = makeScope({ secondary: [] });
    const layers = buildLayerDefinitions(scope);
    const secondaries = layers.filter((l) => l.id.startsWith("05-secondary-"));
    expect(secondaries).toHaveLength(0);
  });
});

/* ─── Assemble — Budget Enforcement ──────────────────────────────────── */

describe("assemble", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("assembles a bundle under budget", () => {
    const scope = makeScope();
    const metaRepo = makeMetaRepo();
    const outDir = join(tmpDir, "bundle");

    const manifest = assemble({ scope, metaRepo, outDir, budget: DEFAULT_BUDGET });

    expect(manifest.totalTokens).toBeLessThanOrEqual(DEFAULT_BUDGET);
    expect(manifest.files.length).toBeGreaterThan(0);
    expect(manifest.budget).toBe(DEFAULT_BUDGET);
    // Manifest file written
    expect(existsSync(join(outDir, "bundle.json"))).toBe(true);
  });

  it("writes files to the output directory", () => {
    const scope = makeScope();
    const metaRepo = makeMetaRepo();
    const outDir = join(tmpDir, "bundle");

    const manifest = assemble({ scope, metaRepo, outDir });

    for (const file of manifest.files) {
      expect(existsSync(join(outDir, file.filename))).toBe(true);
    }
  });

  it("produces deterministic output (same SHA-256 on re-run)", () => {
    const scope = makeScope();
    const metaRepo = makeMetaRepo();
    const outDir1 = join(tmpDir, "bundle1");
    const outDir2 = join(tmpDir, "bundle2");

    const manifest1 = assemble({ scope, metaRepo, outDir: outDir1 });
    const manifest2 = assemble({ scope, metaRepo, outDir: outDir2 });

    // Same number of files
    expect(manifest1.files.length).toBe(manifest2.files.length);

    // Same SHA-256 for each file
    for (let i = 0; i < manifest1.files.length; i++) {
      expect(manifest1.files[i].sha256).toBe(manifest2.files[i].sha256);
      expect(manifest1.files[i].filename).toBe(manifest2.files[i].filename);
      expect(manifest1.files[i].tokens).toBe(manifest2.files[i].tokens);
    }
  });

  it("records truncation when over budget", () => {
    const scope = makeScope();
    // Use a very large architecture doc to force truncation
    const bigArch = "# Architecture\n\n" + "This is a detailed paragraph.\n".repeat(5000);
    const metaRepo = makeMetaRepo({ architectureMd: bigArch });
    const outDir = join(tmpDir, "bundle");

    // Set a tight budget
    const manifest = assemble({ scope, metaRepo, outDir, budget: 1000 });

    expect(manifest.totalTokens).toBeLessThanOrEqual(1000);
    expect(manifest.truncated.length).toBeGreaterThan(0);

    // Check truncation record structure
    for (const t of manifest.truncated) {
      expect(t.layerId).toBeDefined();
      expect(t.originalTokens).toBeGreaterThanOrEqual(t.truncatedTo);
    }
  });

  it("truncates in reverse priority order (highest priority number first)", () => {
    const scope = makeScope({ primary: ["auth-service", "user-service"], secondary: [] });
    // Make docs big enough to require truncation
    const bigDocs = "# Docs\n\n" + "Detail paragraph.\n".repeat(3000);
    const metaRepo = makeMetaRepo({
      componentContent: new Map([
        ["auth-service", { docs: bigDocs, contracts: [] }],
        ["user-service", { docs: bigDocs, contracts: [] }],
      ]),
    });
    const outDir = join(tmpDir, "bundle");

    const manifest = assemble({ scope, metaRepo, outDir, budget: 1500 });

    if (manifest.truncated.length >= 2) {
      // Contracts (06-) should be truncated before primary (04-)
      const firstTruncated = manifest.truncated[0];
      const secondTruncated = manifest.truncated[1];
      // Higher priority numbers get truncated first
      expect(firstTruncated.layerId >= secondTruncated.layerId).toBe(true);
    }
  });

  it("throws BudgetExceededError when non-truncable exceeds budget", () => {
    const scope = makeScope();
    // Make conventions very large (non-truncable)
    const hugeConventions = "# Conventions\n\n" + "Rule: ".repeat(100_000);
    const metaRepo = makeMetaRepo({ conventionsMd: hugeConventions });
    const outDir = join(tmpDir, "bundle");

    expect(() => assemble({ scope, metaRepo, outDir, budget: 100 })).toThrow(BudgetExceededError);
  });

  it("BudgetExceededError includes required tokens and budget", () => {
    const scope = makeScope();
    const hugeConventions = "# Conventions\n\n" + "X ".repeat(50_000);
    const metaRepo = makeMetaRepo({ conventionsMd: hugeConventions });
    const outDir = join(tmpDir, "bundle");

    try {
      assemble({ scope, metaRepo, outDir, budget: 100 });
      expect.fail("Should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(BudgetExceededError);
      const e = err as BudgetExceededError;
      expect(e.requiredTokens).toBeGreaterThan(100);
      expect(e.budget).toBe(100);
    }
  });

  it("does not include in-file timestamps", () => {
    const scope = makeScope();
    const metaRepo = makeMetaRepo();
    const outDir = join(tmpDir, "bundle");

    assemble({ scope, metaRepo, outDir });

    // Read all generated files and check for timestamp patterns
    const timestampRe = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
    const files = ["00-index.md", "01-flow.md", "02-conventions-delta.md", "03-architecture.md"];
    for (const f of files) {
      const path = join(outDir, f);
      if (existsSync(path)) {
        const content = readFileSync(path, "utf-8");
        expect(content).not.toMatch(timestampRe);
      }
    }
  });

  it("uses default budget of 60000 tokens", () => {
    const scope = makeScope();
    const metaRepo = makeMetaRepo();
    const outDir = join(tmpDir, "bundle");

    const manifest = assemble({ scope, metaRepo, outDir });
    expect(manifest.budget).toBe(60000);
  });

  it("emits SHA-256 per file in manifest", () => {
    const scope = makeScope();
    const metaRepo = makeMetaRepo();
    const outDir = join(tmpDir, "bundle");

    const manifest = assemble({ scope, metaRepo, outDir });

    for (const file of manifest.files) {
      expect(file.sha256).toMatch(/^[a-f0-9]{64}$/);
    }
  });

  it("secondary components render summary only (no full docs)", () => {
    const scope = makeScope({ secondary: ["user-service"] });
    const metaRepo = makeMetaRepo();
    const outDir = join(tmpDir, "bundle");

    assemble({ scope, metaRepo, outDir });

    const secondaryFile = join(outDir, "05-secondary-user-service.md");
    expect(existsSync(secondaryFile)).toBe(true);
    const content = readFileSync(secondaryFile, "utf-8");

    // Should contain summary info
    expect(content).toContain("user-service");
    expect(content).toContain("secondary");
    // Should NOT contain full documentation section
    expect(content).not.toContain("## Documentation");
    expect(content).not.toContain("Profile management.");
  });

  it("renders boundary contracts with visible confidence badge", () => {
    const scope = makeScope();
    const metaRepo = makeMetaRepo();
    const outDir = join(tmpDir, "bundle");

    assemble({ scope, metaRepo, outDir });

    const contractsFile = join(outDir, "06-contracts.md");
    expect(existsSync(contractsFile)).toBe(true);
    const content = readFileSync(contractsFile, "utf-8");

    // Should include confidence badges
    expect(content).toContain("[HIGH]");
  });

  it("handles no flow in scope", () => {
    const scope = makeScope({ flow: undefined });
    const metaRepo = makeMetaRepo();
    const outDir = join(tmpDir, "bundle");

    assemble({ scope, metaRepo, outDir });

    const flowFile = join(outDir, "01-flow.md");
    expect(existsSync(flowFile)).toBe(true);
    const content = readFileSync(flowFile, "utf-8");
    expect(content).toContain("No flow in scope");
  });

  it("handles empty secondary list", () => {
    const scope = makeScope({ secondary: [] });
    const metaRepo = makeMetaRepo();
    const outDir = join(tmpDir, "bundle");

    const manifest = assemble({ scope, metaRepo, outDir });

    // No secondary files should exist
    const secondaryFiles = manifest.files.filter((f) => f.filename.startsWith("05-"));
    expect(secondaryFiles).toHaveLength(0);
  });

  it("handles single primary with very large docs (truncation)", () => {
    const hugeDocs = "# Auth Docs\n\n" + "Detailed explanation of the auth flow.\n".repeat(10000);
    const scope = makeScope({ primary: ["auth-service"], secondary: [] });
    const metaRepo = makeMetaRepo({
      componentContent: new Map([["auth-service", { docs: hugeDocs, contracts: [] }]]),
    });
    const outDir = join(tmpDir, "bundle");

    const manifest = assemble({ scope, metaRepo, outDir, budget: 2000 });

    expect(manifest.totalTokens).toBeLessThanOrEqual(2000);
    expect(manifest.truncated.length).toBeGreaterThan(0);
  });
});
