/**
 * Unit tests for core/scope/gate.ts
 *
 * Tests: each gate rule G1-G7 in isolation; abort vs review_flags behavior.
 */

import { describe, it, expect } from "vitest";
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
    },
    domains: [
      { name: "identity", components: ["auth-service", "user-service"] },
      { name: "payments", components: ["billing-service"] },
      { name: "notifications", components: ["notif-service"] },
    ],
    flows: [{ id: "login-flow", name: "Login", participants: ["auth-service", "user-service"] }],
    extraction_quality: { total: { high: 3, medium: 1, low: 0 }, per_component: [] },
    errors: [],
  };
}

function baseScope(): ScopeOutput {
  return {
    schemaVersion: "1.0.0",
    primary: ["auth-service"],
    secondary: ["user-service"],
    contracts_crossed: ["auth-api"],
    confidence: "high",
    unresolved: [],
    rationale: "Auth service is the target.",
  };
}

function baseClosure(): ClosureResult {
  return {
    primary: ["auth-service"],
    secondary: ["user-service"],
    sourceMap: { "auth-service": "llm", "user-service": "closure" },
  };
}

/* ─── G1: Total components > max ──────────────────────────────────────── */

describe("G1: total components exceeds max", () => {
  it("aborts when primary + secondary > maxComponents", () => {
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

    const result = runGate(baseScope(), closure, makeIndex(), { maxComponents: 3 });

    expect(result.passed).toBe(false);
    if (!result.passed) {
      expect(result.abortRule).toBe("G1");
      expect(result.abortReason).toContain("4");
      expect(result.abortReason).toContain("3");
    }
  });

  it("passes when exactly at maxComponents", () => {
    const closure: ClosureResult = {
      primary: ["auth-service"],
      secondary: ["user-service", "billing-service"],
      sourceMap: {
        "auth-service": "llm",
        "user-service": "closure",
        "billing-service": "closure",
      },
    };

    const result = runGate(baseScope(), closure, makeIndex(), { maxComponents: 3 });

    // Exactly 3 = maxComponents, should NOT abort (only > max aborts)
    expect(result.passed).toBe(true);
  });

  it("uses default maxComponents of 4", () => {
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

    // 4 components, default max is 4 — should pass
    const result = runGate(baseScope(), closure, makeIndex());
    expect(result.passed).toBe(true);
  });

  it("aborts with 5 components at default max of 4", () => {
    const index = makeIndex();
    index.components.push({
      id: "extra-service",
      name: "Extra",
      description: "Extra",
      repo: "https://github.com/org/extra.git",
      type: "service",
      domain: "identity",
      owner: "team-extra",
      criticality: "low",
      lifecycle: "production",
      stack: ["typescript"],
      aliases: [],
      provides: [],
      consumes: [],
      datastores: [],
      origin_sha: "xyz",
    });

    const closure: ClosureResult = {
      primary: ["auth-service", "user-service"],
      secondary: ["billing-service", "notif-service", "extra-service"],
      sourceMap: {
        "auth-service": "llm",
        "user-service": "llm",
        "billing-service": "closure",
        "notif-service": "closure",
        "extra-service": "closure",
      },
    };

    const result = runGate(baseScope(), closure, index);
    expect(result.passed).toBe(false);
    if (!result.passed) {
      expect(result.abortRule).toBe("G1");
    }
  });
});

/* ─── G2: confidence: low ─────────────────────────────────────────────── */

describe("G2: confidence is low", () => {
  it("aborts when confidence is low", () => {
    const scope: ScopeOutput = { ...baseScope(), confidence: "low" };
    const result = runGate(scope, baseClosure(), makeIndex());

    expect(result.passed).toBe(false);
    if (!result.passed) {
      expect(result.abortRule).toBe("G2");
      expect(result.abortReason).toContain("low");
    }
  });

  it("passes when confidence is medium", () => {
    const scope: ScopeOutput = { ...baseScope(), confidence: "medium" };
    const result = runGate(scope, baseClosure(), makeIndex());
    expect(result.passed).toBe(true);
  });

  it("passes when confidence is high", () => {
    const result = runGate(baseScope(), baseClosure(), makeIndex());
    expect(result.passed).toBe(true);
  });
});

/* ─── G3: non-empty unresolved ────────────────────────────────────────── */

describe("G3: non-empty unresolved", () => {
  it("aborts when unresolved is non-empty", () => {
    const scope: ScopeOutput = {
      ...baseScope(),
      unresolved: ["unknown-capability"],
    };
    const result = runGate(scope, baseClosure(), makeIndex());

    expect(result.passed).toBe(false);
    if (!result.passed) {
      expect(result.abortRule).toBe("G3");
      expect(result.abortReason).toContain("unknown-capability");
    }
  });

  it("passes when unresolved is empty", () => {
    const result = runGate(baseScope(), baseClosure(), makeIndex());
    expect(result.passed).toBe(true);
  });
});

