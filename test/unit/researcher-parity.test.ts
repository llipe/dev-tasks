/**
 * Structural and behavioral parity checks for the `researcher` agent.
 *
 * Covers issue #139:
 *   AC-1  Agent ships on all three platforms with both entry points
 *   AC-5  Read-only authority holds (prohibition stated on all platforms)
 *   AC-6  Callers wired with conditional triggers
 *   AC-9  Registries and docs list researcher
 *
 * Modeled on test/unit/qa-engineer-parity.test.ts.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";

const ROOT = resolve(__dirname, "../..");

const KIRO_AGENT = ".kiro/agents/researcher.md";
const COPILOT_AGENT = ".github/agents/researcher.agent.md";
const CLAUDE_AGENT = ".claude/agents/researcher.md";
const COPILOT_ENTRY = ".github/prompts/researcher.prompt.md";
const CLAUDE_ENTRY = ".claude/commands/researcher.md";

/** The three agent definitions that must carry an equivalent contract. */
const AGENT_VARIANTS = [KIRO_AGENT, COPILOT_AGENT, CLAUDE_AGENT] as const;

/** Every file the agent ships as, including platform entry points. */
const ALL_REQUIRED_FILES = [...AGENT_VARIANTS, COPILOT_ENTRY, CLAUDE_ENTRY] as const;

/**
 * Normative statements that MUST appear in all three agent variants.
 * Behavioral parity, not byte-for-byte.
 */
const CONTRACT_STATEMENTS: ReadonlyArray<{ label: string; pattern: RegExp }> = [
  { label: "read-only authority", pattern: /read-only/i },
  {
    label: "write prohibition on code/PRD/spec/task/test",
    pattern: /MUST NOT.*(create|modify).*(application code|PRD|spec|task list|test)/i,
  },
  { label: "eight slices (S1-S8)", pattern: /S1.*S2.*S3.*S4.*S5.*S6.*S7.*S8/s },
  { label: "budget cap 250 lines", pattern: /250\s*lines/i },
  { label: "budget cap 30 files", pattern: /30\s*files/i },
  { label: "artifact path contract", pattern: /research-issue-<n>-<slug>/i },
  { label: "non-mandatory status", pattern: /never mandatory/i },
  { label: "staleness via commit SHA", pattern: /commit SHA/i },
  { label: "no verdict rendering", pattern: /no(t a)? verdict/i },
  { label: "skill: activity-codebase-research", pattern: /activity-codebase-research/ },
  { label: "multi-repo detection", pattern: /component\.json/i },
  { label: "untrusted input handling", pattern: /untrusted data/i },
];

/** Caller files that must reference the research step. */
const CALLER_FILES = {
  productEngineer: [
    ".kiro/agents/product-engineer.md",
    ".github/agents/product-engineer.agent.md",
    ".claude/commands/product-engineer.md",
  ],
  developer: [
    ".kiro/agents/developer.md",
    ".github/agents/developer.agent.md",
    ".claude/agents/developer.md",
  ],
  planner: [
    ".kiro/agents/planner.md",
    ".github/agents/planner.agent.md",
    ".claude/commands/planner.md",
  ],
} as const;

/** Registry and documentation files that must mention researcher. */
const REGISTRY_FILES = [
  "AGENTS.md",
  "CLAUDE.md",
  "README.md",
  "docs/system-overview.md",
  "docs/workflow-chains.md",
  "docs/adr/README.md",
] as const;

function exists(relPath: string): boolean {
  return existsSync(resolve(ROOT, relPath));
}

function read(relPath: string): string {
  return readFileSync(resolve(ROOT, relPath), "utf-8");
}

/**
 * Extract the YAML frontmatter block, or null when absent.
 */
function extractFrontmatter(contents: string): string | null {
  if (!contents.startsWith("---\n")) return null;
  const end = contents.indexOf("\n---", 4);
  if (end === -1) return null;
  return contents.slice(4, end + 1);
}

// ─── AC-1: All platform files present ────────────────────────────────────────

