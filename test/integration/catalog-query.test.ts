/**
 * Integration tests for `dt catalog resolve|get|deps|consumers|flow|closure|coverage`.
 * Tests the full CLI over the 20-component fixture catalog.
 */

import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

const BIN = join(import.meta.dirname, "../../bin/dt.ts");
const FIXTURES_INDEX = join(import.meta.dirname, "../fixtures/catalog/catalog/index.yaml");

function runDt(args: string[]): { code: number; stdout: string; stderr: string } {
  try {
    const stdout = execFileSync("npx", ["tsx", BIN, ...args], {
      encoding: "utf-8",
      cwd: import.meta.dirname,
      timeout: 30000,
      env: { ...process.env, NODE_NO_WARNINGS: "1" },
    });
    return { code: 0, stdout, stderr: "" };
  } catch (err: unknown) {
    const e = err as { status: number; stdout: string; stderr: string };
    return { code: e.status ?? 1, stdout: e.stdout ?? "", stderr: e.stderr ?? "" };
  }
}

describe("dt catalog resolve — integration", () => {
  it("resolves exact id match", () => {
    const result = runDt([
      "catalog",
      "resolve",
      "--text",
      "payment-service",
      "--index",
      FIXTURES_INDEX,
      "--json",
    ]);
    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.candidates.length).toBeGreaterThan(0);
    expect(output.candidates[0].id).toBe("payment-service");
    expect(output.candidates[0].score).toBeGreaterThanOrEqual(100);
    expect(output.candidates[0].signals.some((s: { type: string }) => s.type === "exact_id")).toBe(
      true,
    );
  });

  it("resolves alias match", () => {
    const result = runDt([
      "catalog",
      "resolve",
      "--text",
      "cart",
      "--index",
      FIXTURES_INDEX,
      "--json",
    ]);
    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.candidates.length).toBeGreaterThan(0);
    // cart-service has alias "cart"
    expect(output.candidates[0].id).toBe("cart-service");
  });

  it("resolves by domain", () => {
    const result = runDt([
      "catalog",
      "resolve",
      "--text",
      "logistics",
      "--index",
      FIXTURES_INDEX,
      "--json",
    ]);
    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.candidates.length).toBeGreaterThan(0);
    // logistics domain components should rank high
    const ids = output.candidates.map((c: { id: string }) => c.id);
    expect(
      ids.some((id: string) =>
        ["inventory-service", "shipping-service", "warehouse-service"].includes(id),
      ),
    ).toBe(true);
  });

  it("resolves flow alias", () => {
    const result = runDt([
      "catalog",
      "resolve",
      "--text",
      "purchase",
      "--index",
      FIXTURES_INDEX,
      "--json",
    ]);
    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.candidates.length).toBeGreaterThan(0);
    // checkout-flow has alias "purchase" → participants should match
    const ids = output.candidates.map((c: { id: string }) => c.id);
    expect(
      ids.some((id: string) => ["cart-service", "order-service", "payment-service"].includes(id)),
    ).toBe(true);
  });

  it("returns ordered candidates with score and signals", () => {
    const result = runDt([
      "catalog",
      "resolve",
      "--text",
      "payment",
      "--index",
      FIXTURES_INDEX,
      "--json",
    ]);
    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.candidates.length).toBeGreaterThan(0);
    // Check they're ordered by score descending
    for (let i = 1; i < output.candidates.length; i++) {
      expect(output.candidates[i - 1].score).toBeGreaterThanOrEqual(output.candidates[i].score);
    }
    // Each candidate has signals
    expect(output.candidates[0].signals.length).toBeGreaterThan(0);
  });

  it("respects --threshold flag", () => {
    const result = runDt([
      "catalog",
      "resolve",
      "--text",
      "payment",
      "--threshold",
      "200",
      "--index",
      FIXTURES_INDEX,
      "--json",
    ]);
    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.candidates).toHaveLength(0);
  });

  it("respects --limit flag", () => {
    const result = runDt([
      "catalog",
      "resolve",
      "--text",
      "service",
      "--limit",
      "3",
      "--index",
      FIXTURES_INDEX,
      "--json",
    ]);
    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.candidates.length).toBeLessThanOrEqual(3);
  });
});

describe("dt catalog get — integration", () => {
  it("returns full component by id", () => {
    const result = runDt([
      "catalog",
      "get",
      "--id",
      "payment-service",
      "--index",
      FIXTURES_INDEX,
      "--json",
    ]);
    expect(result.code).toBe(0);
    const component = JSON.parse(result.stdout);
    expect(component.id).toBe("payment-service");
    expect(component.domain).toBe("payments");
    expect(component.provides.length).toBeGreaterThan(0);
  });

  it("exits 5 for non-existent component", () => {
    const result = runDt([
      "catalog",
      "get",
      "--id",
      "ghost-svc",
      "--index",
      FIXTURES_INDEX,
      "--json",
    ]);
    expect(result.code).toBe(5);
  });
});

