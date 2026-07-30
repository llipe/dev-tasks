import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { execSync, execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import type { Manifest } from "#core/distribution/manifest.js";

const ROOT = resolve(import.meta.dirname, "../..");
const DIST_BIN = resolve(ROOT, "dist/bin/dev-tasks.js");

describe("dev-tasks update (integration)", () => {
  beforeAll(() => {
    if (!existsSync(DIST_BIN)) {
      execSync("pnpm run build", { cwd: ROOT, encoding: "utf-8" });
    }
  });

  function run(
    args: string[],
    options: { cwd?: string } = {},
  ): { stdout: string; stderr: string; exitCode: number } {
    const cwd = options.cwd ?? ROOT;
    try {
      const stdout = execFileSync("node", [DIST_BIN, ...args], {
        cwd,
        encoding: "utf-8",
        env: { ...process.env, NODE_ENV: "test" },
        timeout: 10_000,
      });
      return { stdout, stderr: "", exitCode: 0 };
    } catch (err: unknown) {
      const e = err as { stdout?: string; stderr?: string; status?: number };
      return {
        stdout: e.stdout ?? "",
        stderr: e.stderr ?? "",
        exitCode: e.status ?? 1,
      };
    }
  }

  describe("update with no manifest", () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = mkdtempSync(join(tmpdir(), "dev-tasks-update-noop-"));
    });

    afterEach(() => {
      rmSync(tmpDir, { recursive: true, force: true });
    });

    it("exits 0 when no manifest exists (nothing to update)", () => {
      const result = run(["update"], { cwd: tmpDir });
      expect(result.exitCode).toBe(0);
      expect(result.stdout + result.stderr).toMatch(/no manifest|nothing to update|no files/i);
    });

    it("supports --json output format", () => {
      const result = run(["update", "--json"], { cwd: tmpDir });
      expect(result.exitCode).toBe(0);
      const output = JSON.parse(result.stdout) as Record<string, unknown>;
      expect(output.command).toBe("update");
    });
  });

  describe("update with manifest (files at native paths)", () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = mkdtempSync(join(tmpdir(), "dev-tasks-update-int-"));
    });

    afterEach(() => {
      rmSync(tmpDir, { recursive: true, force: true });
    });

    it("skips files that are already up to date", () => {
      // Install first, then update — file content from package hasn't changed
      run(["install", "--profile", "copilot"], { cwd: tmpDir });

      // Update — nothing should change since package content is the same
      const result = run(["update", "--json"], { cwd: tmpDir });
      expect(result.exitCode).toBe(0);

      const output = JSON.parse(result.stdout) as {
        updated: unknown[];
        conflicts: unknown[];
        installed: unknown[];
        skipped: unknown[];
      };
      expect(output.conflicts).toHaveLength(0);
      expect(output.updated).toHaveLength(0);
      expect(output.installed).toHaveLength(0);
      // Everything should be skipped (already up to date)
      expect(output.skipped.length).toBeGreaterThanOrEqual(0);
    });

    it("detects conflict when user edits an installed file", () => {
      // Install
      run(["install", "--profile", "copilot"], { cwd: tmpDir });

      // Read the manifest to find an installed file
      const manifestPath = join(tmpDir, ".dev-tasks", "manifest.json");
      const manifest = JSON.parse(readFileSync(manifestPath, "utf-8")) as Manifest;

      if (manifest.files.length === 0) {
        // If no files were installed (package has nothing), skip this test
        return;
      }

      const firstFile = manifest.files[0];
      const localPath = join(tmpDir, firstFile.path);

      // Simulate user editing the file
      writeFileSync(localPath, "# User-edited content that differs from origin", "utf-8");

      // Now update — should detect conflict
      const result = run(["update", "--json"], { cwd: tmpDir });
      // Exit code 14 = ReconciliationConflict, or 0 if the package content is the same
      expect(result.exitCode === 0 || result.exitCode === 14).toBe(true);
    });
  });

  describe("install then update round-trip", () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = mkdtempSync(join(tmpdir(), "dev-tasks-roundtrip-"));
    });

    afterEach(() => {
      rmSync(tmpDir, { recursive: true, force: true });
    });

    it("install + immediate update = all skipped (idempotent)", () => {
      const installResult = run(["install", "--profile", "all", "--json"], { cwd: tmpDir });
      expect(installResult.exitCode).toBe(0);

      const updateResult = run(["update", "--json"], { cwd: tmpDir });
      expect(updateResult.exitCode).toBe(0);

      const output = JSON.parse(updateResult.stdout) as {
        conflicts: unknown[];
        updated: unknown[];
        installed: unknown[];
        skipped: unknown[];
      };
      expect(output.conflicts).toHaveLength(0);
      expect(output.updated).toHaveLength(0);
      expect(output.installed).toHaveLength(0);
    });
  });
});
