/**
 * Integration tests for `dt catalog validate` CLI command.
 * Tests the full command against the 20-component fixture catalog.
 */

import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { stringify as yamlStringify } from "yaml";

const BIN = join(import.meta.dirname, "../../bin/dt.ts");
const FIXTURES_CATALOG = join(import.meta.dirname, "../fixtures/catalog/catalog");

function runDt(args: string[], cwd?: string): { code: number; stdout: string; stderr: string } {
  try {
    const stdout = execFileSync("npx", ["tsx", BIN, ...args], {
      cwd: cwd ?? import.meta.dirname,
      encoding: "utf-8",
      timeout: 30000,
      env: { ...process.env, NODE_NO_WARNINGS: "1" },
    });
    return { code: 0, stdout, stderr: "" };
  } catch (err: unknown) {
    const e = err as { status: number; stdout: string; stderr: string };
    return { code: e.status ?? 1, stdout: e.stdout ?? "", stderr: e.stderr ?? "" };
  }
}

describe("dt catalog validate — integration", () => {
  it("validates the 20-component fixture catalog successfully", () => {
    // The fixture catalog is well-formed, so validate should pass
    // (with some warnings like orphan contracts)
    const result = runDt([
      "catalog",
      "validate",
      "--catalog-dir",
      FIXTURES_CATALOG,
      "--index",
      join(FIXTURES_CATALOG, "index.yaml"),
      "--json",
    ]);
    const output = JSON.parse(result.stdout);
    // Catalog should pass (no errors); may have warnings
    expect(output.passed).toBe(true);
    expect(output.errorCount).toBe(0);
    expect(result.code).toBe(0);
  });

  it("outputs human-readable format without --json", () => {
    const result = runDt([
      "catalog",
      "validate",
      "--catalog-dir",
      FIXTURES_CATALOG,
      "--index",
      join(FIXTURES_CATALOG, "index.yaml"),
    ]);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("✓");
    expect(result.stdout).toContain("passed");
  });

  it("reports warnings for orphan contracts (V13)", () => {
    const result = runDt([
      "catalog",
      "validate",
      "--catalog-dir",
      FIXTURES_CATALOG,
      "--index",
      join(FIXTURES_CATALOG, "index.yaml"),
      "--json",
    ]);
    const output = JSON.parse(result.stdout);
    const v13 = output.checks.find((c: { check: string }) => c.check === "V13");
    expect(v13).toBeDefined();
    // The fixture has product-updated and shipment-dispatched with no consumers
    expect(v13.passed).toBe(false);
    expect(v13.severity).toBe("warning");
    expect(v13.violationCount).toBeGreaterThan(0);
  });
});

