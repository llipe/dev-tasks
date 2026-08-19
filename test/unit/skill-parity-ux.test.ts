/**
 * Structural parity check: verifies that ux-scaffold and ux-theme-gen skills
 * have identical behavioural content across all three platform trees,
 * and that the ux-engineer agent is consistent across trees.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";

const ROOT = resolve(__dirname, "../..");

function stripFrontmatter(content: string): string {
  const match = content.match(/^---\n[\s\S]*?\n---\n/);
  if (match) {
    return content.slice(match[0].length).trim();
  }
  return content.trim();
}

describe("ux-scaffold skill parity", () => {
  const kiroPath = resolve(ROOT, ".kiro/skills/ux-scaffold/SKILL.md");
  const githubPath = resolve(ROOT, ".github/skills/ux-scaffold/SKILL.md");
  const claudePath = resolve(ROOT, ".claude/skills/ux-scaffold/SKILL.md");

  const kiroContent = stripFrontmatter(readFileSync(kiroPath, "utf-8"));
  const githubContent = stripFrontmatter(readFileSync(githubPath, "utf-8"));
  const claudeContent = stripFrontmatter(readFileSync(claudePath, "utf-8"));

  it("all three trees have identical behavioural content (ignoring frontmatter)", () => {
    expect(kiroContent).toBe(githubContent);
    expect(kiroContent).toBe(claudeContent);
  });

  it("contains html-lite and react-full templates", () => {
    expect(kiroContent).toContain("html-lite");
    expect(kiroContent).toContain("react-full");
  });

  it("does not contain react-mid (cut per decision 2)", () => {
    expect(kiroContent).not.toMatch(/\breact-mid\b.*\|.*Vite/);
  });

  it("references DESIGN.md as the sole token source", () => {
    expect(kiroContent).toContain("DESIGN.md");
  });

  it("scaffold scripts exist in all three trees", () => {
    for (const tree of [".github", ".claude", ".kiro"]) {
      expect(
        existsSync(resolve(ROOT, `${tree}/skills/ux-scaffold/scripts/scaffold-lite.sh`)),
        `scaffold-lite.sh missing in ${tree}`,
      ).toBe(true);
      expect(
        existsSync(resolve(ROOT, `${tree}/skills/ux-scaffold/scripts/scaffold-full.sh`)),
        `scaffold-full.sh missing in ${tree}`,
      ).toBe(true);
    }
  });
});

describe("ux-theme-gen skill parity", () => {
  const kiroPath = resolve(ROOT, ".kiro/skills/ux-theme-gen/SKILL.md");
  const githubPath = resolve(ROOT, ".github/skills/ux-theme-gen/SKILL.md");
  const claudePath = resolve(ROOT, ".claude/skills/ux-theme-gen/SKILL.md");

  const kiroContent = stripFrontmatter(readFileSync(kiroPath, "utf-8"));
  const githubContent = stripFrontmatter(readFileSync(githubPath, "utf-8"));
  const claudeContent = stripFrontmatter(readFileSync(claudePath, "utf-8"));

  it("all three trees have identical behavioural content (ignoring frontmatter)", () => {
    expect(kiroContent).toBe(githubContent);
    expect(kiroContent).toBe(claudeContent);
  });

  it("contains @theme inline (Tailwind v4)", () => {
    expect(kiroContent).toContain("@theme inline");
  });

  it("contains contract check section", () => {
    expect(kiroContent).toContain("Contract Check");
    expect(kiroContent).toContain("placeholder");
  });

  it("documents slot mapping from DESIGN.md to CSS variables", () => {
    expect(kiroContent).toContain("--color-primary");
    expect(kiroContent).toContain("--color-background");
  });

  it("specifies theme.css and tokens.json as outputs", () => {
    expect(kiroContent).toContain("theme.css");
    expect(kiroContent).toContain("tokens.json");
  });

  it("does not emit tailwind.theme.ts (Tailwind v4 has no config file)", () => {
    expect(kiroContent).not.toContain("tailwind.theme.ts");
  });
});

describe("ux-engineer agent parity", () => {
  const kiroPath = resolve(ROOT, ".kiro/agents/ux-engineer.md");
  const githubPath = resolve(ROOT, ".github/agents/ux-engineer.agent.md");
  const claudePath = resolve(ROOT, ".claude/agents/ux-engineer.md");

  const kiroContent = stripFrontmatter(readFileSync(kiroPath, "utf-8"));
  const githubContent = stripFrontmatter(readFileSync(githubPath, "utf-8"));
  const claudeContent = stripFrontmatter(readFileSync(claudePath, "utf-8"));

  it("all three trees have identical behavioural content (ignoring frontmatter)", () => {
    expect(kiroContent).toBe(githubContent);
    expect(kiroContent).toBe(claudeContent);
  });

  it("declares ownership of DESIGN.md", () => {
    expect(kiroContent).toContain("own");
    expect(kiroContent).toContain("/DESIGN.md");
  });

  it("supports fidelity parameter (lite and full)", () => {
    expect(kiroContent).toContain("fidelity");
    expect(kiroContent).toContain("lite");
    expect(kiroContent).toContain("full");
  });

  it("contains the filling procedure", () => {
    expect(kiroContent).toContain("Filling Procedure");
    expect(kiroContent).toContain("explicit human confirmation");
  });

  it("does not reference colorhunt or external palette URLs", () => {
    expect(kiroContent).not.toContain("colorhunt");
    expect(kiroContent).not.toContain("palette_url");
  });

  it("references ux-scaffold and ux-theme-gen skills", () => {
    expect(kiroContent).toContain("ux-scaffold");
    expect(kiroContent).toContain("ux-theme-gen");
  });

  it("lite is the default fidelity", () => {
    expect(kiroContent).toContain("Lite is the default");
  });
});

describe("webapp-mockup deprecation parity", () => {
  const kiroPath = resolve(ROOT, ".kiro/skills/webapp-mockup/SKILL.md");
  const githubPath = resolve(ROOT, ".github/skills/webapp-mockup/SKILL.md");
  const claudePath = resolve(ROOT, ".claude/skills/webapp-mockup/SKILL.md");

  const kiroContent = stripFrontmatter(readFileSync(kiroPath, "utf-8"));
  const githubContent = stripFrontmatter(readFileSync(githubPath, "utf-8"));
  const claudeContent = stripFrontmatter(readFileSync(claudePath, "utf-8"));

  it("all three trees have identical deprecation content", () => {
    expect(kiroContent).toBe(githubContent);
    expect(kiroContent).toBe(claudeContent);
  });

  it("is marked deprecated and directs to ux-scaffold", () => {
    expect(kiroContent).toContain("Deprecated");
    expect(kiroContent).toContain("ux-scaffold");
  });
});
