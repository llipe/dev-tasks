/**
 * Integration tests for the scoping module.
 *
 * Tests: mocked LLM returning valid JSON → pass; invalid JSON (bad schema) →
 * repair → pass; second-invalid → exit 10; non-JSON output → repair attempt.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { runScoping } from "#core/scope/scoping.js";
import type { LlmScopeProvider, ScopeOutput } from "#core/scope/types.js";
import type { CatalogIndex } from "#core/catalog/index-model.js";
import type { ResolveCandidate } from "#core/catalog/resolve.js";

/* ─── Test Helpers ────────────────────────────────────────────────────── */

function makeTmpDir(): string {
  return mkdtempSync(join(tmpdir(), "dt-scope-int-"));
}

function makeIndex(): CatalogIndex {
  return {
    generated_at: new Date().toISOString(),
    generator: "dt@0.6.7",
    components: [
      {
        id: "auth-service",
        name: "Auth Service",
        description: "Handles authentication",
        repo: "https://github.com/org/auth-service.git",
        type: "service",
        domain: "identity",
        owner: "team-auth",
        criticality: "high",
        lifecycle: "production",
        stack: ["typescript"],
        aliases: ["auth"],
        provides: [{ id: "auth-api", kind: "openapi", source: "extracted", confidence: "high" }],
        consumes: [],
        datastores: [],
        origin_sha: "abc123",
      },
      {
        id: "user-service",
        name: "User Service",
        description: "Manages users",
        repo: "https://github.com/org/user-service.git",
        type: "service",
        domain: "identity",
        owner: "team-users",
        criticality: "medium",
        lifecycle: "production",
        stack: ["typescript"],
        aliases: ["users"],
        provides: [{ id: "user-api", kind: "openapi", source: "extracted", confidence: "high" }],
        consumes: [],
        datastores: [],
        origin_sha: "def456",
      },
      {
        id: "billing-service",
        name: "Billing",
        description: "Payments",
        repo: "https://github.com/org/billing.git",
        type: "service",
        domain: "payments",
        owner: "team-billing",
        criticality: "high",
        lifecycle: "production",
        stack: ["java"],
        aliases: ["billing"],
        provides: [],
        consumes: [],
        datastores: [],
        origin_sha: "ghi789",
      },
    ],
    contracts: {
      "auth-api": { provider: "auth-service", kind: "openapi", consumers: [] },
      "user-api": { provider: "user-service", kind: "openapi", consumers: [] },
    },
    domains: [
      { name: "identity", components: ["auth-service", "user-service"] },
      { name: "payments", components: ["billing-service"] },
    ],
    flows: [{ id: "login-flow", name: "Login", participants: ["auth-service", "user-service"] }],
    extraction_quality: { total: { high: 2, medium: 0, low: 0 }, per_component: [] },
    errors: [],
  };
}

function makeCandidates(): ResolveCandidate[] {
  return [
    {
      id: "auth-service",
      score: 100,
      signals: [{ type: "exact_id", weight: 100, matched: "auth-service" }],
    },
    {
      id: "user-service",
      score: 60,
      signals: [{ type: "domain", weight: 60, matched: "identity" }],
    },
  ];
}

function validScopeOutput(): ScopeOutput {
  return {
    schemaVersion: "1.0.0",
    primary: ["auth-service"],
    secondary: ["user-service"],
    contracts_crossed: ["auth-api"],
    confidence: "high",
    unresolved: [],
    rationale: "Auth service handles authentication and is the primary target.",
  };
}

function mockProvider(responses: string[]): LlmScopeProvider {
  let callIndex = 0;
  return {
    async scopeCall(_system: string, _user: string): Promise<string> {
      const response = responses[callIndex] ?? "";
      callIndex++;
      return response;
    },
  };
}

/* ─── Integration Tests ───────────────────────────────────────────────── */

