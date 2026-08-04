/**
 * Unit tests for core/scope/validate.ts
 *
 * Tests: schema validation (valid/invalid outputs); invented-id rejection;
 * JSON parsing with markdown fences.
 */

import { describe, it, expect } from "vitest";
import { validateScopeSchema, validateScopeIds, parseLlmResponse } from "#core/scope/validate.js";
import type { ScopeOutput } from "#core/scope/types.js";

/* ─── Fixtures ────────────────────────────────────────────────────────── */

function validScope(): ScopeOutput {
  return {
    schemaVersion: "1.0.0",
    primary: ["auth-service"],
    secondary: ["user-service"],
    contracts_crossed: ["auth-api"],
    confidence: "high",
    unresolved: [],
    rationale: "Auth service handles the login flow directly.",
  };
}

/* ─── Schema Validation ───────────────────────────────────────────────── */

describe("validateScopeSchema", () => {
  it("accepts a valid scope output", () => {
    const result = validateScopeSchema(validScope());
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.output.primary).toEqual(["auth-service"]);
    }
  });

  it("accepts valid output with optional flow field", () => {
    const scope = { ...validScope(), flow: "login-flow" };
    const result = validateScopeSchema(scope);
    expect(result.valid).toBe(true);
  });

  it("rejects output missing required field (primary)", () => {
    const scope = { ...validScope() } as Record<string, unknown>;
    delete scope.primary;
    const result = validateScopeSchema(scope);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.includes("primary"))).toBe(true);
    }
  });

  it("rejects output missing schemaVersion", () => {
    const scope = { ...validScope() } as Record<string, unknown>;
    delete scope.schemaVersion;
    const result = validateScopeSchema(scope);
    expect(result.valid).toBe(false);
  });

  it("rejects primary with more than 6 items", () => {
    const scope = validScope();
    scope.primary = ["a", "b", "c", "d", "e", "f", "g"];
    const result = validateScopeSchema(scope);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.includes("primary"))).toBe(true);
    }
  });

  it("rejects empty primary array", () => {
    const scope = validScope();
    scope.primary = [];
    const result = validateScopeSchema(scope);
    expect(result.valid).toBe(false);
  });

  it("rejects secondary with more than 8 items", () => {
    const scope = validScope();
    scope.secondary = ["a", "b", "c", "d", "e", "f", "g", "h", "i"];
    const result = validateScopeSchema(scope);
    expect(result.valid).toBe(false);
  });

  it("rejects invalid confidence value", () => {
    const scope = { ...validScope(), confidence: "very-high" };
    const result = validateScopeSchema(scope);
    expect(result.valid).toBe(false);
  });

  it("rejects rationale longer than 600 characters", () => {
    const scope = validScope();
    scope.rationale = "x".repeat(601);
    const result = validateScopeSchema(scope);
    expect(result.valid).toBe(false);
  });

  it("rejects additional properties", () => {
    const scope = { ...validScope(), extra_field: "not allowed" };
    const result = validateScopeSchema(scope);
    expect(result.valid).toBe(false);
  });

  it("rejects invalid schemaVersion format", () => {
    const scope = { ...validScope(), schemaVersion: "v1" };
    const result = validateScopeSchema(scope);
    expect(result.valid).toBe(false);
  });

  it("rejects non-unique primary items", () => {
    const scope = validScope();
    scope.primary = ["auth-service", "auth-service"];
    const result = validateScopeSchema(scope);
    expect(result.valid).toBe(false);
  });
});

/* ─── Post-Schema ID Validation ───────────────────────────────────────── */

describe("validateScopeIds", () => {
  const candidateIds = new Set(["auth-service", "user-service", "billing-service"]);
  const indexIds = new Set(["auth-service", "user-service", "billing-service", "email-service"]);

  it("accepts ids that are in candidates", () => {
    const scope = validScope();
    const result = validateScopeIds(scope, candidateIds, indexIds);
    expect(result.valid).toBe(true);
  });

  it("accepts ids that are in index but not in candidates", () => {
    const scope = validScope();
    scope.secondary = ["email-service"];
    const result = validateScopeIds(scope, candidateIds, indexIds);
    expect(result.valid).toBe(true);
  });

  it("rejects invented ids not in candidates or index", () => {
    const scope = validScope();
    scope.primary = ["invented-service"];
    const result = validateScopeIds(scope, candidateIds, indexIds);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.inventedIds).toContain("invented-service");
    }
  });

  it("reports all invented ids (primary + secondary)", () => {
    const scope = validScope();
    scope.primary = ["fake-primary"];
    scope.secondary = ["fake-secondary"];
    const result = validateScopeIds(scope, candidateIds, indexIds);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.inventedIds).toContain("fake-primary");
      expect(result.inventedIds).toContain("fake-secondary");
    }
  });

  it("id present in index but NOT in candidates is accepted", () => {
    // Per spec: reject any id not in candidates OR full index
    // email-service is in indexIds but not candidateIds — should pass
    const scope = validScope();
    scope.primary = ["email-service"];
    const result = validateScopeIds(scope, candidateIds, indexIds);
    expect(result.valid).toBe(true);
  });
});

/* ─── JSON Parsing ────────────────────────────────────────────────────── */

describe("parseLlmResponse", () => {
  it("parses clean JSON", () => {
    const result = parseLlmResponse(JSON.stringify(validScope()));
    expect("parsed" in result).toBe(true);
  });

  it("strips markdown json fence", () => {
    const wrapped = "```json\n" + JSON.stringify(validScope()) + "\n```";
    const result = parseLlmResponse(wrapped);
    expect("parsed" in result).toBe(true);
  });

  it("strips plain markdown fence", () => {
    const wrapped = "```\n" + JSON.stringify(validScope()) + "\n```";
    const result = parseLlmResponse(wrapped);
    expect("parsed" in result).toBe(true);
  });

  it("returns error for non-JSON", () => {
    const result = parseLlmResponse("This is not JSON at all");
    expect("error" in result).toBe(true);
  });

  it("handles leading/trailing whitespace", () => {
    const result = parseLlmResponse("   " + JSON.stringify(validScope()) + "   ");
    expect("parsed" in result).toBe(true);
  });
});
