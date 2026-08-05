/**
 * Unit tests for core/scope/prompt.ts
 *
 * Tests: input assembler excludes full catalog; only includes task, candidates,
 * flows, domains; filters flows/domains to candidate set.
 */

import { describe, it, expect } from "vitest";
import {
  buildScopingInput,
  serializeScopingInput,
  SCOPING_SYSTEM_PROMPT,
} from "#core/scope/prompt.js";
import type { CatalogIndex } from "#core/catalog/index-model.js";
import type { ResolveCandidate } from "#core/catalog/resolve.js";

/* ─── Fixtures ────────────────────────────────────────────────────────── */

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
        stack: ["typescript", "express"],
        aliases: ["auth"],
        provides: [{ id: "auth-api", kind: "openapi", source: "extracted", confidence: "high" }],
        consumes: [{ contract: "user-api", criticality: "high" }],
        datastores: ["auth-db"],
        origin_sha: "abc123",
      },
      {
        id: "user-service",
        name: "User Service",
        description: "Manages user profiles",
        repo: "https://github.com/org/user-service.git",
        type: "service",
        domain: "identity",
        owner: "team-users",
        criticality: "medium",
        lifecycle: "production",
        stack: ["typescript", "nestjs"],
        aliases: ["users"],
        provides: [{ id: "user-api", kind: "openapi", source: "extracted", confidence: "high" }],
        consumes: [],
        datastores: ["user-db"],
        origin_sha: "def456",
      },
      {
        id: "billing-service",
        name: "Billing Service",
        description: "Processes payments",
        repo: "https://github.com/org/billing-service.git",
        type: "service",
        domain: "payments",
        owner: "team-billing",
        criticality: "high",
        lifecycle: "production",
        stack: ["java", "spring"],
        aliases: ["billing"],
        provides: [
          { id: "billing-api", kind: "openapi", source: "extracted", confidence: "medium" },
        ],
        consumes: [{ contract: "auth-api", criticality: "medium" }],
        datastores: ["billing-db"],
        origin_sha: "ghi789",
      },
    ],
    contracts: {
      "auth-api": { provider: "auth-service", kind: "openapi", consumers: ["billing-service"] },
      "user-api": { provider: "user-service", kind: "openapi", consumers: ["auth-service"] },
      "billing-api": { provider: "billing-service", kind: "openapi", consumers: [] },
    },
    domains: [
      { name: "identity", components: ["auth-service", "user-service"] },
      { name: "payments", components: ["billing-service"] },
    ],
    flows: [
      { id: "login-flow", name: "Login Flow", participants: ["auth-service", "user-service"] },
      {
        id: "payment-flow",
        name: "Payment Flow",
        participants: ["billing-service", "auth-service"],
      },
    ],
    extraction_quality: {
      total: { high: 2, medium: 1, low: 0 },
      per_component: [],
    },
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

/* ─── Tests ───────────────────────────────────────────────────────────── */

describe("buildScopingInput", () => {
  it("includes task text", () => {
    const input = buildScopingInput("Add rate limiting to auth", makeCandidates(), makeIndex());
    expect(input.task).toBe("Add rate limiting to auth");
  });

  it("includes only candidate components (not full catalog)", () => {
    const input = buildScopingInput("task", makeCandidates(), makeIndex());
    expect(input.candidates).toHaveLength(2);
    expect(input.candidates.map((c) => c.id)).toEqual(["auth-service", "user-service"]);
    // billing-service should NOT be included
    expect(input.candidates.map((c) => c.id)).not.toContain("billing-service");
  });

  it("includes candidate details (name, description, domain, provides, consumes)", () => {
    const input = buildScopingInput("task", makeCandidates(), makeIndex());
    const auth = input.candidates.find((c) => c.id === "auth-service")!;
    expect(auth.name).toBe("Auth Service");
    expect(auth.description).toBe("Handles authentication");
    expect(auth.domain).toBe("identity");
    expect(auth.provides).toEqual(["auth-api"]);
    expect(auth.consumes).toEqual(["user-api"]);
  });

  it("filters flows to only those with candidate participants", () => {
    const input = buildScopingInput("task", makeCandidates(), makeIndex());
    // Both flows include auth-service (a candidate)
    expect(input.flows.map((f) => f.id)).toContain("login-flow");
    expect(input.flows.map((f) => f.id)).toContain("payment-flow");
  });

  it("filters domains to only those containing candidate components", () => {
    const input = buildScopingInput("task", makeCandidates(), makeIndex());
    // identity domain contains auth-service and user-service (both candidates)
    expect(input.domains.map((d) => d.name)).toContain("identity");
    // payments domain has billing-service (not a candidate) — excluded
    expect(input.domains.map((d) => d.name)).not.toContain("payments");
  });

  it("domain components list only includes candidate ids", () => {
    const input = buildScopingInput("task", makeCandidates(), makeIndex());
    const identityDomain = input.domains.find((d) => d.name === "identity")!;
    expect(identityDomain.components).toEqual(["auth-service", "user-service"]);
  });

  it("handles empty candidates (returns empty input structures)", () => {
    const input = buildScopingInput("task", [], makeIndex());
    expect(input.candidates).toHaveLength(0);
    expect(input.flows).toHaveLength(0);
    expect(input.domains).toHaveLength(0);
  });
});

describe("serializeScopingInput", () => {
  it("produces valid JSON", () => {
    const input = buildScopingInput("task", makeCandidates(), makeIndex());
    const serialized = serializeScopingInput(input);
    expect(() => JSON.parse(serialized)).not.toThrow();
  });

  it("contains task field", () => {
    const input = buildScopingInput("test task", makeCandidates(), makeIndex());
    const serialized = serializeScopingInput(input);
    const parsed = JSON.parse(serialized) as Record<string, unknown>;
    expect(parsed.task).toBe("test task");
  });
});

describe("SCOPING_SYSTEM_PROMPT", () => {
  it("instructs to only choose from candidates", () => {
    expect(SCOPING_SYSTEM_PROMPT).toContain("Only choose from the provided candidates list");
  });

  it("instructs low confidence when ambiguous", () => {
    expect(SCOPING_SYSTEM_PROMPT).toContain("ambiguous");
    expect(SCOPING_SYSTEM_PROMPT).toContain('"low"');
  });

  it("instructs to list unmapped in unresolved", () => {
    expect(SCOPING_SYSTEM_PROMPT).toContain("unresolved");
  });
});
