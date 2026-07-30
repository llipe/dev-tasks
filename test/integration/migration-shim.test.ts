import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { execSync } from "node:child_process";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import type { Manifest } from "#core/distribution/manifest.js";

const ROOT = resolve(import.meta.dirname, "../..");
const DIST_BIN = resolve(ROOT, "dist/bin/dev-tasks.js");

describe("Migration shim (integration)", () => {
  let tmpDir: string;

  beforeAll(() => {
    if (!existsSync(DIST_BIN)) {
      execSync("pnpm run build", { cwd: ROOT, encoding: "utf-8" });
    }
  });

  afterEach(() => {
    if (tmpDir) {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  function setupLegacyRepo(): string {
    tmpDir = mkdtempSync(join(tmpdir(), "dev-tasks-migrate-intg-"));

    // Simulate a legacy install: .dev-tasks-version + skill files in known locations
    writeFileSync(
      join(tmpDir, ".dev-tasks-version"),
      JSON.stringify({
        version: "0.4.0",
        installed_at: "2024-06-01T00:00:00Z",
        script_version: "1.0.0",
      }),
    );

    // Simulate legacy skill files at native platform paths
    mkdirSync(join(tmpDir, ".github", "agents"), { recursive: true });
    writeFileSync(join(tmpDir, ".github", "agents", "developer.md"), "# Legacy developer agent");
    writeFileSync(join(tmpDir, ".github", "agents", "housekeeping.md"), "# Legacy housekeeping");

    mkdirSync(join(tmpDir, ".claude", "agents"), { recursive: true });
    writeFileSync(join(tmpDir, ".claude", "agents", "developer.md"), "# Claude developer");

    return tmpDir;
  }

  describe("simulate legacy install → run migrate → manifest written", () => {
    it("generates manifest from legacy state with all files marked unknown", async () => {
      const repoRoot = setupLegacyRepo();

      const { detectLegacyInstall, runMigration } = await import("#core/distribution/migrate.js");

      const detection = detectLegacyInstall(repoRoot);
      expect(detection.isLegacy).toBe(true);

      const result = await runMigration(repoRoot);
      expect(result.success).toBe(true);
      expect(result.manifestWritten).toBe(true);

      // Verify manifest was written
      const manifestPath = join(repoRoot, ".dev-tasks", "manifest.json");
      expect(existsSync(manifestPath)).toBe(true);

      const manifest: Manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
      expect(manifest.version).toBe("migrated");
      expect(manifest.files.length).toBeGreaterThan(0);

      // All origin_sha256 should be "unknown"
      for (const entry of manifest.files) {
        expect(entry.origin_sha256).toBe("unknown");
      }

      // Profile inference should work
      const ghFile = manifest.files.find((f) => f.path.startsWith(".github/"));
      expect(ghFile?.profile).toBe("copilot");
      const claudeFile = manifest.files.find((f) => f.path.startsWith(".claude/"));
      expect(claudeFile?.profile).toBe("claude");
    });

    it("first update after migration reports conflicts for all pre-existing files", async () => {
      const repoRoot = setupLegacyRepo();

      const { runMigration } = await import("#core/distribution/migrate.js");
      await runMigration(repoRoot);

      const manifestPath = join(repoRoot, ".dev-tasks", "manifest.json");
      const manifest: Manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
      expect(manifest.files.length).toBeGreaterThan(0);

      // Now run update against a "package source" with different content
      const { runUpdate } = await import("#core/distribution/update.js");

      // Create a fake package source matching the manifest paths
      const packageRoot = join(tmpDir, "__pkg__");
      for (const entry of manifest.files) {
        const pkgPath = join(packageRoot, entry.path);
        mkdirSync(join(pkgPath, ".."), { recursive: true });
        writeFileSync(pkgPath, "# Updated content v2 — different from legacy");
      }

      // The update should report conflicts because origin_sha256 is "unknown"
      const result = await runUpdate({
        targetDir: repoRoot,
        sourceDir: packageRoot,
        force: false,
        version: "0.2.0",
      });

      // All files with "unknown" origin should produce conflicts
      expect(result.conflicts.length).toBeGreaterThan(0);

      for (const conflict of result.conflicts) {
        expect(conflict.action).toBe("conflict");
        expect(conflict.originHash).toBe("unknown");
      }
    });
  });

  describe("edge cases", () => {
    it("no legacy install present — migration is a noop", async () => {
      tmpDir = mkdtempSync(join(tmpdir(), "dev-tasks-migrate-intg-"));

      const { detectLegacyInstall, runMigration } = await import("#core/distribution/migrate.js");

      const detection = detectLegacyInstall(tmpDir);
      expect(detection.isLegacy).toBe(false);

      const result = await runMigration(tmpDir);
      expect(result.success).toBe(true);
      expect(result.manifestWritten).toBe(false);
      expect(result.reason).toContain("not a legacy install");
    });

    it("partial legacy install — handles missing directories gracefully", async () => {
      tmpDir = mkdtempSync(join(tmpdir(), "dev-tasks-migrate-intg-"));

      // Only .dev-tasks-version, no skill files
      writeFileSync(join(tmpDir, ".dev-tasks-version"), JSON.stringify({ version: "0.3.0" }));

      const { runMigration } = await import("#core/distribution/migrate.js");
      const result = await runMigration(tmpDir);

      expect(result.success).toBe(true);
      expect(result.manifestWritten).toBe(true);

      const manifestPath = join(tmpDir, ".dev-tasks", "manifest.json");
      expect(existsSync(manifestPath)).toBe(true);

      const manifest: Manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
      expect(manifest.files).toBeDefined();
    });

    it("already migrated — returns early without overwriting manifest", async () => {
      tmpDir = mkdtempSync(join(tmpdir(), "dev-tasks-migrate-intg-"));

      const devTasksDir = join(tmpDir, ".dev-tasks");
      mkdirSync(devTasksDir, { recursive: true });
      const existingManifest = {
        version: "0.1.0",
        pinned: "0.1.0",
        installed_at: "2024-01-01T00:00:00Z",
        files: [{ path: "test/file.md", profile: "copilot", sha256: "abc", origin_sha256: "abc" }],
        extraction: {},
      };
      writeFileSync(join(devTasksDir, "manifest.json"), JSON.stringify(existingManifest));

      const { runMigration } = await import("#core/distribution/migrate.js");
      const result = await runMigration(tmpDir);

      expect(result.success).toBe(true);
      expect(result.manifestWritten).toBe(false);

      // Original manifest should be untouched
      const manifest = JSON.parse(readFileSync(join(devTasksDir, "manifest.json"), "utf-8"));
      expect(manifest.version).toBe("0.1.0");
    });
  });
});
