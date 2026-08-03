/**
 * Integration tests for `dt catalog scaffold` and CI-like build+validate harness.
 * Tests: CLI command produces expected output; build→validate sequence works against fixtures.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import { mkdirSync, rmSync, existsSync, readFileSync, writeFileSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { stringify as yamlStringify } from "yaml";

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

describe("dt catalog scaffold — integration", () => {
  let tmpDir: string;

  beforeEach(() => {
    const rawDir = join(
      tmpdir(),
      `scaffold-int-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    mkdirSync(rawDir, { recursive: true });
    tmpDir = realpathSync(rawDir);
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("scaffold command produces expected directory structure via CLI", () => {
    const { stdout, exitCode } = runDt(["catalog", "scaffold", "--out", tmpDir, "--json"]);

    expect(exitCode).toBe(0);
    const output = JSON.parse(stdout);
    expect(output.success).toBe(true);
    expect(output.created.length).toBeGreaterThan(0);

    // Verify structure
    expect(existsSync(join(tmpDir, "architecture.md"))).toBe(true);
    expect(existsSync(join(tmpDir, "domains.md"))).toBe(true);
    expect(existsSync(join(tmpDir, "glossary.md"))).toBe(true);
    expect(existsSync(join(tmpDir, "conventions.md"))).toBe(true);
    expect(existsSync(join(tmpDir, "platform.yaml"))).toBe(true);
    expect(existsSync(join(tmpDir, "registry.yaml"))).toBe(true);
    expect(existsSync(join(tmpDir, "adr"))).toBe(true);
    expect(existsSync(join(tmpDir, "catalog"))).toBe(true);
    expect(existsSync(join(tmpDir, "catalog/flows"))).toBe(true);
    expect(existsSync(join(tmpDir, "catalog/components"))).toBe(true);
    expect(existsSync(join(tmpDir, "schemas"))).toBe(true);
  });

  it("scaffold command with human-readable output", () => {
    const { stdout, exitCode } = runDt(["catalog", "scaffold", "--out", tmpDir]);

    expect(exitCode).toBe(0);
    expect(stdout).toContain("Meta-repo scaffold generated");
    expect(stdout).toContain(tmpDir);
  });

  it("scaffold does not overwrite existing files without --force", () => {
    const archPath = join(tmpDir, "architecture.md");
    writeFileSync(archPath, "# Custom Content\n", "utf-8");

    const { stdout, exitCode } = runDt(["catalog", "scaffold", "--out", tmpDir, "--json"]);

    expect(exitCode).toBe(0);
    const output = JSON.parse(stdout);
    expect(output.skipped).toContain(archPath);

    // Original content preserved
    expect(readFileSync(archPath, "utf-8")).toBe("# Custom Content\n");
  });

  it("scaffold overwrites existing files with --force", () => {
    const archPath = join(tmpDir, "architecture.md");
    writeFileSync(archPath, "# Custom Content\n", "utf-8");

    const { stdout, exitCode } = runDt([
      "catalog",
      "scaffold",
      "--out",
      tmpDir,
      "--force",
      "--json",
    ]);

    expect(exitCode).toBe(0);
    const output = JSON.parse(stdout);
    expect(output.created).toContain(archPath);

    // Content should be template
    expect(readFileSync(archPath, "utf-8")).toContain("# Architecture");
  });
});

describe("CI-like build+validate harness — integration", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `ci-harness-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("build→validate sequence succeeds against fixture registry", () => {
    // Step 1: Build the catalog
    const buildResult = runDt([
      "catalog",
      "build",
      "--registry",
      join(FIXTURES_DIR, "registry.yaml"),
      "--json",
    ]);

    // Exit 3 is expected because broken-repo fixture causes partial failure
    expect([0, 3]).toContain(buildResult.exitCode);
    const buildOutput = JSON.parse(buildResult.stdout);
    expect(buildOutput.components_count).toBeGreaterThan(0);

    // Step 2: Validate the catalog (non-strict since we know the fixture has some issues)
    // The index was generated relative to fixtures — validate where it was built
    const indexPath = join(FIXTURES_DIR, "catalog", "index.yaml");
    if (existsSync(indexPath)) {
      const catalogDir = join(FIXTURES_DIR, "catalog");
      const validateResult = runDt([
        "catalog",
        "validate",
        "--index",
        indexPath,
        "--catalog-dir",
        catalogDir,
        "--json",
      ]);

      // Validate runs — may exit 4 (validation errors) or 0 (pass)
      expect([0, 4]).toContain(validateResult.exitCode);
      const validateOutput = JSON.parse(validateResult.stdout);
      expect(validateOutput).toHaveProperty("checks");
    }
  });

  it("validate fails with non-zero exit on referential integrity errors", () => {
    // Create a minimal invalid catalog to test failure alerting
    const catalogDir = join(tmpDir, "catalog");
    const componentsDir = join(catalogDir, "components");
    mkdirSync(componentsDir, { recursive: true });

    // Create a component that references a non-existent contract
    const badComponent = {
      schemaVersion: "1.0.0",
      id: "bad-service",
      name: "Bad Service",
      description: "A service with broken references",
      repo: "https://github.com/acme/bad-service",
      type: "service",
      domain: "nonexistent-domain",
      owner: "team",
      criticality: "tier-2",
      lifecycle: "production",
      stack: ["node"],
      aliases: [],
      provides: [],
      consumes: [{ contract: "nonexistent-api", criticality: "hard", source: "manual" }],
      datastores: [],
      docs: {},
      paths: { source: ["src/"] },
      _provenance: {
        extracted_at: "2026-01-01T00:00:00Z",
        extractor: "0.6.7",
        repo_sha: "abc123",
        fields: {},
        field_hashes: {},
      },
    };

    writeFileSync(
      join(componentsDir, "bad-service.json"),
      JSON.stringify(badComponent, null, 2),
      "utf-8",
    );

    // Create a minimal index
    const index = {
      generated_at: new Date().toISOString(),
      generator: "0.6.7",
      components: [
        {
          id: "bad-service",
          name: "Bad Service",
          description: "A service with broken references",
          type: "service",
          domain: "nonexistent-domain",
          owner: "team",
          criticality: "tier-2",
          lifecycle: "production",
          stack: ["node"],
          provides: [],
          consumes: [{ contract: "nonexistent-api", criticality: "hard" }],
          origin_sha: "abc123",
        },
      ],
      contracts: {},
      domains: [],
      flows: [],
      extraction_quality: {
        high: 0,
        medium: 0,
        low: 1,
        per_component: [{ component_id: "bad-service", counts: { high: 0, medium: 0, low: 1 } }],
      },
      errors: [],
    };

    // Write as YAML
    writeFileSync(join(catalogDir, "index.yaml"), yamlStringify(index), "utf-8");

    const validateResult = runDt([
      "catalog",
      "validate",
      "--strict",
      "--index",
      join(catalogDir, "index.yaml"),
      "--catalog-dir",
      catalogDir,
      "--json",
    ]);

    // Should fail (exit 4) due to referential integrity errors
    expect(validateResult.exitCode).toBe(4);
  });
});
