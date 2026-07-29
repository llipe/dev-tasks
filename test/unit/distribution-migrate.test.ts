import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  detectLegacyInstall,
  generateMigrationManifest,
  UNKNOWN_ORIGIN,
} from "#core/distribution/migrate.js";
import { hashContent } from "#core/distribution/hash.js";

describe("core/distribution/migrate — legacy detection", () => {
  let tmpDir: string;

  function setup(): string {
    tmpDir = mkdtempSync(join(tmpdir(), "dev-tasks-migrate-unit-"));
    return tmpDir;
  }

  afterEach(() => {
    if (tmpDir) {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  describe("detectLegacyInstall()", () => {
    it("returns true when .dev-tasks/ directory exists but no manifest.json", () => {
      const repoRoot = setup();
      // Create .dev-tasks dir with some files but no manifest.json
      const devTasksDir = join(repoRoot, ".dev-tasks");
      mkdirSync(devTasksDir, { recursive: true });
      writeFileSync(join(devTasksDir, "some-file.txt"), "legacy content");

      const result = detectLegacyInstall(repoRoot);
      expect(result.isLegacy).toBe(true);
      expect(result.reason).toContain("no manifest.json");
    });

    it("returns true when .dev-tasks-version file exists (legacy version marker)", () => {
      const repoRoot = setup();
      // Legacy version file
      writeFileSync(
        join(repoRoot, ".dev-tasks-version"),
        JSON.stringify({ version: "0.4.0", installed_at: "2024-01-01T00:00:00Z" }),
      );

      const result = detectLegacyInstall(repoRoot);
      expect(result.isLegacy).toBe(true);
      expect(result.reason).toContain(".dev-tasks-version");
    });

    it("returns false when .dev-tasks/manifest.json exists (already migrated)", () => {
      const repoRoot = setup();
      const devTasksDir = join(repoRoot, ".dev-tasks");
      mkdirSync(devTasksDir, { recursive: true });
      writeFileSync(
        join(devTasksDir, "manifest.json"),
        JSON.stringify({ version: "0.1.0", pinned: "0.1.0", skills: [] }),
      );

      const result = detectLegacyInstall(repoRoot);
      expect(result.isLegacy).toBe(false);
    });

    it("returns false when no legacy indicators are present (no legacy install)", () => {
      const repoRoot = setup();
      // Empty directory — no legacy install

      const result = detectLegacyInstall(repoRoot);
      expect(result.isLegacy).toBe(false);
    });

    it("detects legacy when skill files exist in known locations without manifest", () => {
      const repoRoot = setup();
      // Simulate legacy skill files in known locations (e.g., .github/agents/)
      mkdirSync(join(repoRoot, ".github", "agents"), { recursive: true });
      writeFileSync(join(repoRoot, ".github", "agents", "developer.md"), "# Developer agent");
      // Also has .dev-tasks-version
      writeFileSync(join(repoRoot, ".dev-tasks-version"), JSON.stringify({ version: "0.3.0" }));

      const result = detectLegacyInstall(repoRoot);
      expect(result.isLegacy).toBe(true);
    });
  });

  describe("generateMigrationManifest()", () => {
    it("generates manifest with all files marked as modified: unknown origin", async () => {
      const repoRoot = setup();
      // Simulate legacy installed skill files
      const skillsDir = join(repoRoot, ".github", "agents");
      mkdirSync(skillsDir, { recursive: true });
      const content1 = "# Developer agent content";
      const content2 = "# Housekeeping agent content";
      writeFileSync(join(skillsDir, "developer.md"), content1);
      writeFileSync(join(skillsDir, "housekeeping.md"), content2);

      const manifest = await generateMigrationManifest(repoRoot, [
        ".github/agents/developer.md",
        ".github/agents/housekeeping.md",
      ]);

      expect(manifest.version).toBe("migrated");
      expect(manifest.pinned).toBe("latest");
      expect(manifest.skills).toHaveLength(2);

      // All entries should have origin_sha256 set to UNKNOWN_ORIGIN
      for (const entry of manifest.skills) {
        expect(entry.origin_sha256).toBe(UNKNOWN_ORIGIN);
      }

      // sha256 should be the actual hash of the file content
      const expectedHash1 = hashContent(content1);
      const dev = manifest.skills.find((s) => s.path === ".github/agents/developer.md");
      expect(dev?.sha256).toBe(expectedHash1);
    });

    it("sets origin_sha256 to UNKNOWN_ORIGIN sentinel value", async () => {
      const repoRoot = setup();
      mkdirSync(join(repoRoot, ".github", "agents"), { recursive: true });
      writeFileSync(join(repoRoot, ".github", "agents", "test.md"), "test content");

      const manifest = await generateMigrationManifest(repoRoot, [".github/agents/test.md"]);

      expect(manifest.skills[0].origin_sha256).toBe(UNKNOWN_ORIGIN);
      // The UNKNOWN_ORIGIN should never match any real hash
      const realHash = hashContent("test content");
      expect(UNKNOWN_ORIGIN).not.toBe(realHash);
    });

    it("derives skill name from the first path segment", async () => {
      const repoRoot = setup();
      mkdirSync(join(repoRoot, ".github", "agents"), { recursive: true });
      writeFileSync(join(repoRoot, ".github", "agents", "dev.md"), "content");

      const manifest = await generateMigrationManifest(repoRoot, [".github/agents/dev.md"]);

      expect(manifest.skills[0].name).toBe(".github");
    });

    it("handles empty file list gracefully", async () => {
      const repoRoot = setup();

      const manifest = await generateMigrationManifest(repoRoot, []);

      expect(manifest.skills).toHaveLength(0);
      expect(manifest.version).toBe("migrated");
    });

    it("records installed_at timestamp", async () => {
      const repoRoot = setup();
      mkdirSync(join(repoRoot, ".github", "agents"), { recursive: true });
      writeFileSync(join(repoRoot, ".github", "agents", "test.md"), "content");

      const before = new Date().toISOString();
      const manifest = await generateMigrationManifest(repoRoot, [".github/agents/test.md"]);
      const after = new Date().toISOString();

      expect(manifest.installed_at).toBeDefined();
      expect(manifest.installed_at >= before).toBe(true);
      expect(manifest.installed_at <= after).toBe(true);
    });
  });

  describe("UNKNOWN_ORIGIN sentinel", () => {
    it("is a string that cannot be a valid SHA-256 hash", () => {
      // SHA-256 hashes are 64 hex characters
      expect(UNKNOWN_ORIGIN).toBe("unknown");
      expect(UNKNOWN_ORIGIN.length).not.toBe(64);
    });

    it("triggers conflict when used with reconcile engine", async () => {
      // This verifies the integration point: unknown origin always conflicts
      const { reconcile } = await import("#core/reconcile.js");
      const localHash = hashContent("any file content");
      const packageHash = hashContent("new package content");

      // With UNKNOWN_ORIGIN as origin, local != origin and local != package → conflict
      const action = reconcile(localHash, UNKNOWN_ORIGIN, packageHash);
      expect(action).toBe("conflict");
    });
  });
});
