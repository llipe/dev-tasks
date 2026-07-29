import { describe, it, expect, afterEach } from "vitest";
import { createBackupDir, backupFile } from "#core/distribution/backup.js";
import { mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("core/distribution/backup", () => {
  let tmpDir: string;

  function setup(): string {
    tmpDir = mkdtempSync(join(tmpdir(), "dev-tasks-backup-test-"));
    return tmpDir;
  }

  afterEach(() => {
    if (tmpDir) {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  describe("createBackupDir", () => {
    it("creates a timestamped directory under .dev-tasks/backup/", async () => {
      const repoRoot = setup();
      const backupDir = await createBackupDir(repoRoot);
      expect(existsSync(backupDir)).toBe(true);
      expect(backupDir).toMatch(/\.dev-tasks\/backup\/\d{4}-\d{2}-\d{2}T/);
    });

    it("returns a path containing ISO timestamp format", async () => {
      const repoRoot = setup();
      const backupDir = await createBackupDir(repoRoot);
      // Extract the timestamp portion
      const parts = backupDir.split("/backup/");
      expect(parts.length).toBe(2);
      // Should be parseable as a date (ISO-like format safe for filesystem)
      const ts = parts[1];
      expect(ts).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}[-_:]\d{2}[-_:]\d{2}/);
    });

    it("creates parent directories if they don't exist", async () => {
      const repoRoot = setup();
      // .dev-tasks doesn't exist yet
      expect(existsSync(join(repoRoot, ".dev-tasks", "backup"))).toBe(false);
      const backupDir = await createBackupDir(repoRoot);
      expect(existsSync(backupDir)).toBe(true);
    });
  });

  describe("backupFile", () => {
    it("copies a file to the backup directory preserving relative path", async () => {
      const repoRoot = setup();
      const backupDir = await createBackupDir(repoRoot);

      // Create a source file
      const skillDir = join(repoRoot, ".dev-tasks", "skills", "my-skill");
      mkdirSync(skillDir, { recursive: true });
      const sourceFile = join(skillDir, "SKILL.md");
      writeFileSync(sourceFile, "# Original content", "utf-8");

      const relativePath = "my-skill/SKILL.md";
      const result = await backupFile(backupDir, sourceFile, relativePath);

      expect(result.success).toBe(true);
      const backupFilePath = join(backupDir, relativePath);
      expect(existsSync(backupFilePath)).toBe(true);
      expect(readFileSync(backupFilePath, "utf-8")).toBe("# Original content");
    });

    it("creates subdirectories in backup dir if needed", async () => {
      const repoRoot = setup();
      const backupDir = await createBackupDir(repoRoot);

      const skillDir = join(repoRoot, ".dev-tasks", "skills", "nested", "deep");
      mkdirSync(skillDir, { recursive: true });
      const sourceFile = join(skillDir, "file.md");
      writeFileSync(sourceFile, "nested content", "utf-8");

      const relativePath = "nested/deep/file.md";
      const result = await backupFile(backupDir, sourceFile, relativePath);

      expect(result.success).toBe(true);
      expect(existsSync(join(backupDir, relativePath))).toBe(true);
    });

    it("returns failure result when source file does not exist", async () => {
      const repoRoot = setup();
      const backupDir = await createBackupDir(repoRoot);

      const result = await backupFile(
        backupDir,
        join(repoRoot, "nonexistent.md"),
        "nonexistent.md",
      );
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
