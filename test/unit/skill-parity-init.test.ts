/**
 * Structural parity check: verifies that the activity-init skill
 * has identical behavioral logic across all three platform trees.
 *
 * This test ensures that updates to the skill are consistently
 * mirrored across .kiro/, .github/, and .claude/ trees.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";

const ROOT = resolve(__dirname, "../..");

/** Strip platform-specific frontmatter (YAML between ---) for comparison */
function stripFrontmatter(content: string): string {
  const match = content.match(/^---\n[\s\S]*?\n---\n/);
  if (match) {
    return content.slice(match[0].length).trim();
  }
  return content.trim();
}

describe("activity-init skill parity", () => {
  const kiroPath = resolve(ROOT, ".kiro/skills/activity-init/SKILL.md");
  const githubPath = resolve(ROOT, ".github/skills/activity-init/SKILL.md");
  const claudePath = resolve(ROOT, ".claude/skills/activity-init/SKILL.md");

  const kiroContent = stripFrontmatter(readFileSync(kiroPath, "utf-8"));
  const githubContent = stripFrontmatter(readFileSync(githubPath, "utf-8"));
  const claudeContent = stripFrontmatter(readFileSync(claudePath, "utf-8"));

  it("all three trees have identical behavioral content (ignoring frontmatter)", () => {
    expect(kiroContent).toBe(githubContent);
    expect(kiroContent).toBe(claudeContent);
  });

  it("contains Mode Detection section", () => {
    expect(kiroContent).toContain("## Mode Detection");
  });

  it("contains documented-repository mode (Mode A), renamed per D-44", () => {
    expect(kiroContent).toContain("## Mode A — Documented Repository (Current Flow)");
  });

  it("no longer uses the old mode heading anywhere (AC-5)", () => {
    // The term is reserved for repository shape now. The rename note
    // that explains the change is the one permitted mention, so the
    // heading is what is asserted gone — not the word.
    for (const content of [kiroContent, githubContent, claudeContent]) {
      expect(content).not.toContain("## Mode A — Mono-Repo");
    }
  });

  it("documents repository-shape detection and the package map (AC-1, AC-2)", () => {
    for (const content of [kiroContent, githubContent, claudeContent]) {
      expect(content).toContain("## Repository Shape Detection");
      expect(content).toContain("pnpm-workspace.yaml");
      expect(content).toContain("[tool.uv.workspace]");
      expect(content).toContain("### Package Map");
      expect(content).toContain("Bounded context");
    }
  });

  it("states that a single-package repository records exactly one row (AC-3)", () => {
    expect(kiroContent).toContain("single-package repository records exactly one row");
  });

  it("fills bounded context freeform at interview time (AC-4, D-45)", () => {
    expect(kiroContent).toContain("shared-understanding#D-45");
    expect(kiroContent).toContain("freeform");
  });

  it("establishes docs/runbooks/ and its index (AC-7, PRD AC-26)", () => {
    // The other half of AC-7, which the SIMPLICITY clause alone did not
    // cover: activity-init must create the runbook index, not merely
    // leave it to `dev-tasks install`.
    for (const content of [kiroContent, githubContent, claudeContent]) {
      expect(content).toContain("docs/runbooks/README.md");
      expect(content).toContain("runbook-template.md");
      expect(content).toMatch(/MUST NOT\*{0,2} be overwritten/i);
    }
  });

  it("confirms the SIMPLICITY.md owner and thresholds with the user (AC-7)", () => {
    for (const content of [kiroContent, githubContent, claudeContent]) {
      expect(content).toContain("## SIMPLICITY.md Confirmation");
      expect(content).toContain("housekeeping");
      expect(content).toContain("MUST NOT** loosen");
    }
  });

  it("contains undocumented/greenfield mode (Mode B), investigating the codebase directly", () => {
    expect(kiroContent).toContain("## Mode B — Undocumented / Greenfield");
    expect(kiroContent).toContain("Investigate the codebase");
    expect(kiroContent).toContain("Present a findings summary");
  });

  it("names the glossary as the canonical source of context names (PT-5, AC-4, D-62)", () => {
    for (const content of [kiroContent, githubContent, claudeContent]) {
      expect(content).toContain("docs/domain/ubiquitous-language.md");
    }
  });

  it("no longer defers the canonical name to a future phase (PT-5, D-45 closed by D-69)", () => {
    for (const content of [kiroContent, githubContent, claudeContent]) {
      expect(content).not.toContain("Phase 3's glossary supersedes");
      expect(content).not.toContain("working label, not a contract");
    }
  });

  it("adds no interview step to do it (PT-5, AC-4)", () => {
    // D-62 bought the pointer with one sentence, explicitly instead of
    // a confirmation step. These two counts are the pin: a new
    // numbered step or a new section moves one of them, and the reason
    // the sentence was chosen over a step disappears quietly otherwise.
    for (const content of [kiroContent, githubContent, claudeContent]) {
      expect(content.match(/^[0-9]+\. /gm) ?? []).toHaveLength(54);
      expect(content.match(/^## /gm) ?? []).toHaveLength(16);
    }
  });

  it("has no multi-repo mode, dt invocation, or component.json reference (dt retirement, ADR-007)", () => {
    for (const content of [kiroContent, githubContent, claudeContent]) {
      expect(content).not.toMatch(/multi-repo/);
      expect(content).not.toMatch(/\bdt\s+(init|extract|catalog|scope|verify|ctx)\b/);
      expect(content).not.toContain("component.json");
      expect(content).not.toContain("review_flags");
    }
  });
});
