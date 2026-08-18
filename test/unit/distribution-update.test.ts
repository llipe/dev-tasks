import { describe, it, expect, afterEach } from "vitest";
import { runUpdate } from "#core/distribution/update.js";
import { hashContent } from "#core/distribution/hash.js";
import type { Manifest } from "#core/distribution/manifest.js";
import {
  mkdtempSync,
  rmSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  chmodSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("core/distribution/update — runUpdate()", () => {
  let tmpDir: string;

  function setup(): string {
    tmpDir = mkdtempSync(join(tmpdir(), "dev-tasks-update-unit-"));
    return tmpDir;
  }

  afterEach(() => {
    if (tmpDir) {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  function writeManifest(repoRoot: string, manifest: Manifest): void {
    const dir = join(repoRoot, ".dev-tasks");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf-8");
  }

  function createFile(baseDir: string, relativePath: string, content: string): void {
    const fullPath = join(baseDir, relativePath);
    mkdirSync(join(fullPath, ".."), { recursive: true });
    writeFileSync(fullPath, content, "utf-8");
  }

  describe("four reconciliation branches", () => {
    it("install: copies file from package when file doesn't exist locally", async () => {
      const repoRoot = setup();
      const packageRoot = join(repoRoot, "__pkg__");

      const pkgContent = "# New agent from package";
      createFile(packageRoot, ".github/agents/new.agent.md", pkgContent);

      // Manifest references a file that doesn't exist locally
      writeManifest(repoRoot, {
        version: "0.1.0",
        pinned: "0.1.0",
        installed_at: "2024-01-01T00:00:00.000Z",
        files: [
          {
            path: ".github/agents/new.agent.md",
            profile: "copilot",
            sha256: hashContent("old content"),
            origin_sha256: hashContent("old content"),
          },
        ],
        extraction: {},
      });

      const result = await runUpdate({
        targetDir: repoRoot,
        sourceDir: packageRoot,
        force: false,
        version: "0.2.0",
      });

      expect(result.installed.length).toBe(1);
      expect(result.installed[0].path).toBe(".github/agents/new.agent.md");
      expect(result.installed[0].action).toBe("install");

      // File should exist locally now at the native path
      const installedPath = join(repoRoot, ".github/agents/new.agent.md");
      expect(existsSync(installedPath)).toBe(true);
      expect(readFileSync(installedPath, "utf-8")).toBe(pkgContent);
    });

    it("overwrite: updates file when user hasn't edited (local == origin, package differs)", async () => {
      const repoRoot = setup();
      const packageRoot = join(repoRoot, "__pkg__");

      const originalContent = "# Original";
      const newPkgContent = "# Updated v2";

      // Local file matches origin (not edited)
      createFile(repoRoot, ".claude/agents/developer.md", originalContent);
      createFile(packageRoot, ".claude/agents/developer.md", newPkgContent);

      writeManifest(repoRoot, {
        version: "0.1.0",
        pinned: "0.1.0",
        installed_at: "2024-01-01T00:00:00.000Z",
        files: [
          {
            path: ".claude/agents/developer.md",
            profile: "claude",
            sha256: hashContent(originalContent),
            origin_sha256: hashContent(originalContent),
          },
        ],
        extraction: {},
      });

      const result = await runUpdate({
        targetDir: repoRoot,
        sourceDir: packageRoot,
        force: false,
        version: "0.2.0",
      });

      expect(result.updated.length).toBe(1);
      expect(result.updated[0].action).toBe("overwrite");

      const localPath = join(repoRoot, ".claude/agents/developer.md");
      expect(readFileSync(localPath, "utf-8")).toBe(newPkgContent);
    });

    it("skip: no action when local hash equals package hash (already up to date)", async () => {
      const repoRoot = setup();
      const packageRoot = join(repoRoot, "__pkg__");

      const content = "# Same content in both";

      createFile(repoRoot, ".kiro/agents/developer.md", content);
      createFile(packageRoot, ".kiro/agents/developer.md", content);

      writeManifest(repoRoot, {
        version: "0.1.0",
        pinned: "0.1.0",
        installed_at: "2024-01-01T00:00:00.000Z",
        files: [
          {
            path: ".kiro/agents/developer.md",
            profile: "kiro",
            sha256: hashContent(content),
            origin_sha256: hashContent(content),
          },
        ],
        extraction: {},
      });

      const result = await runUpdate({
        targetDir: repoRoot,
        sourceDir: packageRoot,
        force: false,
        version: "0.2.0",
      });

      expect(result.skipped.length).toBe(1);
      expect(result.skipped[0].action).toBe("skip");
      expect(result.conflicts.length).toBe(0);
      expect(result.updated.length).toBe(0);
      expect(result.installed.length).toBe(0);
    });

    it("conflict: detects when user has edited and package has also changed", async () => {
      const repoRoot = setup();
      const packageRoot = join(repoRoot, "__pkg__");

      const originalContent = "# Original";
      const userEdited = "# User edited this";
      const newPkgContent = "# Updated from package";

      createFile(repoRoot, ".github/agents/developer.agent.md", userEdited);
      createFile(packageRoot, ".github/agents/developer.agent.md", newPkgContent);

      writeManifest(repoRoot, {
        version: "0.1.0",
        pinned: "0.1.0",
        installed_at: "2024-01-01T00:00:00.000Z",
        files: [
          {
            path: ".github/agents/developer.agent.md",
            profile: "copilot",
            sha256: hashContent(originalContent),
            origin_sha256: hashContent(originalContent),
          },
        ],
        extraction: {},
      });

      const result = await runUpdate({
        targetDir: repoRoot,
        sourceDir: packageRoot,
        force: false,
        version: "0.2.0",
      });

      expect(result.conflicts.length).toBe(1);
      expect(result.conflicts[0].action).toBe("conflict");
      expect(result.conflicts[0].path).toBe(".github/agents/developer.agent.md");

      // File should NOT be modified
      const localPath = join(repoRoot, ".github/agents/developer.agent.md");
      expect(readFileSync(localPath, "utf-8")).toBe(userEdited);
    });
  });

  describe("--force behavior", () => {
    it("backs up conflicting files and overwrites when force=true", async () => {
      const repoRoot = setup();
      const packageRoot = join(repoRoot, "__pkg__");

      const originalContent = "# Original";
      const userEdited = "# User edited this";
      const newPkgContent = "# Force-updated from package";

      createFile(repoRoot, ".github/agents/developer.agent.md", userEdited);
      createFile(packageRoot, ".github/agents/developer.agent.md", newPkgContent);

      writeManifest(repoRoot, {
        version: "0.1.0",
        pinned: "0.1.0",
        installed_at: "2024-01-01T00:00:00.000Z",
        files: [
          {
            path: ".github/agents/developer.agent.md",
            profile: "copilot",
            sha256: hashContent(originalContent),
            origin_sha256: hashContent(originalContent),
          },
        ],
        extraction: {},
      });

      const result = await runUpdate({
        targetDir: repoRoot,
        sourceDir: packageRoot,
        force: true,
        version: "0.2.0",
      });

      // Should be moved to updated (not conflicts) when force=true
      expect(result.conflicts.length).toBe(0);
      expect(result.updated.length).toBe(1);
      expect(result.backupDir).not.toBeNull();

      // File should be overwritten
      const localPath = join(repoRoot, ".github/agents/developer.agent.md");
      expect(readFileSync(localPath, "utf-8")).toBe(newPkgContent);

      // Backup should contain the user's version
      const backupFilePath = join(result.backupDir!, ".github/agents/developer.agent.md");
      expect(existsSync(backupFilePath)).toBe(true);
      expect(readFileSync(backupFilePath, "utf-8")).toBe(userEdited);
    });

    it("updates manifest with new hashes after force overwrite", async () => {
      const repoRoot = setup();
      const packageRoot = join(repoRoot, "__pkg__");

      const originalContent = "# Original";
      const userEdited = "# User edited";
      const newPkgContent = "# Updated from package";

      createFile(repoRoot, ".claude/commands/refine.md", userEdited);
      createFile(packageRoot, ".claude/commands/refine.md", newPkgContent);

      writeManifest(repoRoot, {
        version: "0.1.0",
        pinned: "0.1.0",
        installed_at: "2024-01-01T00:00:00.000Z",
        files: [
          {
            path: ".claude/commands/refine.md",
            profile: "claude",
            sha256: hashContent(originalContent),
            origin_sha256: hashContent(originalContent),
          },
        ],
        extraction: {},
      });

      await runUpdate({
        targetDir: repoRoot,
        sourceDir: packageRoot,
        force: true,
        version: "0.2.0",
      });

      // Check manifest is updated
      const manifest = JSON.parse(
        readFileSync(join(repoRoot, ".dev-tasks", "manifest.json"), "utf-8"),
      ) as Manifest;
      const entry = manifest.files.find((f) => f.path === ".claude/commands/refine.md");
      expect(entry).toBeDefined();
      expect(entry!.sha256).toBe(hashContent(newPkgContent));
      expect(entry!.origin_sha256).toBe(hashContent(newPkgContent));
      expect(manifest.version).toBe("0.2.0");
    });
  });

  describe("no manifest", () => {
    it("returns empty result when no manifest exists and no managed files present", async () => {
      const repoRoot = setup();
      const packageRoot = join(repoRoot, "__pkg__");

      const result = await runUpdate({
        targetDir: repoRoot,
        sourceDir: packageRoot,
        force: false,
        version: "0.1.0",
      });

      expect(result.conflicts.length).toBe(0);
      expect(result.updated.length).toBe(0);
      expect(result.installed.length).toBe(0);
      expect(result.skipped.length).toBe(0);
    });

    it("auto-migrates and discovers new files when managed files exist without manifest", async () => {
      const repoRoot = setup();
      const packageRoot = join(repoRoot, "__pkg__");

      // Consumer has existing files from a prior install but no manifest
      const existingContent = "# Developer agent";
      const newContent = "# QA Engineer agent";
      createFile(repoRoot, ".kiro/agents/developer.md", existingContent);

      // Package has the existing file plus a new one
      createFile(packageRoot, ".kiro/agents/developer.md", existingContent);
      createFile(packageRoot, ".kiro/agents/qa-engineer.md", newContent);

      const result = await runUpdate({
        targetDir: repoRoot,
        sourceDir: packageRoot,
        force: false,
        version: "0.9.0",
      });

      // Should have auto-migrated and discovered the new file
      // The existing file will be a conflict (origin unknown) but the new file should be discovered
      expect(result.installed.length + result.conflicts.length).toBeGreaterThan(0);

      // Manifest should now exist
      expect(existsSync(join(repoRoot, ".dev-tasks", "manifest.json"))).toBe(true);
    });
  });

  describe("package file missing", () => {
    it("skips entry when package source file doesn't exist (file removed from package)", async () => {
      const repoRoot = setup();
      const packageRoot = join(repoRoot, "__pkg__");

      const content = "# Local content";
      createFile(repoRoot, ".github/agents/removed.agent.md", content);
      // Don't create the package file — simulates removal from package

      writeManifest(repoRoot, {
        version: "0.1.0",
        pinned: "0.1.0",
        installed_at: "2024-01-01T00:00:00.000Z",
        files: [
          {
            path: ".github/agents/removed.agent.md",
            profile: "copilot",
            sha256: hashContent(content),
            origin_sha256: hashContent(content),
          },
        ],
        extraction: {},
      });

      const result = await runUpdate({
        targetDir: repoRoot,
        sourceDir: packageRoot,
        force: false,
        version: "0.2.0",
      });

      expect(result.skipped.length).toBe(1);
      expect(result.conflicts.length).toBe(0);
    });
  });

  describe("mixed scenario", () => {
    it("handles multiple files with different actions in one update", async () => {
      const repoRoot = setup();
      const packageRoot = join(repoRoot, "__pkg__");

      const origA = "# A original";
      const origB = "# B original";
      const origC = "# C original";
      const newPkgA = "# A updated";
      const newPkgB = "# B updated";
      const newPkgC = "# C same as local";

      // File A: unedited locally, package updated → overwrite
      createFile(repoRoot, ".github/agents/a.md", origA);
      createFile(packageRoot, ".github/agents/a.md", newPkgA);

      // File B: user edited, package updated → conflict
      createFile(repoRoot, ".claude/agents/b.md", "# B user edit");
      createFile(packageRoot, ".claude/agents/b.md", newPkgB);

      // File C: local matches package → skip
      createFile(repoRoot, ".kiro/agents/c.md", newPkgC);
      createFile(packageRoot, ".kiro/agents/c.md", newPkgC);

      writeManifest(repoRoot, {
        version: "0.1.0",
        pinned: "0.1.0",
        installed_at: "2024-01-01T00:00:00.000Z",
        files: [
          {
            path: ".github/agents/a.md",
            profile: "copilot",
            sha256: hashContent(origA),
            origin_sha256: hashContent(origA),
          },
          {
            path: ".claude/agents/b.md",
            profile: "claude",
            sha256: hashContent(origB),
            origin_sha256: hashContent(origB),
          },
          {
            path: ".kiro/agents/c.md",
            profile: "kiro",
            sha256: hashContent(origC),
            origin_sha256: hashContent(origC),
          },
        ],
        extraction: {},
      });

      const result = await runUpdate({
        targetDir: repoRoot,
        sourceDir: packageRoot,
        force: false,
        version: "0.2.0",
      });

      expect(result.updated.length).toBe(1);
      expect(result.updated[0].path).toBe(".github/agents/a.md");
      expect(result.conflicts.length).toBe(1);
      expect(result.conflicts[0].path).toBe(".claude/agents/b.md");
      expect(result.skipped.length).toBe(1);
      expect(result.skipped[0].path).toBe(".kiro/agents/c.md");
    });
  });

  describe("edge case: --force with unwritable backup dir", () => {
    it("throws error when backup directory cannot be created", async () => {
      const repoRoot = setup();
      const packageRoot = join(repoRoot, "__pkg__");

      const originalContent = "# Original";
      const userEdited = "# User edited";
      const newPkgContent = "# Package v2";

      createFile(repoRoot, ".github/agents/dev.md", userEdited);
      createFile(packageRoot, ".github/agents/dev.md", newPkgContent);

      writeManifest(repoRoot, {
        version: "0.1.0",
        pinned: "0.1.0",
        installed_at: "2024-01-01T00:00:00.000Z",
        files: [
          {
            path: ".github/agents/dev.md",
            profile: "copilot",
            sha256: hashContent(originalContent),
            origin_sha256: hashContent(originalContent),
          },
        ],
        extraction: {},
      });

      // Make .dev-tasks/backup unwritable
      const backupParent = join(repoRoot, ".dev-tasks", "backup");
      mkdirSync(backupParent, { recursive: true });
      chmodSync(backupParent, 0o444);

      try {
        await expect(
          runUpdate({
            targetDir: repoRoot,
            sourceDir: packageRoot,
            force: true,
            version: "0.2.0",
          }),
        ).rejects.toThrow();
      } finally {
        // Restore permissions for cleanup
        chmodSync(backupParent, 0o755);
      }
    });
  });

  describe("new file discovery", () => {
    it("installs new files added to the package that are not in the manifest", async () => {
      const repoRoot = setup();
      const packageRoot = join(repoRoot, "__pkg__");

      const existingContent = "# Existing agent";
      const newContent = "# New qa-engineer agent";

      // Consumer has one existing file tracked in their manifest
      createFile(repoRoot, ".kiro/agents/developer.md", existingContent);
      createFile(packageRoot, ".kiro/agents/developer.md", existingContent);
      // Package now also has qa-engineer.md (not in consumer's manifest)
      createFile(packageRoot, ".kiro/agents/qa-engineer.md", newContent);

      writeManifest(repoRoot, {
        version: "0.8.0",
        pinned: "0.8.0",
        installed_at: "2024-01-01T00:00:00.000Z",
        files: [
          {
            path: ".kiro/agents/developer.md",
            profile: "kiro",
            sha256: hashContent(existingContent),
            origin_sha256: hashContent(existingContent),
          },
        ],
        extraction: {},
      });

      const result = await runUpdate({
        targetDir: repoRoot,
        sourceDir: packageRoot,
        force: false,
        version: "0.9.0",
      });

      // qa-engineer.md should be discovered and installed
      expect(result.installed.length).toBe(1);
      expect(result.installed[0].path).toBe(".kiro/agents/qa-engineer.md");
      expect(result.installed[0].profile).toBe("kiro");
      expect(result.installed[0].action).toBe("install");

      // File should exist locally
      expect(existsSync(join(repoRoot, ".kiro/agents/qa-engineer.md"))).toBe(true);
      expect(readFileSync(join(repoRoot, ".kiro/agents/qa-engineer.md"), "utf-8")).toBe(newContent);

      // Manifest should now include the new file
      const manifest = JSON.parse(
        readFileSync(join(repoRoot, ".dev-tasks", "manifest.json"), "utf-8"),
      ) as Manifest;
      const newEntry = manifest.files.find((f) => f.path === ".kiro/agents/qa-engineer.md");
      expect(newEntry).toBeDefined();
      expect(newEntry!.profile).toBe("kiro");
      expect(newEntry!.sha256).toBe(hashContent(newContent));
      expect(newEntry!.origin_sha256).toBe(hashContent(newContent));
    });

    it("discovers new files across all installed profiles", async () => {
      const repoRoot = setup();
      const packageRoot = join(repoRoot, "__pkg__");

      const existingContent = "# Dev";
      const newGithub = "# New GH agent";
      const newClaude = "# New Claude agent";
      const newKiro = "# New Kiro agent";

      // Consumer has files from all three platforms
      createFile(repoRoot, ".github/agents/developer.agent.md", existingContent);
      createFile(repoRoot, ".claude/agents/developer.md", existingContent);
      createFile(repoRoot, ".kiro/agents/developer.md", existingContent);

      // Package has existing + new files
      createFile(packageRoot, ".github/agents/developer.agent.md", existingContent);
      createFile(packageRoot, ".claude/agents/developer.md", existingContent);
      createFile(packageRoot, ".kiro/agents/developer.md", existingContent);
      createFile(packageRoot, ".github/agents/qa-engineer.agent.md", newGithub);
      createFile(packageRoot, ".claude/agents/qa-engineer.md", newClaude);
      createFile(packageRoot, ".kiro/agents/qa-engineer.md", newKiro);

      writeManifest(repoRoot, {
        version: "0.8.0",
        pinned: "0.8.0",
        installed_at: "2024-01-01T00:00:00.000Z",
        files: [
          {
            path: ".github/agents/developer.agent.md",
            profile: "copilot",
            sha256: hashContent(existingContent),
            origin_sha256: hashContent(existingContent),
          },
          {
            path: ".claude/agents/developer.md",
            profile: "claude",
            sha256: hashContent(existingContent),
            origin_sha256: hashContent(existingContent),
          },
          {
            path: ".kiro/agents/developer.md",
            profile: "kiro",
            sha256: hashContent(existingContent),
            origin_sha256: hashContent(existingContent),
          },
        ],
        extraction: {},
      });

      const result = await runUpdate({
        targetDir: repoRoot,
        sourceDir: packageRoot,
        force: false,
        version: "0.9.0",
      });

      expect(result.installed.length).toBe(3);
      const installedPaths = result.installed.map((f) => f.path).sort();
      expect(installedPaths).toEqual([
        ".claude/agents/qa-engineer.md",
        ".github/agents/qa-engineer.agent.md",
        ".kiro/agents/qa-engineer.md",
      ]);

      // All three files should exist
      expect(existsSync(join(repoRoot, ".github/agents/qa-engineer.agent.md"))).toBe(true);
      expect(existsSync(join(repoRoot, ".claude/agents/qa-engineer.md"))).toBe(true);
      expect(existsSync(join(repoRoot, ".kiro/agents/qa-engineer.md"))).toBe(true);
    });

    it("discovers new files in recursive skill directories", async () => {
      const repoRoot = setup();
      const packageRoot = join(repoRoot, "__pkg__");

      const existingSkill = "# Git ops skill";
      const newSkill = "# New test-standards skill";

      createFile(repoRoot, ".kiro/skills/git-ops/SKILL.md", existingSkill);
      createFile(packageRoot, ".kiro/skills/git-ops/SKILL.md", existingSkill);
      createFile(packageRoot, ".kiro/skills/activity-test-standards/SKILL.md", newSkill);

      writeManifest(repoRoot, {
        version: "0.8.0",
        pinned: "0.8.0",
        installed_at: "2024-01-01T00:00:00.000Z",
        files: [
          {
            path: ".kiro/skills/git-ops/SKILL.md",
            profile: "kiro",
            sha256: hashContent(existingSkill),
            origin_sha256: hashContent(existingSkill),
          },
        ],
        extraction: {},
      });

      const result = await runUpdate({
        targetDir: repoRoot,
        sourceDir: packageRoot,
        force: false,
        version: "0.9.0",
      });

      expect(result.installed.length).toBe(1);
      expect(result.installed[0].path).toBe(".kiro/skills/activity-test-standards/SKILL.md");
      expect(existsSync(join(repoRoot, ".kiro/skills/activity-test-standards/SKILL.md"))).toBe(
        true,
      );
    });

    it("discovers new root files (e.g. TESTING.md) not yet in manifest", async () => {
      const repoRoot = setup();
      const packageRoot = join(repoRoot, "__pkg__");

      const existingContent = "# Dev";
      const testingContent = "# Testing Standard\n\n<!-- placeholder -->\n";

      createFile(repoRoot, ".kiro/agents/developer.md", existingContent);
      createFile(packageRoot, ".kiro/agents/developer.md", existingContent);
      createFile(packageRoot, "TESTING.md", testingContent);

      writeManifest(repoRoot, {
        version: "0.8.0",
        pinned: "0.8.0",
        installed_at: "2024-01-01T00:00:00.000Z",
        files: [
          {
            path: ".kiro/agents/developer.md",
            profile: "kiro",
            sha256: hashContent(existingContent),
            origin_sha256: hashContent(existingContent),
          },
        ],
        extraction: {},
      });

      const result = await runUpdate({
        targetDir: repoRoot,
        sourceDir: packageRoot,
        force: false,
        version: "0.9.0",
      });

      expect(result.installed.length).toBe(1);
      expect(result.installed[0].path).toBe("TESTING.md");
      expect(result.installed[0].profile).toBe("root");
      expect(existsSync(join(repoRoot, "TESTING.md"))).toBe(true);
      expect(readFileSync(join(repoRoot, "TESTING.md"), "utf-8")).toBe(testingContent);
    });

    it("does not re-discover files already tracked in the manifest", async () => {
      const repoRoot = setup();
      const packageRoot = join(repoRoot, "__pkg__");

      const content = "# Already tracked";

      createFile(repoRoot, ".kiro/agents/developer.md", content);
      createFile(repoRoot, ".kiro/agents/qa-engineer.md", content);
      createFile(packageRoot, ".kiro/agents/developer.md", content);
      createFile(packageRoot, ".kiro/agents/qa-engineer.md", content);

      writeManifest(repoRoot, {
        version: "0.9.0",
        pinned: "0.9.0",
        installed_at: "2024-01-01T00:00:00.000Z",
        files: [
          {
            path: ".kiro/agents/developer.md",
            profile: "kiro",
            sha256: hashContent(content),
            origin_sha256: hashContent(content),
          },
          {
            path: ".kiro/agents/qa-engineer.md",
            profile: "kiro",
            sha256: hashContent(content),
            origin_sha256: hashContent(content),
          },
        ],
        extraction: {},
      });

      const result = await runUpdate({
        targetDir: repoRoot,
        sourceDir: packageRoot,
        force: false,
        version: "0.9.0",
      });

      // Everything is already tracked and up to date — nothing to install
      expect(result.installed.length).toBe(0);
      expect(result.skipped.length).toBe(2);
    });

    it("does not scan platforms not present in the manifest", async () => {
      const repoRoot = setup();
      const packageRoot = join(repoRoot, "__pkg__");

      const existingContent = "# Dev";
      const newClaudeAgent = "# Claude agent not installed";

      // Consumer only has kiro installed
      createFile(repoRoot, ".kiro/agents/developer.md", existingContent);
      createFile(packageRoot, ".kiro/agents/developer.md", existingContent);
      // Package has claude agents too, but consumer never installed claude
      createFile(packageRoot, ".claude/agents/qa-engineer.md", newClaudeAgent);

      writeManifest(repoRoot, {
        version: "0.8.0",
        pinned: "0.8.0",
        installed_at: "2024-01-01T00:00:00.000Z",
        files: [
          {
            path: ".kiro/agents/developer.md",
            profile: "kiro",
            sha256: hashContent(existingContent),
            origin_sha256: hashContent(existingContent),
          },
        ],
        extraction: {},
      });

      const result = await runUpdate({
        targetDir: repoRoot,
        sourceDir: packageRoot,
        force: false,
        version: "0.9.0",
      });

      // Should NOT install claude agent since claude isn't in the manifest
      expect(result.installed.length).toBe(0);
      expect(existsSync(join(repoRoot, ".claude/agents/qa-engineer.md"))).toBe(false);
    });
  });
});
