/**
 * Integration tests for `dt verify contract-diff`.
 * Exercises the full CLI through the binary with fixture specs.
 */

import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

const BIN = join(import.meta.dirname, "../../bin/dt.ts");
const FIXTURES = join(import.meta.dirname, "../fixtures/verify");

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

describe("dt verify contract-diff — integration", () => {
  describe("OpenAPI", () => {
    it("detects breaking changes and exits 8 with --json (AC: exit 8)", () => {
      const result = runDt([
        "verify",
        "contract-diff",
        "--base",
        join(FIXTURES, "openapi-base.yaml"),
        "--head",
        join(FIXTURES, "openapi-head-breaking.yaml"),
        "--json",
      ]);

      expect(result.code).toBe(8);
      const output = JSON.parse(result.stdout);
      expect(output.contractType).toBe("openapi");
      expect(output.breaking).toBe(true);
      expect(output.findings.length).toBeGreaterThan(0);

      const breakingCodes = output.findings
        .filter((f: { kind: string }) => f.kind === "breaking")
        .map((f: { code: string }) => f.code);
      expect(breakingCodes.length).toBeGreaterThan(0);
    });

    it("reports no breaking changes and exits 0 (AC: additive = non-breaking)", () => {
      const result = runDt([
        "verify",
        "contract-diff",
        "--base",
        join(FIXTURES, "openapi-base.yaml"),
        "--head",
        join(FIXTURES, "openapi-head-nonbreaking.yaml"),
        "--json",
      ]);

      expect(result.code).toBe(0);
      const output = JSON.parse(result.stdout);
      expect(output.contractType).toBe("openapi");
      expect(output.breaking).toBe(false);
    });
  });

  describe("AsyncAPI", () => {
    it("detects breaking changes and exits 8", () => {
      const result = runDt([
        "verify",
        "contract-diff",
        "--base",
        join(FIXTURES, "asyncapi-base.yaml"),
        "--head",
        join(FIXTURES, "asyncapi-head-breaking.yaml"),
        "--json",
      ]);

      expect(result.code).toBe(8);
      const output = JSON.parse(result.stdout);
      expect(output.contractType).toBe("asyncapi");
      expect(output.breaking).toBe(true);

      const breakingCodes = output.findings
        .filter((f: { kind: string }) => f.kind === "breaking")
        .map((f: { code: string }) => f.code);
      expect(breakingCodes.length).toBeGreaterThan(0);
    });

    it("reports no breaking changes and exits 0", () => {
      const result = runDt([
        "verify",
        "contract-diff",
        "--base",
        join(FIXTURES, "asyncapi-base.yaml"),
        "--head",
        join(FIXTURES, "asyncapi-head-nonbreaking.yaml"),
        "--json",
      ]);

      expect(result.code).toBe(0);
      const output = JSON.parse(result.stdout);
      expect(output.contractType).toBe("asyncapi");
      expect(output.breaking).toBe(false);
    });

    it("skips low-confidence payload channels (AC: payload_confidence: low excluded)", () => {
      const result = runDt([
        "verify",
        "contract-diff",
        "--base",
        join(FIXTURES, "asyncapi-base.yaml"),
        "--head",
        join(FIXTURES, "asyncapi-head-breaking.yaml"),
        "--json",
      ]);

      const output = JSON.parse(result.stdout);
      // orders/tracking has payload_confidence: low in base fixture — must be skipped
      const trackingFindings = output.findings.filter((f: { path: string }) =>
        f.path.includes("orders/tracking"),
      );
      expect(trackingFindings).toHaveLength(0);
    });
  });

  describe("error handling", () => {
    it("exits 2 when --base is missing", () => {
      const result = runDt([
        "verify",
        "contract-diff",
        "--head",
        join(FIXTURES, "openapi-base.yaml"),
        "--json",
      ]);

      expect(result.code).toBe(2);
      const output = JSON.parse(result.stdout);
      expect(output.error).toBeDefined();
    });

    it("exits 2 when --head is missing", () => {
      const result = runDt([
        "verify",
        "contract-diff",
        "--base",
        join(FIXTURES, "openapi-base.yaml"),
        "--json",
      ]);

      expect(result.code).toBe(2);
      const output = JSON.parse(result.stdout);
      expect(output.error).toBeDefined();
    });

    it("exits 1 when file does not exist", () => {
      const result = runDt([
        "verify",
        "contract-diff",
        "--base",
        join(FIXTURES, "openapi-base.yaml"),
        "--head",
        "/nonexistent/path/spec.yaml",
        "--json",
      ]);

      expect(result.code).toBe(1);
      const output = JSON.parse(result.stdout);
      expect(output.error).toBeDefined();
    });
  });

  describe("human-readable output", () => {
    it("prints breaking-change summary without --json", () => {
      const result = runDt([
        "verify",
        "contract-diff",
        "--base",
        join(FIXTURES, "openapi-base.yaml"),
        "--head",
        join(FIXTURES, "openapi-head-breaking.yaml"),
      ]);

      expect(result.code).toBe(8);
      expect(result.stdout).toContain("breaking change");
    });

    it("prints success message for non-breaking without --json", () => {
      const result = runDt([
        "verify",
        "contract-diff",
        "--base",
        join(FIXTURES, "openapi-base.yaml"),
        "--head",
        join(FIXTURES, "openapi-head-nonbreaking.yaml"),
      ]);

      expect(result.code).toBe(0);
      expect(result.stdout).toContain("No breaking changes");
    });
  });
});
