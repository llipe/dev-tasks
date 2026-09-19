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

  it("contains mono-repo mode (Mode A)", () => {
    expect(kiroContent).toContain("## Mode A — Mono-Repo (Current Flow)");
  });

  it("contains undocumented/greenfield mode (Mode B), investigating the codebase directly", () => {
    expect(kiroContent).toContain("## Mode B — Undocumented / Greenfield");
    expect(kiroContent).toContain("Investigate the codebase");
    expect(kiroContent).toContain("Present a findings summary");
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
