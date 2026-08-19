import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  checkNodeVersion,
  checkGitVersion,
  checkCacheDir,
  checkVersionSkew,
  runDoctor,
} from "#core/distribution/doctor.js";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("core/distribution/doctor", () => {
  describe("checkNodeVersion", () => {
    it("passes when Node version >= 24", () => {
      const result = checkNodeVersion("v24.0.0");
      expect(result.pass).toBe(true);
      expect(result.name).toBe("node-version");
    });

    it("passes for Node v26.x", () => {
      const result = checkNodeVersion("v26.7.0");
      expect(result.pass).toBe(true);
    });

    it("fails for Node v22.x (previous LTS, now below the floor)", () => {
      const result = checkNodeVersion("v22.5.1");
      expect(result.pass).toBe(false);
      expect(result.message).toMatch(/24/);
    });

    it("fails for Node v20.x", () => {
      const result = checkNodeVersion("v20.0.0");
      expect(result.pass).toBe(false);
    });
  });

  describe("checkGitVersion", () => {
    it("passes when git version >= 2.37", () => {
      const result = checkGitVersion("git version 2.37.0");
      expect(result.pass).toBe(true);
      expect(result.name).toBe("git-version");
    });

    it("passes for git 2.43.0", () => {
      const result = checkGitVersion("git version 2.43.0");
      expect(result.pass).toBe(true);
    });

    it("fails for git 2.36.9", () => {
      const result = checkGitVersion("git version 2.36.9");
      expect(result.pass).toBe(false);
      expect(result.message).toMatch(/2\.37/);
    });

    it("fails for git 1.x", () => {
      const result = checkGitVersion("git version 1.9.5");
      expect(result.pass).toBe(false);
    });

    it("handles Apple git version strings", () => {
      const result = checkGitVersion("git version 2.39.5 (Apple Git-154)");
      expect(result.pass).toBe(true);
    });
  });

  describe("checkCacheDir", () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = mkdtempSync(join(tmpdir(), "dev-tasks-doctor-cache-"));
    });

    afterEach(() => {
      rmSync(tmpDir, { recursive: true, force: true });
    });

    it("passes when cache directory is writable", async () => {
      const result = await checkCacheDir(tmpDir);
      expect(result.pass).toBe(true);
      expect(result.name).toBe("cache-dir");
    });

    it("creates the cache directory if it does not exist", async () => {
      const newDir = join(tmpDir, "new-cache");
      const result = await checkCacheDir(newDir);
      expect(result.pass).toBe(true);
    });

    it("fails when path is not writable", async () => {
      // Use a path that definitely can't be written
      const result = await checkCacheDir("/root/no-access-dev-tasks-cache");
      expect(result.pass).toBe(false);
    });
  });

  describe("checkVersionSkew", () => {
    it("passes when installed matches pinned", () => {
      const result = checkVersionSkew("0.1.0", "0.1.0");
      expect(result.pass).toBe(true);
      expect(result.name).toBe("version-skew");
    });

    it("fails when installed differs from pinned", () => {
      const result = checkVersionSkew("0.1.0", "0.2.0");
      expect(result.pass).toBe(false);
      expect(result.message).toMatch(/skew/i);
    });

    it("passes when no pin exists (null)", () => {
      const result = checkVersionSkew("0.1.0", null);
      expect(result.pass).toBe(true);
    });

    it("passes when not installed and no pin", () => {
      const result = checkVersionSkew(null, null);
      expect(result.pass).toBe(true);
    });
  });

  describe("runDoctor", () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = mkdtempSync(join(tmpdir(), "dev-tasks-doctor-run-"));
    });

    afterEach(() => {
      rmSync(tmpDir, { recursive: true, force: true });
    });

    it("returns an array of DoctorCheck results", async () => {
      mkdirSync(join(tmpDir, ".dev-tasks"), { recursive: true });
      writeFileSync(
        join(tmpDir, ".dev-tasks", "manifest.json"),
        JSON.stringify({
          version: "0.1.0",
          pinned: "0.1.0",
          installed_at: "2024-01-01T00:00:00.000Z",
          skills: [],
          extraction: {},
        }),
        "utf-8",
      );

      const results = await runDoctor({
        repoRoot: tmpDir,
        cacheDir: tmpDir,
      });

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThanOrEqual(4);
      for (const check of results) {
        expect(check).toHaveProperty("name");
        expect(check).toHaveProperty("pass");
        expect(check).toHaveProperty("message");
      }
    });

    it("includes all four check categories", async () => {
      const results = await runDoctor({
        repoRoot: tmpDir,
        cacheDir: tmpDir,
      });

      const names = results.map((r) => r.name);
      expect(names).toContain("node-version");
      expect(names).toContain("git-version");
      expect(names).toContain("cache-dir");
      expect(names).toContain("version-skew");
    });
  });
});
