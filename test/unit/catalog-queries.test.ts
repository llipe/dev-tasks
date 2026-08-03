/**
 * Unit tests for core/catalog/queries.ts — get, deps, consumers, flow, closure.
 */

import { describe, it, expect } from "vitest";
import {
  catalogGet,
  catalogDeps,
  catalogConsumers,
  catalogFlow,
  catalogClosure,
} from "#core/catalog/queries.js";
import type { CatalogIndex } from "#core/catalog/index-model.js";

/* ─── Test Helpers ─────────────────────────────────────────────────── */

function makeIndex(overrides: Partial<CatalogIndex> = {}): CatalogIndex {
  return {
    generated_at: "2026-01-01T00:00:00Z",
    generator: "test@1.0.0",
    components: [],
    contracts: {},
    domains: [],
    flows: [],
    extraction_quality: { total: { high: 0, medium: 0, low: 0 }, per_component: [] },
    errors: [],
    ...overrides,
  };
}

function makeComponent(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    name: id,
    description: `${id} description`,
    repo: `https://github.com/acme/${id}`,
    type: "service",
    domain: "test",
    owner: "team",
    criticality: "tier-2",
    lifecycle: "production",
    stack: ["node"],
    aliases: [] as string[],
    provides: [] as Array<{ id: string; kind: string; source: string }>,
    consumes: [] as Array<{ contract: string; criticality?: string }>,
    datastores: [] as string[],
    origin_sha: "abc123",
    ...overrides,
  };
}

/* ─── catalogGet ───────────────────────────────────────────────────── */

describe("catalogGet", () => {
  it("returns component by id", () => {
    const index = makeIndex({
      components: [makeComponent("svc-a"), makeComponent("svc-b")] as CatalogIndex["components"],
    });
    const result = catalogGet(index, "svc-a");
    expect(result).not.toBeNull();
    expect(result!.id).toBe("svc-a");
  });

  it("returns null for non-existent id", () => {
    const index = makeIndex({
      components: [makeComponent("svc-a")] as CatalogIndex["components"],
    });
    expect(catalogGet(index, "ghost")).toBeNull();
  });
});

/* ─── catalogDeps ──────────────────────────────────────────────────── */

describe("catalogDeps", () => {
  const chainIndex = makeIndex({
    components: [
      makeComponent("svc-a", {
        provides: [{ id: "api-a", kind: "openapi", source: "introspected" }],
        consumes: [{ contract: "api-b", criticality: "hard" }],
      }),
      makeComponent("svc-b", {
        provides: [{ id: "api-b", kind: "openapi", source: "introspected" }],
        consumes: [{ contract: "api-c", criticality: "hard" }],
      }),
      makeComponent("svc-c", {
        provides: [{ id: "api-c", kind: "openapi", source: "introspected" }],
      }),
    ] as CatalogIndex["components"],
  });

  it("returns downstream dependencies (direction=down)", () => {
    const result = catalogDeps(chainIndex, "svc-a", { direction: "down" });
    expect(result).not.toBeNull();
    expect(result!.dependencies.map((d) => d.id)).toContain("svc-b");
    expect(result!.dependencies.map((d) => d.id)).toContain("svc-c");
  });

  it("returns upstream dependants (direction=up)", () => {
    const result = catalogDeps(chainIndex, "svc-c", { direction: "up" });
    expect(result).not.toBeNull();
    expect(result!.dependencies.map((d) => d.id)).toContain("svc-b");
    expect(result!.dependencies.map((d) => d.id)).toContain("svc-a");
  });

  it("respects depth limit", () => {
    const result = catalogDeps(chainIndex, "svc-a", { direction: "down", depth: 1 });
    expect(result).not.toBeNull();
    // Depth 1: only direct dependency
    expect(result!.dependencies.map((d) => d.id)).toContain("svc-b");
    expect(result!.dependencies.map((d) => d.id)).not.toContain("svc-c");
  });

  it("direction=both returns all connected", () => {
    const result = catalogDeps(chainIndex, "svc-b", { direction: "both" });
    expect(result).not.toBeNull();
    expect(result!.dependencies.map((d) => d.id)).toContain("svc-a");
    expect(result!.dependencies.map((d) => d.id)).toContain("svc-c");
  });

  it("returns null for non-existent component", () => {
    expect(catalogDeps(chainIndex, "ghost")).toBeNull();
  });

  it("returns empty for disconnected component", () => {
    const index = makeIndex({
      components: [
        makeComponent("isolated"),
        makeComponent("other", {
          provides: [{ id: "api-x", kind: "openapi", source: "introspected" }],
        }),
      ] as CatalogIndex["components"],
    });
    const result = catalogDeps(index, "isolated");
    expect(result).not.toBeNull();
    expect(result!.dependencies).toHaveLength(0);
  });
});

/* ─── catalogConsumers ─────────────────────────────────────────────── */

