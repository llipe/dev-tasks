/**
 * Parity checks for S-007: the runbook-coverage finding, the same-PR
 * delivery rule, and documentation ownership (FR-49a, FR-49b, FR-50,
 * FR-51).
 *
 * Six agents changed across three trees, plus the two registries. The
 * assertions are behavioral, not byte-for-byte: each tree may phrase its
 * frontmatter differently, but a rule stated in one and missing from
 * another is a consumer on that platform not getting it.
 *
 * Two properties here are worth more than the presence checks:
 *
 *   1. The finding is **advisory**. A "coverage gate" that blocks a PR
 *      would contradict the drift policy every other finding follows,
 *      and the first time it blocked someone it would be disabled.
 *   2. Ownership is **exclusive**. `housekeeping` saying "not mine" and
 *      `technical-writer` saying "mine" are two halves of one rule; a
 *      docs failure with no owner is how it sits unfixed.
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");

function read(relPath: string): string {
  const full = resolve(ROOT, relPath);
  if (!existsSync(full)) throw new Error(`missing file: ${relPath}`);
  return readFileSync(full, "utf-8");
}

const VERIFIER = [
  ".claude/agents/verifier.md",
  ".github/agents/verifier.agent.md",
  ".kiro/agents/verifier.md",
];

const TECHNICAL_WRITER = [
  ".claude/agents/technical-writer.md",
  ".github/agents/technical-writer.agent.md",
  ".kiro/agents/technical-writer.md",
];

const HOUSEKEEPING = [
  ".claude/agents/housekeeping.md",
  ".github/agents/housekeeping.agent.md",
  ".kiro/agents/housekeeping.md",
];

/**
 * The four owners the FR-49a rule binds. `infra-engineer` ships as a
 * Claude *command* rather than an agent — a documented asymmetry
 * (AGENTS.md), since it pauses for one human approval per step.
 */
const SAME_PR_OWNERS = [
  ".claude/commands/infra-engineer.md",
  ".github/agents/infra-engineer.agent.md",
  ".kiro/agents/infra-engineer.md",
  ".claude/agents/developer.md",
  ".github/agents/developer.agent.md",
  ".kiro/agents/developer.md",
  ".claude/agents/qa-engineer.md",
  ".github/agents/qa-engineer.agent.md",
  ".kiro/agents/qa-engineer.md",
  ...HOUSEKEEPING,
];

describe("S-007 — the verifier's runbook-coverage finding (AC-1, AC-2)", () => {
  for (const relPath of VERIFIER) {
    it(`${relPath} states the trigger with its numeric threshold`, () => {
      const c = read(relPath);
      expect(c).toContain("## Runbook-Coverage Finding");
      // The threshold is stated so the judgment is bounded. "Several
      // setup steps" would make every reviewer's answer different.
      expect(c).toMatch(/three or more/i);
      expect(c).toMatch(/configuration, environment, tooling, credentials, or data/i);
    });

    it(`${relPath} makes the finding advisory and non-blocking`, () => {
      const c = read(relPath);
      expect(c).toMatch(/non-blocking to PR readiness/i);
      expect(c).toMatch(/Never hold a PR on it/i);
    });

    it(`${relPath} excludes the three cases that are not findings`, () => {
      // Each of these is a plausible false positive, and a reviewer who
      // has to work them out from first principles will get one wrong.
      const c = read(relPath);
      expect(c).toMatch(/updates an existing runbook/i);
      expect(c).toMatch(/docs-only PR/i);
      expect(c).toMatch(/Two such steps is below it/i);
    });

    it(`${relPath} names an owner per work kind (AC-3)`, () => {
      const c = read(relPath);
      for (const owner of ["infra-engineer", "developer", "qa-engineer", "housekeeping"]) {
        expect(c, `${relPath} does not route any work kind to ${owner}`).toContain(owner);
      }
    });

    it(`${relPath} treats it as a new trigger, not a new drift category`, () => {
      expect(read(relPath)).toMatch(/new trigger, not a\s*\n?\s*new category/i);
    });
  }
});

