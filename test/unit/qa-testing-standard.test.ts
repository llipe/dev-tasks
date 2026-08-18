/**
 * Structural assertions for the QA testing standard introduced by issue #123.
 *
 * Covers AC-3 through AC-11: the three new skills, the `/TESTING.md` section
 * contract, the harness-defect detection list, the monorepo/CI reachability
 * check, the security-negative test category, the structural gap-analysis path,
 * the `developer` wiring (including that rule 19 is unchanged), the `planner`
 * verification line, the `verifier` ownership pointer, registry references, and
 * distribution registration.
 *
 * Test plan mapping (workstream/test-plan-123.md):
 *   SC-6, SC-7   three skills present / mirrored across all three trees
 *   SC-10, SC-11 `/TESTING.md` section contract, no project-specific values
 *   SC-19 – SC-21 `developer` five touchpoints, rule 19 intact, no duplicated procedure
 *   SC-25, SC-26 registries and docs updated
 *   CT-5, CT-6   `/TESTING.md` document schema
 *
 * SC-20 asserts the rule-19 baseline hash captured by `verifier` before any
 * implementation work began. See the Rule 19 Baseline section of the test plan.
 */

import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";

const ROOT = resolve(__dirname, "../..");

/**
 * Pre-implementation hash of `developer` rule 19, captured 2026-08-18 across all
 * four platform variants. AC-7 requires rule 19 to remain byte-identical: the
 * agent that authors tests must not quietly delegate that duty to `qa-engineer`.
 */
const RULE_19_BASELINE_SHA256 = "27aa0238fc7fa29bf3f68a50fdd3a0f744e96a660cc609fc36462c5567d66876";

const RULE_19_PREFIX = "19. **Test-first design";

const TESTING_CONTRACT = "TESTING.md";

const NEW_SKILLS = [
  "activity-test-standards",
  "activity-test-implementation",
  "activity-coverage-gap-analysis",
] as const;

const SKILL_TREES = [".kiro/skills", ".github/skills", ".claude/skills"] as const;

const DEVELOPER_VARIANTS = [
  ".kiro/agents/developer.md",
  ".github/agents/developer.agent.md",
  ".claude/agents/developer.md",
  ".claude/commands/developer.md",
] as const;

const PLANNER_VARIANTS = [
  ".kiro/agents/planner.md",
  ".github/agents/planner.agent.md",
  ".claude/commands/planner.md",
] as const;

const VERIFIER_VARIANTS = [
  ".kiro/agents/verifier.md",
  ".github/agents/verifier.agent.md",
  ".claude/agents/verifier.md",
] as const;

function exists(relPath: string): boolean {
  return existsSync(resolve(ROOT, relPath));
}

function read(relPath: string): string {
  return readFileSync(resolve(ROOT, relPath), "utf-8");
}

function readIfExists(relPath: string): string {
  return exists(relPath) ? read(relPath) : "";
}

/**
 * Extract rule 19 as a single line. Mirrors the capture command recorded in the
 * test plan so the baseline stays reproducible from the shell:
 *   grep -A0 '^19\. \*\*Test-first design' <file> | shasum -a 256
 */
