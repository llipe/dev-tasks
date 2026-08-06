/**
 * Integration tests for `dt verify impact`.
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

describe("dt verify impact — integration", () => {
  it("lists consumers for a contract with JSON output (AC1 + AC4)", () => {
    const result = runDt([
      "verify",
      "impact",
      "--contract",
      "orders-v1",
      "--index",
      FIXTURES_INDEX,
      "--json",
    ]);
    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.contractId).toBe("orders-v1");
    expect(output.provider).toBe("order-service");
    expect(output.consumers.length).toBe(4);

    // Verify consumers include criticality
    const consumerIds = output.consumers.map((c: { id: string }) => c.id);
    expect(consumerIds).toContain("gateway-bff");
    expect(consumerIds).toContain("payment-service");
    expect(consumerIds).toContain("reporting-job");
    expect(consumerIds).toContain("shipping-service");

    // Every consumer should have a criticality field
    for (const consumer of output.consumers) {
      expect(consumer.criticality).toBeDefined();
      expect(typeof consumer.criticality).toBe("string");
    }
  });

  it("outputs human-readable format without --json", () => {
    const result = runDt([
      "verify",
      "impact",
      "--contract",
      "orders-v1",
      "--index",
      FIXTURES_INDEX,
    ]);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("Contract: orders-v1");
    expect(result.stdout).toContain("provider: order-service");
    expect(result.stdout).toContain("Consumers: 4");
    expect(result.stdout).toContain("gateway-bff");
  });

  it("returns exit 12 for unknown contract", () => {
    const result = runDt([
      "verify",
      "impact",
      "--contract",
      "nonexistent-api",
      "--index",
      FIXTURES_INDEX,
      "--json",
    ]);
    expect(result.code).toBe(12);
    const output = JSON.parse(result.stdout);
    expect(output.error).toContain("not found");
  });

  it("returns exit 2 when --contract is missing", () => {
    const result = runDt(["verify", "impact", "--json"]);
    expect(result.code).toBe(2);
    const output = JSON.parse(result.stdout);
    expect(output.error).toContain("--contract");
  });

  it("handles contract with no consumers", () => {
    const result = runDt([
      "verify",
      "impact",
      "--contract",
      "product-updated",
      "--index",
      FIXTURES_INDEX,
      "--json",
    ]);
    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.contractId).toBe("product-updated");
    expect(output.consumers).toHaveLength(0);
  });

  it("--emit-tasks degrades gracefully when no tracker provider (AC2 + AC5)", () => {
    const result = runDt([
      "verify",
      "impact",
      "--contract",
      "orders-v1",
      "--emit-tasks",
      "--index",
      FIXTURES_INDEX,
      "--json",
    ]);
    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.tasksEmitted).toBe(false);
    expect(output.taskResults.length).toBeGreaterThan(0);
    // All should report provider unavailable
    for (const tr of output.taskResults) {
      expect(tr.success).toBe(false);
      expect(tr.error).toContain("No tracker provider configured");
    }
  });

  it("includes per-relationship criticality from consumes[] entries", () => {
    // users-v1 has many consumers with varying criticality
    const result = runDt([
      "verify",
      "impact",
      "--contract",
      "users-v1",
      "--index",
      FIXTURES_INDEX,
      "--json",
    ]);
    expect(result.code).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.consumers.length).toBe(7);

    // auth-service consumes users-v1 with criticality: hard
    const authConsumer = output.consumers.find((c: { id: string }) => c.id === "auth-service");
    expect(authConsumer).toBeDefined();
    expect(authConsumer.criticality).toBe("hard");
  });
});
