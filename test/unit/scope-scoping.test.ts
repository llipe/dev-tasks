/**
 * Unit tests for core/scope/scoping.ts (orchestrator)
 *
 * Tests: retry logic (first fail → repair → pass; second fail → exit 10);
 * calibration record shape; input assembler excludes full catalog.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { runScoping, EXIT_INVALID_SCOPE } from "#core/scope/scoping.js";
import type { LlmScopeProvider, ScopeOutput } from "#core/scope/types.js";
import type { CatalogIndex } from "#core/catalog/index-model.js";
import type { ResolveCandidate } from "#core/catalog/resolve.js";

/* ─── Test Helpers ────────────────────────────────────────────────────── */

function makeTmpDir(): string {
  return mkdtempSync(join(tmpdir(), "dt-scope-test-"));
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
    ],
    contracts: {
      "auth-api": { provider: "auth-service", kind: "openapi", consumers: [] },
      "user-api": { provider: "user-service", kind: "openapi", consumers: [] },
    },
    domains: [{ name: "identity", components: ["auth-service", "user-service"] }],
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

function validScopeJson(): string {
  const scope: ScopeOutput = {
    schemaVersion: "1.0.0",
    primary: ["auth-service"],
    secondary: ["user-service"],
    contracts_crossed: ["auth-api"],
    confidence: "high",
    unresolved: [],
    rationale: "Auth service handles the login flow.",
  };
  return JSON.stringify(scope);
}

function invalidSchemaJson(): string {
  // Missing required fields
  return JSON.stringify({ primary: ["auth-service"] });
}

function inventedIdJson(): string {
  const scope: ScopeOutput = {
    schemaVersion: "1.0.0",
    primary: ["invented-service"],
    secondary: [],
    contracts_crossed: [],
    confidence: "high",
    unresolved: [],
    rationale: "This id is made up.",
  };
  return JSON.stringify(scope);
}

/** Creates a mock LLM provider with configurable responses */
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

/* ─── Tests ───────────────────────────────────────────────────────────── */

describe("runScoping", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("succeeds on valid first response", async () => {
    const provider = mockProvider([validScopeJson()]);
    const result = await runScoping({
      taskText: "Add rate limiting to auth",
      candidates: makeCandidates(),
      index: makeIndex(),
      llmProvider: provider,
      baseDir: tmpDir,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.output.primary).toEqual(["auth-service"]);
      expect(result.repairAttempted).toBe(false);
    }
  });

  it("retries once on schema error and succeeds", async () => {
    const provider = mockProvider([invalidSchemaJson(), validScopeJson()]);
    const result = await runScoping({
      taskText: "Add rate limiting",
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

  it("retries once on invented-id and succeeds", async () => {
    const provider = mockProvider([inventedIdJson(), validScopeJson()]);
    const result = await runScoping({
      taskText: "Add rate limiting",
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

  it("fails after second invalid response (would exit 10)", async () => {
    const provider = mockProvider([invalidSchemaJson(), invalidSchemaJson()]);
    const result = await runScoping({
      taskText: "Add rate limiting",
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

  it("fails after non-JSON first response then another invalid", async () => {
    const provider = mockProvider(["This is not JSON", "Still not JSON"]);
    const result = await runScoping({
      taskText: "task",
      candidates: makeCandidates(),
      index: makeIndex(),
      llmProvider: provider,
      baseDir: tmpDir,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.repairAttempted).toBe(true);
    }
  });

  it("records calibration data on success", async () => {
    const provider = mockProvider([validScopeJson()]);
    const result = await runScoping({
      taskText: "Add rate limiting to auth",
      candidates: makeCandidates(),
      index: makeIndex(),
      llmProvider: provider,
      baseDir: tmpDir,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.calibrationPath).toBeDefined();
      expect(existsSync(result.calibrationPath!)).toBe(true);

      const record = JSON.parse(readFileSync(result.calibrationPath!, "utf-8"));
      expect(record.primary).toEqual(["auth-service"]);
      expect(record.secondary).toEqual(["user-service"]);
      expect(record.confidence).toBe("high");
      expect(record.taskTextHash).toBeDefined();
      expect(record.timestamp).toBeDefined();
    }
  });

  it("skips calibration when skipCalibration is true", async () => {
    const provider = mockProvider([validScopeJson()]);
    const result = await runScoping({
      taskText: "Add rate limiting to auth",
      candidates: makeCandidates(),
      index: makeIndex(),
      llmProvider: provider,
      baseDir: tmpDir,
      skipCalibration: true,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.calibrationPath).toBeUndefined();
    }

    // No calibration directory created
    const calibDir = join(tmpDir, ".dev-tasks", "calibration");
    expect(existsSync(calibDir)).toBe(false);
  });

  it("EXIT_INVALID_SCOPE is 10", () => {
    expect(EXIT_INVALID_SCOPE).toBe(10);
  });
});