describe("catalogConsumers", () => {
  it("returns consumers for a known contract", () => {
    const index = makeIndex({
      components: [makeComponent("svc-a"), makeComponent("svc-b")] as CatalogIndex["components"],
      contracts: {
        "api-a": { provider: "svc-a", kind: "openapi", consumers: ["svc-b"] },
      },
    });
    const result = catalogConsumers(index, "api-a");
    expect(result).not.toBeNull();
    expect(result!.provider).toBe("svc-a");
    expect(result!.consumers).toHaveLength(1);
    expect(result!.consumers[0].id).toBe("svc-b");
  });

  it("returns null for unknown contract", () => {
    const index = makeIndex();
    expect(catalogConsumers(index, "ghost-api")).toBeNull();
  });

  it("returns empty consumers array for contract with no consumers", () => {
    const index = makeIndex({
      contracts: {
        "orphan-api": { provider: "svc-a", kind: "openapi", consumers: [] },
      },
    });
    const result = catalogConsumers(index, "orphan-api");
    expect(result).not.toBeNull();
    expect(result!.consumers).toHaveLength(0);
  });
});

/* ─── catalogFlow ──────────────────────────────────────────────────── */

describe("catalogFlow", () => {
  it("returns flow with resolved participants", () => {
    const index = makeIndex({
      components: [makeComponent("svc-a"), makeComponent("svc-b")] as CatalogIndex["components"],
      flows: [{ id: "my-flow", name: "My Flow", participants: ["svc-a", "svc-b"] }],
    });
    const result = catalogFlow(index, "my-flow");
    expect(result).not.toBeNull();
    expect(result!.flow.id).toBe("my-flow");
    expect(result!.components).toHaveLength(2);
    expect(result!.components.map((c) => c.id)).toEqual(["svc-a", "svc-b"]);
  });

  it("returns null for unknown flow", () => {
    const index = makeIndex({
      flows: [{ id: "only-flow", name: "Only", participants: [] }],
    });
    expect(catalogFlow(index, "ghost-flow")).toBeNull();
  });
});

/* ─── catalogClosure ───────────────────────────────────────────────── */

describe("catalogClosure", () => {
  const closureIndex = makeIndex({
    components: [
      makeComponent("svc-a", {
        provides: [{ id: "api-a", kind: "openapi", source: "introspected" }],
        consumes: [{ contract: "api-b", criticality: "hard" }],
      }),
      makeComponent("svc-b", {
        provides: [{ id: "api-b", kind: "openapi", source: "introspected" }],
        consumes: [{ contract: "api-c", criticality: "hard" }],
      }),
      makeComponent("svc-c", {
        provides: [{ id: "api-c", kind: "openapi", source: "introspected" }],
      }),
      makeComponent("svc-d", {
        consumes: [{ contract: "api-a", criticality: "soft" }],
      }),
    ] as CatalogIndex["components"],
  });

  it("computes transitive closure (down)", () => {
    const result = catalogClosure(closureIndex, ["svc-a"]);
    expect(result).not.toBeNull();
    // svc-a depends on svc-b which depends on svc-c
    expect(result!.components.map((c) => c.id)).toContain("svc-a");
    expect(result!.components.map((c) => c.id)).toContain("svc-b");
    expect(result!.components.map((c) => c.id)).toContain("svc-c");
    // svc-d is not in the closure (it's upstream)
    expect(result!.components.map((c) => c.id)).not.toContain("svc-d");
  });

  it("includes consumers when includeConsumers=true", () => {
    const result = catalogClosure(closureIndex, ["svc-a"], { includeConsumers: true });
    expect(result).not.toBeNull();
    // svc-d consumes api-a from svc-a
    expect(result!.components.map((c) => c.id)).toContain("svc-d");
  });

  it("respects --max cap", () => {
    const result = catalogClosure(closureIndex, ["svc-a"], { max: 2 });
    expect(result).not.toBeNull();
    expect(result!.components.length).toBeLessThanOrEqual(2);
    expect(result!.capped).toBe(true);
  });

  it("deduplicates across multiple roots", () => {
    // Both svc-a and svc-b depend on svc-c (transitively or directly)
    const result = catalogClosure(closureIndex, ["svc-a", "svc-b"]);
    expect(result).not.toBeNull();
    const ids = result!.components.map((c) => c.id);
    // svc-c should only appear once
    expect(ids.filter((id) => id === "svc-c")).toHaveLength(1);
  });

  it("roots appear first in results (primary wins)", () => {
    const result = catalogClosure(closureIndex, ["svc-a", "svc-b"]);
    expect(result).not.toBeNull();
    // First elements should be the roots
    expect(result!.components[0].id).toBe("svc-a");
    expect(result!.components[1].id).toBe("svc-b");
  });

  it("returns null for non-existent root id", () => {
    expect(catalogClosure(closureIndex, ["ghost"])).toBeNull();
  });

  it("handles cycles without infinite loop", () => {
    const cyclicIndex = makeIndex({
      components: [
        makeComponent("svc-x", {
          provides: [{ id: "api-x", kind: "openapi", source: "introspected" }],
          consumes: [{ contract: "api-y", criticality: "hard" }],
        }),
        makeComponent("svc-y", {
          provides: [{ id: "api-y", kind: "openapi", source: "introspected" }],
          consumes: [{ contract: "api-x", criticality: "hard" }],
        }),
      ] as CatalogIndex["components"],
    });
    const result = catalogClosure(cyclicIndex, ["svc-x"]);
    expect(result).not.toBeNull();
    expect(result!.components.map((c) => c.id).sort()).toEqual(["svc-x", "svc-y"]);
  });
});