export function extractRule19(contents: string): string | null {
  const line = contents.split("\n").find((l) => l.startsWith(RULE_19_PREFIX));
  return line ?? null;
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

describe("QA skills — SC-6/SC-7: three skills mirrored across all trees", () => {
  for (const tree of SKILL_TREES) {
    for (const skill of NEW_SKILLS) {
      const relPath = `${tree}/${skill}/SKILL.md`;
      it(`ships ${relPath}`, () => {
        expect(exists(relPath), `missing skill definition: ${relPath}`).toBe(true);
      });
    }
  }

  for (const tree of SKILL_TREES) {
    for (const skill of NEW_SKILLS) {
      const relPath = `${tree}/${skill}/SKILL.md`;
      it(`declares frontmatter name and description in ${relPath}`, () => {
        const contents = readIfExists(relPath);
        expect(contents.length, `missing or empty skill definition: ${relPath}`).toBeGreaterThan(0);
        expect(contents).toMatch(new RegExp(`^name:\\s*${skill}\\s*$`, "m"));
        expect(contents).toMatch(/^description:/m);
      });
    }
  }
});

describe("activity-test-standards — AC-5: harness-defect detection list", () => {
  const requiredChecks: ReadonlyArray<{ label: string; pattern: RegExp }> = [
    { label: "test environment correctness", pattern: /environment/i },
    { label: "test config presence", pattern: /config presence|missing (test )?config/i },
    { label: "path-alias parity with tsconfig", pattern: /alias/i },
    { label: "global cleanup policy", pattern: /restoreMocks|stubbed globals|global cleanup/i },
    { label: "runtime version parity", pattern: /runtime (version )?parity/i },
    { label: "locale and timezone fixture policy", pattern: /timezone/i },
    { label: "false-green placeholder detection", pattern: /placeholder/i },
  ];

  for (const check of requiredChecks) {
    it(`declares detection for "${check.label}" in all three trees`, () => {
      const missing = SKILL_TREES.filter((tree) => {
        const contents = readIfExists(`${tree}/activity-test-standards/SKILL.md`);
        return contents.length === 0 || !check.pattern.test(contents);
      });
      expect(missing, `"${check.label}" not declared in: ${missing.join(", ")}`).toEqual([]);
    });
  }
});

describe("activity-test-standards — AC-6: monorepo and CI reachability check", () => {
  const requirements: ReadonlyArray<{ label: string; pattern: RegExp }> = [
    { label: "reachability from the aggregate script", pattern: /reachab/i },
    { label: "workspace package coverage", pattern: /workspace/i },
    { label: "CI gate invokes the aggregate", pattern: /\bCI\b/ },
    { label: "deploy gate invokes the aggregate", pattern: /deploy/i },
  ];

  for (const requirement of requirements) {
    it(`declares "${requirement.label}" in all three trees`, () => {
      const missing = SKILL_TREES.filter((tree) => {
        const contents = readIfExists(`${tree}/activity-test-standards/SKILL.md`);
        return contents.length === 0 || !requirement.pattern.test(contents);
      });
      expect(missing, `"${requirement.label}" not declared in: ${missing.join(", ")}`).toEqual([]);
    });
  }
});

describe("activity-test-implementation — AC-3: security-negative test category", () => {
  const requiredNegatives: ReadonlyArray<{ label: string; pattern: RegExp }> = [
    { label: "invalid signature", pattern: /invalid signature/i },
    { label: "expired token", pattern: /expired/i },
    { label: "wrong issuer or audience", pattern: /issuer|audience/i },
    { label: "tampered claims", pattern: /tampered/i },
    { label: "tests faithful to insecure code trap", pattern: /faithful to insecure code/i },
  ];

  for (const negative of requiredNegatives) {
    it(`requires "${negative.label}" in all three trees`, () => {
      const missing = SKILL_TREES.filter((tree) => {
        const contents = readIfExists(`${tree}/activity-test-implementation/SKILL.md`);
        return contents.length === 0 || !negative.pattern.test(contents);
      });
      expect(missing, `"${negative.label}" not declared in: ${missing.join(", ")}`).toEqual([]);
    });
  }
});

describe("activity-coverage-gap-analysis — AC-11: structural path without a provider", () => {
  const requirements: ReadonlyArray<{ label: string; pattern: RegExp }> = [
    { label: "structural path runs with no provider", pattern: /structural/i },
    { label: "untested source enumeration", pattern: /untested|no corresponding test/i },
    { label: "source-to-test size ratio", pattern: /ratio/i },
    { label: "risk-based ranking", pattern: /rank/i },
    { label: "misleading artifact validation", pattern: /misleading|stale/i },
    { label: "SKIPPED reason form", pattern: /SKIPPED/ },
    { label: "never reports unknown", pattern: /unknown/i },
  ];

  for (const requirement of requirements) {
    it(`declares "${requirement.label}" in all three trees`, () => {
      const missing = SKILL_TREES.filter((tree) => {
        const contents = readIfExists(`${tree}/activity-coverage-gap-analysis/SKILL.md`);
        return contents.length === 0 || !requirement.pattern.test(contents);
      });
      expect(missing, `"${requirement.label}" not declared in: ${missing.join(", ")}`).toEqual([]);
    });
  }
});

describe("/TESTING.md — SC-10/SC-11/CT-5/CT-6: section contract", () => {
  const requiredSections: ReadonlyArray<{ label: string; pattern: RegExp }> = [
    { label: "layer taxonomy", pattern: /layer/i },
    { label: "per-package section", pattern: /per-package|## Packages|### Package/i },
    { label: "runner declaration", pattern: /runner/i },
    { label: "test environment declaration", pattern: /environment/i },
    { label: "coverage thresholds and baseline policy", pattern: /threshold/i },
    { label: "fixture and mocking strategy", pattern: /fixture/i },
    { label: "non-JS package slot", pattern: /non-JS|pytest|language/i },
  ];

  it("exists at the repository root", () => {
    expect(exists(TESTING_CONTRACT), `missing required file: ${TESTING_CONTRACT}`).toBe(true);
  });

  for (const section of requiredSections) {
    it(`declares "${section.label}"`, () => {
      const contents = readIfExists(TESTING_CONTRACT);
      expect(contents.length, `missing or empty ${TESTING_CONTRACT}`).toBeGreaterThan(0);
      expect(section.pattern.test(contents), `"${section.label}" section absent`).toBe(true);
    });
  }

  it("stays a placeholder — no project-specific threshold value asserted", () => {
    const contents = readIfExists(TESTING_CONTRACT);
    expect(contents.length, `missing or empty ${TESTING_CONTRACT}`).toBeGreaterThan(0);
    expect(
      /\b\d{2}%\s*(minimum|threshold|required)/i.test(contents),
      "shipped placeholder must not assert a concrete coverage threshold",
    ).toBe(false);
  });
});

describe("developer — SC-19/SC-21/AC-7: five touchpoints, no duplicated procedure", () => {
  const touchpoints: ReadonlyArray<{ label: string; pattern: RegExp }> = [
    { label: "qa-engineer named", pattern: /qa-engineer/ },
    { label: "coverage_gate payload field", pattern: /coverage_gate/ },
    { label: "SKIPPED reason form in payload", pattern: /SKIPPED\(<reason>\)/ },
  ];

  for (const touchpoint of touchpoints) {
    it(`declares "${touchpoint.label}" in all four variants`, () => {
      const missing = DEVELOPER_VARIANTS.filter(
        (relPath) => !touchpoint.pattern.test(readIfExists(relPath)),
      );
      expect(missing, `"${touchpoint.label}" absent from: ${missing.join(", ")}`).toEqual([]);
    });
  }

  it("orders the coverage gate before the verifier audit", () => {
    for (const relPath of DEVELOPER_VARIANTS) {
      const contents = readIfExists(relPath);
      const qaIndex = contents.search(/invoke `qa-engineer`/);
      const verifierIndex = contents.search(/invoke `verifier` in `audit` mode/);
      expect(qaIndex, `${relPath} never invokes qa-engineer`).toBeGreaterThan(-1);
      expect(verifierIndex, `${relPath} never invokes the verifier audit`).toBeGreaterThan(-1);
      expect(
        qaIndex,
        `${relPath} must invoke qa-engineer before the verifier audit so the audit can consume the gap report`,
      ).toBeLessThan(verifierIndex);
    }
  });
});

describe("developer — SC-20/AC-7: rule 19 is unchanged", () => {
  for (const relPath of DEVELOPER_VARIANTS) {
    it(`preserves the rule 19 baseline in ${relPath}`, () => {
      const rule = extractRule19(read(relPath));
      expect(rule, `${relPath} no longer contains rule 19`).not.toBeNull();
      expect(
        sha256(`${rule as string}\n`),
        `rule 19 changed in ${relPath}; AC-7 requires it byte-identical to the pre-implementation baseline`,
      ).toBe(RULE_19_BASELINE_SHA256);
    });
  }

  it("keeps rule 19 identical across all four variants", () => {
    const hashes = DEVELOPER_VARIANTS.map((relPath) =>
      sha256(`${extractRule19(read(relPath)) ?? ""}\n`),
    );
    expect(new Set(hashes).size, "rule 19 diverged between platform variants").toBe(1);
  });
});

describe("planner — AC-8: verifies the coverage gate was reached", () => {
  for (const relPath of PLANNER_VARIANTS) {
    it(`declares the coverage_gate check in ${relPath}`, () => {
      const contents = readIfExists(relPath);
      expect(contents.length, `missing or empty ${relPath}`).toBeGreaterThan(0);
      expect(
        /coverage_gate/.test(contents),
        `${relPath} must verify coverage_gate is present in the closeout payload`,
      ).toBe(true);
    });
  }
});

describe("verifier — AC-9: coverage ownership points to qa-engineer", () => {
  for (const relPath of VERIFIER_VARIANTS) {
    it(`names qa-engineer as the coverage owner in ${relPath}`, () => {
      const contents = readIfExists(relPath);
      expect(contents.length, `missing or empty ${relPath}`).toBeGreaterThan(0);
      const coverageLine = contents
        .split("\n")
        .find((line) => /White-box code coverage or mutation testing/.test(line));
      expect(coverageLine, `${relPath} lost its coverage out-of-scope entry`).toBeDefined();
      expect(
        /qa-engineer/.test(coverageLine ?? ""),
        `${relPath} must name qa-engineer as the owner of coverage and mutation testing`,
      ).toBe(true);
    });
  }
});

describe("registries and docs — SC-25/SC-26/AC-9", () => {
  const registries = [
    "AGENTS.md",
    "AGENTS.md.template",
    "CLAUDE.md",
    "CLAUDE.md.template",
    "README.md",
    "docs/workflow-chains.md",
    "docs/system-overview.md",
  ] as const;

  for (const relPath of registries) {
    it(`references qa-engineer in ${relPath}`, () => {
      const contents = readIfExists(relPath);
      expect(contents.length, `missing or empty ${relPath}`).toBeGreaterThan(0);
      expect(/qa-engineer/.test(contents), `${relPath} does not mention qa-engineer`).toBe(true);
    });
  }

  for (const skill of NEW_SKILLS) {
    it(`lists ${skill} in AGENTS.md`, () => {
      expect(readIfExists("AGENTS.md")).toContain(skill);
    });
  }

  it("documents the TESTING.md contract in AGENTS.md", () => {
    const contents = readIfExists("AGENTS.md");
    expect(contents).toContain("TESTING.md");
  });

  it("updates the Claude subagent count away from six", () => {
    const contents = readIfExists("AGENTS.md");
    expect(contents.length, "missing or empty AGENTS.md").toBeGreaterThan(0);
    expect(
      /`\.claude\/agents\/` carries six by design/.test(contents),
      "AGENTS.md still claims six Claude subagents; qa-engineer makes seven",
    ).toBe(false);
  });
});

describe("distribution registration — AC-10", () => {
  it("lists TESTING.md as consumer-owned in bundle-manifest.json", () => {
    const manifest = JSON.parse(read("bundle-manifest.json")) as {
      consumer_owned_paths?: string[];
    };
    expect(manifest.consumer_owned_paths ?? []).toContain(TESTING_CONTRACT);
  });

  it("ships TESTING.md via build-bundle.sh MANAGED_FILES", () => {
    const script = read("scripts/build-bundle.sh");
    const managedBlock = script.slice(
      script.indexOf("MANAGED_FILES=("),
      script.indexOf(")", script.indexOf("MANAGED_FILES=(")),
    );
    expect(managedBlock, "MANAGED_FILES block not found in build-bundle.sh").not.toHaveLength(0);
    expect(managedBlock).toContain(TESTING_CONTRACT);
  });
});
