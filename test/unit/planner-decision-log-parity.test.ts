/**
 * Parity check for planner's Phase 4 per-story handoff `decision_log_path` field
 * (issue #217, Story S-005).
 *
 * Specification §8.5 requires the per-story delegation template to pass a
 * `decision_log_path` field (`workstream/decisions-<feature>.md`) to `developer`
 * unconditionally, alongside the existing `task_file`/`test_plan_path`/integration
 * branch/test-first fields. This must land in lockstep across
 * `.claude/commands/planner.md`, `.github/agents/planner.agent.md`, and
 * `.kiro/agents/planner.md` (research risk #6) — this test closes that gap,
 * following the established parity-test pattern in
 * test/unit/planner-merge-gate-parity.test.ts.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");
const CLAUDE_PLANNER = ".claude/commands/planner.md";
const GITHUB_PLANNER = ".github/agents/planner.agent.md";
const KIRO_PLANNER = ".kiro/agents/planner.md";
const PLANNER_FILES = [CLAUDE_PLANNER, GITHUB_PLANNER, KIRO_PLANNER];

function read(relativePath: string): string {
  return readFileSync(resolve(ROOT, relativePath), "utf8");
}

/** Extract the body of the Phase 4 Handoff template's ````markdown fenced block. */
function extractHandoffTemplate(content: string): string | null {
  const match = content.match(/Handoff template:\s*\n+````markdown\n([\s\S]*?)\n````/);
  return match ? match[1] : null;
}

describe("planner Phase 4 handoff — decision_log_path parity", () => {
  it("all three planner variants declare a Handoff template block", () => {
    for (const relativePath of PLANNER_FILES) {
      expect(
        extractHandoffTemplate(read(relativePath)),
        `${relativePath} missing Handoff template block`,
      ).not.toBeNull();
    }
  });

  it("the per-story handoff bullet list mentions decision_log_path in all three trees", () => {
    for (const relativePath of PLANNER_FILES) {
      const content = read(relativePath);
      expect(
        /decision_log_path/.test(content),
        `${relativePath} does not mention decision_log_path anywhere`,
      ).toBe(true);
    }
  });

  it("the handoff template body includes a decision_log_path field, in all three trees", () => {
    for (const relativePath of PLANNER_FILES) {
      const template = extractHandoffTemplate(read(relativePath));
      expect(template, `${relativePath} missing Handoff template block`).not.toBeNull();
      expect(
        /decision_log_path/.test(template as string),
        `${relativePath} Handoff template does not include decision_log_path`,
      ).toBe(true);
    }
  });

  it("the plain-language handoff bullet list documents the workstream/decisions-<feature>.md path pattern, in all three trees", () => {
    for (const relativePath of PLANNER_FILES) {
      const content = read(relativePath);
      const bulletMatch = content.match(
        /For each story invoke `developer` in \*\*Execute Mode\*\* with:[\s\S]*?(?=\n###)/,
      );
      expect(bulletMatch, `${relativePath} missing per-story handoff bullet list`).not.toBeNull();
      expect(
        /workstream\/decisions-<feature>\.md/.test(bulletMatch ? bulletMatch[0] : ""),
        `${relativePath} per-story handoff bullet list does not reference workstream/decisions-<feature>.md`,
      ).toBe(true);
    }
  });

  it("the decision_log_path handoff template line is passed unconditionally (no default/fallback qualifier)", () => {
    for (const relativePath of PLANNER_FILES) {
      const template = extractHandoffTemplate(read(relativePath)) as string;
      const line = template.split("\n").find((l) => l.includes("decision_log_path"));
      expect(line, `${relativePath} Handoff template missing decision_log_path line`).toBeDefined();
      expect(
        /\| default:/.test(line as string),
        `${relativePath} decision_log_path line has a conditional default, but must be passed unconditionally: "${line}"`,
      ).toBe(false);
    }
  });

  it("all three trees declare the identical decision_log_path handoff line (exact parity)", () => {
    const lines = PLANNER_FILES.map((relativePath) => {
      const template = extractHandoffTemplate(read(relativePath)) as string;
      return template.split("\n").find((l) => l.includes("decision_log_path"));
    });
    expect(lines[0]).toBeDefined();
    expect(lines[1]).toBe(lines[0]);
    expect(lines[2]).toBe(lines[0]);
  });

  it("the plain-language handoff bullet list also cites decision_log_path in all three trees", () => {
    for (const relativePath of PLANNER_FILES) {
      const content = read(relativePath);
      const bulletMatch = content.match(
        /For each story invoke `developer` in \*\*Execute Mode\*\* with:[\s\S]*?(?=\n###)/,
      );
      expect(bulletMatch, `${relativePath} missing per-story handoff bullet list`).not.toBeNull();
      expect(
        /decision_log_path/.test(bulletMatch ? bulletMatch[0] : ""),
        `${relativePath} per-story handoff bullet list does not mention decision_log_path`,
      ).toBe(true);
    }
  });
});
