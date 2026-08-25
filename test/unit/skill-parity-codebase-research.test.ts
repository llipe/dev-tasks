/**
 * Structural parity check: verifies that activity-codebase-research skill
 * has identical behavioural content across all three platform trees,
 * and that it declares all eight research slices and both budget caps.
 *
 * Covers issue #139 AC-2.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";

const ROOT = resolve(__dirname, "../..");

const SKILL_PATHS = [
  ".github/skills/activity-codebase-research/SKILL.md",
  ".claude/skills/activity-codebase-research/SKILL.md",
  ".kiro/skills/activity-codebase-research/SKILL.md",
] as const;

/** All eight research slices that MUST be declared. */
const SLICES = ["S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8"] as const;

/** Budget cap constants that MUST appear in the skill. */
const BUDGET_CAPS = {
  maxLines: 250,
  maxFiles: 30,
} as const;

function stripFrontmatter(content: string): string {
  const match = content.match(/^---\n[\s\S]*?\n---\n/);
  if (match) {
    return content.slice(match[0].length).trim();
  }
  return content.trim();
}

function read(relPath: string): string {
  return readFileSync(resolve(ROOT, relPath), "utf-8");
}

describe("activity-codebase-research skill — presence", () => {
  for (const relPath of SKILL_PATHS) {
    it(`exists at ${relPath}`, () => {
      expect(existsSync(resolve(ROOT, relPath)), `missing required file: ${relPath}`).toBe(true);
    });
  }
});

describe("activity-codebase-research skill — behavioral parity", () => {
  it("all three trees have identical behavioural content (ignoring frontmatter)", () => {
    const contents = SKILL_PATHS.map((p) => stripFrontmatter(read(p)));
    expect(contents[0]).toBe(contents[1]);
    expect(contents[0]).toBe(contents[2]);
  });
});

describe("activity-codebase-research skill — eight slices declared", () => {
  for (const slice of SLICES) {
    it(`declares slice ${slice} in all three trees`, () => {
      for (const relPath of SKILL_PATHS) {
        const content = read(relPath);
        expect(content.includes(slice), `${relPath} does not mention slice ${slice}`).toBe(true);
      }
    });
  }
});

describe("activity-codebase-research skill — budget caps declared", () => {
  it(`declares max lines cap (${BUDGET_CAPS.maxLines}) in all three trees`, () => {
    for (const relPath of SKILL_PATHS) {
      const content = read(relPath);
      expect(
        content.includes(String(BUDGET_CAPS.maxLines)),
        `${relPath} does not declare the ${BUDGET_CAPS.maxLines}-line cap`,
      ).toBe(true);
    }
  });

  it(`declares max files cap (${BUDGET_CAPS.maxFiles}) in all three trees`, () => {
    for (const relPath of SKILL_PATHS) {
      const content = read(relPath);
      expect(
        content.includes(String(BUDGET_CAPS.maxFiles)),
        `${relPath} does not declare the ${BUDGET_CAPS.maxFiles}-file cap`,
      ).toBe(true);
    }
  });
});
