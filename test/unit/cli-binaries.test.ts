import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");
const TSX = resolve(ROOT, "node_modules/.bin/tsx");

function run(
  bin: string,
  args: string[] = [],
): { stdout: string; stderr: string; exitCode: number } {
  const binPath = resolve(ROOT, bin);
  try {
    const stdout = execFileSync(TSX, [binPath, ...args], {
      cwd: ROOT,
      encoding: "utf-8",
      env: { ...process.env, NODE_ENV: "test" },
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

describe("bin/dev-tasks.ts", () => {
  it("prints usage and exits 2 on no arguments", () => {
    const result = run("bin/dev-tasks.ts");
    expect(result.exitCode).toBe(2);
    expect(result.stdout + result.stderr).toMatch(/usage/i);
  });

  it("prints usage and exits 2 on unknown command", () => {
    const result = run("bin/dev-tasks.ts", ["foobar"]);
    expect(result.exitCode).toBe(2);
    expect(result.stdout + result.stderr).toMatch(/unknown command/i);
  });

  it("prints version on --version", () => {
    const result = run("bin/dev-tasks.ts", ["--version"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("lists known commands in usage", () => {
    const result = run("bin/dev-tasks.ts");
    const output = result.stdout + result.stderr;
    expect(output).toMatch(/install/);
    expect(output).toMatch(/update/);
    expect(output).toMatch(/status/);
    expect(output).toMatch(/pin/);
    expect(output).toMatch(/doctor/);
  });
});

describe("bin/dt.ts", () => {
  it("prints usage and exits 2 on no arguments", () => {
    const result = run("bin/dt.ts");
    expect(result.exitCode).toBe(2);
    expect(result.stdout + result.stderr).toMatch(/usage/i);
  });

  it("prints usage and exits 2 on unknown command", () => {
    const result = run("bin/dt.ts", ["foobar"]);
    expect(result.exitCode).toBe(2);
    expect(result.stdout + result.stderr).toMatch(/unknown command/i);
  });

  it("prints version on --version", () => {
    const result = run("bin/dt.ts", ["--version"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("lists known commands in usage", () => {
    const result = run("bin/dt.ts");
    const output = result.stdout + result.stderr;
    expect(output).toMatch(/extract/);
    expect(output).toMatch(/catalog/);
    expect(output).toMatch(/ctx/);
    expect(output).toMatch(/scope/);
    expect(output).toMatch(/init/);
    expect(output).toMatch(/verify/);
    expect(output).toMatch(/validate-component/);
  });
});
