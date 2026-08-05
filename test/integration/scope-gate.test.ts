/**
 * Integration tests for scope closure + gate pipeline.
 *
 * Tests: scope fixtures triggering each gate outcome:
 * G1 abort with partition proposal; G2-G4 aborts; G5-G7 continue with flags.
 */

import { describe, it, expect } from "vitest";
import { expandClosure } from "#core/scope/closure.js";
import { runGate } from "#core/scope/gate.js";
import { buildPartitionProposal } from "#core/scope/partition.js";
import type { ScopeOutput } from "#core/scope/types.js";
import type { CatalogIndex } from "#core/catalog/index-model.js";

/* ─── Fixture: Full Catalog ───────────────────────────────────────────── */

function makeFullIndex(): CatalogIndex {
  return {
    generated_at: new Date().toISOString(),
    generator: "dt@0.6.7",
    components: [
      {
        id: "auth-service",
        name: "Auth",
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
        name: "Users",
        description: "User management",
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
      {
        id: "email-service",
        name: "Email",
        description: "Email delivery",
        repo: "https://github.com/org/email.git",
        type: "service",
        domain: "communications",
        owner: "team-comms",
        criticality: "medium",
        lifecycle: "production",
        stack: ["typescript"],
        aliases: [],
        provides: [{ id: "email-api", kind: "openapi", source: "extracted", confidence: "high" }],
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
      "user-api": {
        provider: "user-service",
        kind: "openapi",
        consumers: ["notif-service"],
      },
      "billing-api": { provider: "billing-service", kind: "openapi", consumers: [] },
      "email-api": { provider: "email-service", kind: "openapi", consumers: [] },
    },
    domains: [
      { name: "identity", components: ["auth-service", "user-service"] },
      { name: "payments", components: ["billing-service"] },
      { name: "notifications", components: ["notif-service"] },
      { name: "communications", components: ["email-service"] },
    ],
    flows: [
      { id: "login-flow", name: "Login", participants: ["auth-service", "user-service"] },
      {
        id: "payment-flow",
        name: "Payment",
        participants: ["billing-service", "auth-service"],
      },
    ],
    extraction_quality: { total: { high: 4, medium: 1, low: 0 }, per_component: [] },
    errors: [],
  };
}

/* ─── Integration Tests ───────────────────────────────────────────────── */

describe("Scope Closure + Gate Integration", () => {
  describe("G1 abort with partition proposal", () => {
    it("over-broad scope → abort with ordered partition", () => {
      const scope: ScopeOutput = {
        schemaVersion: "1.0.0",
        primary: ["auth-service"],
        secondary: [],
        contracts_crossed: ["auth-api", "user-api"],
        confidence: "high",
        unresolved: [],
        rationale: "Adding auth + user features.",
        flow: "login-flow",
      };

      const index = makeFullIndex();
      const closure = expandClosure(scope, index);

      // Closure expands: auth-api consumers (user-service, billing-service),
      // user-api consumers (notif-service), login-flow neighbors (user-service dedup),
      // providers (auth-service already primary, user-service dedup)
      expect(closure.secondary.length).toBeGreaterThan(2);

      const gateResult = runGate(scope, closure, index, { maxComponents: 3 });

      expect(gateResult.passed).toBe(false);
      if (!gateResult.passed) {
        expect(gateResult.abortRule).toBe("G1");

        // Generate partition proposal
        const proposal = buildPartitionProposal(closure, index);
        expect(proposal.partitions.length).toBeGreaterThanOrEqual(2);
        // Producer domain (identity) should come first
        expect(proposal.partitions[0].domain).toBe("identity");
        expect(proposal.partitions[0].order).toBe(0);
      }
    });
  });

  describe("G2 abort: low confidence", () => {
    it("low confidence scope → abort immediately", () => {
      const scope: ScopeOutput = {
        schemaVersion: "1.0.0",
        primary: ["auth-service"],
        secondary: [],
        contracts_crossed: [],
        confidence: "low",
        unresolved: [],
        rationale: "Uncertain scope.",
      };

      const closure = expandClosure(scope, makeFullIndex());
      const gateResult = runGate(scope, closure, makeFullIndex());

      expect(gateResult.passed).toBe(false);
      if (!gateResult.passed) {
        expect(gateResult.abortRule).toBe("G2");
      }
    });
  });

  describe("G3 abort: unresolved capabilities", () => {
    it("non-empty unresolved → abort", () => {
      const scope: ScopeOutput = {
        schemaVersion: "1.0.0",
        primary: ["auth-service"],
        secondary: [],
        contracts_crossed: [],
        confidence: "high",
        unresolved: ["rate-limiting-service", "caching-layer"],
        rationale: "Cannot map rate limiting.",
      };

      const closure = expandClosure(scope, makeFullIndex());
      const gateResult = runGate(scope, closure, makeFullIndex());

      expect(gateResult.passed).toBe(false);
      if (!gateResult.passed) {
        expect(gateResult.abortRule).toBe("G3");
        expect(gateResult.abortReason).toContain("rate-limiting-service");
      }
    });
  });

  describe("G4 abort: component not in catalog", () => {
    it("closure adds component that is not in catalog → abort", () => {
      // Manually construct a closure with a phantom component
      const scope: ScopeOutput = {
        schemaVersion: "1.0.0",
        primary: ["auth-service"],
        secondary: [],
        contracts_crossed: [],
        confidence: "high",
        unresolved: [],
        rationale: "Auth.",
      };

      // Manually override closure to include a phantom
      const closure = {
        primary: ["auth-service"],
        secondary: ["phantom-service"],
        sourceMap: { "auth-service": "llm" as const, "phantom-service": "closure" as const },
      };

      const gateResult = runGate(scope, closure, makeFullIndex());

      expect(gateResult.passed).toBe(false);
      if (!gateResult.passed) {
        expect(gateResult.abortRule).toBe("G4");
        expect(gateResult.abortReason).toContain("phantom-service");
      }
    });
  });

  describe("G5-G7 continue with review flags", () => {
    it("G6: scope spanning 3+ domains → review flag, no abort", () => {
      const scope: ScopeOutput = {
        schemaVersion: "1.0.0",
        primary: ["auth-service"],
        secondary: [],
        contracts_crossed: ["auth-api"],
        confidence: "high",
        unresolved: [],
        rationale: "Multi-domain task.",
      };

      const index = makeFullIndex();
      // Manually build closure spanning 3 domains
      const closure = {
        primary: ["auth-service"],
        secondary: ["billing-service", "notif-service"],
        sourceMap: {
          "auth-service": "llm" as const,
          "billing-service": "closure" as const,
          "notif-service": "closure" as const,
        },
      };

      const gateResult = runGate(scope, closure, index, { maxComponents: 10 });

      expect(gateResult.passed).toBe(true);
      if (gateResult.passed) {
        expect(gateResult.reviewFlags.some((f) => f.rule === "G6")).toBe(true);
      }
    });

    it("G7: low-payload boundary contract → review flag, no abort", () => {
      const scope: ScopeOutput = {
        schemaVersion: "1.0.0",
        primary: ["auth-service"],
        secondary: ["billing-service"],
        contracts_crossed: ["billing-api"],
        confidence: "high",
        unresolved: [],
        rationale: "Billing integration.",
      };

      const closure = {
        primary: ["auth-service"],
        secondary: ["billing-service"],
        sourceMap: { "auth-service": "llm" as const, "billing-service": "closure" as const },
      };

      const gateResult = runGate(scope, closure, makeFullIndex());

      expect(gateResult.passed).toBe(true);
      if (gateResult.passed) {
        expect(gateResult.reviewFlags.some((f) => f.rule === "G7")).toBe(true);
        const g7 = gateResult.reviewFlags.find((f) => f.rule === "G7")!;
        expect(g7.message).toContain("billing-api");
      }
    });
  });

  describe("happy path: scope passes all gates", () => {
    it("small focused scope passes with no flags", () => {
      const scope: ScopeOutput = {
        schemaVersion: "1.0.0",
        primary: ["auth-service"],
        secondary: [],
        contracts_crossed: [],
        confidence: "high",
        unresolved: [],
        rationale: "Simple auth change.",
      };

      const closure = expandClosure(scope, makeFullIndex());
      const gateResult = runGate(scope, closure, makeFullIndex());

      expect(gateResult.passed).toBe(true);
      if (gateResult.passed) {
        expect(gateResult.reviewFlags.length).toBe(0);
      }
    });

    it("scope at exact max boundary passes", () => {
      const scope: ScopeOutput = {
        schemaVersion: "1.0.0",
        primary: ["auth-service", "user-service"],
        secondary: [],
        contracts_crossed: [],
        confidence: "high",
        unresolved: [],
        rationale: "Identity changes.",
      };

      const closure = {
        primary: ["auth-service", "user-service"],
        secondary: [],
        sourceMap: { "auth-service": "llm" as const, "user-service": "llm" as const },
      };

      // maxComponents = 2, total = 2 → should pass (not > max)
      const gateResult = runGate(scope, closure, makeFullIndex(), { maxComponents: 2 });
      expect(gateResult.passed).toBe(true);
    });
  });

  describe("end-to-end: closure → gate → proposal", () => {
    it("full pipeline produces actionable partition on G1 abort", () => {
      const scope: ScopeOutput = {
        schemaVersion: "1.0.0",
        primary: ["auth-service", "user-service"],
        secondary: [],
        contracts_crossed: ["auth-api", "user-api"],
        confidence: "high",
        unresolved: [],
        rationale: "Cross-domain feature.",
        flow: "login-flow",
      };

      const index = makeFullIndex();

      // Step 1: Closure
      const closure = expandClosure(scope, index);
      expect(closure.primary).toContain("auth-service");
      expect(closure.primary).toContain("user-service");

      // Step 2: Gate (with low max to trigger G1)
      const gateResult = runGate(scope, closure, index, { maxComponents: 3 });
      expect(gateResult.passed).toBe(false);

      // Step 3: Partition proposal
      if (!gateResult.passed) {
        const proposal = buildPartitionProposal(closure, index);
        expect(proposal.partitions.length).toBeGreaterThan(0);
        expect(proposal.rationale.length).toBeGreaterThan(0);

        // Each partition has components and an order
        for (const part of proposal.partitions) {
          expect(part.components.length).toBeGreaterThan(0);
          expect(part.domain.length).toBeGreaterThan(0);
          expect(typeof part.order).toBe("number");
        }
      }
    });
  });
});
