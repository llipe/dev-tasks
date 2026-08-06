/**
 * Edge-case tests for the activity-init skill mode detection.
 *
 * Covers:
 * - Repo with both component.json and /docs (multi-repo wins)
 * - Exit 7/9 presentation completeness
 * - Interrupted interactive extraction (clear resume path)
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";

const ROOT = resolve(__dirname, "../..");
const SKILL_PATH = resolve(ROOT, ".kiro/skills/activity-init/SKILL.md");
const skillContent = readFileSync(SKILL_PATH, "utf-8");

describe("activity-init edge cases", () => {
  describe("repo with both component.json and /docs", () => {
    it("multi-repo mode takes precedence", () => {
      // The skill must explicitly document this precedence rule
      expect(skillContent).toContain(
        "If both `component.json` AND `/docs` exist, multi-repo mode wins — `component.json` is the authoritative signal",
      );
    });

    it("precedence is documented as a blockquote for visibility", () => {
      // Check that it's marked as a notable callout
      expect(skillContent).toContain("> **Precedence:**");
    });
  });

  describe("exit 7 (gate abort) presentation", () => {
    it("includes actionable guidance for the user", () => {
      expect(skillContent).toContain("scope is too broad and needs to be split");
    });

    it("stops the entire flow — no planning proceeds", () => {
      expect(skillContent).toContain("**Stop** — do not proceed to planning");
    });

    it("presents the partition proposal to the user", () => {
      expect(skillContent).toContain("Present the partition proposal to the user");
    });
  });

  describe("exit 9 (stale catalog) presentation", () => {
    it("includes actionable guidance to rebuild", () => {
      expect(skillContent).toContain("`dt catalog build`");
    });

    it("stops the entire flow", () => {
      // After exit 9, skill must not continue
      const exit9Section = skillContent.substring(
        skillContent.indexOf("Stale catalog index"),
        skillContent.indexOf("Stale catalog index") + 200,
      );
      expect(exit9Section).toContain("Stop");
    });
  });

  describe("interrupted interactive extraction", () => {
    it("documents that --interactive allows user to confirm or skip", () => {
      expect(skillContent).toContain(
        "`--interactive` flag allows the user to confirm or skip ambiguous extractions",
      );
    });

    it("documents a clear resume path", () => {
      expect(skillContent).toContain("`dt extract all --interactive` picks up where it left off");
    });

    it("mentions interruption handling as a SHOULD", () => {
      // The skill should inform how to resume
      expect(skillContent).toContain("**SHOULD** inform the user how to resume");
    });
  });

  describe("final instructions enforce mode detection first", () => {
    it("first instruction requires mode detection", () => {
      const finalSection = skillContent.substring(
        skillContent.lastIndexOf("## Final Instructions"),
      );
      // Instruction 1 must be about mode detection
      expect(finalSection).toContain("1. You **MUST** detect the repository mode before starting");
    });

    it("explicitly prohibits /docs reading in multi-repo mode in final instructions", () => {
      const finalSection = skillContent.substring(
        skillContent.lastIndexOf("## Final Instructions"),
      );
      expect(finalSection).toContain(
        "In multi-repo mode, you **MUST NOT** read `/docs` or walk the repository directly",
      );
    });
  });
});
