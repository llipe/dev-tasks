/**
 * Edge-case tests for scope closure + gate.
 *
 * Tests: exactly at max-components limit (no abort); multi-domain but within
 * component limit; low-payload contract present (flag, no abort); LLM-only
 * component not in closure.
 */

import { describe, it, expect } from "vitest";
import { expandClosure } from "#core/scope/closure.js";
import { runGate } from "#core/scope/gate.js";
import type { ScopeOutput } from "#core/scope/types.js";
import type { CatalogIndex } from "#core/catalog/index-model.js";
import type { ClosureResult } from "#core/scope/closure.js";

/* ─── Fixtures ────────────────────────────────────────────────────────── */

function makeIndex(): CatalogIndex {
  return {
    generated_at: new Date().toISOString(),
    generator: "dt@0.6.7",
    components: [
      {
        id: "auth-service",
        name: "Auth",
        description: "Auth",
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
        name: "Users",
        description: "Users",
        repo: "https://github.com/org/users.git",
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
          {
            id: "billing-api",
            kind: "openapi",
            source: "extracted",
            confidence: "medium",
            payload_confidence: "low",
          },
        ],
        consumes: [{ contract: "auth-api", criticality: "medium" }],
        datastores: [],
        origin_sha: "ghi",
      },
      {
        id: "notif-service",
        name: "Notifications",
        description: "Sends messages",
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
      {
        id: "search-service",
        name: "Search",
        description: "Full-text search",
        repo: "https://github.com/org/search.git",
        type: "service",
        domain: "platform",
        owner: "team-platform",
        criticality: "medium",
        lifecycle: "production",
        stack: ["go"],
        aliases: [],
        provides: [{ id: "search-api", kind: "openapi", source: "extracted", confidence: "high" }],
        consumes: [],
        datastores: [],
        origin_sha: "mno",
      },
    ],
    contracts: {
      "auth-api": {
        provider: "auth-service",
        kind: "openapi",
        consumers: ["user-service", "billing-service"],
      },
      "user-api": { provider: "user-service", kind: "openapi", consumers: ["notif-service"] },
      "billing-api": { provider: "billing-service", kind: "openapi", consumers: [] },
      "search-api": { provider: "search-service", kind: "openapi", consumers: [] },
    },
    domains: [
      { name: "identity", components: ["auth-service", "user-service"] },
      { name: "payments", components: ["billing-service"] },
      { name: "notifications", components: ["notif-service"] },
      { name: "platform", components: ["search-service"] },
    ],
    flows: [{ id: "login-flow", name: "Login", participants: ["auth-service", "user-service"] }],
    extraction_quality: { total: { high: 4, medium: 1, low: 0 }, per_component: [] },
    errors: [],
  };
}

/* ─── Edge Cases ──────────────────────────────────────────────────────── */

