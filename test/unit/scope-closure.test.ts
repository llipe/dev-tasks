/**
 * Unit tests for core/scope/closure.ts
 *
 * Tests: closure adds consumers/flow neighbors to secondary;
 * deduplication (primary wins); source tagging.
 */

import { describe, it, expect } from "vitest";
import { expandClosure } from "#core/scope/closure.js";
import type { ScopeOutput } from "#core/scope/types.js";
import type { CatalogIndex } from "#core/catalog/index-model.js";

/* ─── Fixtures ────────────────────────────────────────────────────────── */

function makeIndex(): CatalogIndex {
  return {
    generated_at: new Date().toISOString(),
    generator: "dt@0.6.7",
    components: [
      {
        id: "auth-service",
        name: "Auth Service",
        description: "Authentication",
        repo: "https://github.com/org/auth.git",
        type: "service",
        domain: "identity",
        owner: "team-auth",
        criticality: "high",
        lifecycle: "production",
        stack: ["typescript"],
        aliases: [],
        provides: [{ id: "auth-api", kind: "openapi", source: "extracted", confidence: "high" }],
        consumes: [],
        datastores: [],
        origin_sha: "abc",
      },
      {
        id: "user-service",
        name: "User Service",
        description: "Users",
        repo: "https://github.com/org/user.git",
        type: "service",
        domain: "identity",
        owner: "team-users",
        criticality: "medium",
        lifecycle: "production",
        stack: ["typescript"],
        aliases: [],
        provides: [{ id: "user-api", kind: "openapi", source: "extracted", confidence: "high" }],
        consumes: [{ contract: "auth-api", criticality: "high" }],
        datastores: [],
        origin_sha: "def",
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
        aliases: [],
        provides: [
          { id: "billing-api", kind: "openapi", source: "extracted", confidence: "medium" },
        ],
        consumes: [{ contract: "auth-api", criticality: "medium" }],
        datastores: [],
        origin_sha: "ghi",
      },
      {
        id: "notification-service",
        name: "Notifications",
        description: "Sends notifications",
        repo: "https://github.com/org/notif.git",
        type: "service",
        domain: "notifications",
        owner: "team-notif",
        criticality: "low",
        lifecycle: "production",
        stack: ["typescript"],
        aliases: [],
        provides: [],
        consumes: [{ contract: "user-api", criticality: "low" }],
        datastores: [],
        origin_sha: "jkl",
      },
    ],
    contracts: {
      "auth-api": {
        provider: "auth-service",
        kind: "openapi",
        consumers: ["user-service", "billing-service"],
      },
      "user-api": {
        provider: "user-service",
        kind: "openapi",
        consumers: ["notification-service"],
      },
      "billing-api": { provider: "billing-service", kind: "openapi", consumers: [] },
    },
    domains: [
      { name: "identity", components: ["auth-service", "user-service"] },
      { name: "payments", components: ["billing-service"] },
      { name: "notifications", components: ["notification-service"] },
    ],
    flows: [
      {
        id: "login-flow",
        name: "Login",
        participants: ["auth-service", "user-service", "notification-service"],
      },
      { id: "payment-flow", name: "Payment", participants: ["billing-service", "auth-service"] },
    ],
    extraction_quality: { total: { high: 3, medium: 1, low: 0 }, per_component: [] },
    errors: [],
  };
}

function baseScopeOutput(): ScopeOutput {
  return {
    schemaVersion: "1.0.0",
    primary: ["auth-service"],
    secondary: [],
    contracts_crossed: ["auth-api"],
    confidence: "high",
    unresolved: [],
    rationale: "Auth service is the primary target.",
  };
}

/* ─── Tests ───────────────────────────────────────────────────────────── */

