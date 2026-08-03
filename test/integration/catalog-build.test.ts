/**
 * Integration tests for `dt catalog build`.
 * Tests the full build pipeline over the 20-component fixture registry.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import { mkdirSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { parse as yamlParse } from "yaml";

const FIXTURES_DIR = join(import.meta.dirname, "../fixtures/catalog");
const BIN = join(import.meta.dirname, "../../bin/dt.ts");

function runDt(args: string[], cwd?: string): { stdout: string; stderr: string; exitCode: number } {
  try {
    const result = execFileSync("npx", ["tsx", BIN, ...args], {
      encoding: "utf-8",
      cwd: cwd ?? import.meta.dirname,
      env: { ...process.env, NODE_OPTIONS: "" },
    });
    return { stdout: result, stderr: "", exitCode: 0 };
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; status?: number };
    return {
      stdout: e.stdout ?? "",
      stderr: e.stderr ?? "",
      exitCode: e.status ?? 1,
    };
  }
}

describe("dt catalog build — integration", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `catalog-build-int-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("builds 20-component registry and generates index.yaml", () => {
    const { stdout, exitCode } = runDt([
      "catalog",
      "build",
      "--registry",
      join(FIXTURES_DIR, "registry.yaml"),
      "--json",
    ]);

    // Since we can't easily pass --catalog-dir through CLI yet, test via module directly
    // This is the CLI-level smoke test (it will output to fixture's sibling catalog/)
    // Let's use a different approach: test via the core module directly
    expect(exitCode).toBe(3); // broken-repo causes exit 3
    const output = JSON.parse(stdout);
    expect(output.components_count).toBe(20);
    expect(output.errors_count).toBe(1);
    expect(output.errors[0].repo).toContain("broken-repo");
  });

  it("exits 3 when one repo has errors (broken-repo)", () => {
    const { exitCode, stdout } = runDt([
      "catalog",
      "build",
      "--registry",
      join(FIXTURES_DIR, "registry.yaml"),
      "--json",
    ]);

    expect(exitCode).toBe(3);
    const output = JSON.parse(stdout);
    expect(output.errors_count).toBe(1);
    expect(output.errors[0].error).toContain("component.json not found");
  });

  it("generates correct index structure with contracts and domains", async () => {
    // Use the core module for deeper assertions
    const { catalogBuild } = await import("#core/catalog/build.js");
    const catalogDir = join(tmpDir, "catalog");

    // Copy flow fixtures into the catalog dir (flows are read from catalog/flows/)
    const { cpSync } = await import("node:fs");
    cpSync(join(FIXTURES_DIR, "catalog", "flows"), join(catalogDir, "flows"), { recursive: true });

    const _result = await catalogBuild({
      registryPath: join(FIXTURES_DIR, "registry.yaml"),
      catalogDir,
    });

    // Check generated index.yaml exists and is valid YAML
    const indexPath = join(catalogDir, "index.yaml");
    expect(existsSync(indexPath)).toBe(true);

    const indexRaw = readFileSync(indexPath, "utf-8");
    const index = yamlParse(indexRaw) as Record<string, unknown>;

    // Top-level structure
    expect(index.generated_at).toBeDefined();
    expect(index.generator).toContain("dev-tasks@");
    expect(Array.isArray(index.components)).toBe(true);
    expect((index.components as unknown[]).length).toBe(20);

    // Contracts map (inverted consumer index)
    const contracts = index.contracts as Record<string, unknown>;
    expect(contracts).toBeDefined();
    // payment-service provides payments-v2, consumed by order-service and reporting-job
    const paymentsContract = contracts["payments-v2"] as { provider: string; consumers: string[] };
    expect(paymentsContract.provider).toBe("payment-service");
    expect(paymentsContract.consumers).toContain("order-service");
    expect(paymentsContract.consumers).toContain("reporting-job");

    // Domains
    const domains = index.domains as Array<{ name: string; components: string[] }>;
    expect(domains.length).toBeGreaterThan(0);
    const paymentsDomain = domains.find((d) => d.name === "payments");
    expect(paymentsDomain?.components).toContain("payment-service");

    // Flows (from catalog/flows/ directory)
    const flows = index.flows as Array<{ id: string }>;
    expect(flows.length).toBe(2);
    expect(flows.find((f) => f.id === "checkout-flow")).toBeDefined();
    expect(flows.find((f) => f.id === "user-registration")).toBeDefined();

    // Extraction quality
    const quality = index.extraction_quality as {
      total: { high: number; medium: number; low: number };
    };
    expect(quality.total.high).toBeGreaterThan(0);

    // Errors
    expect((index.errors as unknown[]).length).toBe(1);
  });

  it("mirrors component.json files into catalog/components/", async () => {
    const { catalogBuild } = await import("#core/catalog/build.js");
    const catalogDir = join(tmpDir, "catalog");

    await catalogBuild({
      registryPath: join(FIXTURES_DIR, "registry.yaml"),
      catalogDir,
    });

    // Check component files were mirrored
    expect(existsSync(join(catalogDir, "components", "payment-service.json"))).toBe(true);
    expect(existsSync(join(catalogDir, "components", "order-service.json"))).toBe(true);
    expect(existsSync(join(catalogDir, "components", "config-lib.json"))).toBe(true);

    // Verify content is valid JSON
    const paymentJson = JSON.parse(
      readFileSync(join(catalogDir, "components", "payment-service.json"), "utf-8"),
    );
    expect(paymentJson.id).toBe("payment-service");
  });

  it("records per-component origin SHA in the index", async () => {
    const { catalogBuild } = await import("#core/catalog/build.js");
    const catalogDir = join(tmpDir, "catalog");

    const result = await catalogBuild({
      registryPath: join(FIXTURES_DIR, "registry.yaml"),
      catalogDir,
    });

    const payment = result.index.components.find((c) => c.id === "payment-service");
    expect(payment?.origin_sha).toBe("aaa111aaa111aaa111aaa111aaa111aaa111aaa1");

    const order = result.index.components.find((c) => c.id === "order-service");
    expect(order?.origin_sha).toBe("bbb222bbb222bbb222bbb222bbb222bbb222bbb2");
  });

  it("human output mode works (no --json)", () => {
    const { stdout, stderr, exitCode } = runDt([
      "catalog",
      "build",
      "--registry",
      join(FIXTURES_DIR, "registry.yaml"),
    ]);

    expect(exitCode).toBe(3);
    expect(stdout).toContain("20 components");
    expect(stderr).toContain("error");
  });

  it("exits 2 with usage when --registry is missing", () => {
    const { exitCode } = runDt(["catalog", "build"]);
    expect(exitCode).toBe(2);
  });

  it("exits 5 when registry file does not exist", () => {
    const { exitCode } = runDt(["catalog", "build", "--registry", "/nonexistent/registry.yaml"]);
    expect(exitCode).toBe(5);
  });
});
