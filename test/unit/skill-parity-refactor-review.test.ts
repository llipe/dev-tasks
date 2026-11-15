/**
 * Structural parity check: verifies that the activity-refactor-review skill
 * has identical behavioural content across all three platform trees, that it
 * declares all eight dimensions and its Setup section, and that every
 * platform has an entry point and a registry row for it.
 *
 * Covers issue #347.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";

const ROOT = resolve(__dirname, "../..");

const SKILL = "activity-refactor-review";

const SKILL_PATHS = [
  `.github/skills/${SKILL}/SKILL.md`,
  `.claude/skills/${SKILL}/SKILL.md`,
  `.kiro/skills/${SKILL}/SKILL.md`,
] as const;

/** Entry points: Kiro has no prompt files, so its entry is the agent itself. */
const ENTRY_POINTS = [
  ".claude/commands/refactor-review.md",
  ".github/prompts/refactor-review.prompt.md",
  ".kiro/agents/product-engineer.md",
] as const;

/** Registries that MUST list the skill, root docs and consumer templates alike. */
const REGISTRIES = [
  "AGENTS.md",
  "AGENTS.md.template",
  "CLAUDE.md",
  "CLAUDE.md.template",
  "README.md",
] as const;

/** All eight refactoring dimensions that MUST be declared. */
const DIMENSIONS = ["R1", "R2", "R3", "R4", "R5", "R6", "R7", "R8"] as const;

/** Sections a consumer depends on to install, start, and bound a run. */
const REQUIRED_SECTIONS = ["## Setup", "## Write Authority", "## Procedure"] as const;

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

describe(`${SKILL} skill — presence`, () => {
  for (const relPath of SKILL_PATHS) {
    it(`exists at ${relPath}`, () => {
      expect(existsSync(resolve(ROOT, relPath)), `missing required file: ${relPath}`).toBe(true);
    });
  }
});

describe(`${SKILL} skill — behavioral parity`, () => {
  it("all three trees have identical behavioural content (ignoring frontmatter)", () => {
    const contents = SKILL_PATHS.map((p) => stripFrontmatter(read(p)));
    expect(contents[0]).toBe(contents[1]);
    expect(contents[0]).toBe(contents[2]);
  });
});

describe(`${SKILL} skill — structure`, () => {
  const content = read(SKILL_PATHS[1]);

  for (const dimension of DIMENSIONS) {
    it(`declares dimension ${dimension}`, () => {
      expect(content).toMatch(new RegExp(`^\\| ${dimension} +\\|`, "m"));
    });
  }

  for (const section of REQUIRED_SECTIONS) {
    it(`has the "${section}" section`, () => {
      expect(content.split("\n")).toContain(section);
    });
  }
});

describe(`${SKILL} skill — entry points and registries`, () => {
  for (const relPath of ENTRY_POINTS) {
    it(`${relPath} points at the skill`, () => {
      expect(read(relPath)).toContain(SKILL);
    });
  }

  for (const relPath of REGISTRIES) {
    it(`${relPath} lists the skill`, () => {
      expect(read(relPath)).toContain(SKILL);
    });
  }
});
