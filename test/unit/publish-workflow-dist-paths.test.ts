/**
 * The npm publish workflow's "Verify dist output" step only runs at
 * publish time, so a path it names going stale (as happened with
 * dist/bin/dt.js and dist/adapters/ during the dt retirement, ADR-007)
 * produces no CI signal until the next release actually fails.
 *
 * This test parses that step's shell script out of the workflow YAML and
 * asserts every path it checks for actually exists after a build, so the
 * same class of drift is caught on every PR instead of at publish time.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");
const WORKFLOW = resolve(ROOT, ".github/workflows/publish-npm.yml");

/** Extracts `[ -f path ]` / `[ -d path ]` checks from the "Verify dist output" step. */
function extractDistChecks(): Array<{ kind: "file" | "dir"; path: string }> {
  const yaml = readFileSync(WORKFLOW, "utf-8");
  const stepStart = yaml.indexOf("Verify dist output");
  expect(stepStart, "the 'Verify dist output' step must exist in publish-npm.yml").toBeGreaterThan(
    -1,
  );
  const nextStepIdx = yaml.indexOf("\n      - name:", stepStart);
  const stepBlock = yaml.slice(stepStart, nextStepIdx === -1 ? undefined : nextStepIdx);

  const checks: Array<{ kind: "file" | "dir"; path: string }> = [];
  const pattern = /\[\s*-([fd])\s+(\S+)\s*\]/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(stepBlock)) !== null) {
    checks.push({ kind: match[1] === "f" ? "file" : "dir", path: match[2] });
  }
  return checks;
}

describe("publish-npm.yml dist verification step", () => {
  beforeAll(() => {
    if (!existsSync(resolve(ROOT, "dist/bin/dev-tasks.js"))) {
      execSync("pnpm run build", { cwd: ROOT, encoding: "utf-8" });
    }
  });

  it("names at least one path to verify", () => {
    expect(extractDistChecks().length).toBeGreaterThan(0);
  });

  it("every path the workflow checks for exists after a build", () => {
    const checks = extractDistChecks();
    const missing = checks.filter(({ path }) => !existsSync(resolve(ROOT, path)));
    expect(
      missing,
      `paths named by the workflow but missing from dist/: ${JSON.stringify(missing)}`,
    ).toEqual([]);
  });

  it("does not check for the retired dt binary or the retired adapters/ directory", () => {
    const checks = extractDistChecks();
    const paths = checks.map((c) => c.path);
    expect(paths).not.toContain("dist/bin/dt.js");
    expect(paths).not.toContain("dist/adapters");
  });
});
