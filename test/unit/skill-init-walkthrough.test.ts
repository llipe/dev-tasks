/**
 * Dry-run walkthrough tests for the activity-init skill.
 *
 * These validate the documented behavioral branches for each mode:
 * - Mono-repo: current flow unchanged
 * - Undocumented/greenfield: direct codebase investigation + interview
 *
 * The former Multi-Repo mode (which invoked the retired binary and handled
 * its exit codes) was removed with it (ADR-007); see skill-parity-init.test.ts
 * for the assertion that no trace of it remains.
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
    it("documents /docs as the mono-repo trigger", () => {
      expect(skillContent).toContain("`/docs` directory exists → current single-repo flow");
    });

    it("documents absence of /docs as the undocumented/greenfield trigger", () => {
      expect(skillContent).toContain("no `/docs` → investigation-first flow");
    });
  });

  describe("Mono-repo mode (Mode A) — current flow unchanged", () => {
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

  describe("Undocumented/greenfield mode (Mode B) — investigation + interview", () => {
    it("investigates manifest files, directory structure, and README", () => {
      expect(skillContent).toContain(
        "Read manifest files (`package.json`, `pyproject.toml`, `go.mod`, or equivalent)",
      );
    });

    it("presents a findings summary before the interview", () => {
      expect(skillContent).toContain(
        "Show the user what was found — stack, frameworks, notable directories",
      );
    });

    it("conducts the standard interview after investigation", () => {
      expect(skillContent).toContain(
        "Proceed with the standard clarifying questions for product context and technical guidelines",
      );
    });

    it("handles empty project gracefully (skip investigation)", () => {
      expect(skillContent).toContain(
        "no identifiable stack (an empty project), skip investigation and proceed directly to the interview",
      );
    });
  });
});
