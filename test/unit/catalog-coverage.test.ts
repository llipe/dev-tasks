/**
 * Unit tests for core/catalog/coverage.ts — extraction quality reporting.
 */

import { describe, it, expect } from "vitest";
import { catalogCoverage } from "#core/catalog/coverage.js";
import type { CatalogIndex } from "#core/catalog/index-model.js";

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

describe("catalogCoverage", () => {
  it("returns aggregate coverage for full catalog", () => {
    const index = makeIndex({
      extraction_quality: {
        total: { high: 10, medium: 5, low: 3 },
        per_component: [
          { component_id: "svc-a", counts: { high: 5, medium: 3, low: 1 }, unresolved: 0 },
          { component_id: "svc-b", counts: { high: 5, medium: 2, low: 2 }, unresolved: 1 },
        ],
      },
    });

    const report = catalogCoverage(index);
    expect(report).not.toBeNull();
    expect(report!.total.fields).toBe(18);
    expect(report!.total.high).toBe(10);
    expect(report!.total.medium).toBe(5);
    expect(report!.total.low).toBe(3);
    expect(report!.ratios.high).toBeCloseTo(10 / 18);
    expect(report!.components).toHaveLength(2);
  });

  it("returns coverage for a single component", () => {
    const index = makeIndex({
      extraction_quality: {
        total: { high: 10, medium: 5, low: 3 },
        per_component: [
          { component_id: "svc-a", counts: { high: 5, medium: 3, low: 1 }, unresolved: 2 },
          { component_id: "svc-b", counts: { high: 5, medium: 2, low: 2 }, unresolved: 0 },
        ],
      },
    });

    const report = catalogCoverage(index, "svc-a");
    expect(report).not.toBeNull();
    expect(report!.components).toHaveLength(1);
    expect(report!.components[0].id).toBe("svc-a");
    expect(report!.components[0].total).toBe(9);
    expect(report!.components[0].unresolved).toBe(2);
    expect(report!.components[0].highRatio).toBeCloseTo(5 / 9);
    expect(report!.components[0].lowRatio).toBeCloseTo(1 / 9);
  });

  it("returns null for non-existent component id", () => {
    const index = makeIndex({
      extraction_quality: {
        total: { high: 0, medium: 0, low: 0 },
        per_component: [],
      },
    });
    expect(catalogCoverage(index, "ghost")).toBeNull();
  });

  it("handles zero-field components", () => {
    const index = makeIndex({
      extraction_quality: {
        total: { high: 0, medium: 0, low: 0 },
        per_component: [
          { component_id: "svc-empty", counts: { high: 0, medium: 0, low: 0 }, unresolved: 0 },
        ],
      },
    });

    const report = catalogCoverage(index, "svc-empty");
    expect(report).not.toBeNull();
    expect(report!.components[0].highRatio).toBe(0);
    expect(report!.components[0].lowRatio).toBe(0);
    expect(report!.ratios.high).toBe(0);
  });
});