describe("researcher — AC-1: all platform files present", () => {
  for (const relPath of ALL_REQUIRED_FILES) {
    it(`ships ${relPath}`, () => {
      expect(exists(relPath), `missing required file: ${relPath}`).toBe(true);
    });
  }

  it("keeps every variant non-empty", () => {
    for (const relPath of AGENT_VARIANTS) {
      expect(read(relPath).trim().length, `${relPath} is empty`).toBeGreaterThan(0);
    }
  });
});

// ─── AC-1: Behavioral parity across platforms ────────────────────────────────

describe("researcher — AC-1: behavioral parity across platforms", () => {
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
});

// ─── AC-1: Kiro frontmatter conformance ──────────────────────────────────────

describe("researcher — AC-1: Kiro frontmatter conformance", () => {
  it("declares description and tools", () => {
    const frontmatter = extractFrontmatter(read(KIRO_AGENT));
    expect(frontmatter, `${KIRO_AGENT} has no YAML frontmatter block`).not.toBeNull();
    expect(frontmatter).toMatch(/^description:/m);
    expect(frontmatter).toMatch(/^tools:/m);
  });

  it("omits the permissions block (prevents agent from loading)", () => {
    const frontmatter = extractFrontmatter(read(KIRO_AGENT)) ?? "";
    expect(
      /^permissions:/m.test(frontmatter),
      "`permissions` is unsupported by the Kiro runtime and causes agents to fail to load",
    ).toBe(false);
  });
});

// ─── AC-5: Read-only prohibition stated explicitly ───────────────────────────

describe("researcher — AC-5: read-only prohibition on all platforms", () => {
  for (const relPath of AGENT_VARIANTS) {
    it(`${relPath} states write prohibition`, () => {
      const content = read(relPath);
      expect(
        /MUST NOT.*(create|modify)/i.test(content),
        `${relPath} does not state write prohibition`,
      ).toBe(true);
    });
  }
});

// ─── AC-6: Callers wired with conditional triggers ───────────────────────────

describe("researcher — AC-6: product-engineer caller wiring", () => {
  for (const relPath of CALLER_FILES.productEngineer) {
    it(`${relPath} references researcher`, () => {
      if (!exists(relPath)) {
        expect.fail(`caller file missing: ${relPath}`);
      }
      const content = read(relPath);
      expect(/researcher/i.test(content), `${relPath} does not reference researcher`).toBe(true);
    });

    it(`${relPath} uses conditional language`, () => {
      if (!exists(relPath)) {
        expect.fail(`caller file missing: ${relPath}`);
      }
      const content = read(relPath);
      expect(
        /conditional|recommended|SHOULD|optional|when/i.test(content),
        `${relPath} does not use conditional language for research step`,
      ).toBe(true);
    });
  }
});

describe("researcher — AC-6: developer caller wiring", () => {
  for (const relPath of CALLER_FILES.developer) {
    it(`${relPath} references researcher`, () => {
      if (!exists(relPath)) {
        expect.fail(`caller file missing: ${relPath}`);
      }
      const content = read(relPath);
      expect(/researcher/i.test(content), `${relPath} does not reference researcher`).toBe(true);
    });
  }
});

describe("researcher — AC-6: planner caller wiring", () => {
  for (const relPath of CALLER_FILES.planner) {
    it(`${relPath} references researcher`, () => {
      if (!exists(relPath)) {
        expect.fail(`caller file missing: ${relPath}`);
      }
      const content = read(relPath);
      expect(/researcher/i.test(content), `${relPath} does not reference researcher`).toBe(true);
    });
  }
});

// ─── AC-9: Registry and documentation consistency ────────────────────────────

describe("researcher — AC-9: registries and docs list researcher", () => {
  for (const relPath of REGISTRY_FILES) {
    it(`${relPath} mentions researcher`, () => {
      if (!exists(relPath)) {
        expect.fail(`registry file missing: ${relPath}`);
      }
      const content = read(relPath);
      expect(/researcher/i.test(content), `${relPath} does not mention researcher`).toBe(true);
    });
  }

  it("AGENTS.md mentions activity-codebase-research skill", () => {
    const content = read("AGENTS.md");
    expect(
      content.includes("activity-codebase-research"),
      "AGENTS.md does not list the activity-codebase-research skill",
    ).toBe(true);
  });
});
