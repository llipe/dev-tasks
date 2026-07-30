import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readManifest, writeManifest, type Manifest } from "#core/distribution/manifest.js";
import { mkdtempSync, rmSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("core/distribution/manifest", () => {
  let tmpDir: string;
  let devTasksDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "dev-tasks-manifest-test-"));
    devTasksDir = join(tmpDir, ".dev-tasks");
    mkdirSync(devTasksDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  const sampleManifest: Manifest = {
    version: "0.1.0",
    pinned: "0.1.0",
    installed_at: "2024-01-01T00:00:00.000Z",
    files: [
      {
        path: ".claude/skills/activity-refine/SKILL.md",
        profile: "claude",
        sha256: "abc123",
        origin_sha256: "def456",
      },
    ],
    extraction: {},
  };

  describe("writeManifest", () => {
    it("writes manifest.json to .dev-tasks directory", async () => {
      await writeManifest(tmpDir, sampleManifest);
      const raw = readFileSync(join(devTasksDir, "manifest.json"), "utf-8");
      const parsed = JSON.parse(raw) as Manifest;
      expect(parsed.version).toBe("0.1.0");
      expect(parsed.files).toHaveLength(1);
    });

    it("creates .dev-tasks directory if missing", async () => {
      const freshDir = mkdtempSync(join(tmpdir(), "dev-tasks-manifest-fresh-"));
      try {
        await writeManifest(freshDir, sampleManifest);
        const raw = readFileSync(join(freshDir, ".dev-tasks", "manifest.json"), "utf-8");
        expect(JSON.parse(raw)).toEqual(sampleManifest);
      } finally {
        rmSync(freshDir, { recursive: true, force: true });
      }
    });

    it("formats JSON with 2-space indentation", async () => {
      await writeManifest(tmpDir, sampleManifest);
      const raw = readFileSync(join(devTasksDir, "manifest.json"), "utf-8");
      expect(raw).toContain("  ");
      expect(raw.endsWith("\n")).toBe(true);
    });
  });

  describe("readManifest", () => {
    it("reads an existing manifest.json", async () => {
      await writeManifest(tmpDir, sampleManifest);
      const result = await readManifest(tmpDir);
      expect(result).toEqual(sampleManifest);
    });

    it("returns null if manifest.json does not exist", async () => {
      const emptyDir = mkdtempSync(join(tmpdir(), "dev-tasks-no-manifest-"));
      try {
        const result = await readManifest(emptyDir);
        expect(result).toBeNull();
      } finally {
        rmSync(emptyDir, { recursive: true, force: true });
      }
    });

    it("round-trips correctly", async () => {
      await writeManifest(tmpDir, sampleManifest);
      const result = await readManifest(tmpDir);
      expect(result).toEqual(sampleManifest);
    });

    it("migrates legacy manifests (skills[] only) to files[] format", async () => {
      const legacyManifest = {
        version: "0.1.0",
        pinned: "0.1.0",
        installed_at: "2024-01-01T00:00:00.000Z",
        skills: [
          {
            name: "my-skill",
            path: "my-skill/SKILL.md",
            sha256: "abc123",
            origin_sha256: "def456",
          },
        ],
        extraction: {},
      };
      writeFileSync(
        join(devTasksDir, "manifest.json"),
        JSON.stringify(legacyManifest, null, 2) + "\n",
        "utf-8",
      );

      const result = await readManifest(tmpDir);
      expect(result).not.toBeNull();
      expect(result!.files).toHaveLength(1);
      expect(result!.files[0].path).toBe("my-skill/SKILL.md");
      expect(result!.files[0].profile).toBe("legacy");
      expect(result!.files[0].sha256).toBe("abc123");
      expect(result!.files[0].origin_sha256).toBe("def456");
      // Preserves legacy skills array
      expect(result!.skills).toHaveLength(1);
    });
  });

  describe("manifest schema", () => {
    it("allows empty files array", async () => {
      const manifest: Manifest = {
        version: "0.1.0",
        pinned: "0.1.0",
        installed_at: new Date().toISOString(),
        files: [],
        extraction: {},
      };
      await writeManifest(tmpDir, manifest);
      const result = await readManifest(tmpDir);
      expect(result?.files).toEqual([]);
    });

    it("preserves extraction data", async () => {
      const manifest: Manifest = {
        version: "0.1.0",
        pinned: "0.1.0",
        installed_at: new Date().toISOString(),
        files: [],
        extraction: { schema: { lastRun: "2024-01-01" } },
      };
      await writeManifest(tmpDir, manifest);
      const result = await readManifest(tmpDir);
      expect(result?.extraction).toEqual({ schema: { lastRun: "2024-01-01" } });
    });
  });
});
