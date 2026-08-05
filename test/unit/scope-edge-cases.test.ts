/**
 * Edge-case tests for scope module.
 *
 * Tests: empty candidates upstream (no resolve results); id present in index
 * but not in candidates → accepted; overlong rationale → schema error;
 * response with extra fields → schema strictness.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { runScoping } from "#core/scope/scoping.js";
import { validateScopeSchema, validateScopeIds } from "#core/scope/validate.js";
import { buildScopingInput } from "#core/scope/prompt.js";
import type { LlmScopeProvider, ScopeOutput } from "#core/scope/types.js";
import type { CatalogIndex } from "#core/catalog/index-model.js";

/* ─── Test Helpers ────────────────────────────────────────────────────── */

function makeTmpDir(): string {
  return mkdtempSync(join(tmpdir(), "dt-scope-edge-"));
}

function makeIndex(): CatalogIndex {
  return {
    generated_at: new Date().toISOString(),
    generator: "dt@0.6.7",
    components: [
      {
        id: "auth-service",
        name: "Auth Service",
        description: "Auth",
        repo: "https://github.com/org/auth.git",
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
        id: "email-service",
        name: "Email Service",
        description: "Sends emails",
        repo: "https://github.com/org/email.git",
        type: "service",
        domain: "notifications",
        owner: "team-notif",
        criticality: "low",
        lifecycle: "production",
        stack: ["typescript"],
        aliases: ["email"],
        provides: [],
        consumes: [],
        datastores: [],
        origin_sha: "xyz789",
      },
    ],
    contracts: {
      "auth-api": { provider: "auth-service", kind: "openapi", consumers: [] },
    },
    domains: [
      { name: "identity", components: ["auth-service"] },
      { name: "notifications", components: ["email-service"] },
    ],
    flows: [],
    extraction_quality: { total: { high: 1, medium: 0, low: 0 }, per_component: [] },
    errors: [],
  };
}

function mockProvider(responses: string[]): LlmScopeProvider {
  let callIndex = 0;
  return {
    async scopeCall(_system: string, _user: string): Promise<string> {
      return responses[callIndex++] ?? "";
    },
  };
}

/* ─── Edge Cases ──────────────────────────────────────────────────────── */

describe("Scope Edge Cases", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("empty candidates upstream", () => {
    it("buildScopingInput handles empty candidates", () => {
      const input = buildScopingInput("task text", [], makeIndex());
      expect(input.candidates).toHaveLength(0);
      expect(input.flows).toHaveLength(0);
      expect(input.domains).toHaveLength(0);
      expect(input.task).toBe("task text");
    });

    it("scoping with empty candidates still calls LLM (edge: might produce unresolved)", async () => {
      const scope: ScopeOutput = {
        schemaVersion: "1.0.0",
        primary: ["auth-service"],
        secondary: [],
        contracts_crossed: [],
        confidence: "low",
        unresolved: ["cannot map anything"],
        rationale: "No candidates provided.",
      };
      // auth-service is in the index but NOT in candidates (empty set)
      // per spec: id must be in candidates OR full index → should pass id validation
      const provider = mockProvider([JSON.stringify(scope)]);

      const result = await runScoping({
        taskText: "task",
        candidates: [],
        index: makeIndex(),
        llmProvider: provider,
        baseDir: tmpDir,
        skipCalibration: true,
      });

      // It should pass because auth-service is in the index
      expect(result.success).toBe(true);
    });
  });

  describe("id present in index but NOT in candidates", () => {
    it("is accepted (index ids are valid)", () => {
      const scope: ScopeOutput = {
        schemaVersion: "1.0.0",
        primary: ["email-service"],
        secondary: [],
        contracts_crossed: [],
        confidence: "medium",
        unresolved: [],
        rationale: "Email service for notifications.",
      };

      const candidateIds = new Set(["auth-service"]); // email-service NOT a candidate
      const indexIds = new Set(["auth-service", "email-service"]);

      const result = validateScopeIds(scope, candidateIds, indexIds);
      expect(result.valid).toBe(true);
    });
  });

  describe("overlong rationale", () => {
    it("exactly 600 chars → valid", () => {
      const scope: ScopeOutput = {
        schemaVersion: "1.0.0",
        primary: ["auth-service"],
        secondary: [],
        contracts_crossed: [],
        confidence: "high",
        unresolved: [],
        rationale: "x".repeat(600),
      };
      const result = validateScopeSchema(scope);
      expect(result.valid).toBe(true);
    });

    it("601 chars → invalid", () => {
      const scope: ScopeOutput = {
        schemaVersion: "1.0.0",
        primary: ["auth-service"],
        secondary: [],
        contracts_crossed: [],
        confidence: "high",
        unresolved: [],
        rationale: "x".repeat(601),
      };
      const result = validateScopeSchema(scope);
      expect(result.valid).toBe(false);
    });
  });

  describe("extra fields (additionalProperties: false)", () => {
    it("rejects unknown top-level fields", () => {
      const scope = {
        schemaVersion: "1.0.0",
        primary: ["auth-service"],
        secondary: [],
        contracts_crossed: [],
        confidence: "high",
        unresolved: [],
        rationale: "test",
        unknown_extra: "should fail",
      };
      const result = validateScopeSchema(scope);
      expect(result.valid).toBe(false);
    });
  });

  describe("primary boundary values", () => {
    it("exactly 1 primary item → valid", () => {
      const scope: ScopeOutput = {
        schemaVersion: "1.0.0",
        primary: ["auth-service"],
        secondary: [],
        contracts_crossed: [],
        confidence: "high",
        unresolved: [],
        rationale: "test",
      };
      const result = validateScopeSchema(scope);
      expect(result.valid).toBe(true);
    });

    it("exactly 6 primary items → valid", () => {
      const scope: ScopeOutput = {
        schemaVersion: "1.0.0",
        primary: ["a", "b", "c", "d", "e", "f"],
        secondary: [],
        contracts_crossed: [],
        confidence: "high",
        unresolved: [],
        rationale: "test",
      };
      const result = validateScopeSchema(scope);
      expect(result.valid).toBe(true);
    });

    it("7 primary items → invalid", () => {
      const scope: ScopeOutput = {
        schemaVersion: "1.0.0",
        primary: ["a", "b", "c", "d", "e", "f", "g"],
        secondary: [],
        contracts_crossed: [],
        confidence: "high",
        unresolved: [],
        rationale: "test",
      };
      const result = validateScopeSchema(scope);
      expect(result.valid).toBe(false);
    });
  });

  describe("secondary boundary values", () => {
    it("exactly 8 secondary items → valid", () => {
      const scope: ScopeOutput = {
        schemaVersion: "1.0.0",
        primary: ["auth-service"],
        secondary: ["a", "b", "c", "d", "e", "f", "g", "h"],
        contracts_crossed: [],
        confidence: "high",
        unresolved: [],
        rationale: "test",
      };
      const result = validateScopeSchema(scope);
      expect(result.valid).toBe(true);
    });

    it("9 secondary items → invalid", () => {
      const scope: ScopeOutput = {
        schemaVersion: "1.0.0",
        primary: ["auth-service"],
        secondary: ["a", "b", "c", "d", "e", "f", "g", "h", "i"],
        contracts_crossed: [],
        confidence: "high",
        unresolved: [],
        rationale: "test",
      };
      const result = validateScopeSchema(scope);
      expect(result.valid).toBe(false);
    });
  });
});
