import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "../..");
const FIXTURES_DIR = join(ROOT, "test/fixtures/extract");
const TSX = join(ROOT, "node_modules/.bin/tsx");
const DT_BIN = join(ROOT, "bin/dt.ts");

function runDt(args: string[], cwd?: string): { stdout: string; stderr: string; exitCode: number } {
  try {
    const stdout = execFileSync(TSX, [DT_BIN, ...args], {
      cwd: cwd ?? ROOT,
      encoding: "utf-8",
      timeout: 10000,
    });
    return { stdout, stderr: "", exitCode: 0 };
  } catch (err: unknown) {
    const error = err as { stdout?: string; stderr?: string; status?: number };
    return {
      stdout: error.stdout ?? "",
      stderr: error.stderr ?? "",
      exitCode: error.status ?? 1,
    };
  }
}

describe("dt extract detect — CLI", () => {
  it("outputs JSON for nestjs-prisma-kafkajs fixture", () => {
    const { stdout, exitCode } = runDt([
      "extract",
      "detect",
      FIXTURES_DIR + "/nestjs-prisma-kafkajs",
      "--json",
    ]);
    expect(exitCode).toBe(0);

    const output = JSON.parse(stdout);
    expect(output.detection).not.toBeNull();
    expect(output.detection.stack).toContain("nestjs");
    expect(output.detection.http.framework).toBe("nestjs");
    expect(output.detection.orm.kind).toBe("prisma");
    expect(output.detection.messaging.client).toBe("kafkajs");
    expect(output.detection.type_hint).toBe("node-nestjs-prisma-kafkajs");
    expect(output.requires_human).toBeDefined();
  });

  it("outputs human-readable format by default", () => {
    const { stdout, exitCode } = runDt(["extract", "detect", FIXTURES_DIR + "/express-drizzle"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Stack Detection Results");
    expect(stdout).toContain("express");
    expect(stdout).toContain("drizzle");
  });

  it("reports requires_human for missing capabilities in JSON", () => {
    const { stdout, exitCode } = runDt([
      "extract",
      "detect",
      FIXTURES_DIR + "/fastify-no-orm",
      "--json",
    ]);
    expect(exitCode).toBe(0);

    const output = JSON.parse(stdout);
    expect(output.requires_human.length).toBeGreaterThan(0);
    // db_introspection should be missing
    const dbEntry = output.requires_human.find(
      (e: { missing_capability: string }) => e.missing_capability === "db_introspection",
    );
    expect(dbEntry).toBeDefined();
  });

  it("handles no-framework repo", () => {
    const { stdout, exitCode } = runDt([
      "extract",
      "detect",
      FIXTURES_DIR + "/no-framework",
      "--json",
    ]);
    expect(exitCode).toBe(0);

    const output = JSON.parse(stdout);
    expect(output.detection.http).toBeNull();
    expect(output.detection.orm).toBeNull();
    expect(output.detection.messaging).toBeNull();
    expect(output.detection.type_hint).toBe("node-ts-no-framework");
  });

  it("outputs error message when no stack detected", () => {
    const { exitCode } = runDt(["extract", "detect", "/tmp", "--json"]);
    // /tmp won't have a package.json typically
    expect(exitCode).toBe(0);
  });

  it("shows extract subcommand usage when no subcommand given", () => {
    const { stderr, exitCode } = runDt(["extract"]);
    expect(exitCode).toBe(2);
    expect(stderr).toContain("detect");
  });
});
