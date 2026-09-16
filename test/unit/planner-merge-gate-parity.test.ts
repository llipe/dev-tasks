/**
 * Parity check for planner's merge-gate step 13 (issue #177, PR #181 audit fix 3).
 *
 * `.claude/commands/planner.md` merge gate 13 requires observed-state confirmation
 * (`gh pr view <n> --json state,mergedAt`, requiring `state: MERGED` and non-null
 * `mergedAt`) before writing `✅ Merged` to the checkpoint. `.kiro/agents/planner.md`
 * had not been updated to match and still described the old, unverified checkpoint
 * behavior. This is the first dedicated parity test for that specific line — see
 * test/unit/infra-engineer-parity.test.ts and test/unit/researcher-parity.test.ts
 * for the established parity-test pattern this follows.
 *
 * `.github/agents/planner.md` does not exist — planner is `.claude/commands/`-only
 * on that platform per AGENTS.md, so there is no third file to check here.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");
const CLAUDE_PLANNER = ".claude/commands/planner.md";
const KIRO_PLANNER = ".kiro/agents/planner.md";

function read(relativePath: string): string {
  return readFileSync(resolve(ROOT, relativePath), "utf8");
}

/** Extract the numbered merge-gate step 13 line from a planner file. */
function extractGate13(content: string): string | null {
  const match = content.match(/^13\.\s.*$/m);
  return match ? match[0] : null;
}

describe("planner merge gate 13 — verify-before-checkpoint parity", () => {
  it("both planner variants declare merge gate step 13", () => {
    expect(extractGate13(read(CLAUDE_PLANNER)), `${CLAUDE_PLANNER} missing step 13`).not.toBeNull();
    expect(extractGate13(read(KIRO_PLANNER)), `${KIRO_PLANNER} missing step 13`).not.toBeNull();
  });

  it("both planner variants require gh pr view state/mergedAt confirmation before writing Merged", () => {
    for (const relativePath of [CLAUDE_PLANNER, KIRO_PLANNER]) {
      const gate = extractGate13(read(relativePath));
      expect(gate, `${relativePath} missing step 13`).not.toBeNull();
      expect(
        /gh pr view.*--json state,mergedAt/.test(gate as string),
        `${relativePath} step 13 does not require 'gh pr view <n> --json state,mergedAt'`,
      ).toBe(true);
      expect(
        /state.*MERGED/.test(gate as string) && /mergedAt.*non-null/.test(gate as string),
        `${relativePath} step 13 does not require state MERGED and mergedAt non-null`,
      ).toBe(true);
      expect(
        /do not.*write.*✅ Merged|not.*write.*✅ Merged/.test(gate as string),
        `${relativePath} step 13 does not forbid writing '✅ Merged' when the check fails`,
      ).toBe(true);
    }
  });

  it("both planner variants declare the identical step 13 text (exact parity)", () => {
    const claudeGate = extractGate13(read(CLAUDE_PLANNER));
    const kiroGate = extractGate13(read(KIRO_PLANNER));
    expect(claudeGate).not.toBeNull();
    expect(kiroGate).toBe(claudeGate);
  });
});
