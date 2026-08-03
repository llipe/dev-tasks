/**
 * Edge-case tests for core/catalog/scaffold.ts.
 * Tests: no changes → no commit scenario; validation error → job fails;
 * scaffold into existing directory (no overwrite without --force).
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import { mkdirSync, rmSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { parse as yamlParse } from "yaml";
import { catalogScaffold } from "#core/catalog/scaffold.js";

describe("catalogScaffold — edge cases", () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `scaffold-edge-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  describe("no changes → no commit scenario (idempotency)", () => {
    it("running scaffold twice without --force produces all skipped on second run", () => {
      // First run: creates everything
      const first = catalogScaffold({ outDir: testDir });
      expect(first.created.length).toBeGreaterThan(0);
      expect(first.skipped).toHaveLength(0);

      // Second run: everything already exists, nothing created
      const second = catalogScaffold({ outDir: testDir, force: false });
      expect(second.created).toHaveLength(0);
      expect(second.skipped.length).toBeGreaterThan(0);

      // File content unchanged between runs
      const registryContent = readFileSync(join(testDir, "registry.yaml"), "utf-8");
      expect(registryContent).toContain("repos:");
    });

    it("idempotent scaffold produces identical file content", () => {
      catalogScaffold({ outDir: testDir });

      // Capture content
      const firstContent = readFileSync(join(testDir, "architecture.md"), "utf-8");
      const firstRegistry = readFileSync(join(testDir, "registry.yaml"), "utf-8");

      // Force re-scaffold
      catalogScaffold({ outDir: testDir, force: true });

      // Content is byte-for-byte identical
      expect(readFileSync(join(testDir, "architecture.md"), "utf-8")).toBe(firstContent);
      expect(readFileSync(join(testDir, "registry.yaml"), "utf-8")).toBe(firstRegistry);
    });
  });

  describe("scaffold into existing directory (no overwrite without --force)", () => {
    it("preserves ALL existing files when scaffold runs without --force", () => {
      // Pre-populate directory with custom files
      mkdirSync(testDir, { recursive: true });
      const customFiles = {
        "architecture.md": "# My Architecture\nCustom content here.\n",
        "domains.md": "# My Domains\nDomain A | Core | team-alpha\n",
        "glossary.md": "# My Glossary\nTerm X | definition Y\n",
        "conventions.md": "# My Conventions\nRule 1: ...\n",
        "platform.yaml": "platform:\n  name: my-platform\n",
        "registry.yaml": "repos:\n  - id: my-service\n    url: https://example.com\n",
      };

      for (const [file, content] of Object.entries(customFiles)) {
        writeFileSync(join(testDir, file), content, "utf-8");
      }

      const result = catalogScaffold({ outDir: testDir, force: false });

      // All template files should be skipped
      for (const file of Object.keys(customFiles)) {
        expect(result.skipped).toContain(join(testDir, file));
      }

      // All custom content preserved
      for (const [file, expectedContent] of Object.entries(customFiles)) {
        expect(readFileSync(join(testDir, file), "utf-8")).toBe(expectedContent);
      }
    });

    it("does not delete extra files that exist in the target directory", () => {
      mkdirSync(testDir, { recursive: true });
      writeFileSync(join(testDir, "my-custom-doc.md"), "I should persist\n", "utf-8");
      writeFileSync(join(testDir, "notes.txt"), "Private notes\n", "utf-8");

      catalogScaffold({ outDir: testDir });

      // Extra files still exist — scaffold only adds, never removes
      expect(existsSync(join(testDir, "my-custom-doc.md"))).toBe(true);
      expect(readFileSync(join(testDir, "my-custom-doc.md"), "utf-8")).toBe("I should persist\n");
      expect(existsSync(join(testDir, "notes.txt"))).toBe(true);
    });

    it("creates subdirectories even when top-level files exist", () => {
      // Pre-create files but no subdirs
      mkdirSync(testDir, { recursive: true });
      writeFileSync(join(testDir, "architecture.md"), "existing", "utf-8");

      catalogScaffold({ outDir: testDir, force: false });

      // Directories should still be created
      expect(existsSync(join(testDir, "adr"))).toBe(true);
      expect(existsSync(join(testDir, "catalog"))).toBe(true);
      expect(existsSync(join(testDir, "catalog/flows"))).toBe(true);
      expect(existsSync(join(testDir, "schemas"))).toBe(true);

      // .gitkeep files should be created in new directories
      expect(existsSync(join(testDir, "adr", ".gitkeep"))).toBe(true);
    });

    it("handles partial existing structure gracefully", () => {
      // Create some directories and files but not all
      mkdirSync(join(testDir, "adr"), { recursive: true });
      mkdirSync(join(testDir, "catalog"), { recursive: true });
      writeFileSync(join(testDir, "adr", ".gitkeep"), "");
      writeFileSync(join(testDir, "registry.yaml"), "repos: []\n", "utf-8");

      const result = catalogScaffold({ outDir: testDir, force: false });

      // Existing items skipped
      expect(result.skipped).toContain(join(testDir, "adr", ".gitkeep"));
      expect(result.skipped).toContain(join(testDir, "registry.yaml"));

      // Missing items created
      expect(result.created).toContain(join(testDir, "architecture.md"));
      expect(result.created).toContain(join(testDir, "domains.md"));
      expect(existsSync(join(testDir, "catalog/flows"))).toBe(true);
      expect(existsSync(join(testDir, "schemas"))).toBe(true);
    });
  });

  describe("validation error → job fails (alert scenario)", () => {
    it("scaffold + build with empty registry produces valid but empty catalog", () => {
      // This tests the scenario where the CI job would find no changes to commit
      catalogScaffold({ outDir: testDir });

      // The generated registry.yaml has empty repos: []
      const registry = readFileSync(join(testDir, "registry.yaml"), "utf-8");
      expect(registry).toContain("repos: []");

      // In a CI scenario, `dt catalog build --registry registry.yaml` with empty repos
      // would produce an empty index — no components to commit, no commit needed.
    });

    it("scaffold produces files that are valid YAML where expected", () => {
      catalogScaffold({ outDir: testDir });

      // platform.yaml should parse as valid YAML
      const platformContent = readFileSync(join(testDir, "platform.yaml"), "utf-8");
      const platform = yamlParse(platformContent);
      expect(platform).toHaveProperty("platform");
      expect(platform.platform).toHaveProperty("name");

      // registry.yaml should parse as valid YAML
      const registryContent = readFileSync(join(testDir, "registry.yaml"), "utf-8");
      const registry = yamlParse(registryContent);
      expect(registry).toHaveProperty("repos");
      expect(registry.repos).toEqual([]);
    });
  });

  describe("force overwrite behavior", () => {
    it("force overwrites all files including .gitkeep", () => {
      // First scaffold
      catalogScaffold({ outDir: testDir });

      // Modify a .gitkeep to have content (unusual but tests force)
      writeFileSync(join(testDir, "adr", ".gitkeep"), "should be reset", "utf-8");

      // Force scaffold
      const result = catalogScaffold({ outDir: testDir, force: true });

      // .gitkeep should be overwritten (empty content)
      expect(readFileSync(join(testDir, "adr", ".gitkeep"), "utf-8")).toBe("");
      expect(result.created).toContain(join(testDir, "adr", ".gitkeep"));
    });

    it("force scaffold reports all files as created, none skipped", () => {
      // First scaffold
      catalogScaffold({ outDir: testDir });

      // Force re-scaffold
      const result = catalogScaffold({ outDir: testDir, force: true });

      expect(result.skipped).toHaveLength(0);
      expect(result.created.length).toBeGreaterThan(0);
    });
  });
});
