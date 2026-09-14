/**
 * Deterministic checks for git-guard rule 4 (tags are human-only).
 *
 * Covers Story S-007 AC-3 and AC-5. The hook receives the PreToolUse payload as
 * JSON on stdin; exit code 2 blocks the command, exit 0 allows it. AC-4 is
 * checked here too: both release workflows must trigger on the exact-semver tag
 * filter `v[0-9]+.[0-9]+.[0-9]+`.
 */

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");
const HOOK = resolve(ROOT, ".claude/hooks/git-guard.sh");

/** Run the hook with a command string, return its exit code. */
function runHook(command: string): number {
  const payload = JSON.stringify({ tool_input: { command } });
  const result = spawnSync("bash", [HOOK], { input: payload, encoding: "utf-8" });
  return result.status ?? -1;
}

const BLOCK_MATRIX: readonly string[] = [
  "git tag v1.2.3",
  "git tag -a v1.2.3 -m 'release'",
  "git tag -d v1.2.3",
  "git tag -f v1.2.3",
  "git push --tags",
  "git push origin refs/tags/v1",
  "git push origin v1.2.3",
  "git push origin :refs/tags/v1.2.3",
  "gh release create v1.2.3",
];

const ALLOW_MATRIX: readonly string[] = [
  "git tag -l",
  "git tag --list",
  "git tag",
  "git describe --tags",
  "git push -u origin issue/1-x",
];

describe("git-guard rule 4 — blocks agent tag operations", () => {
  for (const cmd of BLOCK_MATRIX) {
    it(`blocks: ${cmd}`, () => {
      expect(runHook(cmd), `expected block (exit 2) for: ${cmd}`).toBe(2);
    });
  }
});

describe("git-guard rule 4 — allows tag reads and branch pushes", () => {
  for (const cmd of ALLOW_MATRIX) {
    it(`allows: ${cmd}`, () => {
      expect(runHook(cmd), `expected allow (exit 0) for: ${cmd}`).toBe(0);
    });
  }
});

describe("git-guard header documents four invariants", () => {
  it("mentions a fourth invariant about tags", () => {
    const src = readFileSync(HOOK, "utf-8");
    expect(/tag/i.test(src), "hook does not mention tags").toBe(true);
  });
});

// ─── AC-4: exact-semver workflow filters ─────────────────────────────────────

const WORKFLOWS = [
  ".github/workflows/publish-npm.yml",
  ".github/workflows/release-bundle.yml",
] as const;

describe("release workflows — AC-4: exact-semver tag filter", () => {
  for (const wf of WORKFLOWS) {
    it(`${wf} triggers on v[0-9]+.[0-9]+.[0-9]+`, () => {
      const content = readFileSync(resolve(ROOT, wf), "utf-8");
      expect(
        content.includes("v[0-9]+.[0-9]+.[0-9]+"),
        `${wf} does not use the exact-semver tag filter`,
      ).toBe(true);
      expect(
        content.includes("v[0-9]+.[0-9]+.[0-9]*"),
        `${wf} still uses the loose prerelease-permitting filter`,
      ).toBe(false);
    });
  }
});
