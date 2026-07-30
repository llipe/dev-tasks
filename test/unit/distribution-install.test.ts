import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { installFiles } from "#core/distribution/install.js";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import type { Manifest } from "#core/distribution/manifest.js";

describe("core/distribution/install — installFiles()", () => {
  let tmpDir: string;
  let targetDir: string;
  let sourceDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "dev-tasks-install-test-"));
    targetDir = join(tmpDir, "target-repo");
    sourceDir = join(tmpDir, "package-source");
    mkdirSync(targetDir, { recursive: true });
    mkdirSync(sourceDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  function createFile(basePath: string, relPath: string, content: string): void {
    const fullPath = join(basePath, relPath);
    mkdirSync(join(fullPath, ".."), { recursive: true });
    writeFileSync(fullPath, content, "utf-8");
  }

  function sha256(content: string): string {
    return createHash("sha256").update(content).digest("hex");
  }

  describe("profile: copilot", () => {
    it("copies agent files from .github/agents/ to target repo", async () => {
      createFile(sourceDir, ".github/agents/developer.agent.md", "# Developer Agent");
      const result = await installFiles({
        sourceDir,
        targetDir,
        version: "0.1.0",
        pin: "0.1.0",
        profile: "copilot",
      });

      const installedPath = join(targetDir, ".github/agents/developer.agent.md");
      expect(existsSync(installedPath)).toBe(true);
      expect(readFileSync(installedPath, "utf-8")).toBe("# Developer Agent");
      expect(result.installed.length).toBeGreaterThanOrEqual(1);
      expect(result.platforms).toEqual(["copilot"]);
    });

    it("copies skill subdirectories recursively", async () => {
      createFile(sourceDir, ".github/skills/git-ops/SKILL.md", "# Git Ops");
      createFile(sourceDir, ".github/skills/git-ops/scripts/hook.sh", "#!/bin/bash");
      const result = await installFiles({
        sourceDir,
        targetDir,
        version: "0.1.0",
        pin: "0.1.0",
        profile: "copilot",
      });

      expect(existsSync(join(targetDir, ".github/skills/git-ops/SKILL.md"))).toBe(true);
      expect(existsSync(join(targetDir, ".github/skills/git-ops/scripts/hook.sh"))).toBe(true);
      expect(result.installed.length).toBe(2);
    });
  });

  describe("profile: claude", () => {
    it("copies agent and command files", async () => {
      createFile(sourceDir, ".claude/agents/developer.md", "# Claude Dev");
      createFile(sourceDir, ".claude/commands/refine.md", "# Refine");
      const result = await installFiles({
        sourceDir,
        targetDir,
        version: "0.1.0",
        pin: "0.1.0",
        profile: "claude",
      });

      expect(existsSync(join(targetDir, ".claude/agents/developer.md"))).toBe(true);
      expect(existsSync(join(targetDir, ".claude/commands/refine.md"))).toBe(true);
      expect(result.platforms).toEqual(["claude"]);
      expect(result.installed.length).toBe(2);
    });
  });

  describe("profile: kiro", () => {
    it("copies kiro agents and steering files", async () => {
      createFile(sourceDir, ".kiro/agents/developer.md", "# Kiro Dev");
      createFile(sourceDir, ".kiro/steering/implement.md", "# Implement");
      const result = await installFiles({
        sourceDir,
        targetDir,
        version: "0.1.0",
        pin: "0.1.0",
        profile: "kiro",
      });

      expect(existsSync(join(targetDir, ".kiro/agents/developer.md"))).toBe(true);
      expect(existsSync(join(targetDir, ".kiro/steering/implement.md"))).toBe(true);
      expect(result.platforms).toEqual(["kiro"]);
      expect(result.installed.length).toBe(2);
    });
  });

  describe("profile: both (default)", () => {
    it("installs copilot + claude when no profile specified", async () => {
      createFile(sourceDir, ".github/agents/developer.agent.md", "# GH Dev");
      createFile(sourceDir, ".claude/agents/developer.md", "# Claude Dev");
      createFile(sourceDir, ".kiro/agents/developer.md", "# Kiro Dev");

      const result = await installFiles({
        sourceDir,
        targetDir,
        version: "0.1.0",
        pin: "0.1.0",
        // profile defaults to 'both'
      });

      expect(existsSync(join(targetDir, ".github/agents/developer.agent.md"))).toBe(true);
      expect(existsSync(join(targetDir, ".claude/agents/developer.md"))).toBe(true);
      // Kiro should NOT be installed in 'both' mode
      expect(existsSync(join(targetDir, ".kiro/agents/developer.md"))).toBe(false);
      expect(result.platforms).toEqual(["copilot", "claude"]);
    });
  });

  describe("profile: all", () => {
    it("installs copilot + claude + kiro", async () => {
      createFile(sourceDir, ".github/agents/developer.agent.md", "# GH Dev");
      createFile(sourceDir, ".claude/agents/developer.md", "# Claude Dev");
      createFile(sourceDir, ".kiro/agents/developer.md", "# Kiro Dev");

      const result = await installFiles({
        sourceDir,
        targetDir,
        version: "0.1.0",
        pin: "0.1.0",
        profile: "all",
      });

      expect(existsSync(join(targetDir, ".github/agents/developer.agent.md"))).toBe(true);
      expect(existsSync(join(targetDir, ".claude/agents/developer.md"))).toBe(true);
      expect(existsSync(join(targetDir, ".kiro/agents/developer.md"))).toBe(true);
      expect(result.platforms).toEqual(["copilot", "claude", "kiro"]);
    });
  });

  describe("manifest writing", () => {
    it("writes a valid manifest with files[], sha256, and origin_sha256", async () => {
      const content = "# Test Agent";
      createFile(sourceDir, ".github/agents/test.agent.md", content);
      await installFiles({
        sourceDir,
        targetDir,
        version: "0.1.0",
        pin: "0.1.0",
        profile: "copilot",
      });

      const manifestRaw = readFileSync(join(targetDir, ".dev-tasks", "manifest.json"), "utf-8");
      const manifest = JSON.parse(manifestRaw) as Manifest;

      expect(manifest.version).toBe("0.1.0");
      expect(manifest.pinned).toBe("0.1.0");
      expect(manifest.installed_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(manifest.files).toHaveLength(1);
      expect(manifest.files[0].path).toBe(".github/agents/test.agent.md");
      expect(manifest.files[0].profile).toBe("copilot");
      expect(manifest.files[0].sha256).toBe(sha256(content));
      expect(manifest.files[0].origin_sha256).toBe(sha256(content));
    });

    it("uses provided pin version in manifest", async () => {
      createFile(sourceDir, ".github/agents/x.md", "X");
      await installFiles({
        sourceDir,
        targetDir,
        version: "0.3.0",
        pin: "0.2.0",
        profile: "copilot",
      });

      const manifestRaw = readFileSync(join(targetDir, ".dev-tasks", "manifest.json"), "utf-8");
      const manifest = JSON.parse(manifestRaw) as Manifest;
      expect(manifest.version).toBe("0.3.0");
      expect(manifest.pinned).toBe("0.2.0");
    });
  });

  describe("edge cases", () => {
    it("creates .dev-tasks directory structure automatically", async () => {
      createFile(sourceDir, ".github/agents/x.md", "data");
      await installFiles({
        sourceDir,
        targetDir,
        version: "0.1.0",
        pin: "0.1.0",
        profile: "copilot",
      });

      expect(existsSync(join(targetDir, ".dev-tasks"))).toBe(true);
      expect(existsSync(join(targetDir, ".dev-tasks", "manifest.json"))).toBe(true);
    });

    it("handles empty source directories gracefully", async () => {
      // sourceDir has no platform directories at all
      const result = await installFiles({
        sourceDir,
        targetDir,
        version: "0.1.0",
        pin: "0.1.0",
        profile: "copilot",
      });

      expect(result.installed).toHaveLength(0);
      const manifestRaw = readFileSync(join(targetDir, ".dev-tasks", "manifest.json"), "utf-8");
      const manifest = JSON.parse(manifestRaw) as Manifest;
      expect(manifest.files).toEqual([]);
    });

    it("handles multiple files across multiple directories", async () => {
      createFile(sourceDir, ".github/agents/a.md", "A");
      createFile(sourceDir, ".github/agents/b.md", "B");
      createFile(sourceDir, ".github/prompts/c.md", "C");

      const result = await installFiles({
        sourceDir,
        targetDir,
        version: "0.2.0",
        pin: "0.2.0",
        profile: "copilot",
      });

      expect(result.installed).toHaveLength(3);
      const manifestRaw = readFileSync(join(targetDir, ".dev-tasks", "manifest.json"), "utf-8");
      const manifest = JSON.parse(manifestRaw) as Manifest;
      expect(manifest.files).toHaveLength(3);
    });
  });
});
