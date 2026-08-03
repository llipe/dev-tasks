/**
 * Unit tests for core/catalog/scaffold.ts.
 * Tests: scaffold file generation produces expected directory structure and file list.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import { mkdirSync, rmSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { catalogScaffold } from "#core/catalog/scaffold.js";

describe("catalogScaffold", () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `scaffold-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it("creates the complete meta-repo directory structure", () => {
    const result = catalogScaffold({ outDir: testDir });

    // Check directories exist
    expect(existsSync(join(testDir, "adr"))).toBe(true);
    expect(existsSync(join(testDir, "catalog"))).toBe(true);
    expect(existsSync(join(testDir, "catalog/flows"))).toBe(true);
    expect(existsSync(join(testDir, "catalog/components"))).toBe(true);
    expect(existsSync(join(testDir, "schemas"))).toBe(true);

    // Directories should be reported
    expect(result.directories).toContain(testDir);
    expect(result.directories.length).toBeGreaterThanOrEqual(5);
  });

  it("creates all expected template files", () => {
    const result = catalogScaffold({ outDir: testDir });

    const expectedFiles = [
      "architecture.md",
      "domains.md",
      "glossary.md",
      "conventions.md",
      "platform.yaml",
      "registry.yaml",
    ];

    for (const file of expectedFiles) {
      const filePath = join(testDir, file);
      expect(existsSync(filePath), `Expected ${file} to exist`).toBe(true);
      expect(result.created).toContain(filePath);
    }
  });

  it("creates .gitkeep files in empty directories", () => {
    const result = catalogScaffold({ outDir: testDir });

    const gitkeepDirs = ["adr", "catalog", "catalog/flows", "catalog/components", "schemas"];
    for (const dir of gitkeepDirs) {
      const gitkeepPath = join(testDir, dir, ".gitkeep");
      expect(existsSync(gitkeepPath), `Expected .gitkeep in ${dir}`).toBe(true);
      expect(result.created).toContain(gitkeepPath);
    }
  });

  it("generated files have non-empty content", () => {
    catalogScaffold({ outDir: testDir });

    const content = readFileSync(join(testDir, "architecture.md"), "utf-8");
    expect(content).toContain("# Architecture");
    expect(content.length).toBeGreaterThan(20);

    const registry = readFileSync(join(testDir, "registry.yaml"), "utf-8");
    expect(registry).toContain("repos:");
    expect(registry).toContain("dt catalog build");

    const platform = readFileSync(join(testDir, "platform.yaml"), "utf-8");
    expect(platform).toContain("platform:");
  });

  it("does NOT overwrite existing files without --force", () => {
    // Create the dir and write a file first
    mkdirSync(testDir, { recursive: true });
    const existingPath = join(testDir, "architecture.md");
    writeFileSync(existingPath, "# My Custom Architecture\n", "utf-8");

    const result = catalogScaffold({ outDir: testDir, force: false });

    // File should be skipped
    expect(result.skipped).toContain(existingPath);
    expect(result.created).not.toContain(existingPath);

    // Content should be unchanged
    const content = readFileSync(existingPath, "utf-8");
    expect(content).toBe("# My Custom Architecture\n");
  });

  it("DOES overwrite existing files with --force", () => {
    // Create the dir and write a file first
    mkdirSync(testDir, { recursive: true });
    const existingPath = join(testDir, "architecture.md");
    writeFileSync(existingPath, "# My Custom Architecture\n", "utf-8");

    const result = catalogScaffold({ outDir: testDir, force: true });

    // File should be created (overwritten)
    expect(result.created).toContain(existingPath);
    expect(result.skipped).not.toContain(existingPath);

    // Content should be the template
    const content = readFileSync(existingPath, "utf-8");
    expect(content).toContain("# Architecture");
    expect(content).not.toContain("My Custom");
  });

  it("handles scaffold into non-existent nested directory", () => {
    const nestedDir = join(testDir, "deep", "nested", "path");
    const result = catalogScaffold({ outDir: nestedDir });

    expect(existsSync(nestedDir)).toBe(true);
    expect(result.created.length).toBeGreaterThan(0);
    expect(existsSync(join(nestedDir, "registry.yaml"))).toBe(true);
  });

  it("returns no skipped files on fresh scaffold", () => {
    const result = catalogScaffold({ outDir: testDir });
    expect(result.skipped).toHaveLength(0);
  });

  it("reports correct counts for partial existing directory", () => {
    // Pre-create some files
    mkdirSync(join(testDir, "adr"), { recursive: true });
    writeFileSync(join(testDir, "adr", ".gitkeep"), "");
    writeFileSync(join(testDir, "domains.md"), "existing");

    const result = catalogScaffold({ outDir: testDir, force: false });

    // These should be skipped
    expect(result.skipped).toContain(join(testDir, "adr", ".gitkeep"));
    expect(result.skipped).toContain(join(testDir, "domains.md"));

    // Other files should be created
    expect(result.created).toContain(join(testDir, "architecture.md"));
    expect(result.created).toContain(join(testDir, "registry.yaml"));
  });
});