/* ─── G4: component without catalog entry ─────────────────────────────── */

describe("G4: component without catalog entry", () => {
  it("aborts when a scope component is not in the index", () => {
    const closure: ClosureResult = {
      primary: ["auth-service"],
      secondary: ["phantom-service"],
      sourceMap: { "auth-service": "llm", "phantom-service": "closure" },
    };

    const result = runGate(baseScope(), closure, makeIndex());

    expect(result.passed).toBe(false);
    if (!result.passed) {
      expect(result.abortRule).toBe("G4");
      expect(result.abortReason).toContain("phantom-service");
    }
  });

  it("passes when all scope components exist in catalog", () => {
    const result = runGate(baseScope(), baseClosure(), makeIndex());
    expect(result.passed).toBe(true);
  });
});

/* ─── G5: LLM component absent from closure (review flag) ────────────── */

describe("G5: LLM component isolated from closure", () => {
  it("flags when LLM primary component has no graph connection to other scope members", () => {
    // billing-service has no direct connection to notif-service
    const scope: ScopeOutput = {
      ...baseScope(),
      primary: ["billing-service"],
      secondary: ["notif-service"],
      contracts_crossed: [],
    };
    const closure: ClosureResult = {
      primary: ["billing-service"],
      secondary: ["notif-service"],
      sourceMap: { "billing-service": "llm", "notif-service": "llm" },
    };

    const result = runGate(scope, closure, makeIndex());

    expect(result.passed).toBe(true);
    if (result.passed) {
      expect(result.reviewFlags.some((f) => f.rule === "G5")).toBe(true);
    }
  });

  it("does not flag when LLM primary has graph connections", () => {
    // auth-service provides auth-api consumed by user-service
    const result = runGate(baseScope(), baseClosure(), makeIndex());

    expect(result.passed).toBe(true);
    if (result.passed) {
      expect(result.reviewFlags.some((f) => f.rule === "G5")).toBe(false);
    }
  });
});

/* ─── G6: scope spans >2 domains (review flag) ───────────────────────── */

describe("G6: scope spans >2 domains", () => {
  it("flags when scope spans 3 or more domains", () => {
    const closure: ClosureResult = {
      primary: ["auth-service"],
      secondary: ["billing-service", "notif-service"],
      sourceMap: {
        "auth-service": "llm",
        "billing-service": "closure",
        "notif-service": "closure",
      },
    };

    const result = runGate(baseScope(), closure, makeIndex());

    expect(result.passed).toBe(true);
    if (result.passed) {
      const g6 = result.reviewFlags.find((f) => f.rule === "G6");
      expect(g6).toBeDefined();
      expect(g6!.message).toContain("3 domains");
    }
  });

  it("does not flag when scope spans exactly 2 domains", () => {
    const closure: ClosureResult = {
      primary: ["auth-service"],
      secondary: ["billing-service"],
      sourceMap: { "auth-service": "llm", "billing-service": "closure" },
    };

    const result = runGate(baseScope(), closure, makeIndex());

    expect(result.passed).toBe(true);
    if (result.passed) {
      expect(result.reviewFlags.some((f) => f.rule === "G6")).toBe(false);
    }
  });

  it("does not flag when scope spans 1 domain", () => {
    const closure: ClosureResult = {
      primary: ["auth-service"],
      secondary: ["user-service"],
      sourceMap: { "auth-service": "llm", "user-service": "closure" },
    };

    const result = runGate(baseScope(), closure, makeIndex());

    expect(result.passed).toBe(true);
    if (result.passed) {
      expect(result.reviewFlags.some((f) => f.rule === "G6")).toBe(false);
    }
  });
});

/* ─── G7: low-payload boundary contract (review flag) ─────────────────── */

describe("G7: boundary contract with payload_confidence: low", () => {
  it("flags when contracts_crossed has a low-payload contract", () => {
    const scope: ScopeOutput = {
      ...baseScope(),
      contracts_crossed: ["billing-api"],
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
      expect(g7!.message).toContain("payload_confidence: low");
    }
  });

  it("does not flag when contract has high payload confidence", () => {
    const result = runGate(baseScope(), baseClosure(), makeIndex());

    expect(result.passed).toBe(true);
    if (result.passed) {
      expect(result.reviewFlags.some((f) => f.rule === "G7")).toBe(false);
    }
  });
});

/* ─── Abort priority ──────────────────────────────────────────────────── */

describe("abort priority", () => {
  it("G1 takes priority over G2/G3 when both trigger", () => {
    const scope: ScopeOutput = {
      ...baseScope(),
      confidence: "low",
      unresolved: ["something"],
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

    // With maxComponents=3, G1 fires first
    const result = runGate(scope, closure, makeIndex(), { maxComponents: 3 });
    expect(result.passed).toBe(false);
    if (!result.passed) {
      expect(result.abortRule).toBe("G1");
    }
  });
});
