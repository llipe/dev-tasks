import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { installSkills } from "#core/distribution/install.js";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import type { Manifest } from "#core/distribution/manifest.js";

describe("core/distribution/install", () => {
  let tmpDir: string;
  let targetDir: string;
  let sourceDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "dev-tasks-install-test-"));
    targetDir = join(tmpDir, "target-repo");
    sourceDir = join(tmpDir, "package-source");
    mkdirSync(targetDir, { recursive: true });
    mkdirSync(join(sourceDir, "skills"), { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  function createSkillFile(name: string, content: string): void {
    const skillDir = join(sourceDir, "skills", name);
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, "SKILL.md"), content, "utf-8");
  }

  function sha256(content: string): string {
    return createHash("sha256").update(content).digest("hex");
  }

  it("copies skill files from source to target repo", async () => {
    createSkillFile("activity-refine", "# Refine Skill\nContent here.");
    const result = await installSkills({
      sourceDir,
      targetDir,
      version: "0.1.0",
      pin: "0.1.0",
    });

    const installedPath = join(targetDir, ".dev-tasks", "skills", "activity-refine", "SKILL.md");
    expect(existsSync(installedPath)).toBe(true);
    expect(readFileSync(installedPath, "utf-8")).toBe("# Refine Skill\nContent here.");
    expect(result.installed).toHaveLength(1);
  });

  it("writes a valid manifest with sha256 and origin_sha256", async () => {
    const content = "# Test Skill";
    createSkillFile("test-skill", content);
    await installSkills({
      sourceDir,
      targetDir,
      version: "0.1.0",
      pin: "0.1.0",
    });

    const manifestRaw = readFileSync(join(targetDir, ".dev-tasks", "manifest.json"), "utf-8");
    const manifest = JSON.parse(manifestRaw) as Manifest;

    expect(manifest.version).toBe("0.1.0");
    expect(manifest.pinned).toBe("0.1.0");
    expect(manifest.installed_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(manifest.skills).toHaveLength(1);
    expect(manifest.skills[0].name).toBe("test-skill");
    expect(manifest.skills[0].sha256).toBe(sha256(content));
    expect(manifest.skills[0].origin_sha256).toBe(sha256(content));
  });

  it("handles multiple skills", async () => {
    createSkillFile("skill-a", "Content A");
    createSkillFile("skill-b", "Content B");

    const result = await installSkills({
      sourceDir,
      targetDir,
      version: "0.2.0",
      pin: "0.2.0",
    });

    expect(result.installed).toHaveLength(2);
    const manifestRaw = readFileSync(join(targetDir, ".dev-tasks", "manifest.json"), "utf-8");
    const manifest = JSON.parse(manifestRaw) as Manifest;
    expect(manifest.skills).toHaveLength(2);
  });

  it("uses provided pin version in manifest", async () => {
    createSkillFile("skill-x", "X");
    await installSkills({
      sourceDir,
      targetDir,
      version: "0.3.0",
      pin: "0.2.0",
    });

    const manifestRaw = readFileSync(join(targetDir, ".dev-tasks", "manifest.json"), "utf-8");
    const manifest = JSON.parse(manifestRaw) as Manifest;
    expect(manifest.version).toBe("0.3.0");
    expect(manifest.pinned).toBe("0.2.0");
  });

  it("creates .dev-tasks directory structure automatically", async () => {
    createSkillFile("my-skill", "data");
    await installSkills({
      sourceDir,
      targetDir,
      version: "0.1.0",
      pin: "0.1.0",
    });

    expect(existsSync(join(targetDir, ".dev-tasks"))).toBe(true);
    expect(existsSync(join(targetDir, ".dev-tasks", "manifest.json"))).toBe(true);
    expect(existsSync(join(targetDir, ".dev-tasks", "skills"))).toBe(true);
  });

  it("handles empty skills directory (no skills to install)", async () => {
    // sourceDir/skills/ exists but is empty
    const result = await installSkills({
      sourceDir,
      targetDir,
      version: "0.1.0",
      pin: "0.1.0",
    });

    expect(result.installed).toHaveLength(0);
    const manifestRaw = readFileSync(join(targetDir, ".dev-tasks", "manifest.json"), "utf-8");
    const manifest = JSON.parse(manifestRaw) as Manifest;
    expect(manifest.skills).toEqual([]);
  });
});
