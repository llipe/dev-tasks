import { describe, it, expect, beforeAll } from "vitest";
import { execSync, execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");
const DIST_BIN = resolve(ROOT, "dist/bin");

describe("binary integration — built binaries resolve and execute", () => {
  beforeAll(() => {
    // Build the project if dist doesn't exist
    if (!existsSync(resolve(DIST_BIN, "dev-tasks.js"))) {
      execSync("pnpm run build", { cwd: ROOT, encoding: "utf-8" });
    }
  });

  function runBin(
    bin: string,
    args: string[] = [],
  ): { stdout: string; stderr: string; exitCode: number } {
    const binPath = resolve(DIST_BIN, `${bin}.js`);
    try {
      const stdout = execFileSync("node", [binPath, ...args], {
        cwd: ROOT,
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

  it("dev-tasks --version prints version from built binary", () => {
    const result = runBin("dev-tasks", ["--version"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("dt --version prints version from built binary", () => {
    const result = runBin("dt", ["--version"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("dev-tasks exits 2 on unknown command from built binary", () => {
    const result = runBin("dev-tasks", ["nonexistent"]);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toMatch(/unknown command/i);
  });

  it("dt exits 2 on unknown command from built binary", () => {
    const result = runBin("dt", ["nonexistent"]);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toMatch(/unknown command/i);
  });

  it("dev-tasks prints usage on no args from built binary", () => {
    const result = runBin("dev-tasks");
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toMatch(/usage/i);
  });

  it("dt prints usage on no args from built binary", () => {
    const result = runBin("dt");
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toMatch(/usage/i);
  });

  it("package.json bin field points to existing dist files", () => {
    const pkg = JSON.parse(execSync("cat package.json", { cwd: ROOT, encoding: "utf-8" })) as {
      bin: Record<string, string>;
    };

    expect(pkg.bin["dev-tasks"]).toBe("./dist/bin/dev-tasks.js");
    expect(pkg.bin["dt"]).toBe("./dist/bin/dt.js");

    expect(existsSync(resolve(ROOT, pkg.bin["dev-tasks"]))).toBe(true);
    expect(existsSync(resolve(ROOT, pkg.bin["dt"]))).toBe(true);
  });
});
