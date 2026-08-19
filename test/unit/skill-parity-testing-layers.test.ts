/**
 * Structural and behavioral parity checks for the three new testing skills
 * added in issue #130:
 *   - activity-integration-test-implementation (Layer 2.5)
 *   - activity-e2e-test-implementation (Playwright E2E)
 *   - activity-contract-validation (dt verify wiring)
 *
 * Also validates TESTING.md taxonomy updates and qa-engineer procedure extension.
 *
 * Test plan mapping (workstream/test-plan-130.md):
 *   SC-1/SC-2/SC-3  integration skill presence + parity + content
 *   SC-5/SC-6/SC-7  e2e skill presence + parity + content
 *   SC-8/SC-9/SC-10 contract skill presence + parity + content
 *   SC-4/SC-26      no install commands + line count budget
 *   SC-11/SC-12     TESTING.md Layer 2.5
 *   SC-13/SC-14     TESTING.md E2E + Contract
 *   SC-15/SC-16     qa-engineer steps + conditional logic
 *   SC-22           AGENTS.md skill registration
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";

const ROOT = resolve(__dirname, "../..");

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

const PLATFORMS = [".kiro/skills", ".github/skills", ".claude/skills"] as const;

const NEW_SKILLS = [
  "activity-integration-test-implementation",
  "activity-e2e-test-implementation",
  "activity-contract-validation",
] as const;

const MAX_SKILL_LINES = 200;

// --- SC-1, SC-5, SC-8: File presence ---

describe("issue-130 — skill file presence", () => {
  for (const skill of NEW_SKILLS) {
    for (const platform of PLATFORMS) {
      const relPath = `${platform}/${skill}/SKILL.md`;
      it(`ships ${relPath}`, () => {
        expect(exists(relPath), `missing: ${relPath}`).toBe(true);
      });
    }
  }
});

// --- SC-2: Cross-platform parity ---

describe("issue-130 — cross-platform parity (identical content)", () => {
  for (const skill of NEW_SKILLS) {
    it(`${skill} is identical across all three platforms`, () => {
      const paths = PLATFORMS.map((p) => `${p}/${skill}/SKILL.md`);
      const contents = paths.map((p) => read(p));
      expect(contents[0]).toBe(contents[1]);
      expect(contents[0]).toBe(contents[2]);
    });
  }
});

// --- SC-4: No install commands ---

describe("issue-130 — SC-4: skills do not install dependencies", () => {
  const INSTALL_PATTERN =
    /\b(npm install|pnpm add|yarn add|apt-get install|brew install|pip install)\b/i;

  for (const skill of NEW_SKILLS) {
    it(`${skill} contains no install commands`, () => {
      const content = read(`.kiro/skills/${skill}/SKILL.md`);
      expect(INSTALL_PATTERN.test(content)).toBe(false);
    });
  }
});

// --- SC-26: Line count budget ---

describe("issue-130 — SC-26: skills within 200-line budget", () => {
  for (const skill of NEW_SKILLS) {
    it(`${skill} is ≤${MAX_SKILL_LINES} lines`, () => {
      const content = read(`.kiro/skills/${skill}/SKILL.md`);
      const count = lineCount(content);
      expect(count, `${skill} is ${count} lines`).toBeLessThanOrEqual(MAX_SKILL_LINES);
    });
  }
});

// --- SC-3: Integration skill content completeness ---

describe("issue-130 — SC-3: integration skill content", () => {
  const content = () => read(".kiro/skills/activity-integration-test-implementation/SKILL.md");

  it("covers local integration", () => {
    expect(content()).toMatch(/testcontainers/i);
    expect(content()).toMatch(/docker.compose/i);
    expect(content()).toMatch(/supabase/i);
  });

  it("covers fixtures and rollback", () => {
    expect(content()).toMatch(/fixture/i);
    expect(content()).toMatch(/rollback/i);
    expect(content()).toMatch(/teardown/i);
  });

  it("covers migration clean-apply", () => {
    expect(content()).toMatch(/migration/i);
    expect(content()).toMatch(/clean.apply/i);
  });

  it("covers RLS policy tests", () => {
    expect(content()).toMatch(/RLS|row.level security/i);
    expect(content()).toMatch(/tenant/i);
  });

  it("covers pgTAP", () => {
    expect(content()).toMatch(/pgTAP/i);
  });

  it("covers remote integration", () => {
    expect(content()).toMatch(/read.only/i);
    expect(content()).toMatch(/testing environment/i);
  });

  it("covers fallback", () => {
    expect(content()).toMatch(/SKIPPED/);
  });
});

// --- SC-6: E2E skill Playwright prerequisites ---

describe("issue-130 — SC-6: e2e skill Playwright prerequisites", () => {
  const content = () => read(".kiro/skills/activity-e2e-test-implementation/SKILL.md");

  it("covers auth strategy with storageState default", () => {
    expect(content()).toMatch(/storageState/);
  });

  it("covers seeded test users", () => {
    expect(content()).toMatch(/test user/i);
  });

  it("covers base URL resolution", () => {
    expect(content()).toMatch(/baseURL|BASE_URL/);
  });

  it("covers DB state reset", () => {
    expect(content()).toMatch(/state reset/i);
  });

  it("covers trace/screenshot/video", () => {
    expect(content()).toMatch(/trace/i);
    expect(content()).toMatch(/screenshot/i);
  });

  it("covers browser install and sharding", () => {
    expect(content()).toMatch(/playwright install/i);
    expect(content()).toMatch(/shard/i);
  });

  it("covers scenario-to-spec mapping (AC-10)", () => {
    expect(content()).toMatch(/@scenario SC-\{n\}/);
  });
});

// --- SC-9/SC-10: Contract validation skill ---

describe("issue-130 — SC-9: contract validation references dt verify", () => {
  const content = () => read(".kiro/skills/activity-contract-validation/SKILL.md");

  it("references contract-diff", () => {
    expect(content()).toMatch(/contract-diff/);
  });

  it("references impact", () => {
    expect(content()).toMatch(/dt verify impact/);
  });

  it("references drift", () => {
    expect(content()).toMatch(/dt verify drift/);
  });

  it("handles dt not installed (SC-10)", () => {
    expect(content()).toMatch(/SKIPPED.*dt not installed/i);
  });
});

// --- SC-11/SC-12/SC-13/SC-14: TESTING.md taxonomy ---

describe("issue-130 — TESTING.md taxonomy updates", () => {
  const content = () => read("TESTING.md");

  it("AC-4: has Layer 2.5 (Integration) row", () => {
    expect(content()).toMatch(/2\.5/);
    expect(content()).toMatch(/Integration/);
  });

  it("AC-4: Layer 2.5 boundary states MUST NOT mock", () => {
    expect(content()).toMatch(/MUST NOT.*mock the data layer/i);
  });

  it("AC-4: escalation rule includes Layer 2 → 2.5", () => {
    expect(content()).toMatch(/Layer 2 test needs a real database.*Layer 2\.5/i);
  });

  it("AC-5: has E2E layer row", () => {
    expect(content()).toMatch(/E2E/);
    expect(content()).toMatch(/Playwright/i);
  });

  it("AC-5: E2E boundary states MUST NOT assert on internal state", () => {
    expect(content()).toMatch(/MUST NOT.*assert on internal state/i);
  });

  it("AC-6: has Contract Validation row", () => {
    expect(content()).toMatch(/Contract.*validation/i);
  });

  it("AC-6: contract boundary checks interface only", () => {
    expect(content()).toMatch(/checks the boundary\/interface only/i);
  });

  it("has test:contract in commands", () => {
    expect(content()).toMatch(/test:contract/);
  });
});

// --- SC-15/SC-16: qa-engineer procedure ---

describe("issue-130 — SC-15/SC-16: qa-engineer procedure extension", () => {
  const AGENT_VARIANTS = [
    ".kiro/agents/qa-engineer.md",
    ".github/agents/qa-engineer.agent.md",
    ".claude/agents/qa-engineer.md",
  ] as const;

  for (const relPath of AGENT_VARIANTS) {
    describe(relPath, () => {
      const content = () => read(relPath);

      it("references step 2.5 (integration)", () => {
        expect(content()).toMatch(/2\.5.*Integration|integration.*2\.5/i);
      });

      it("references activity-integration-test-implementation", () => {
        expect(content()).toMatch(/activity-integration-test-implementation/);
      });

      it("references activity-e2e-test-implementation", () => {
        expect(content()).toMatch(/activity-e2e-test-implementation/);
      });

      it("references activity-contract-validation", () => {
        expect(content()).toMatch(/activity-contract-validation/);
      });

      it("conditional steps skip when layer not configured", () => {
        expect(content()).toMatch(/SKIPPED/);
        expect(content()).toMatch(/not configured/i);
      });
    });
  }
});

// --- SC-22: AGENTS.md registration ---

describe("issue-130 — SC-22: AGENTS.md registers new skills", () => {
  const content = () => read("AGENTS.md");

  for (const skill of NEW_SKILLS) {
    it(`registers ${skill}`, () => {
      expect(content()).toContain(skill);
    });
  }
});

// --- SC-19: Planner rollup ---

describe("issue-130 — SC-19: planner rollup step", () => {
  const PLANNER_VARIANTS = [
    ".github/agents/planner.agent.md",
    ".kiro/agents/planner.md",
    ".claude/commands/planner.md",
  ] as const;

  for (const relPath of PLANNER_VARIANTS) {
    it(`${relPath} references qa-engineer PRD-scope rollup`, () => {
      const content = read(relPath);
      expect(content).toMatch(/qa-engineer.*PRD scope|PRD scope.*qa-engineer/i);
    });

    it(`${relPath} mentions coverage_gate at PRD level`, () => {
      const content = read(relPath);
      expect(content).toMatch(/coverage_gate/);
    });

    it(`${relPath} scopes to affected packages`, () => {
      const content = read(relPath);
      expect(content).toMatch(/affected.*packages|packages.*affected/i);
    });
  }
});

// --- SC-21: workflow-chains.md ---

describe("issue-130 — SC-21: docs/workflow-chains.md updated", () => {
  const content = () => read("docs/workflow-chains.md");

  it("shows step 2.5 in QA chain", () => {
    expect(content()).toMatch(/Step 2\.5.*activity-integration-test-implementation/);
  });

  it("shows step 3 (E2E) in QA chain", () => {
    expect(content()).toMatch(/Step 3.*activity-e2e-test-implementation/);
  });

  it("shows step 4 (contract) in QA chain", () => {
    expect(content()).toMatch(/Step 4.*activity-contract-validation/);
  });

  it("has integration decision path section", () => {
    expect(content()).toMatch(/Docker available/i);
    expect(content()).toMatch(/Supabase CLI/i);
    expect(content()).toMatch(/testing env/i);
  });

  it("has planner rollup section", () => {
    expect(content()).toMatch(/Planner.*Rollup/i);
  });
});

// --- SC-23: technical-guidelines Layer 2.5 ---

describe("issue-130 — SC-23: technical-guidelines references Layer 2.5", () => {
  it("mentions Layer 2.5 or Integration tests", () => {
    const content = read("docs/technical-guidelines.md");
    expect(content).toMatch(/Layer 2\.5|Integration tests/i);
  });
});
