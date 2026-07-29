import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { execSync, execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import type { Manifest } from "#core/distribution/manifest.js";

const ROOT = resolve(import.meta.dirname, "../..");
const DIST_BIN = resolve(ROOT, "dist/bin/dev-tasks.js");

describe("dev-tasks bootstrap commands (integration)", () => {
  beforeAll(() => {
    // Ensure the project is built
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

  describe("install", () => {
    let tmpDir: string;
    let skillsDir: string;
    let skillTestDir: string;

    beforeEach(() => {
      tmpDir = mkdtempSync(join(tmpdir(), "dev-tasks-int-install-"));
      // Create a test skills dir in the package source
      skillsDir = join(ROOT, "skills");
      skillTestDir = join(skillsDir, "test-integration-skill");
      mkdirSync(skillTestDir, { recursive: true });
      writeFileSync(
        join(skillTestDir, "SKILL.md"),
        "# Integration Test Skill\nContent here.",
        "utf-8",
      );
    });

    afterEach(() => {
      rmSync(tmpDir, { recursive: true, force: true });
      rmSync(skillTestDir, { recursive: true, force: true });
      // Remove skills dir only if empty
      try {
        rmSync(skillsDir, { recursive: false });
      } catch {
        // Not empty, fine
      }
    });

    it("installs skills and writes manifest with sha256/origin_sha256", () => {
      const result = run(["install"], { cwd: tmpDir });
      expect(result.exitCode).toBe(0);

      const manifestPath = join(tmpDir, ".dev-tasks", "manifest.json");
      expect(existsSync(manifestPath)).toBe(true);

      const manifest = JSON.parse(readFileSync(manifestPath, "utf-8")) as Manifest;
      expect(manifest.version).toBe("0.1.0");
      expect(manifest.skills.length).toBeGreaterThanOrEqual(1);

      for (const skill of manifest.skills) {
        expect(skill.sha256).toMatch(/^[a-f0-9]{64}$/);
        expect(skill.origin_sha256).toMatch(/^[a-f0-9]{64}$/);
      }
    });

    it("supports --json output for install", () => {
      const result = run(["install", "--json"], { cwd: tmpDir });
      expect(result.exitCode).toBe(0);

      const output = JSON.parse(result.stdout) as Record<string, unknown>;
      expect(output.command).toBe("install");
      expect(output.version).toBe("0.1.0");
      expect(typeof output.installed).toBe("number");
      expect(Array.isArray(output.skills)).toBe(true);
    });

    it("supports --pin flag to set a specific pinned version", () => {
      const result = run(["install", "--pin", "0.0.5", "--json"], {
        cwd: tmpDir,
      });
      expect(result.exitCode).toBe(0);

      const output = JSON.parse(result.stdout) as Record<string, unknown>;
      expect(output.pinned).toBe("0.0.5");

      const manifest = JSON.parse(
        readFileSync(join(tmpDir, ".dev-tasks", "manifest.json"), "utf-8"),
      ) as Manifest;
      expect(manifest.pinned).toBe("0.0.5");
    });
  });

  describe("pin", () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = mkdtempSync(join(tmpdir(), "dev-tasks-int-pin-"));
    });

    afterEach(() => {
      rmSync(tmpDir, { recursive: true, force: true });
    });

    it("writes .dev-tasks/version file", () => {
      const result = run(["pin", "1.2.3"], { cwd: tmpDir });
      expect(result.exitCode).toBe(0);

      const versionFile = join(tmpDir, ".dev-tasks", "version");
      expect(existsSync(versionFile)).toBe(true);
      expect(readFileSync(versionFile, "utf-8").trim()).toBe("1.2.3");
    });

    it("supports --json output for pin", () => {
      const result = run(["pin", "2.0.0", "--json"], { cwd: tmpDir });
      expect(result.exitCode).toBe(0);

      const output = JSON.parse(result.stdout) as Record<string, unknown>;
      expect(output.command).toBe("pin");
      expect(output.version).toBe("2.0.0");
    });

    it("exits 2 if no version argument provided", () => {
      const result = run(["pin"], { cwd: tmpDir });
      expect(result.exitCode).toBe(2);
    });

    it("pin is honored — subsequent status reports pinned version", () => {
      // First pin
      run(["pin", "0.5.0"], { cwd: tmpDir });

      // Then check status
      const statusResult = run(["status", "--json"], { cwd: tmpDir });
      const output = JSON.parse(statusResult.stdout) as Record<string, unknown>;
      expect(output.pinned).toBe("0.5.0");
    });
  });

  describe("status", () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = mkdtempSync(join(tmpdir(), "dev-tasks-int-status-"));
    });

    afterEach(() => {
      rmSync(tmpDir, { recursive: true, force: true });
    });

    it("reports not installed when no manifest exists", () => {
      const result = run(["status"], { cwd: tmpDir });
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/not installed/);
    });

    it("reports installed version from manifest", () => {
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

      const result = run(["status"], { cwd: tmpDir });
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/0\.1\.0/);
    });

    it("supports --json output shape with all three versions", () => {
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
      writeFileSync(join(tmpDir, ".dev-tasks", "version"), "0.2.0\n", "utf-8");

      const result = run(["status", "--json"], { cwd: tmpDir });
      expect(result.exitCode).toBe(0);

      const output = JSON.parse(result.stdout) as Record<string, unknown>;
      expect(output.command).toBe("status");
      expect(output.installed).toBe("0.1.0");
      expect(output.pinned).toBe("0.2.0");
      expect(output).toHaveProperty("latest");
      expect(output).toHaveProperty("upToDate");
    });
  });

  describe("doctor", () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = mkdtempSync(join(tmpdir(), "dev-tasks-int-doctor-"));
    });

    afterEach(() => {
      rmSync(tmpDir, { recursive: true, force: true });
    });

    it("runs all checks and outputs results", () => {
      const result = run(["doctor"], { cwd: tmpDir });
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/node-version/);
      expect(result.stdout).toMatch(/git-version/);
      expect(result.stdout).toMatch(/cache-dir/);
      expect(result.stdout).toMatch(/version-skew/);
    });

    it("supports --json output with structured check results", () => {
      const result = run(["doctor", "--json"], { cwd: tmpDir });
      expect(result.exitCode).toBe(0);

      const output = JSON.parse(result.stdout) as {
        command: string;
        ok: boolean;
        checks: Array<{ name: string; pass: boolean; message: string }>;
      };
      expect(output.command).toBe("doctor");
      expect(typeof output.ok).toBe("boolean");
      expect(Array.isArray(output.checks)).toBe(true);
      expect(output.checks.length).toBeGreaterThanOrEqual(4);

      for (const check of output.checks) {
        expect(check).toHaveProperty("name");
        expect(check).toHaveProperty("pass");
        expect(check).toHaveProperty("message");
      }
    });

    it("detects version skew when pin differs from installed", () => {
      mkdirSync(join(tmpDir, ".dev-tasks"), { recursive: true });
      writeFileSync(
        join(tmpDir, ".dev-tasks", "manifest.json"),
        JSON.stringify({
          version: "0.0.1",
          pinned: "0.0.1",
          installed_at: "2024-01-01T00:00:00.000Z",
          skills: [],
          extraction: {},
        }),
        "utf-8",
      );
      writeFileSync(join(tmpDir, ".dev-tasks", "version"), "0.9.9\n", "utf-8");

      const result = run(["doctor", "--json"], { cwd: tmpDir });
      const output = JSON.parse(result.stdout) as {
        ok: boolean;
        checks: Array<{ name: string; pass: boolean; message: string }>;
      };
      const skewCheck = output.checks.find((c) => c.name === "version-skew");
      expect(skewCheck?.pass).toBe(false);
      expect(skewCheck?.message).toMatch(/skew/i);
    });
  });
});