describe("Scope Integration", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("valid LLM response → success with scope output and calibration", async () => {
    const provider = mockProvider([JSON.stringify(validScopeOutput())]);

    const result = await runScoping({
      taskText: "Add multi-factor authentication to login",
      candidates: makeCandidates(),
      index: makeIndex(),
      llmProvider: provider,
      baseDir: tmpDir,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.output.primary).toEqual(["auth-service"]);
      expect(result.output.secondary).toEqual(["user-service"]);
      expect(result.output.confidence).toBe("high");
      expect(result.repairAttempted).toBe(false);

      // Calibration file written
      expect(result.calibrationPath).toBeDefined();
      expect(existsSync(result.calibrationPath!)).toBe(true);
    }
  });

  it("invalid schema on first try → repair → valid on second try → success", async () => {
    const invalidFirst = JSON.stringify({ primary: ["auth-service"] }); // missing required fields
    const validSecond = JSON.stringify(validScopeOutput());

    const provider = mockProvider([invalidFirst, validSecond]);

    const result = await runScoping({
      taskText: "Fix authentication bug",
      candidates: makeCandidates(),
      index: makeIndex(),
      llmProvider: provider,
      baseDir: tmpDir,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.repairAttempted).toBe(true);
      expect(result.output.primary).toEqual(["auth-service"]);
    }
  });

  it("invalid on both tries → failure (exit 10)", async () => {
    const invalid = JSON.stringify({ primary: ["auth-service"] }); // missing required fields
    const provider = mockProvider([invalid, invalid]);

    const result = await runScoping({
      taskText: "Do something",
      candidates: makeCandidates(),
      index: makeIndex(),
      llmProvider: provider,
      baseDir: tmpDir,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.repairAttempted).toBe(true);
      expect(result.errors.length).toBeGreaterThan(0);
    }
  });

  it("non-JSON first response → repair attempt → valid second → success", async () => {
    const nonJson = "I think the primary component is auth-service because...";
    const validSecond = JSON.stringify(validScopeOutput());

    const provider = mockProvider([nonJson, validSecond]);

    const result = await runScoping({
      taskText: "Improve login UX",
      candidates: makeCandidates(),
      index: makeIndex(),
      llmProvider: provider,
      baseDir: tmpDir,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.repairAttempted).toBe(true);
    }
  });

  it("non-JSON both responses → failure", async () => {
    const nonJson = "Cannot determine scope from given information";
    const provider = mockProvider([nonJson, nonJson]);

    const result = await runScoping({
      taskText: "Vague task",
      candidates: makeCandidates(),
      index: makeIndex(),
      llmProvider: provider,
      baseDir: tmpDir,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.repairAttempted).toBe(true);
      expect(result.errors[0]).toContain("not valid JSON");
    }
  });

  it("invented ids on first try → repair → valid ids on second → success", async () => {
    const inventedScope: ScopeOutput = {
      ...validScopeOutput(),
      primary: ["nonexistent-service"],
    };
    const provider = mockProvider([
      JSON.stringify(inventedScope),
      JSON.stringify(validScopeOutput()),
    ]);

    const result = await runScoping({
      taskText: "Update auth",
      candidates: makeCandidates(),
      index: makeIndex(),
      llmProvider: provider,
      baseDir: tmpDir,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.repairAttempted).toBe(true);
    }
  });

  it("LLM response with markdown fences → parsed correctly", async () => {
    const fenced = "```json\n" + JSON.stringify(validScopeOutput()) + "\n```";
    const provider = mockProvider([fenced]);

    const result = await runScoping({
      taskText: "Add feature",
      candidates: makeCandidates(),
      index: makeIndex(),
      llmProvider: provider,
      baseDir: tmpDir,
    });

    expect(result.success).toBe(true);
  });

  it("response with extra fields → rejected by schema (additionalProperties: false)", async () => {
    const withExtra = { ...validScopeOutput(), extra_field: "not allowed" };
    const validSecond = JSON.stringify(validScopeOutput());
    const provider = mockProvider([JSON.stringify(withExtra), validSecond]);

    const result = await runScoping({
      taskText: "Add feature",
      candidates: makeCandidates(),
      index: makeIndex(),
      llmProvider: provider,
      baseDir: tmpDir,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.repairAttempted).toBe(true);
    }
  });

  it("overlong rationale → rejected by schema → repair", async () => {
    const overlongScope: ScopeOutput = {
      ...validScopeOutput(),
      rationale: "x".repeat(601),
    };
    const provider = mockProvider([
      JSON.stringify(overlongScope),
      JSON.stringify(validScopeOutput()),
    ]);

    const result = await runScoping({
      taskText: "Add feature",
      candidates: makeCandidates(),
      index: makeIndex(),
      llmProvider: provider,
      baseDir: tmpDir,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.repairAttempted).toBe(true);
    }
  });
});
