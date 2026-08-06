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
    expect(kiroContent).toContain("## Mode Detection (RF-60)");
  });

  it("contains multi-repo mode (Mode A)", () => {
    expect(kiroContent).toContain("## Mode A — Multi-Repo (RF-61)");
    expect(kiroContent).toContain("dt init --task");
    expect(kiroContent).toContain("MUST NOT** read `/docs`");
  });

  it("contains mono-repo mode (Mode B)", () => {
    expect(kiroContent).toContain("## Mode B — Mono-Repo (Current Flow)");
  });

  it("contains undocumented/greenfield mode (Mode C)", () => {
    expect(kiroContent).toContain("## Mode C — Undocumented / Greenfield");
    expect(kiroContent).toContain("dt extract detect");
    expect(kiroContent).toContain("dt extract all --interactive");
  });

  it("documents exit code handling for multi-repo mode", () => {
    expect(kiroContent).toContain("Exit Code");
    expect(kiroContent).toContain("`0`");
    expect(kiroContent).toContain("`7`");
    expect(kiroContent).toContain("`9`");
    expect(kiroContent).toContain("`10`");
    expect(kiroContent).toContain("`11`");
    expect(kiroContent).toContain("`6`");
  });

  it("documents component.json as the multi-repo signal with precedence over /docs", () => {
    expect(kiroContent).toContain("component.json");
    expect(kiroContent).toContain(
      "If both `component.json` AND `/docs` exist, multi-repo mode wins",
    );
  });

  it("documents review_flags presentation on success", () => {
    expect(kiroContent).toContain("review_flags");
    expect(kiroContent).toContain("present them as warnings");
  });
});
