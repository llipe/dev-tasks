/**
 * Dry-run walkthrough tests for the activity-init skill.
 *
 * These validate the documented behavioral branches for each mode:
 * - Multi-repo: dt init invocation + exit code handling
 * - Mono-repo: current flow unchanged
 * - Undocumented/greenfield: extraction + interview
 *
 * Since the skill is a documentation artifact (Markdown), these tests
 * validate the documented logic structurally rather than executing code.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";

const ROOT = resolve(__dirname, "../..");
const SKILL_PATH = resolve(ROOT, ".kiro/skills/activity-init/SKILL.md");
const skillContent = readFileSync(SKILL_PATH, "utf-8");

describe("activity-init dry-run walkthroughs", () => {
  describe("Mode detection logic", () => {
    it("documents component.json as the multi-repo trigger", () => {
      expect(skillContent).toContain(
        "`component.json` exists at the repository root → the repository is a component in a multi-repo product",
      );
    });

    it("documents /docs as the mono-repo trigger (when no component.json)", () => {
      expect(skillContent).toContain(
        "no `component.json` at root, but `/docs` directory exists → current single-repo flow",
      );
    });

    it("documents neither present as undocumented/greenfield trigger", () => {
      expect(skillContent).toContain(
        "neither `component.json` nor `/docs` → extraction-first flow",
      );
    });

    it("documents precedence: component.json wins when both exist", () => {
      expect(skillContent).toContain(
        "If both `component.json` AND `/docs` exist, multi-repo mode wins",
      );
    });
  });

  describe("Multi-repo mode (Mode A) — dt init invocation", () => {
    it("invokes dt init --task with --json flag", () => {
      expect(skillContent).toContain('dt init --task "<user\'s task/product description>" --json');
    });

    it("handles exit 0: load bundle in numeric order + present review_flags", () => {
      expect(skillContent).toContain("Load bundle files in numeric order");
      expect(skillContent).toContain("Present `review_flags`");
    });

    it("handles exit 7: partition proposal, stop", () => {
      expect(skillContent).toContain("Gate abort — partition proposal");
      expect(skillContent).toContain("scope is too broad and needs to be split");
      expect(skillContent).toContain("**Stop** — do not proceed to planning");
    });

    it("handles exit 9: stale catalog, stop", () => {
      expect(skillContent).toContain("Stale catalog index");
      expect(skillContent).toContain("catalog index is stale and needs to be rebuilt");
      expect(skillContent).toContain("`dt catalog build`");
    });

    it("handles exit 10: invalid scope after LLM retry, stop", () => {
      expect(skillContent).toContain("Invalid scope after LLM retry");
      expect(skillContent).toContain("automatic scoping failed");
      expect(skillContent).toContain("`--components` for manual scope");
    });

    it("handles exit 11: no candidates found, stop", () => {
      expect(skillContent).toContain("No candidates found");
      expect(skillContent).toContain("no components matched the task description");
    });

    it("handles exit 6: budget overflow, stop", () => {
      expect(skillContent).toContain("Budget overflow");
      expect(skillContent).toContain("exceeds the token budget");
      expect(skillContent).toContain("`--max-components` or `--budget`");
    });

    it("prohibits direct /docs reading in multi-repo mode", () => {
      expect(skillContent).toContain(
        "**MUST NOT** read `/docs`, walk the repository tree, or inspect source files directly in multi-repo mode",
      );
    });

    it("allows follow-up questions for gaps not covered by bundle", () => {
      expect(skillContent).toContain(
        "**MAY** ask follow-up questions to fill gaps not covered by the bundle",
      );
    });
  });

  describe("Mono-repo mode (Mode B) — current flow unchanged", () => {
    it("preserves the standard interview flow", () => {
      expect(skillContent).toContain("Receive Initial Brief");
      expect(skillContent).toContain("Ask Clarifying Questions");
      expect(skillContent).toContain("Generate Product Context Document");
      expect(skillContent).toContain("Generate Technical Guidelines Document");
      expect(skillContent).toContain("Save Output");
    });

    it("follows the existing single-repo flow", () => {
      expect(skillContent).toContain(
        "the skill follows the **existing single-repo flow** unchanged",
      );
    });
  });

  describe("Undocumented/greenfield mode (Mode C) — extraction + interview", () => {
    it("runs dt extract detect first", () => {
      expect(skillContent).toContain(
        "Invoke `dt extract detect` to identify the repository's technology stack",
      );
    });

    it("runs dt extract all --interactive after detect", () => {
      expect(skillContent).toContain(
        "Invoke `dt extract all --interactive` to extract schema, OpenAPI, AsyncAPI",
      );
    });

    it("presents extraction report before interview", () => {
      expect(skillContent).toContain(
        "Show the user the results of extraction — what was found, confidence levels",
      );
    });

    it("conducts the standard interview after extraction", () => {
      expect(skillContent).toContain(
        "Proceed with the standard clarifying questions for product context and technical guidelines",
      );
    });

    it("handles empty project gracefully (skip extraction)", () => {
      expect(skillContent).toContain(
        "no extractable content was found (empty project), skip extraction and proceed directly to the interview",
      );
    });

    it("documents resume path for interrupted extraction", () => {
      expect(skillContent).toContain("`dt extract all --interactive` picks up where it left off");
    });
  });
});