describe("dt catalog deps — integration", () => {
  it("returns downstream dependencies", () => {
    const result = runDt([
      "catalog",
      "deps",
      "--id",
      "order-service",
      "--direction",
      "down",
      "--index",
      FIXTURES_INDEX,
      "--json",
    ]);
    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.count).toBeGreaterThan(0);
    // order-service consumes payments-v2, inventory-v1, users-v1
    const ids = output.dependencies.map((d: { id: string }) => d.id);
    expect(ids).toContain("payment-service");
    expect(ids).toContain("inventory-service");
    expect(ids).toContain("user-service");
  });

  it("returns upstream dependants", () => {
    const result = runDt([
      "catalog",
      "deps",
      "--id",
      "user-service",
      "--direction",
      "up",
      "--index",
      FIXTURES_INDEX,
      "--json",
    ]);
    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.count).toBeGreaterThan(0);
    // user-service provides users-v1 consumed by auth, gateway, etc.
    const ids = output.dependencies.map((d: { id: string }) => d.id);
    expect(ids).toContain("auth-service");
    expect(ids).toContain("gateway-bff");
  });

  it("respects --depth limit", () => {
    const result = runDt([
      "catalog",
      "deps",
      "--id",
      "gateway-bff",
      "--direction",
      "down",
      "--depth",
      "1",
      "--index",
      FIXTURES_INDEX,
      "--json",
    ]);
    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    // depth=1: only direct deps, not transitive
    const ids = output.dependencies.map((d: { id: string }) => d.id);
    // gateway-bff directly consumes: auth-v1, orders-v1, users-v1, cart-v1, search-v1
    expect(ids).toContain("auth-service");
    expect(ids).toContain("order-service");
  });
});

describe("dt catalog consumers — integration", () => {
  it("returns consumers of a contract", () => {
    const result = runDt([
      "catalog",
      "consumers",
      "--contract",
      "users-v1",
      "--index",
      FIXTURES_INDEX,
      "--json",
    ]);
    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.provider).toBe("user-service");
    expect(output.count).toBeGreaterThan(0);
    const ids = output.consumers.map((c: { id: string }) => c.id);
    expect(ids).toContain("auth-service");
    expect(ids).toContain("gateway-bff");
  });

  it("exits 5 for non-existent contract", () => {
    const result = runDt([
      "catalog",
      "consumers",
      "--contract",
      "ghost-api",
      "--index",
      FIXTURES_INDEX,
      "--json",
    ]);
    expect(result.code).toBe(5);
  });
});

describe("dt catalog flow — integration", () => {
  it("returns flow with participants", () => {
    const result = runDt([
      "catalog",
      "flow",
      "--id",
      "checkout-flow",
      "--index",
      FIXTURES_INDEX,
      "--json",
    ]);
    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.flow.id).toBe("checkout-flow");
    expect(output.flow.name).toBe("Checkout Flow");
    expect(output.components.length).toBeGreaterThan(0);
    const ids = output.components.map((c: { id: string }) => c.id);
    expect(ids).toContain("cart-service");
    expect(ids).toContain("order-service");
    expect(ids).toContain("payment-service");
  });

  it("exits 5 for non-existent flow", () => {
    const result = runDt([
      "catalog",
      "flow",
      "--id",
      "ghost-flow",
      "--index",
      FIXTURES_INDEX,
      "--json",
    ]);
    expect(result.code).toBe(5);
  });
});

describe("dt catalog closure — integration", () => {
  it("computes transitive closure", () => {
    const result = runDt([
      "catalog",
      "closure",
      "--ids",
      "order-service",
      "--index",
      FIXTURES_INDEX,
      "--json",
    ]);
    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.count).toBeGreaterThan(1);
    const ids = output.components.map((c: { id: string }) => c.id);
    expect(ids).toContain("order-service"); // root
    expect(ids).toContain("payment-service");
    expect(ids).toContain("user-service");
    expect(ids).toContain("inventory-service");
  });

  it("includes consumers with --include-consumers", () => {
    const result = runDt([
      "catalog",
      "closure",
      "--ids",
      "user-service",
      "--include-consumers",
      "--index",
      FIXTURES_INDEX,
      "--json",
    ]);
    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    const ids = output.components.map((c: { id: string }) => c.id);
    expect(ids).toContain("auth-service"); // consumes users-v1
    expect(ids).toContain("gateway-bff"); // consumes users-v1
  });

  it("respects --max cap", () => {
    const result = runDt([
      "catalog",
      "closure",
      "--ids",
      "gateway-bff",
      "--max",
      "3",
      "--index",
      FIXTURES_INDEX,
      "--json",
    ]);
    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.count).toBeLessThanOrEqual(3);
    expect(output.capped).toBe(true);
  });
});

describe("dt catalog coverage — integration", () => {
  it("returns aggregate coverage report", () => {
    const result = runDt(["catalog", "coverage", "--index", FIXTURES_INDEX, "--json"]);
    expect(result.code).toBe(0);
    const report = JSON.parse(result.stdout);
    expect(report.total.fields).toBeGreaterThan(0);
    expect(report.total.high).toBeGreaterThan(0);
    expect(report.ratios.high).toBeGreaterThan(0);
    expect(report.components.length).toBe(20);
  });

  it("returns per-component coverage", () => {
    const result = runDt([
      "catalog",
      "coverage",
      "--id",
      "payment-service",
      "--index",
      FIXTURES_INDEX,
      "--json",
    ]);
    expect(result.code).toBe(0);
    const report = JSON.parse(result.stdout);
    expect(report.components).toHaveLength(1);
    expect(report.components[0].id).toBe("payment-service");
    expect(report.components[0].counts.high).toBeGreaterThan(0);
  });

  it("exits 5 for non-existent component", () => {
    const result = runDt([
      "catalog",
      "coverage",
      "--id",
      "ghost-svc",
      "--index",
      FIXTURES_INDEX,
      "--json",
    ]);
    expect(result.code).toBe(5);
  });
});
