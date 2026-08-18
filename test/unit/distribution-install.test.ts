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

  describe("profile: all (default)", () => {
    it("installs copilot + claude + kiro when no profile specified", async () => {
      createFile(sourceDir, ".github/agents/developer.agent.md", "# GH Dev");
      createFile(sourceDir, ".claude/agents/developer.md", "# Claude Dev");
      createFile(sourceDir, ".kiro/agents/developer.md", "# Kiro Dev");

      const result = await installFiles({
        sourceDir,
        targetDir,
        version: "0.1.0",
        pin: "0.1.0",
        // profile defaults to 'all'
      });

      expect(existsSync(join(targetDir, ".github/agents/developer.agent.md"))).toBe(true);
      expect(existsSync(join(targetDir, ".claude/agents/developer.md"))).toBe(true);
      expect(existsSync(join(targetDir, ".kiro/agents/developer.md"))).toBe(true);
      expect(result.platforms).toEqual(["copilot", "claude", "kiro"]);
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

  describe("manifest merging", () => {
    it("preserves files from other profiles when installing a new profile", async () => {
      createFile(sourceDir, ".github/agents/dev.agent.md", "# GH Dev");
      createFile(sourceDir, ".claude/agents/dev.md", "# Claude Dev");
      createFile(sourceDir, ".kiro/agents/dev.md", "# Kiro Dev");

      // First install copilot + claude
      await installFiles({
        sourceDir,
        targetDir,
        version: "0.1.0",
        pin: "0.1.0",
        profile: "both",
      });

      let manifestRaw = readFileSync(join(targetDir, ".dev-tasks", "manifest.json"), "utf-8");
      let manifest = JSON.parse(manifestRaw) as Manifest;
      expect(manifest.files).toHaveLength(2);
      expect(manifest.files.map((f) => f.profile).sort()).toEqual(["claude", "copilot"]);

      // Then install kiro — should preserve copilot + claude entries
      await installFiles({
        sourceDir,
        targetDir,
        version: "0.1.0",
        pin: "0.1.0",
        profile: "kiro",
      });

      manifestRaw = readFileSync(join(targetDir, ".dev-tasks", "manifest.json"), "utf-8");
      manifest = JSON.parse(manifestRaw) as Manifest;
      expect(manifest.files).toHaveLength(3);
      expect(manifest.files.map((f) => f.profile).sort()).toEqual(["claude", "copilot", "kiro"]);
    });

    it("replaces files from the same profile on re-install", async () => {
      createFile(sourceDir, ".github/agents/dev.agent.md", "# GH Dev v1");

      await installFiles({
        sourceDir,
        targetDir,
        version: "0.1.0",
        pin: "0.1.0",
        profile: "copilot",
      });

      // Update the source file
      createFile(sourceDir, ".github/agents/dev.agent.md", "# GH Dev v2");

      await installFiles({
        sourceDir,
        targetDir,
        version: "0.2.0",
        pin: "0.2.0",
        profile: "copilot",
      });

      const manifestRaw = readFileSync(join(targetDir, ".dev-tasks", "manifest.json"), "utf-8");
      const manifest = JSON.parse(manifestRaw) as Manifest;
      // Should still only have 1 entry (replaced, not duplicated)
      expect(manifest.files).toHaveLength(1);
      expect(manifest.files[0].profile).toBe("copilot");
      expect(manifest.version).toBe("0.2.0");
    });

    it("preserves extraction data from existing manifest", async () => {
      createFile(sourceDir, ".github/agents/dev.agent.md", "# GH Dev");

      // Install copilot first
      await installFiles({
        sourceDir,
        targetDir,
        version: "0.1.0",
        pin: "0.1.0",
        profile: "copilot",
      });

      // Manually add extraction data to manifest
      const manifestPath = join(targetDir, ".dev-tasks", "manifest.json");
      const manifest = JSON.parse(readFileSync(manifestPath, "utf-8")) as Manifest;
      manifest.extraction = { component: "test-service" };
      writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");

      // Install kiro — should preserve extraction
      createFile(sourceDir, ".kiro/agents/dev.md", "# Kiro Dev");
      await installFiles({
        sourceDir,
        targetDir,
        version: "0.1.0",
        pin: "0.1.0",
        profile: "kiro",
      });

      const updatedRaw = readFileSync(manifestPath, "utf-8");
      const updated = JSON.parse(updatedRaw) as Manifest;
      expect(updated.extraction).toEqual({ component: "test-service" });
      expect(updated.files).toHaveLength(2);
    });
  });
});

/**
 * Root-file distribution for the `/TESTING.md` testing-standard contract.
 *
 * Issue #123 AC-10: `TESTING.md` must reach consumer repos through the npm
 * installer as well as the shell bundle, be recorded in the manifest, be
 * installed exactly once under `--profile all`, be idempotent across repeated
 * installs, and survive a consumer edit.
 *
 * Test plan mapping (workstream/test-plan-123.md):
 *   SC-27 fresh install places TESTING.md on every profile
 *   SC-28 `--profile all` installs the root file exactly once
 *   SC-29 consumer-filled TESTING.md survives update
 *   CT-7  manifest entry shape matches platform-file entries
 *   EC-7  repeated installs are idempotent
 *   EC-12 interrupted install is repaired by the next install
 *   EC-20 manifest predating root-file support is not invalidated
 *
 * Deviation from the plan, to report at audit: RT-4 specifies 150 randomly
 * seeded profile sequences. The profile space has five members, so the
 * idempotency sweep below enumerates all five profiles across repeat counts 1-3
 * exhaustively instead. Exhaustive beats sampled on a space this small, and it
 * needs no seed to reproduce.
 */
describe("core/distribution/install — root-file distribution (AC-10)", () => {
  const ROOT_FILE = "TESTING.md";
  /** Platform-agnostic files are tagged `root` so manifest merging can replace them. */
  const ROOT_PROFILE_TAG = "root";
  const PLACEHOLDER = "# Testing Standard\n\n<!-- placeholder -->\n";

  let tmpDir: string;
  let targetDir: string;
  let sourceDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "dev-tasks-rootfile-test-"));
    targetDir = join(tmpDir, "target-repo");
    sourceDir = join(tmpDir, "package-source");
    mkdirSync(targetDir, { recursive: true });
    mkdirSync(sourceDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  function write(basePath: string, relPath: string, content: string): void {
    const fullPath = join(basePath, relPath);
    mkdirSync(join(fullPath, ".."), { recursive: true });
    writeFileSync(fullPath, content, "utf-8");
  }

  function hash(content: string): string {
    return createHash("sha256").update(content).digest("hex");
  }

  /** Seed a source package containing one file per platform plus the root file. */
  function seedSource(): void {
    write(sourceDir, ".github/agents/developer.agent.md", "# GH Dev");
    write(sourceDir, ".claude/agents/developer.md", "# Claude Dev");
    write(sourceDir, ".kiro/agents/developer.md", "# Kiro Dev");
    write(sourceDir, ROOT_FILE, PLACEHOLDER);
  }

  function install(profile: "copilot" | "claude" | "kiro" | "both" | "all") {
    return installFiles({ sourceDir, targetDir, version: "0.1.0", pin: "0.1.0", profile });
  }

  function readManifestFile(): Manifest {
    return JSON.parse(
      readFileSync(join(targetDir, ".dev-tasks/manifest.json"), "utf-8"),
    ) as Manifest;
  }

  function rootEntries(manifest: Manifest) {
    return manifest.files.filter((f) => f.path === ROOT_FILE);
  }

  describe("SC-27: fresh install places the root file on every profile", () => {
    for (const profile of ["copilot", "claude", "kiro", "both", "all"] as const) {
      it(`installs ${ROOT_FILE} under --profile ${profile}`, async () => {
        seedSource();
        await install(profile);
        expect(
          existsSync(join(targetDir, ROOT_FILE)),
          `${ROOT_FILE} missing from target after --profile ${profile}`,
        ).toBe(true);
        expect(readFileSync(join(targetDir, ROOT_FILE), "utf-8")).toBe(PLACEHOLDER);
      });
    }
  });

  describe("CT-7: manifest entry shape", () => {
    it("records the root file with the same shape as platform entries", async () => {
      seedSource();
      await install("kiro");
      const entries = rootEntries(readManifestFile());
      expect(entries, `${ROOT_FILE} not recorded in the manifest`).toHaveLength(1);
      const entry = entries[0];
      expect(entry.path).toBe(ROOT_FILE);
      expect(entry.sha256).toBe(hash(PLACEHOLDER));
      expect(entry.origin_sha256).toBe(hash(PLACEHOLDER));
      expect(typeof entry.profile).toBe("string");
      expect(entry.profile.length).toBeGreaterThan(0);
    });

    it(`tags the root file as "${ROOT_PROFILE_TAG}" rather than a platform`, async () => {
      seedSource();
      await install("all");
      const entries = rootEntries(readManifestFile());
      expect(entries).toHaveLength(1);
      expect(
        entries[0].profile,
        "a platform-agnostic file must not be tagged with a single platform",
      ).toBe(ROOT_PROFILE_TAG);
    });

    it("reports the root file in the install result", async () => {
      seedSource();
      const result = await install("copilot");
      expect(result.installed.map((f) => f.path)).toContain(ROOT_FILE);
    });
  });

  describe("SC-28: --profile all installs the root file exactly once", () => {
    it("does not create one entry per resolved platform", async () => {
      seedSource();
      await install("all");
      const manifest = readManifestFile();
      expect(
        rootEntries(manifest),
        "--profile all resolves to three platforms; the root file must still be recorded once",
      ).toHaveLength(1);
    });

    it("does not duplicate under --profile both either", async () => {
      seedSource();
      await install("both");
      expect(rootEntries(readManifestFile())).toHaveLength(1);
    });
  });

  describe("EC-7: repeated installs are idempotent", () => {
    for (const profile of ["copilot", "claude", "kiro", "both", "all"] as const) {
      for (const repeats of [1, 2, 3]) {
        it(`--profile ${profile} × ${repeats} yields exactly one entry`, async () => {
          seedSource();
          for (let i = 0; i < repeats; i += 1) {
            await install(profile);
          }
          const manifest = readManifestFile();
          expect(rootEntries(manifest)).toHaveLength(1);
          expect(readFileSync(join(targetDir, ROOT_FILE), "utf-8")).toBe(PLACEHOLDER);
        });
      }
    }

    it("keeps a single entry across mixed profile sequences", async () => {
      seedSource();
      await install("copilot");
      await install("kiro");
      await install("all");
      await install("claude");
      expect(rootEntries(readManifestFile())).toHaveLength(1);
    });
  });

  describe("SC-29: consumer edits are detectable, not silently overwritten", () => {
    it("diverges sha256 from origin_sha256 once the consumer fills the file", async () => {
      seedSource();
      await install("all");

      const filled = "# Testing Standard\n\n## Packages\n\n- api: vitest\n";
      write(targetDir, ROOT_FILE, filled);

      const manifest = readManifestFile();
      const entry = rootEntries(manifest)[0];
      const onDisk = hash(readFileSync(join(targetDir, ROOT_FILE), "utf-8"));

      expect(onDisk).not.toBe(entry.origin_sha256);
      expect(
        entry.origin_sha256,
        "origin_sha256 must keep the shipped hash so reconciliation can detect the consumer edit",
      ).toBe(hash(PLACEHOLDER));
    });

    it("is registered as consumer-owned so update never overwrites it", () => {
      const manifest = JSON.parse(readFileSync("bundle-manifest.json", "utf-8")) as {
        consumer_owned_paths?: string[];
      };
      expect(manifest.consumer_owned_paths ?? []).toContain(ROOT_FILE);
    });
  });

  describe("EC-12: interrupted install is repaired", () => {
    it("restores a root file deleted after a previous install", async () => {
      seedSource();
      await install("all");
      rmSync(join(targetDir, ROOT_FILE));
      expect(existsSync(join(targetDir, ROOT_FILE))).toBe(false);

      await install("all");
      expect(existsSync(join(targetDir, ROOT_FILE))).toBe(true);
      expect(rootEntries(readManifestFile())).toHaveLength(1);
    });
  });

  describe("EC-20: manifest predating root-file support", () => {
    it("adds the root entry without dropping existing platform entries", async () => {
      seedSource();
      const legacy: Manifest = {
        version: "0.0.9",
        pinned: "0.0.9",
        installed_at: new Date().toISOString(),
        files: [
          {
            path: ".github/agents/legacy.agent.md",
            profile: "copilot",
            sha256: hash("legacy"),
            origin_sha256: hash("legacy"),
          },
        ],
        extraction: { previous: true },
      };
      mkdirSync(join(targetDir, ".dev-tasks"), { recursive: true });
      writeFileSync(
        join(targetDir, ".dev-tasks/manifest.json"),
        JSON.stringify(legacy, null, 2),
        "utf-8",
      );

      await install("kiro");

      const manifest = readManifestFile();
      expect(rootEntries(manifest)).toHaveLength(1);
      expect(
        manifest.files.some((f) => f.path === ".github/agents/legacy.agent.md"),
        "installing kiro must preserve the pre-existing copilot entry",
      ).toBe(true);
      expect(manifest.extraction).toEqual({ previous: true });
    });
  });

  describe("missing source root file", () => {
    it("does not fail the install when the package ships no root file", async () => {
      write(sourceDir, ".kiro/agents/developer.md", "# Kiro Dev");
      await expect(install("kiro")).resolves.toBeDefined();
      expect(rootEntries(readManifestFile())).toHaveLength(0);
    });
  });
});