describe("Scope Gate Edge Cases", () => {
  describe("exactly at max-components limit", () => {
    it("exactly at limit → passes (only > max triggers abort)", () => {
      const scope: ScopeOutput = {
        schemaVersion: "1.0.0",
        primary: ["auth-service", "user-service"],
        secondary: [],
        contracts_crossed: [],
        confidence: "high",
        unresolved: [],
        rationale: "Focused identity changes.",
      };

      const closure: ClosureResult = {
        primary: ["auth-service", "user-service"],
        secondary: ["billing-service", "notif-service"],
        sourceMap: {
          "auth-service": "llm",
          "user-service": "llm",
          "billing-service": "closure",
          "notif-service": "closure",
        },
      };

      // maxComponents = 4, total = 4 → exactly at limit, should pass
      const result = runGate(scope, closure, makeIndex(), { maxComponents: 4 });
      expect(result.passed).toBe(true);
    });

    it("one above limit → aborts", () => {
      const scope: ScopeOutput = {
        schemaVersion: "1.0.0",
        primary: ["auth-service", "user-service"],
        secondary: [],
        contracts_crossed: [],
        confidence: "high",
        unresolved: [],
        rationale: "Broad changes.",
      };

      const closure: ClosureResult = {
        primary: ["auth-service", "user-service"],
        secondary: ["billing-service", "notif-service", "search-service"],
        sourceMap: {
          "auth-service": "llm",
          "user-service": "llm",
          "billing-service": "closure",
          "notif-service": "closure",
          "search-service": "closure",
        },
      };

      // maxComponents = 4, total = 5 → above limit, should abort
      const result = runGate(scope, closure, makeIndex(), { maxComponents: 4 });
      expect(result.passed).toBe(false);
      if (!result.passed) {
        expect(result.abortRule).toBe("G1");
      }
    });
  });

  describe("multi-domain but within component limit", () => {
    it("3 domains with 3 total components → passes with G6 review flag", () => {
      const scope: ScopeOutput = {
        schemaVersion: "1.0.0",
        primary: ["auth-service"],
        secondary: [],
        contracts_crossed: [],
        confidence: "high",
        unresolved: [],
        rationale: "Cross-domain.",
      };

      const closure: ClosureResult = {
        primary: ["auth-service"],
        secondary: ["billing-service", "notif-service"],
        sourceMap: {
          "auth-service": "llm",
          "billing-service": "closure",
          "notif-service": "closure",
        },
      };

      // 3 components in 3 domains, maxComponents default 4 → passes G1
      const result = runGate(scope, closure, makeIndex());
      expect(result.passed).toBe(true);
      if (result.passed) {
        // Should have G6 flag (3 domains)
        expect(result.reviewFlags.some((f) => f.rule === "G6")).toBe(true);
      }
    });

    it("2 domains stays within limits → passes without G6 flag", () => {
      const scope: ScopeOutput = {
        schemaVersion: "1.0.0",
        primary: ["auth-service"],
        secondary: [],
        contracts_crossed: [],
        confidence: "high",
        unresolved: [],
        rationale: "Two-domain scope.",
      };

      const closure: ClosureResult = {
        primary: ["auth-service"],
        secondary: ["billing-service"],
        sourceMap: { "auth-service": "llm", "billing-service": "closure" },
      };

      const result = runGate(scope, closure, makeIndex());
      expect(result.passed).toBe(true);
      if (result.passed) {
        expect(result.reviewFlags.some((f) => f.rule === "G6")).toBe(false);
      }
    });
  });

  describe("low-payload contract present", () => {
    it("low-payload contract in contracts_crossed → G7 flag, no abort", () => {
      const scope: ScopeOutput = {
        schemaVersion: "1.0.0",
        primary: ["auth-service"],
        secondary: ["billing-service"],
        contracts_crossed: ["billing-api"],
        confidence: "high",
        unresolved: [],
        rationale: "Billing boundary.",
      };

      const closure: ClosureResult = {
        primary: ["auth-service"],
        secondary: ["billing-service"],
        sourceMap: { "auth-service": "llm", "billing-service": "closure" },
      };

      const result = runGate(scope, closure, makeIndex());
      expect(result.passed).toBe(true);
      if (result.passed) {
        const g7 = result.reviewFlags.find((f) => f.rule === "G7");
        expect(g7).toBeDefined();
        expect(g7!.message).toContain("billing-api");
      }
    });

    it("high-payload contract → no G7 flag", () => {
      const scope: ScopeOutput = {
        schemaVersion: "1.0.0",
        primary: ["auth-service"],
        secondary: ["user-service"],
        contracts_crossed: ["auth-api"],
        confidence: "high",
        unresolved: [],
        rationale: "Auth contract.",
      };

      const closure: ClosureResult = {
        primary: ["auth-service"],
        secondary: ["user-service"],
        sourceMap: { "auth-service": "llm", "user-service": "closure" },
      };

      const result = runGate(scope, closure, makeIndex());
      expect(result.passed).toBe(true);
      if (result.passed) {
        expect(result.reviewFlags.some((f) => f.rule === "G7")).toBe(false);
      }
    });
  });

  describe("LLM-only component not in closure", () => {
    it("isolated LLM primary (no graph connection) → G5 review flag", () => {
      // search-service has no connections to any other component in scope
      const scope: ScopeOutput = {
        schemaVersion: "1.0.0",
        primary: ["auth-service", "search-service"],
        secondary: [],
        contracts_crossed: [],
        confidence: "high",
        unresolved: [],
        rationale: "Auth + search.",
      };

      const closure: ClosureResult = {
        primary: ["auth-service", "search-service"],
        secondary: [],
        sourceMap: { "auth-service": "llm", "search-service": "llm" },
      };

      const result = runGate(scope, closure, makeIndex());
      expect(result.passed).toBe(true);
      if (result.passed) {
        // Both are isolated from each other, so G5 flags appear
        const g5Flags = result.reviewFlags.filter((f) => f.rule === "G5");
        expect(g5Flags.length).toBeGreaterThan(0);
        // search-service specifically should be flagged
        expect(g5Flags.some((f) => f.message.includes("search-service"))).toBe(true);
      }
    });

    it("connected LLM primary → no G5 flag", () => {
      // auth-service provides auth-api consumed by user-service
      const scope: ScopeOutput = {
        schemaVersion: "1.0.0",
        primary: ["auth-service"],
        secondary: ["user-service"],
        contracts_crossed: ["auth-api"],
        confidence: "high",
        unresolved: [],
        rationale: "Auth changes.",
      };

      const closure: ClosureResult = {
        primary: ["auth-service"],
        secondary: ["user-service"],
        sourceMap: { "auth-service": "llm", "user-service": "closure" },
      };

      const result = runGate(scope, closure, makeIndex());
      expect(result.passed).toBe(true);
      if (result.passed) {
        expect(result.reviewFlags.some((f) => f.rule === "G5")).toBe(false);
      }
    });
  });

  describe("closure deduplication edge cases", () => {
    it("component in both LLM secondary and closure addition → keeps LLM source", () => {
      const scope: ScopeOutput = {
        schemaVersion: "1.0.0",
        primary: ["auth-service"],
        secondary: ["user-service"],
        contracts_crossed: ["auth-api"], // user-service is a consumer
        confidence: "high",
        unresolved: [],
        rationale: "Auth.",
      };

      const result = expandClosure(scope, makeIndex());

      // user-service was already in secondary (LLM) and is also a consumer of auth-api
      // Should appear only once and retain "llm" source
      expect(result.secondary.filter((id) => id === "user-service").length).toBe(1);
      expect(result.sourceMap["user-service"]).toBe("llm");
    });

    it("component in primary AND closure expansion → stays in primary only", () => {
      const scope: ScopeOutput = {
        schemaVersion: "1.0.0",
        primary: ["auth-service", "user-service"],
        secondary: [],
        contracts_crossed: ["auth-api"], // user-service is a consumer
        confidence: "high",
        unresolved: [],
        rationale: "Auth.",
      };

      const result = expandClosure(scope, makeIndex());

      // user-service is primary and also a consumer of auth-api
      // Should NOT appear in secondary
      expect(result.primary).toContain("user-service");
      expect(result.secondary).not.toContain("user-service");
    });
  });

  describe("empty scope scenarios", () => {
    it("single primary, no contracts, no flow → minimal valid scope", () => {
      const scope: ScopeOutput = {
        schemaVersion: "1.0.0",
        primary: ["auth-service"],
        secondary: [],
        contracts_crossed: [],
        confidence: "high",
        unresolved: [],
        rationale: "Minimal.",
      };

      const closure = expandClosure(scope, makeIndex());
      expect(closure.primary).toEqual(["auth-service"]);
      expect(closure.secondary).toEqual([]);

      const result = runGate(scope, closure, makeIndex());
      expect(result.passed).toBe(true);
      if (result.passed) {
        expect(result.reviewFlags.length).toBe(0);
      }
    });
  });
});