describe("expandClosure", () => {
  it("adds consumers of contracts_crossed to secondary", () => {
    const scope = baseScopeOutput();
    const result = expandClosure(scope, makeIndex());

    // auth-api consumers: user-service, billing-service
    expect(result.secondary).toContain("user-service");
    expect(result.secondary).toContain("billing-service");
  });

  it("adds contract provider to secondary if not in scope", () => {
    // If auth-service were NOT primary, it would be added as the provider of auth-api
    const scope: ScopeOutput = {
      ...baseScopeOutput(),
      primary: ["user-service"],
      contracts_crossed: ["auth-api"],
    };
    const result = expandClosure(scope, makeIndex());

    // auth-service is the provider of auth-api
    expect(result.secondary).toContain("auth-service");
  });

  it("does not add primary components to secondary (dedup: primary wins)", () => {
    const scope = baseScopeOutput();
    const result = expandClosure(scope, makeIndex());

    // auth-service is primary and also provider of auth-api — should NOT be in secondary
    expect(result.secondary).not.toContain("auth-service");
    expect(result.primary).toContain("auth-service");
  });

  it("does not duplicate components already in secondary", () => {
    const scope: ScopeOutput = {
      ...baseScopeOutput(),
      secondary: ["user-service"], // already in secondary from LLM
    };
    const result = expandClosure(scope, makeIndex());

    // user-service should appear only once in secondary
    const count = result.secondary.filter((id) => id === "user-service").length;
    expect(count).toBe(1);
  });

  it("adds flow neighbors to secondary when flow is specified", () => {
    const scope: ScopeOutput = {
      ...baseScopeOutput(),
      flow: "login-flow",
      contracts_crossed: [],
    };
    const result = expandClosure(scope, makeIndex());

    // login-flow participants: auth-service (primary), user-service, notification-service
    expect(result.secondary).toContain("user-service");
    expect(result.secondary).toContain("notification-service");
  });

  it("does not add flow neighbor that is already primary", () => {
    const scope: ScopeOutput = {
      ...baseScopeOutput(),
      flow: "login-flow",
      contracts_crossed: [],
    };
    const result = expandClosure(scope, makeIndex());

    // auth-service is primary and a login-flow participant — should NOT be in secondary
    expect(result.secondary).not.toContain("auth-service");
  });

  it("records source 'llm' for LLM-selected components", () => {
    const scope: ScopeOutput = {
      ...baseScopeOutput(),
      secondary: ["user-service"],
    };
    const result = expandClosure(scope, makeIndex());

    expect(result.sourceMap["auth-service"]).toBe("llm");
    expect(result.sourceMap["user-service"]).toBe("llm");
  });

  it("records source 'closure' for closure-added components", () => {
    const scope = baseScopeOutput();
    const result = expandClosure(scope, makeIndex());

    // user-service and billing-service added via closure
    expect(result.sourceMap["user-service"]).toBe("closure");
    expect(result.sourceMap["billing-service"]).toBe("closure");
  });

  it("handles empty contracts_crossed with no flow (no expansion)", () => {
    const scope: ScopeOutput = {
      ...baseScopeOutput(),
      contracts_crossed: [],
    };
    const result = expandClosure(scope, makeIndex());

    expect(result.primary).toEqual(["auth-service"]);
    expect(result.secondary).toEqual([]);
  });

  it("handles unknown contract id gracefully", () => {
    const scope: ScopeOutput = {
      ...baseScopeOutput(),
      contracts_crossed: ["nonexistent-contract"],
    };
    const result = expandClosure(scope, makeIndex());

    // No expansion from nonexistent contract
    expect(result.secondary).toEqual([]);
  });

  it("handles unknown flow id gracefully", () => {
    const scope: ScopeOutput = {
      ...baseScopeOutput(),
      flow: "nonexistent-flow",
      contracts_crossed: [],
    };
    const result = expandClosure(scope, makeIndex());

    expect(result.secondary).toEqual([]);
  });

  it("combines contract consumers and flow neighbors", () => {
    const scope: ScopeOutput = {
      ...baseScopeOutput(),
      contracts_crossed: ["auth-api"],
      flow: "login-flow",
    };
    const result = expandClosure(scope, makeIndex());

    // From contracts: user-service, billing-service
    // From flow: user-service (dedup), notification-service
    expect(result.secondary).toContain("user-service");
    expect(result.secondary).toContain("billing-service");
    expect(result.secondary).toContain("notification-service");

    // No duplicates
    const unique = new Set(result.secondary);
    expect(unique.size).toBe(result.secondary.length);
  });
});
