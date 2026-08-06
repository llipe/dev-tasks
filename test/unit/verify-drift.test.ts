/**
 * Unit tests for core/verify/drift.ts — drift heuristic computation.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { execSync } from "node:child_process";
import {
  daysAgo,
  deriveComponentPaths,
  computeComponentDrift,
  runDrift,
} from "../../core/verify/drift.js";
import type { CatalogIndex, ComponentSummary } from "../../core/catalog/index-model.js";

/* ─── Mock git operations ──────────────────────────────────────────── */

vi.mock("node:child_process", () => ({
  execSync: vi.fn(() => ""),
}));

const mockExecSync = vi.mocked(execSync);

beforeEach(() => {
  mockExecSync.mockReset();
  mockExecSync.mockReturnValue("");
});

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

function makeComponent(id: string, overrides: Partial<ComponentSummary> = {}): ComponentSummary {
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
    aliases: [],
    provides: [],
    consumes: [],
    datastores: [],
    origin_sha: "abc123",
    ...overrides,
  };
}

/* ─── daysAgo ──────────────────────────────────────────────────────── */

describe("daysAgo", () => {
  it("returns 0 for a date that is today", () => {
    const now = new Date("2026-07-01T12:00:00Z");
    const date = new Date("2026-07-01T06:00:00Z");
    expect(daysAgo(date, now)).toBe(0);
  });

  it("computes correct days for past dates", () => {
    const now = new Date("2026-07-10T12:00:00Z");
    const date = new Date("2026-07-01T12:00:00Z");
    expect(daysAgo(date, now)).toBe(9);
  });

  it("returns Infinity for null date", () => {
    expect(daysAgo(null)).toBe(Infinity);
  });
});

/* ─── deriveComponentPaths ─────────────────────────────────────────── */

describe("deriveComponentPaths", () => {
  it("uses provides[].source for source paths", () => {
    const component = makeComponent("svc-a", {
      provides: [
        { id: "api-a", kind: "openapi", source: "contracts/openapi.yaml" },
        { id: "events-a", kind: "asyncapi", source: "contracts/asyncapi.yaml" },
      ],
    });

    const { sourcePaths } = deriveComponentPaths(component);
    expect(sourcePaths).toContain("contracts/openapi.yaml");
    expect(sourcePaths).toContain("contracts/asyncapi.yaml");
  });

  it("falls back to src/ when no provides have source", () => {
    const component = makeComponent("svc-b", {
      provides: [{ id: "api-b", kind: "openapi", source: "" }],
    });

    const { sourcePaths } = deriveComponentPaths(component);
    expect(sourcePaths).toContain("src/");
  });

  it("always includes docs/ and README.md in docsPaths", () => {
    const component = makeComponent("svc-c");
    const { docsPaths } = deriveComponentPaths(component);
    expect(docsPaths).toContain("docs/");
    expect(docsPaths).toContain("README.md");
  });
});

/* ─── computeComponentDrift ────────────────────────────────────────── */

describe("computeComponentDrift", () => {
  it("reports -1 when git log returns no results", () => {
    mockExecSync.mockReturnValue("");

    const component = makeComponent("svc-a");
    const now = new Date("2026-07-01T12:00:00Z");
    const entry = computeComponentDrift(component, "/tmp/fake-repo", 30, now);

    expect(entry.id).toBe("svc-a");
    expect(entry.sourceDaysAgo).toBe(-1);
    expect(entry.docsDaysAgo).toBe(-1);
    expect(entry.driftDays).toBe(0);
    expect(entry.stale).toBe(false);
  });

  it("marks entry as stale when drift exceeds threshold", () => {
    let callCount = 0;
    mockExecSync.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return "2026-06-26T12:00:00Z"; // source: 5 days ago
      return "2026-05-12T12:00:00Z"; // docs: 50 days ago
    });

    const component = makeComponent("svc-drift");
    const now = new Date("2026-07-01T12:00:00Z");
    const entry = computeComponentDrift(component, "/tmp/repo", 30, now);

    expect(entry.sourceDaysAgo).toBe(5);
    expect(entry.docsDaysAgo).toBe(50);
    expect(entry.driftDays).toBe(45);
    expect(entry.stale).toBe(true);
  });

  it("marks entry as not stale when drift is within threshold", () => {
    let callCount = 0;
    mockExecSync.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return "2026-06-26T12:00:00Z"; // source: 5 days ago
      return "2026-06-20T12:00:00Z"; // docs: 11 days ago
    });

    const component = makeComponent("svc-ok");
    const now = new Date("2026-07-01T12:00:00Z");
    const entry = computeComponentDrift(component, "/tmp/repo", 30, now);

    expect(entry.driftDays).toBe(6);
    expect(entry.stale).toBe(false);
  });
});

/* ─── runDrift ─────────────────────────────────────────────────────── */

describe("runDrift", () => {
  it("returns empty entries for empty catalog", () => {
    const index = makeIndex();
    const result = runDrift(index, { repoRoot: "/tmp/fake" });
    expect(result.entries).toHaveLength(0);
    expect(result.staleEntries).toHaveLength(0);
    expect(result.threshold).toBe(30);
  });

  it("respects custom threshold", () => {
    const index = makeIndex();
    const result = runDrift(index, { threshold: 60, repoRoot: "/tmp/fake" });
    expect(result.threshold).toBe(60);
  });

  it("filters by component id when --id is specified", () => {
    mockExecSync.mockReturnValue("");

    const index = makeIndex({
      components: [makeComponent("svc-a"), makeComponent("svc-b"), makeComponent("svc-c")],
    });

    const result = runDrift(index, { id: "svc-b", repoRoot: "/tmp/fake" });
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].id).toBe("svc-b");
  });

  it("returns empty when --id matches no component", () => {
    const index = makeIndex({
      components: [makeComponent("svc-a")],
    });

    const result = runDrift(index, { id: "nonexistent", repoRoot: "/tmp/fake" });
    expect(result.entries).toHaveLength(0);
  });

  it("threshold boundary: drift exactly at threshold is not stale", () => {
    let callCount = 0;
    mockExecSync.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return "2026-06-01T12:00:00Z"; // source: 30 days ago
      return "2026-05-02T12:00:00Z"; // docs: 60 days ago → drift = 30
    });

    const index = makeIndex({
      components: [makeComponent("svc-boundary")],
    });

    const result = runDrift(index, { threshold: 30, repoRoot: "/tmp/repo" });
    // drift = 30, threshold = 30 → NOT stale (> not >=)
    expect(result.entries[0].driftDays).toBe(30);
    expect(result.entries[0].stale).toBe(false);
  });
});
