import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runMigration, UNKNOWN_ORIGIN } from "#core/distribution/migrate.js";
import { reconcile } from "#core/reconcile.js";
import { hashContent } from "#core/distribution/hash.js";

describe("core/distribution/migrate — edge cases", () => {
  let tmpDir: string;

  function setup(): string {
    tmpDir = mkdtempSync(join(tmpdir(), "dev-tasks-migrate-edge-"));
    return tmpDir;
  }

  afterEach(() => {
    if (tmpDir) {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  describe("no legacy install present (noop)", () => {
    it("returns success with manifestWritten=false when repo has no legacy indicators", async () => {
      const repoRoot = setup();
      // Completely empty directory

      const result = await runMigration(repoRoot);

      expect(result.success).toBe(true);
      expect(result.manifestWritten).toBe(false);
      expect(result.reason).toContain("not a legacy install");
      expect(result.filesDiscovered).toBe(0);
    });

    it("does not create .dev-tasks/ directory when no legacy install", async () => {
      const repoRoot = setup();

      await runMigration(repoRoot);

      expect(existsSync(join(repoRoot, ".dev-tasks"))).toBe(false);
    });

    it("returns noop when only unrelated files exist in the repo", async () => {
      const repoRoot = setup();
      // Some unrelated project files
      writeFileSync(join(repoRoot, "package.json"), "{}");
      writeFileSync(join(repoRoot, "README.md"), "# My Project");
      mkdirSync(join(repoRoot, "src"), { recursive: true });
      writeFileSync(join(repoRoot, "src", "index.ts"), "export {};");

      const result = await runMigration(repoRoot);

      expect(result.success).toBe(true);
      expect(result.manifestWritten).toBe(false);
    });
  });

  describe("partial legacy install", () => {
    it("handles .dev-tasks-version without any skill files", async () => {
      const repoRoot = setup();
      writeFileSync(join(repoRoot, ".dev-tasks-version"), JSON.stringify({ version: "0.2.0" }));

      const result = await runMigration(repoRoot);

      expect(result.success).toBe(true);
      expect(result.manifestWritten).toBe(true);
      // Manifest should have zero skills (no files found in known locations)
      expect(result.filesDiscovered).toBe(0);
    });

    it("handles .dev-tasks/ directory with non-manifest files", async () => {
      const repoRoot = setup();
      const devTasksDir = join(repoRoot, ".dev-tasks");
      mkdirSync(devTasksDir, { recursive: true });
      writeFileSync(join(devTasksDir, "config.json"), '{"some": "config"}');
      writeFileSync(join(devTasksDir, "notes.txt"), "some notes");

      const result = await runMigration(repoRoot);

      expect(result.success).toBe(true);
      expect(result.manifestWritten).toBe(true);
    });

    it("discovers only files in directories that actually exist", async () => {
      const repoRoot = setup();
      writeFileSync(join(repoRoot, ".dev-tasks-version"), JSON.stringify({ version: "0.3.0" }));
      // Only one legacy directory exists
      mkdirSync(join(repoRoot, ".github", "agents"), { recursive: true });
      writeFileSync(join(repoRoot, ".github", "agents", "dev.md"), "content");
      // .claude/ and .kiro/ directories do NOT exist

      const result = await runMigration(repoRoot);

      expect(result.success).toBe(true);
      expect(result.manifestWritten).toBe(true);
      expect(result.filesDiscovered).toBe(1);
    });
  });

  describe("reconcile integration with UNKNOWN_ORIGIN", () => {
    it("always produces conflict when local file differs from package", () => {
      const localHash = hashContent("user's customized content");
      const packageHash = hashContent("new package version content");

      const action = reconcile(localHash, UNKNOWN_ORIGIN, packageHash);
      expect(action).toBe("conflict");
    });

    it("produces skip when local file happens to match package content", () => {
      // Edge case: if user's file is coincidentally identical to the new package
      const content = "same content in both local and package";
      const localHash = hashContent(content);
      const packageHash = hashContent(content);

      const action = reconcile(localHash, UNKNOWN_ORIGIN, packageHash);
      // Skip because local == package (already up to date)
      expect(action).toBe("skip");
    });

    it("handles null local hash (file deleted) as install action", () => {
      const packageHash = hashContent("package content");

      const action = reconcile(null, UNKNOWN_ORIGIN, packageHash);
      expect(action).toBe("install");
    });
  });

  describe("idempotency", () => {
    it("running migration twice does not overwrite the first manifest", async () => {
      const repoRoot = setup();
      writeFileSync(join(repoRoot, ".dev-tasks-version"), JSON.stringify({ version: "0.4.0" }));
      mkdirSync(join(repoRoot, ".github", "agents"), { recursive: true });
      writeFileSync(join(repoRoot, ".github", "agents", "dev.md"), "content");

      // First migration
      const result1 = await runMigration(repoRoot);
      expect(result1.manifestWritten).toBe(true);

      // Second migration — should be a noop because manifest now exists
      const result2 = await runMigration(repoRoot);
      expect(result2.manifestWritten).toBe(false);
      expect(result2.reason).toContain("manifest already exists");
    });
  });

  describe("files with special content", () => {
    it("handles binary-like content in text files", async () => {
      const repoRoot = setup();
      writeFileSync(join(repoRoot, ".dev-tasks-version"), JSON.stringify({ version: "0.4.0" }));
      mkdirSync(join(repoRoot, ".github", "agents"), { recursive: true });
      // File with unusual characters
      writeFileSync(
        join(repoRoot, ".github", "agents", "special.md"),
        "# Agent\n\nContains: émojis 🎉 and ñ chars\n",
      );

      const result = await runMigration(repoRoot);

      expect(result.success).toBe(true);
      expect(result.filesDiscovered).toBe(1);
    });

    it("handles empty files", async () => {
      const repoRoot = setup();
      writeFileSync(join(repoRoot, ".dev-tasks-version"), JSON.stringify({ version: "0.4.0" }));
      mkdirSync(join(repoRoot, ".github", "agents"), { recursive: true });
      writeFileSync(join(repoRoot, ".github", "agents", "empty.md"), "");

      const result = await runMigration(repoRoot);

      expect(result.success).toBe(true);
      expect(result.filesDiscovered).toBe(1);
    });
  });
});