describe("S-007 — same-PR runbook delivery (AC-4)", () => {
  for (const relPath of SAME_PR_OWNERS) {
    it(`${relPath} requires the runbook in the same draft PR`, () => {
      const c = read(relPath);
      expect(c).toContain("## Runbook Delivery in the Same PR");
      expect(c).toMatch(/same\*{0,2} draft PR/i);
      expect(c).toMatch(/not a follow-up issue/i);
    });

    it(`${relPath} enumerates all three covered surfaces plus infra change kinds`, () => {
      const c = read(relPath);
      expect(c).toContain("templates/scripts/");
      expect(c).toContain("templates/workflows/");
      expect(c).toContain(".github/workflows/");
      expect(c).toMatch(/secrets, deploy, DNS/i);
    });

    it(`${relPath} accepts updating an existing runbook`, () => {
      // Requiring a new file per change would produce runbook sprawl,
      // which is the opposite of the goal.
      expect(read(relPath)).toMatch(/Updating an existing runbook satisfies this/i);
    });
  }
});

describe("S-007 — technical-writer runbook hygiene (AC-5)", () => {
  for (const relPath of TECHNICAL_WRITER) {
    it(`${relPath} covers all five hygiene conditions`, () => {
      const c = read(relPath);
      expect(c).toContain("## Runbook Hygiene");
      expect(c).toMatch(/Indexes in sync/i);
      expect(c).toMatch(/Frontmatter valid/i);
      expect(c).toMatch(/Naming respected/i);
      expect(c).toMatch(/No dangling `related`/i);
      expect(c).toMatch(/Staleness reported/i);
    });

    it(`${relPath} forbids auto-bumping last_verified`, () => {
      // The failure mode that makes the whole field worthless: a date
      // refreshed without anyone re-running the procedure.
      expect(read(relPath)).toMatch(/never auto-bumped/i);
    });

    it(`${relPath} defers the deterministic conditions to core/checks`, () => {
      // The business rule: no logic duplicated between the judgment
      // agent and the lint gate.
      const c = read(relPath);
      expect(c).toContain("core/checks/docs-structure.ts");
      expect(c).toMatch(/one implementation, two callers/i);
    });
  }
});

describe("S-007 — documentation ownership is exclusive (AC-6)", () => {
  for (const relPath of TECHNICAL_WRITER) {
    it(`${relPath} claims docs structure and content`, () => {
      const c = read(relPath);
      expect(c).toContain("## Documentation Ownership");
      expect(c).toMatch(/You own documentation structure and content/i);
      expect(c).toMatch(/routes to \*{0,2}you\*{0,2}, not to it/i);
    });
  }

  for (const relPath of HOUSEKEEPING) {
    it(`${relPath} disclaims it, so the rule has both halves`, () => {
      const c = read(relPath);
      expect(c).toContain("## Documentation Is Not Yours");
      expect(c).toMatch(/do \*{0,2}not\*{0,2} organize documentation/i);
      expect(c).toMatch(/routes to\s*\n?`?technical-writer`?, not to you/i);
    });

    it(`${relPath} forbids silencing the check instead of routing it`, () => {
      expect(read(relPath)).toMatch(/do not\s*\n?\s*silence the check/i);
    });
  }

  it("AGENTS.md records both halves in the registry (AC-6)", () => {
    const c = read("AGENTS.md");
    expect(c).toMatch(/technical-writer.*Owns docs structure and content/i);
    expect(c).toMatch(/housekeeping.*Does \*{0,2}not\*{0,2} organize documentation/i);
    expect(c).toMatch(/Route a docs-structure failure in `validate` to `technical-writer`/i);
  });

  it("CLAUDE.md records both the ownership and same-PR rules", () => {
    const c = read("CLAUDE.md");
    expect(c).toMatch(/Documentation ownership is explicit/i);
    expect(c).toMatch(/A runbook ships in the same PR as the procedure it documents/i);
    expect(c).toMatch(/advisory and never blocks PR readiness/i);
  });
});

describe("S-007 — this phase's own PR would not trigger the finding (7.9)", () => {
  it("delivered ten runbooks, so the coverage trigger's second condition fails", () => {
    // The trigger needs BOTH conditions: three-plus setup steps AND no
    // runbook added or updated. Phase 1 added ten, so it cannot fire —
    // which is the manual check task 7.9 asks for, made durable.
    const index = read("docs/runbooks/README.md");
    const links = [...index.matchAll(/\]\((runbook-[a-z0-9-]+\.md)\)/g)].map((m) => m[1]);
    expect(links.length).toBeGreaterThanOrEqual(10);
  });
});
