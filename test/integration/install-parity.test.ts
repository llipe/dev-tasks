/**
 * Per-profile installed-state equivalence for Claude root context (issue #171,
 * task 3.0).
 *
 * `ROOT_FILES` (`DESIGN.md`, `TESTING.md`) install unconditionally on every
 * run. `CLAUDE.md` and `AGENTS.md` are different: they are consumer-facing
 * project memory that a consumer fills in with their own content, so they
 * must use install-if-absent semantics (never overwritten once present) while
 * still being delivered on a fresh install so Claude Code loads project
 * memory on the first turn.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { execSync, execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

const ROOT = resolve(import.meta.dirname, "../..");
const DIST_BIN = resolve(ROOT, "dist/bin/dev-tasks.js");

describe("install/update — Claude root context parity (#171)", () => {
  let tmpDir: string;

  beforeAll(() => {
    if (!existsSync(DIST_BIN)) {
      execSync("pnpm run build", { cwd: ROOT, encoding: "utf-8" });
    }
  });

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "dev-tasks-install-parity-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  function run(
    args: string[],
    options: { cwd?: string } = {},
  ): { stdout: string; stderr: string; exitCode: number } {
    const cwd = options.cwd ?? tmpDir;
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

  it("a fresh `install --profile claude` produces CLAUDE.md and AGENTS.md", () => {
    const result = run(["install", "--profile", "claude"]);
    expect(result.exitCode).toBe(0);

    const claudeMdPath = join(tmpDir, "CLAUDE.md");
    const agentsMdPath = join(tmpDir, "AGENTS.md");
    expect(existsSync(claudeMdPath)).toBe(true);
    expect(existsSync(agentsMdPath)).toBe(true);

    const claudeMd = readFileSync(claudeMdPath, "utf-8");
    expect(claudeMd.length).toBeGreaterThan(0);
  });

  it("an existing consumer CLAUDE.md survives `install` unchanged", () => {
    const consumerContent = "# My Project\n\nConsumer-authored project memory. Do not touch.\n";
    writeFileSync(join(tmpDir, "CLAUDE.md"), consumerContent, "utf-8");

    const result = run(["install", "--profile", "claude"]);
    expect(result.exitCode).toBe(0);

    expect(readFileSync(join(tmpDir, "CLAUDE.md"), "utf-8")).toBe(consumerContent);
  });

  it("an existing consumer AGENTS.md survives `install` unchanged", () => {
    const consumerContent = "# My Project Agents\n\nConsumer-authored. Do not touch.\n";
    writeFileSync(join(tmpDir, "AGENTS.md"), consumerContent, "utf-8");

    const result = run(["install", "--profile", "claude"]);
    expect(result.exitCode).toBe(0);

    expect(readFileSync(join(tmpDir, "AGENTS.md"), "utf-8")).toBe(consumerContent);
  });

  it("an existing consumer CLAUDE.md survives `update` unchanged", () => {
    const consumerContent = "# My Project\n\nConsumer-authored project memory. Do not touch.\n";

    const installResult = run(["install", "--profile", "claude"]);
    expect(installResult.exitCode).toBe(0);

    writeFileSync(join(tmpDir, "CLAUDE.md"), consumerContent, "utf-8");

    const updateResult = run(["update"]);
    expect(updateResult.exitCode).toBe(0);

    expect(readFileSync(join(tmpDir, "CLAUDE.md"), "utf-8")).toBe(consumerContent);
  });

  it("CLAUDE.md.template and AGENTS.md.template are not tracked in the manifest", () => {
    const result = run(["install", "--profile", "claude", "--json"]);
    expect(result.exitCode).toBe(0);

    const manifestPath = join(tmpDir, ".dev-tasks", "manifest.json");
    expect(existsSync(manifestPath)).toBe(true);
    const manifest = JSON.parse(readFileSync(manifestPath, "utf-8")) as {
      files: Array<{ path: string }>;
    };
    const trackedPaths = manifest.files.map((f) => f.path);
    expect(trackedPaths).not.toContain("CLAUDE.md");
    expect(trackedPaths).not.toContain("AGENTS.md");
  });
});
