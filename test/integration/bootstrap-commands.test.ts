import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { execSync, execFileSync } from "node:child_process";
import {
  mkdtempSync,
  rmSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  readdirSync,
  existsSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import type { Manifest } from "#core/distribution/manifest.js";

const ROOT = resolve(import.meta.dirname, "../..");
const DIST_BIN = resolve(ROOT, "dist/bin/dev-tasks.js");
const PKG_VERSION = (
  JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf-8")) as { version: string }
).version;

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

    beforeEach(() => {
      tmpDir = mkdtempSync(join(tmpdir(), "dev-tasks-int-install-"));
    });

    afterEach(() => {
      rmSync(tmpDir, { recursive: true, force: true });
    });

    it("installs files and writes manifest with sha256/origin_sha256", () => {
      const result = run(["install"], { cwd: tmpDir });
      expect(result.exitCode).toBe(0);

      const manifestPath = join(tmpDir, ".dev-tasks", "manifest.json");
      expect(existsSync(manifestPath)).toBe(true);

      const manifest = JSON.parse(readFileSync(manifestPath, "utf-8")) as Manifest;
      expect(manifest.version).toBe(PKG_VERSION);
      expect(manifest.files.length).toBeGreaterThanOrEqual(1);

      for (const file of manifest.files) {
        expect(file.sha256).toMatch(/^[a-f0-9]{64}$/);
        expect(file.origin_sha256).toMatch(/^[a-f0-9]{64}$/);
        // `root` covers platform-agnostic repo-root files such as TESTING.md,
        // which are installed once per run rather than per platform (issue #123).
        expect(file.profile).toMatch(/^(copilot|claude|kiro|root)$/);
      }
    });

    it("default profile (all) installs copilot + claude + kiro", () => {
      const result = run(["install", "--json"], { cwd: tmpDir });
      expect(result.exitCode).toBe(0);

      const output = JSON.parse(result.stdout) as {
        platforms: string[];
        files: Array<{ profile: string }>;
      };
      expect(output.platforms).toEqual(["copilot", "claude", "kiro"]);
    });

    it("--profile kiro installs only kiro files", () => {
      const result = run(["install", "--profile", "kiro", "--json"], { cwd: tmpDir });
      expect(result.exitCode).toBe(0);

      const output = JSON.parse(result.stdout) as {
        platforms: string[];
        files: Array<{ profile: string }>;
      };
      expect(output.platforms).toEqual(["kiro"]);
      for (const file of output.files) {
        // Root files carry the `root` tag on every profile; only platform files
        // are expected to carry the requested platform's tag.
        expect(file.profile).toMatch(/^(kiro|root)$/);
      }
      // The kiro profile must still not pull in another platform's files.
      const platformProfiles = output.files
        .filter((f) => f.profile !== "root")
        .map((f) => f.profile);
      expect(new Set(platformProfiles)).toEqual(new Set(["kiro"]));
    });

    it("--profile all installs all three platforms", () => {
      const result = run(["install", "--profile", "all", "--json"], { cwd: tmpDir });
      expect(result.exitCode).toBe(0);

      const output = JSON.parse(result.stdout) as {
        platforms: string[];
        files: Array<{ profile: string }>;
      };
      expect(output.platforms).toEqual(["copilot", "claude", "kiro"]);
      const profiles = new Set(output.files.map((f) => f.profile));
      expect(profiles.has("copilot")).toBe(true);
      expect(profiles.has("claude")).toBe(true);
      expect(profiles.has("kiro")).toBe(true);
    });

    it("invalid --profile value exits 2 with error message", () => {
      const result = run(["install", "--profile", "invalid"], { cwd: tmpDir });
      expect(result.exitCode).toBe(2);
      expect(result.stderr).toMatch(/Invalid profile/);
      expect(result.stderr).toMatch(/copilot/);
    });

    it("supports --json output for install", () => {
      const result = run(["install", "--json"], { cwd: tmpDir });
      expect(result.exitCode).toBe(0);

      const output = JSON.parse(result.stdout) as Record<string, unknown>;
      expect(output.command).toBe("install");
      expect(output.version).toBe(PKG_VERSION);
      expect(typeof output.installed).toBe("number");
      expect(Array.isArray(output.files)).toBe(true);
      expect(output.profile).toBe("all");
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

    it("installs files to native platform paths (not .dev-tasks/skills/)", () => {
      run(["install", "--profile", "copilot"], { cwd: tmpDir });

      // Files should be at .github/, not .dev-tasks/skills/
      expect(existsSync(join(tmpDir, ".github", "agents"))).toBe(true);
      expect(existsSync(join(tmpDir, ".dev-tasks", "skills"))).toBe(false);
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
      run(["pin", "0.5.0"], { cwd: tmpDir });

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
          files: [],
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
          files: [],
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
          files: [],
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
  describe("migrate docs", () => {
    let tmpDir: string;

    const PRODUCT = "# Product\n\nWhat this product is.\n";
    const TECH = "# Tech\n\nHow we build it.\n";

    function seedOldDocs(): void {
      mkdirSync(join(tmpDir, "docs"), { recursive: true });
      writeFileSync(join(tmpDir, "docs", "product-context.md"), PRODUCT, "utf-8");
      writeFileSync(join(tmpDir, "docs", "technical-guidelines.md"), TECH, "utf-8");
    }

    beforeEach(() => {
      tmpDir = mkdtempSync(join(tmpdir(), "dev-tasks-int-migrate-docs-"));
    });

    afterEach(() => {
      rmSync(tmpDir, { recursive: true, force: true });
    });

    it("proposes both renames and mutates nothing (AC-1)", () => {
      seedOldDocs();
      const result = run(["migrate", "docs"], { cwd: tmpDir });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/docs\/product-context\.md -> docs\/product\.md/);
      expect(result.stdout).toMatch(/docs\/technical-guidelines\.md -> docs\/tech\.md/);
      expect(result.stdout).toMatch(/--force/);

      expect(existsSync(join(tmpDir, "docs", "product-context.md"))).toBe(true);
      expect(existsSync(join(tmpDir, "docs", "product.md"))).toBe(false);
      expect(existsSync(join(tmpDir, ".dev-tasks"))).toBe(false);
    });

    it("lists consumer-owned files that still name the old documents (AC-1)", () => {
      seedOldDocs();
      writeFileSync(join(tmpDir, "CLAUDE.md"), "Read docs/product-context.md first.\n", "utf-8");

      const result = run(["migrate", "docs"], { cwd: tmpDir });
      expect(result.stdout).toMatch(/CLAUDE\.md/);
    });

    it("--force renames both files byte-identical and backs the originals up (AC-2)", () => {
      seedOldDocs();
      const result = run(["migrate", "docs", "--force"], { cwd: tmpDir });

      expect(result.exitCode).toBe(0);
      expect(existsSync(join(tmpDir, "docs", "product-context.md"))).toBe(false);
      expect(readFileSync(join(tmpDir, "docs", "product.md"), "utf-8")).toBe(PRODUCT);
      expect(readFileSync(join(tmpDir, "docs", "tech.md"), "utf-8")).toBe(TECH);

      const backupRoot = join(tmpDir, ".dev-tasks", "backup");
      expect(existsSync(backupRoot)).toBe(true);
      const stamps = readdirSync(backupRoot);
      expect(stamps).toHaveLength(1);
      expect(readFileSync(join(backupRoot, stamps[0], "docs", "product-context.md"), "utf-8")).toBe(
        PRODUCT,
      );
    });

    it("reports nothing to do on an already-migrated repository", () => {
      mkdirSync(join(tmpDir, "docs"), { recursive: true });
      writeFileSync(join(tmpDir, "docs", "product.md"), PRODUCT, "utf-8");
      writeFileSync(join(tmpDir, "docs", "tech.md"), TECH, "utf-8");

      const result = run(["migrate", "docs"], { cwd: tmpDir });
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/already use the current names/i);
    });

    it("refuses a rename whose target exists, exits 14, and leaves both files alone", () => {
      seedOldDocs();
      writeFileSync(join(tmpDir, "docs", "product.md"), "# Hand-migrated\n", "utf-8");

      const result = run(["migrate", "docs", "--force"], { cwd: tmpDir });
      expect(result.exitCode).toBe(14);
      expect(result.stdout).toMatch(/SKIPPED/);
      expect(readFileSync(join(tmpDir, "docs", "product.md"), "utf-8")).toBe("# Hand-migrated\n");
      expect(existsSync(join(tmpDir, "docs", "product-context.md"))).toBe(true);
      // The other rename still happens — one conflict does not abort the rest.
      expect(existsSync(join(tmpDir, "docs", "tech.md"))).toBe(true);
    });

    it("supports --json on the propose path (AC-6)", () => {
      seedOldDocs();
      const result = run(["migrate", "docs", "--json"], { cwd: tmpDir });
      expect(result.exitCode).toBe(0);

      const output = JSON.parse(result.stdout) as {
        command: string;
        applied: boolean;
        renames: Array<{ from: string; to: string; targetExists: boolean }>;
        consumerReferences: string[];
      };
      expect(output.command).toBe("migrate docs");
      expect(output.applied).toBe(false);
      expect(output.renames.map((r) => r.from).sort()).toEqual([
        "docs/product-context.md",
        "docs/technical-guidelines.md",
      ]);
      expect(Array.isArray(output.consumerReferences)).toBe(true);
    });

    it("supports --json on the apply path (AC-6)", () => {
      seedOldDocs();
      const result = run(["migrate", "docs", "--force", "--json"], { cwd: tmpDir });
      expect(result.exitCode).toBe(0);

      const output = JSON.parse(result.stdout) as {
        command: string;
        applied: boolean;
        backupPath?: string;
        renames: Array<{ from: string; to: string }>;
      };
      expect(output.command).toBe("migrate docs");
      expect(output.applied).toBe(true);
      expect(output.backupPath).toBeDefined();
      expect(output.renames).toHaveLength(2);
    });

    it("supports --json when there is nothing to migrate (AC-6)", () => {
      mkdirSync(join(tmpDir, "docs"), { recursive: true });
      writeFileSync(join(tmpDir, "docs", "product.md"), PRODUCT, "utf-8");

      const result = run(["migrate", "docs", "--json"], { cwd: tmpDir });
      expect(result.exitCode).toBe(0);

      const output = JSON.parse(result.stdout) as {
        applied: boolean;
        renames: unknown[];
        backupPath: string | null;
      };
      expect(output.applied).toBe(false);
      expect(output.renames).toEqual([]);
      expect(output.backupPath).toBeNull();
    });

    it("--json reports a skipped rename rather than swallowing it (AC-6)", () => {
      seedOldDocs();
      writeFileSync(join(tmpDir, "docs", "product.md"), "# Hand-migrated\n", "utf-8");

      const result = run(["migrate", "docs", "--force", "--json"], { cwd: tmpDir });
      expect(result.exitCode).toBe(14);

      const output = JSON.parse(result.stdout) as {
        renames: Array<{ from: string; skipped: string | null }>;
      };
      const product = output.renames.find((r) => r.from === "docs/product-context.md");
      expect(product?.skipped).toBe("target-exists");
    });

    it("leaves the bare `migrate` path untouched (AC-3)", () => {
      // No sub-verb: still the legacy shell-install migration, which has
      // nothing to do in a repository that was never installed by the
      // shell script — and must not notice the old foundation docs.
      seedOldDocs();
      const result = run(["migrate"], { cwd: tmpDir });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/No migration needed/);
      expect(result.stdout).not.toMatch(/product-context/);
      expect(existsSync(join(tmpDir, "docs", "product-context.md"))).toBe(true);
    });

    it("doctor detects the old names and proposes the command (AC-4)", () => {
      seedOldDocs();
      const result = run(["doctor", "--json"], { cwd: tmpDir });

      const output = JSON.parse(result.stdout) as {
        checks: Array<{ name: string; pass: boolean; message: string }>;
      };
      const check = output.checks.find((c) => c.name === "foundation-doc-names");
      expect(check?.pass).toBe(false);
      expect(check?.message).toMatch(/docs\/product-context\.md/);
      expect(check?.message).toMatch(/docs\/technical-guidelines\.md/);
      expect(check?.message).toMatch(/docs\/product\.md/);
      expect(check?.message).toMatch(/docs\/tech\.md/);
      expect(check?.message).toMatch(/dev-tasks migrate docs/);
    });

    it("doctor passes on a repository with no old names", () => {
      const result = run(["doctor", "--json"], { cwd: tmpDir });
      const output = JSON.parse(result.stdout) as {
        checks: Array<{ name: string; pass: boolean }>;
      };
      expect(output.checks.find((c) => c.name === "foundation-doc-names")?.pass).toBe(true);
    });
  });
});
