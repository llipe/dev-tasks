/**
 * Structural and behavioral parity checks for the `qa-engineer` agent.
 *
 * Covers issue #123 AC-1 (agent exists on all three platforms with both entry
 * points and an equivalent behavioral contract) and AC-2 (Kiro prompt stays
 * within the line cap, declares exactly one procedure, and has no invocation
 * modes).
 *
 * Test plan mapping (workstream/test-plan-123.md):
 *   SC-1  all five files present with equivalent contract
 *   SC-2  one platform variant absent
 *   SC-3  behavioral divergence between platform variants
 *   SC-4  prompt within the length cap and single-procedure
 *   SC-5  prompt reintroduces invocation modes
 *   EC-16 prompt length at the cap boundary (149 / 150 / 151)
 *   CT-8  Kiro agent frontmatter conformance (no `permissions` block)
 *   CT-10 cross-platform contract equivalence
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";

const ROOT = resolve(__dirname, "../..");

/** AC-2: hard cap on the Kiro `qa-engineer` prompt. */
const MAX_PROMPT_LINES = 150;

const KIRO_AGENT = ".kiro/agents/qa-engineer.md";
const COPILOT_AGENT = ".github/agents/qa-engineer.agent.md";
const CLAUDE_AGENT = ".claude/agents/qa-engineer.md";
const COPILOT_ENTRY = ".github/prompts/qa-engineer.prompt.md";
const CLAUDE_ENTRY = ".claude/commands/qa-engineer.md";

/** The three agent definitions that must carry an equivalent contract. */
const AGENT_VARIANTS = [KIRO_AGENT, COPILOT_AGENT, CLAUDE_AGENT] as const;

/** Every file the agent ships as, including platform entry points. */
const ALL_REQUIRED_FILES = [...AGENT_VARIANTS, COPILOT_ENTRY, CLAUDE_ENTRY] as const;

/**
 * Normative statements that MUST appear in all three agent variants.
 * Byte-level parity is not required; behavioral parity is.
 */
const CONTRACT_STATEMENTS: ReadonlyArray<{ label: string; pattern: RegExp }> = [
  { label: "step 1 — standards check", pattern: /standards check/i },
  { label: "step 2 — author or fill missing tests", pattern: /author or fill/i },
  { label: "step 3 — coverage and gap report", pattern: /coverage and gap report/i },
  { label: "does not grade its own work", pattern: /does not grade its own work/i },
  { label: "verifier owns the audit", pattern: /\bverifier\b/i },
  { label: "test-only config authority", pattern: /test-only config/i },
  { label: "skill: activity-test-standards", pattern: /activity-test-standards/ },
  { label: "skill: activity-test-implementation", pattern: /activity-test-implementation/ },
  { label: "skill: activity-coverage-gap-analysis", pattern: /activity-coverage-gap-analysis/ },
];

/** Headings that would reintroduce invocation modes (AC-2 forbids them). */
const MODE_HEADING = /^#{2,3}\s+(Invocation\s+Modes|Modes)\s*$/m;

function exists(relPath: string): boolean {
  return existsSync(resolve(ROOT, relPath));
}

function read(relPath: string): string {
  return readFileSync(resolve(ROOT, relPath), "utf-8");
}

function lineCount(contents: string): number {
  const normalized = contents.endsWith("\n") ? contents.slice(0, -1) : contents;
  return normalized.length === 0 ? 0 : normalized.split("\n").length;
}

/**
 * Extract the YAML frontmatter block, or null when absent.
 * Pure helper so the boundary behaviour is testable without a fixture file.
 */
export function extractFrontmatter(contents: string): string | null {
  if (!contents.startsWith("---\n")) return null;
  const end = contents.indexOf("\n---", 4);
  if (end === -1) return null;
  return contents.slice(4, end + 1);
}

/**
 * AC-2 comparator, extracted so the cap boundary can be asserted directly
 * rather than inferred from whatever the real file happens to contain (EC-16).
 */
