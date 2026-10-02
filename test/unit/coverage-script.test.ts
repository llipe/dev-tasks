/**
 * Issue #247: `vitest.config.ts` declared the V8 coverage provider, but the
 * provider package was never installed and no `test:coverage` script existed,
 * so every Phase 3 gate recorded `coverage_gate: SKIPPED` for one cause.
 *
 * These assertions pin the four facts that make coverage measurable without
 * slowing the default gate:
 *   - `@vitest/coverage-v8` is an exact-pinned devDependency matching `vitest`
 *   - `test:coverage` runs vitest with `--coverage`
 *   - `validate` does not run coverage (refinement §5 Q1: recorded, not enforced)
 *   - the coverage output directory is ignored by git, prettier, and eslint
 *   - `vitest.config.ts` declares no coverage thresholds (baseline recorded, not enforced)
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");

const pkg = JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf-8")) as {
  scripts: Record<string, string>;
  devDependencies: Record<string, string>;
};

function ignoreLines(file: string): string[] {
  return readFileSync(resolve(ROOT, file), "utf-8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
}

describe("coverage tooling (#247)", () => {
  it("pins @vitest/coverage-v8 exactly to the vitest version", () => {
    const provider = pkg.devDependencies["@vitest/coverage-v8"];
    const vitest = pkg.devDependencies["vitest"].replace(/^[\^~]/, "");
    expect(provider, "@vitest/coverage-v8 must be a devDependency").toBeTypeOf("string");
    expect(provider, "provider must be an exact version, not a range").toMatch(/^\d+\.\d+\.\d+$/);
    expect(provider).toBe(vitest);
  });

  it("defines test:coverage running vitest with --coverage", () => {
    const script = pkg.scripts["test:coverage"];
    expect(script).toBeTypeOf("string");
    expect(script).toMatch(/\bvitest run\b/);
    expect(script).toContain("--coverage");
  });

  it("keeps coverage out of validate", () => {
    const validate = pkg.scripts["validate"];
    expect(validate).not.toContain("coverage");
    expect(validate).toContain("pnpm run test");
    expect(validate).not.toContain("test:coverage");
  });

  it("ignores the coverage output directory in git and prettier", () => {
    expect(ignoreLines(".gitignore")).toContain("coverage/");
    expect(ignoreLines(".prettierignore")).toContain("coverage/");
  });

  it("ignores the coverage output directory in eslint", () => {
    const eslintConfig = readFileSync(resolve(ROOT, "eslint.config.js"), "utf-8");
    expect(eslintConfig).toMatch(/ignores:\s*\[[^\]]*"coverage\/"/);
  });

  it("declares no coverage thresholds, so the baseline is recorded but not enforced", () => {
    const vitestConfig = readFileSync(resolve(ROOT, "vitest.config.ts"), "utf-8");
    expect(vitestConfig).toContain('provider: "v8"');
    expect(vitestConfig).not.toMatch(/thresholds/);
  });
});