describe("dt catalog validate — seeded violations", () => {
  let tmpDir: string;

  function setupViolationCatalog(indexOverrides: Record<string, unknown>) {
    tmpDir = join(tmpdir(), "dt-validate-int-" + Date.now());
    const catalogDir = join(tmpDir, "catalog");
    mkdirSync(catalogDir, { recursive: true });

    // Write a minimal index with violations
    const baseIndex = {
      generated_at: "2026-01-01T00:00:00Z",
      generator: "test@1.0.0",
      components: [],
      contracts: {},
      domains: [],
      flows: [],
      extraction_quality: { total: { high: 0, medium: 0, low: 0 }, per_component: [] },
      errors: [],
      ...indexOverrides,
    };

    // Use yaml stringify
    writeFileSync(join(catalogDir, "index.yaml"), yamlStringify(baseIndex));
    return catalogDir;
  }

  it("exits 4 with V04 referential integrity error", () => {
    const catalogDir = setupViolationCatalog({
      components: [
        {
          id: "svc-a",
          name: "Svc A",
          description: "A",
          repo: "r",
          type: "service",
          domain: "test",
          owner: "t",
          criticality: "tier-2",
          lifecycle: "production",
          stack: ["node"],
          aliases: [],
          provides: [],
          consumes: [{ contract: "ghost-api", criticality: "hard" }],
          datastores: [],
          origin_sha: "abc",
        },
      ],
      domains: [{ name: "test", components: ["svc-a"] }],
      extraction_quality: {
        total: { high: 3, medium: 0, low: 0 },
        per_component: [
          { component_id: "svc-a", counts: { high: 3, medium: 0, low: 0 }, unresolved: 0 },
        ],
      },
    });

    const result = runDt([
      "catalog",
      "validate",
      "--index",
      join(catalogDir, "index.yaml"),
      "--json",
    ]);

    expect(result.code).toBe(4);
    const output = JSON.parse(result.stdout);
    expect(output.passed).toBe(false);
    expect(output.errorCount).toBeGreaterThan(0);
    const v04 = output.checks.find((c: { check: string }) => c.check === "V04");
    expect(v04.passed).toBe(false);

    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("exits 4 with V02 duplicate id error", () => {
    const catalogDir = setupViolationCatalog({
      components: [
        {
          id: "svc-a",
          name: "A1",
          description: "A",
          repo: "r1",
          type: "service",
          domain: "test",
          owner: "t",
          criticality: "tier-2",
          lifecycle: "production",
          stack: ["node"],
          aliases: [],
          provides: [],
          consumes: [],
          datastores: [],
          origin_sha: "a",
        },
        {
          id: "svc-a",
          name: "A2",
          description: "A",
          repo: "r2",
          type: "service",
          domain: "test",
          owner: "t",
          criticality: "tier-2",
          lifecycle: "production",
          stack: ["node"],
          aliases: [],
          provides: [],
          consumes: [],
          datastores: [],
          origin_sha: "b",
        },
      ],
      domains: [{ name: "test", components: ["svc-a"] }],
      extraction_quality: {
        total: { high: 6, medium: 0, low: 0 },
        per_component: [
          { component_id: "svc-a", counts: { high: 3, medium: 0, low: 0 }, unresolved: 0 },
        ],
      },
    });

    const result = runDt([
      "catalog",
      "validate",
      "--index",
      join(catalogDir, "index.yaml"),
      "--json",
    ]);

    expect(result.code).toBe(4);
    const output = JSON.parse(result.stdout);
    const v02 = output.checks.find((c: { check: string }) => c.check === "V02");
    expect(v02.passed).toBe(false);

    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("--strict turns V12 cycle warning into error", () => {
    const catalogDir = setupViolationCatalog({
      components: [
        {
          id: "svc-a",
          name: "A",
          description: "A",
          repo: "r",
          type: "service",
          domain: "test",
          owner: "t",
          criticality: "tier-2",
          lifecycle: "production",
          stack: ["node"],
          aliases: [],
          provides: [{ id: "api-a", kind: "openapi", source: "introspected" }],
          consumes: [{ contract: "api-b", criticality: "hard" }],
          datastores: [],
          origin_sha: "a",
        },
        {
          id: "svc-b",
          name: "B",
          description: "B",
          repo: "r",
          type: "service",
          domain: "test",
          owner: "t",
          criticality: "tier-2",
          lifecycle: "production",
          stack: ["node"],
          aliases: [],
          provides: [{ id: "api-b", kind: "openapi", source: "introspected" }],
          consumes: [{ contract: "api-a", criticality: "hard" }],
          datastores: [],
          origin_sha: "b",
        },
      ],
      domains: [{ name: "test", components: ["svc-a", "svc-b"] }],
      extraction_quality: {
        total: { high: 6, medium: 0, low: 0 },
        per_component: [
          { component_id: "svc-a", counts: { high: 3, medium: 0, low: 0 }, unresolved: 0 },
          { component_id: "svc-b", counts: { high: 3, medium: 0, low: 0 }, unresolved: 0 },
        ],
      },
    });

    // Without --strict: warnings only, exit 0
    const resultDefault = runDt([
      "catalog",
      "validate",
      "--index",
      join(catalogDir, "index.yaml"),
      "--json",
    ]);
    expect(resultDefault.code).toBe(0);

    // With --strict: cycles become errors, exit 4
    const resultStrict = runDt([
      "catalog",
      "validate",
      "--index",
      join(catalogDir, "index.yaml"),
      "--strict",
      "--json",
    ]);
    expect(resultStrict.code).toBe(4);
    const output = JSON.parse(resultStrict.stdout);
    const v12 = output.checks.find((c: { check: string }) => c.check === "V12");
    expect(v12.severity).toBe("error");

    rmSync(tmpDir, { recursive: true, force: true });
  });
});
