/**
 * Unit tests for core/scope/partition.ts
 *
 * Tests: partition proposal generation; producer-before-consumer ordering;
 * domain grouping.
 */

import { describe, it, expect } from "vitest";
import { buildPartitionProposal } from "#core/scope/partition.js";
import type { ClosureResult } from "#core/scope/closure.js";
import type { CatalogIndex } from "#core/catalog/index-model.js";

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
          { id: "billing-api", kind: "openapi", source: "extracted", confidence: "medium" },
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
    ],
    contracts: {
      "auth-api": {
        provider: "auth-service",
        kind: "openapi",
        consumers: ["user-service", "billing-service"],
      },
      "user-api": { provider: "user-service", kind: "openapi", consumers: ["notif-service"] },
      "billing-api": { provider: "billing-service", kind: "openapi", consumers: [] },
    },
    domains: [
      { name: "identity", components: ["auth-service", "user-service"] },
      { name: "payments", components: ["billing-service"] },
      { name: "notifications", components: ["notif-service"] },
    ],
    flows: [],
    extraction_quality: { total: { high: 3, medium: 1, low: 0 }, per_component: [] },
    errors: [],
  };
}

/* ─── Tests ───────────────────────────────────────────────────────────── */

describe("buildPartitionProposal", () => {
  it("groups components by domain", () => {
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

    const proposal = buildPartitionProposal(closure, makeIndex());

    // Should have 3 partitions (identity, payments, notifications)
    expect(proposal.partitions.length).toBe(3);

    const domains = proposal.partitions.map((p) => p.domain);
    expect(domains).toContain("identity");
    expect(domains).toContain("payments");
    expect(domains).toContain("notifications");
  });

  it("orders producer domains before consumer domains", () => {
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

    const proposal = buildPartitionProposal(closure, makeIndex());

    // identity domain has auth-service (produces auth-api consumed by 2) and
    // user-service (produces user-api consumed by 1) = total producer score 3
    // payments domain has billing-service (produces billing-api consumed by 0) = score 0
    // notifications domain has notif-service (produces nothing) = score 0
    expect(proposal.partitions[0].domain).toBe("identity");
    expect(proposal.partitions[0].order).toBe(0);
  });

  it("orders producers before consumers within a domain group", () => {
    const closure: ClosureResult = {
      primary: ["auth-service", "user-service"],
      secondary: [],
      sourceMap: { "auth-service": "llm", "user-service": "llm" },
    };

    const proposal = buildPartitionProposal(closure, makeIndex());

    // Within identity domain: auth-service (score 2) should come before user-service (score 1)
    const identityPartition = proposal.partitions.find((p) => p.domain === "identity")!;
    expect(identityPartition.components[0]).toBe("auth-service");
    expect(identityPartition.components[1]).toBe("user-service");
  });

  it("provides a rationale mentioning domain count", () => {
    const closure: ClosureResult = {
      primary: ["auth-service"],
      secondary: ["billing-service", "notif-service"],
      sourceMap: {
        "auth-service": "llm",
        "billing-service": "closure",
        "notif-service": "closure",
      },
    };

    const proposal = buildPartitionProposal(closure, makeIndex());

    expect(proposal.rationale).toContain("3 domains");
    expect(proposal.rationale).toContain("3 total components");
  });

  it("handles single-domain scope", () => {
    const closure: ClosureResult = {
      primary: ["auth-service", "user-service"],
      secondary: [],
      sourceMap: { "auth-service": "llm", "user-service": "llm" },
    };

    const proposal = buildPartitionProposal(closure, makeIndex());

    expect(proposal.partitions.length).toBe(1);
    expect(proposal.partitions[0].domain).toBe("identity");
    expect(proposal.rationale).toContain("single domain");
  });

  it("handles empty closure", () => {
    const closure: ClosureResult = {
      primary: [],
      secondary: [],
      sourceMap: {},
    };

    const proposal = buildPartitionProposal(closure, makeIndex());

    expect(proposal.partitions.length).toBe(0);
  });

  it("partition entries contain correct components", () => {
    const closure: ClosureResult = {
      primary: ["auth-service"],
      secondary: ["billing-service"],
      sourceMap: { "auth-service": "llm", "billing-service": "closure" },
    };

    const proposal = buildPartitionProposal(closure, makeIndex());

    const identityPart = proposal.partitions.find((p) => p.domain === "identity");
    expect(identityPart).toBeDefined();
    expect(identityPart!.components).toEqual(["auth-service"]);

    const paymentsPart = proposal.partitions.find((p) => p.domain === "payments");
    expect(paymentsPart).toBeDefined();
    expect(paymentsPart!.components).toEqual(["billing-service"]);
  });
});
