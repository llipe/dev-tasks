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
      const devTasksDir = join(repoRoot, ".dev-tasks");
      mkdirSync(devTasksDir, { recursive: true });
      writeFileSync(join(devTasksDir, "some-file.txt"), "legacy content");

      const result = detectLegacyInstall(repoRoot);
      expect(result.isLegacy).toBe(true);
      expect(result.reason).toContain("no manifest.json");
    });

    it("returns true when .dev-tasks-version file exists (legacy version marker)", () => {
      const repoRoot = setup();
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
        JSON.stringify({ version: "0.1.0", pinned: "0.1.0", files: [] }),
      );

      const result = detectLegacyInstall(repoRoot);
      expect(result.isLegacy).toBe(false);
    });

    it("returns false when no legacy indicators are present (no legacy install)", () => {
      const repoRoot = setup();

      const result = detectLegacyInstall(repoRoot);
      expect(result.isLegacy).toBe(false);
    });

    it("detects untracked install when managed directories have files but no .dev-tasks-version", () => {
      const repoRoot = setup();
      // Simulate a repo that had dev-tasks installed but lost its manifest
      mkdirSync(join(repoRoot, ".kiro", "agents"), { recursive: true });
      writeFileSync(join(repoRoot, ".kiro", "agents", "developer.md"), "# Developer agent");

      const result = detectLegacyInstall(repoRoot);
      expect(result.isLegacy).toBe(true);
      expect(result.reason).toContain("managed directory");
      expect(result.reason).toContain("without manifest");
    });

    it("returns false when managed directories exist but are empty", () => {
      const repoRoot = setup();
      mkdirSync(join(repoRoot, ".kiro", "agents"), { recursive: true });
      // Directory exists but has no files

      const result = detectLegacyInstall(repoRoot);
      expect(result.isLegacy).toBe(false);
    });

    it("detects legacy when skill files exist in known locations without manifest", () => {
      const repoRoot = setup();
      mkdirSync(join(repoRoot, ".github", "agents"), { recursive: true });
      writeFileSync(join(repoRoot, ".github", "agents", "developer.md"), "# Developer agent");
      writeFileSync(join(repoRoot, ".dev-tasks-version"), JSON.stringify({ version: "0.3.0" }));

      const result = detectLegacyInstall(repoRoot);
      expect(result.isLegacy).toBe(true);
    });
  });

  describe("generateMigrationManifest()", () => {
    it("generates manifest with all files marked as modified: unknown origin", async () => {
      const repoRoot = setup();
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
      expect(manifest.files).toHaveLength(2);

      // All entries should have origin_sha256 set to UNKNOWN_ORIGIN
      for (const entry of manifest.files) {
        expect(entry.origin_sha256).toBe(UNKNOWN_ORIGIN);
      }

      // sha256 should be the actual hash of the file content
      const expectedHash1 = hashContent(content1);
      const dev = manifest.files.find((f) => f.path === ".github/agents/developer.md");
      expect(dev?.sha256).toBe(expectedHash1);
      expect(dev?.profile).toBe("copilot");
    });

    it("sets origin_sha256 to UNKNOWN_ORIGIN sentinel value", async () => {
      const repoRoot = setup();
      mkdirSync(join(repoRoot, ".github", "agents"), { recursive: true });
      writeFileSync(join(repoRoot, ".github", "agents", "test.md"), "test content");

      const manifest = await generateMigrationManifest(repoRoot, [".github/agents/test.md"]);

      expect(manifest.files[0].origin_sha256).toBe(UNKNOWN_ORIGIN);
      const realHash = hashContent("test content");
      expect(UNKNOWN_ORIGIN).not.toBe(realHash);
    });

    it("infers profile from path prefix", async () => {
      const repoRoot = setup();
      mkdirSync(join(repoRoot, ".github", "agents"), { recursive: true });
      mkdirSync(join(repoRoot, ".claude", "commands"), { recursive: true });
      mkdirSync(join(repoRoot, ".kiro", "steering"), { recursive: true });
      writeFileSync(join(repoRoot, ".github", "agents", "dev.md"), "g");
      writeFileSync(join(repoRoot, ".claude", "commands", "refine.md"), "c");
      writeFileSync(join(repoRoot, ".kiro", "steering", "impl.md"), "k");

      const manifest = await generateMigrationManifest(repoRoot, [
        ".github/agents/dev.md",
        ".claude/commands/refine.md",
        ".kiro/steering/impl.md",
      ]);

      expect(manifest.files[0].profile).toBe("copilot");
      expect(manifest.files[1].profile).toBe("claude");
      expect(manifest.files[2].profile).toBe("kiro");
    });

    it("handles empty file list gracefully", async () => {
      const repoRoot = setup();

      const manifest = await generateMigrationManifest(repoRoot, []);

      expect(manifest.files).toHaveLength(0);
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
      expect(UNKNOWN_ORIGIN).toBe("unknown");
      expect(UNKNOWN_ORIGIN.length).not.toBe(64);
    });

    it("triggers conflict when used with reconcile engine", async () => {
      const { reconcile } = await import("#core/reconcile.js");
      const localHash = hashContent("any file content");
      const packageHash = hashContent("new package content");

      const action = reconcile(localHash, UNKNOWN_ORIGIN, packageHash);
      expect(action).toBe("conflict");
    });
  });
});