export function withinLineCap(count: number, cap: number = MAX_PROMPT_LINES): boolean {
  return count <= cap;
}

describe("qa-engineer — SC-1/SC-2: all platform files present", () => {
  for (const relPath of ALL_REQUIRED_FILES) {
    it(`ships ${relPath}`, () => {
      expect(exists(relPath), `missing required file: ${relPath}`).toBe(true);
    });
  }
});

describe("qa-engineer — SC-3/CT-10: behavioral parity across platforms", () => {
  for (const statement of CONTRACT_STATEMENTS) {
    it(`declares "${statement.label}" in all three variants`, () => {
      const missing = AGENT_VARIANTS.filter(
        (relPath) => !exists(relPath) || !statement.pattern.test(read(relPath)),
      );
      expect(
        missing,
        `contract statement "${statement.label}" absent from: ${missing.join(", ")}`,
      ).toEqual([]);
    });
  }

  it("keeps every variant non-empty", () => {
    for (const relPath of AGENT_VARIANTS) {
      expect(exists(relPath), `missing required file: ${relPath}`).toBe(true);
      expect(read(relPath).trim().length, `${relPath} is empty`).toBeGreaterThan(0);
    }
  });
});

describe("qa-engineer — SC-4/EC-16: prompt length cap", () => {
  it(`keeps ${KIRO_AGENT} within ${MAX_PROMPT_LINES} lines`, () => {
    expect(exists(KIRO_AGENT), `missing required file: ${KIRO_AGENT}`).toBe(true);
    const count = lineCount(read(KIRO_AGENT));
    expect(
      withinLineCap(count),
      `${KIRO_AGENT} is ${count} lines, cap is ${MAX_PROMPT_LINES}`,
    ).toBe(true);
  });

  it("treats the cap as inclusive at the boundary", () => {
    expect(withinLineCap(MAX_PROMPT_LINES - 1)).toBe(true);
    expect(withinLineCap(MAX_PROMPT_LINES)).toBe(true);
    expect(withinLineCap(MAX_PROMPT_LINES + 1)).toBe(false);
  });
});

describe("qa-engineer — SC-5: exactly one procedure, no invocation modes", () => {
  for (const relPath of AGENT_VARIANTS) {
    it(`declares no modes section in ${relPath}`, () => {
      expect(exists(relPath), `missing required file: ${relPath}`).toBe(true);
      const contents = read(relPath);
      expect(
        MODE_HEADING.test(contents),
        `${relPath} reintroduces an invocation-modes section; AC-2 allows exactly one procedure`,
      ).toBe(false);
    });
  }
});

describe("qa-engineer — CT-8: Kiro frontmatter conformance", () => {
  it("declares description and tools", () => {
    expect(exists(KIRO_AGENT), `missing required file: ${KIRO_AGENT}`).toBe(true);
    const frontmatter = extractFrontmatter(read(KIRO_AGENT));
    expect(frontmatter, `${KIRO_AGENT} has no YAML frontmatter block`).not.toBeNull();
    expect(frontmatter).toMatch(/^description:/m);
    expect(frontmatter).toMatch(/^tools:/m);
  });

  it("omits the permissions block, which prevents the agent from loading", () => {
    expect(exists(KIRO_AGENT), `missing required file: ${KIRO_AGENT}`).toBe(true);
    const frontmatter = extractFrontmatter(read(KIRO_AGENT)) ?? "";
    expect(
      /^permissions:/m.test(frontmatter),
      "`permissions` is unsupported by the Kiro runtime and causes agents to fail to load",
    ).toBe(false);
  });

  it("extracts frontmatter only when the block is well formed", () => {
    expect(extractFrontmatter("---\ndescription: x\n---\nbody\n")).toBe("description: x\n");
    expect(extractFrontmatter("no frontmatter here\n")).toBeNull();
    expect(extractFrontmatter("---\nunterminated\n")).toBeNull();
  });
});
