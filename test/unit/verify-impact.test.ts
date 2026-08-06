/**
 * Unit tests for core/verify/impact.ts — consumer lookup + criticality.
 */

import { describe, it, expect, vi } from "vitest";
import { runImpact } from "../../core/verify/impact.js";
import type { CatalogIndex } from "../../core/catalog/index-model.js";
import type { TrackerProvider, DerivedTask } from "../../core/providers/tracker.js";

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

function makeMockTrackerProvider(
  available: boolean,
  results?: Map<string, { success: boolean; taskUrl?: string; error?: string }>,
): TrackerProvider {
  return {
    name: "mock",
    isAvailable: () => available,
    emitTask: vi.fn(async (task: DerivedTask) => {
      const res = results?.get(task.metadata.consumerId);
      if (res) return res;
      return { success: true, taskUrl: `https://tracker.example/task-${task.metadata.consumerId}` };
    }),
  };
}

/* ─── Tests ────────────────────────────────────────────────────────── */

describe("runImpact", () => {
  it("returns null for unknown contract", async () => {
    const index = makeIndex();
    const result = await runImpact(index, { contractId: "nonexistent" });
    expect(result).toBeNull();
  });

  it("lists consumers with criticality from inverted index (RF-51)", async () => {
    const index = makeIndex({
      components: [
        makeComponent("provider-svc", {
          provides: [{ id: "api-orders", kind: "openapi", source: "introspected" }],
        }),
        makeComponent("consumer-a", {
          consumes: [{ contract: "api-orders", criticality: "hard" }],
          criticality: "tier-1",
        }),
        makeComponent("consumer-b", {
          consumes: [{ contract: "api-orders", criticality: "soft" }],
          criticality: "tier-3",
        }),
      ] as CatalogIndex["components"],
      contracts: {
        "api-orders": {
          provider: "provider-svc",
          kind: "openapi",
          consumers: ["consumer-a", "consumer-b"],
        },
      },
    });

    const result = await runImpact(index, { contractId: "api-orders" });

    expect(result).not.toBeNull();
    expect(result!.contractId).toBe("api-orders");
    expect(result!.provider).toBe("provider-svc");
    expect(result!.consumers).toHaveLength(2);

    const consumerA = result!.consumers.find((c) => c.id === "consumer-a");
    expect(consumerA).toBeDefined();
    expect(consumerA!.criticality).toBe("hard"); // per-relationship criticality

    const consumerB = result!.consumers.find((c) => c.id === "consumer-b");
    expect(consumerB).toBeDefined();
    expect(consumerB!.criticality).toBe("soft");
  });

  it("falls back to component-level criticality when per-consume is missing", async () => {
    const index = makeIndex({
      components: [
        makeComponent("provider-svc", {
          provides: [{ id: "api-x", kind: "openapi", source: "introspected" }],
        }),
        makeComponent("consumer-no-crit", {
          consumes: [{ contract: "api-x" }], // no per-relationship criticality
          criticality: "tier-1",
        }),
      ] as CatalogIndex["components"],
      contracts: {
        "api-x": {
          provider: "provider-svc",
          kind: "openapi",
          consumers: ["consumer-no-crit"],
        },
      },
    });

    const result = await runImpact(index, { contractId: "api-x" });
    expect(result!.consumers[0].criticality).toBe("tier-1");
  });

  it("returns empty consumers list when contract has no consumers", async () => {
    const index = makeIndex({
      components: [
        makeComponent("provider-svc", {
          provides: [{ id: "api-isolated", kind: "openapi", source: "introspected" }],
        }),
      ] as CatalogIndex["components"],
      contracts: {
        "api-isolated": {
          provider: "provider-svc",
          kind: "openapi",
          consumers: [],
        },
      },
    });

    const result = await runImpact(index, { contractId: "api-isolated" });
    expect(result).not.toBeNull();
    expect(result!.consumers).toHaveLength(0);
    expect(result!.tasksEmitted).toBe(false);
  });

  it("emits tasks via tracker provider when --emit-tasks and provider available (RF-54)", async () => {
    const index = makeIndex({
      components: [
        makeComponent("provider-svc", {
          provides: [{ id: "api-orders", kind: "openapi", source: "introspected" }],
        }),
        makeComponent("consumer-a", {
          consumes: [{ contract: "api-orders", criticality: "hard" }],
        }),
      ] as CatalogIndex["components"],
      contracts: {
        "api-orders": {
          provider: "provider-svc",
          kind: "openapi",
          consumers: ["consumer-a"],
        },
      },
    });

    const mockProvider = makeMockTrackerProvider(true);
    const result = await runImpact(
      index,
      { contractId: "api-orders", emitTasks: true },
      mockProvider,
    );

    expect(result!.tasksEmitted).toBe(true);
    expect(result!.taskResults).toHaveLength(1);
    expect(result!.taskResults[0].success).toBe(true);
    expect(result!.taskResults[0].taskUrl).toContain("consumer-a");
    expect(mockProvider.emitTask).toHaveBeenCalledTimes(1);
  });

  it("degrades gracefully when provider is unavailable (AC5)", async () => {
    const index = makeIndex({
      components: [
        makeComponent("provider-svc", {
          provides: [{ id: "api-orders", kind: "openapi", source: "introspected" }],
        }),
        makeComponent("consumer-a", {
          consumes: [{ contract: "api-orders", criticality: "hard" }],
        }),
      ] as CatalogIndex["components"],
      contracts: {
        "api-orders": {
          provider: "provider-svc",
          kind: "openapi",
          consumers: ["consumer-a"],
        },
      },
    });

    const mockProvider = makeMockTrackerProvider(false);
    const result = await runImpact(
      index,
      { contractId: "api-orders", emitTasks: true },
      mockProvider,
    );

    expect(result!.tasksEmitted).toBe(false);
    expect(result!.taskResults).toHaveLength(1);
    expect(result!.taskResults[0].success).toBe(false);
    expect(result!.taskResults[0].error).toContain("No tracker provider configured");
    // emitTask should NOT have been called since provider is unavailable
    expect(mockProvider.emitTask).not.toHaveBeenCalled();
  });

  it("does not emit tasks when --emit-tasks is not set", async () => {
    const index = makeIndex({
      components: [
        makeComponent("provider-svc", {
          provides: [{ id: "api-x", kind: "openapi", source: "introspected" }],
        }),
        makeComponent("consumer-a", {
          consumes: [{ contract: "api-x", criticality: "hard" }],
        }),
      ] as CatalogIndex["components"],
      contracts: {
        "api-x": {
          provider: "provider-svc",
          kind: "openapi",
          consumers: ["consumer-a"],
        },
      },
    });

    const result = await runImpact(index, { contractId: "api-x" });
    expect(result!.tasksEmitted).toBe(false);
    expect(result!.taskResults).toHaveLength(0);
  });

  it("skips consumers whose component is not found in index", async () => {
    const index = makeIndex({
      components: [
        makeComponent("provider-svc", {
          provides: [{ id: "api-x", kind: "openapi", source: "introspected" }],
        }),
        // "ghost-consumer" referenced in contracts but not in components
      ] as CatalogIndex["components"],
      contracts: {
        "api-x": {
          provider: "provider-svc",
          kind: "openapi",
          consumers: ["ghost-consumer"],
        },
      },
    });

    const result = await runImpact(index, { contractId: "api-x" });
    expect(result!.consumers).toHaveLength(0);
  });
});
