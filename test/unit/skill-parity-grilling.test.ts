/**
 * Structural parity check: verifies that the activity-grill skill has
 * identical behavioural content across all three platform trees, and that
 * it declares all eleven operative rules from specification §8.1 (FR-1
 * through FR-11), plus the story S-001 invariants (no grill-me
 * attribution per D-53, conversation-only session state per D-54,
 * configurable cap per D-55, researcher-budget precedence per D-56).
 *
 * Covers issue #213 (S-001) AC-9 / S-001-AC-9.
 *
 * Also covers issue #214 (S-002): activity-refine's invocation of
 * activity-grill in both PRD Creation mode (WHAT phase, FR-12) and Issue
 * Refinement mode (Issue Mode, FR-15), the inline decision-citation +
 * `## Decisions` section output contract (FR-14), and three-tree parity
 * for activity-refine itself (S-002-AC-4).
 *
 * Also covers issue #215 (S-003): activity-generate-spec's invocation of
 * activity-grill in HOW phase (FR-13), sequencing confirmation that the
 * existing conditional pre-step researcher call (ADR-004) runs before the
 * HOW-phase invocation, the inline decision-citation + `## Decisions (HOW
 * phase)` section output contract (FR-14), and three-tree parity for
 * activity-generate-spec itself (S-003-AC-4).
 *
 * Also covers issue #216 (S-004): the `plan` instruction/skill's inline
 * decision citation on traceable task-list sub-tasks and its closing
 * `## Decisions Consumed` section output contract (FR-16), the additive
 * "cite none if not traceable" invariant (S-004-AC-2), and three-tree
 * parity across `plan`'s three differently-named platform files —
 * `.claude/skills/plan/SKILL.md`, `.github/instructions/plan.instructions.md`,
 * `.kiro/steering/plan.md` (S-004-AC-3).
 *
 * Also covers issue #218 (S-006): `implement`'s "Before Starting Work"
 * decision-log read step, ordered before the branch-creation gate and
 * alongside (not replacing) the GitHub-issue-open check (S-006-AC-1); the
 * commit/PR decision-ID citation instruction (S-006-AC-2); the
 * graceful-absence handling for a missing `decisions-<feature>.md`
 * (S-006-AC-3); and three-tree parity across `implement`'s three
 * differently-named platform files — `.claude/skills/implement/SKILL.md`,
 * `.github/instructions/implement.instructions.md`,
 * `.kiro/steering/implement.md` (S-006-AC-4). Note `plan` is not a
 * `.claude/skills/activity-*` skill and has no `.github/skills/plan/` or
 * `.kiro/skills/plan/` equivalent.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";

const ROOT = resolve(__dirname, "../..");

const SKILL_PATHS = [
  ".github/skills/activity-grill/SKILL.md",
  ".claude/skills/activity-grill/SKILL.md",
  ".kiro/skills/activity-grill/SKILL.md",
] as const;

const REFINE_SKILL_PATHS = [
  ".github/skills/activity-refine/SKILL.md",
  ".claude/skills/activity-refine/SKILL.md",
  ".kiro/skills/activity-refine/SKILL.md",
] as const;

const SPEC_SKILL_PATHS = [
  ".github/skills/activity-generate-spec/SKILL.md",
  ".claude/skills/activity-generate-spec/SKILL.md",
  ".kiro/skills/activity-generate-spec/SKILL.md",
] as const;

/**
 * `plan` is not a `.claude/skills/activity-*` skill and carries a
 * different file name per platform — no `.github/skills/plan/SKILL.md`
 * or `.kiro/skills/plan/SKILL.md` exists.
 */
const PLAN_INSTRUCTION_PATHS = [
  ".github/instructions/plan.instructions.md",
  ".claude/skills/plan/SKILL.md",
  ".kiro/steering/plan.md",
] as const;

/**
 * `implement` has the same non-`activity-*` path shape as `plan`: a
 * differently-named file per platform, no `.github/skills/implement/` or
 * `.kiro/skills/implement/` equivalent.
 */
const IMPLEMENT_INSTRUCTION_PATHS = [
  ".github/instructions/implement.instructions.md",
  ".claude/skills/implement/SKILL.md",
  ".kiro/steering/implement.md",
] as const;

/** One marker string per operative rule (FR-1..FR-11, specification §8.1). */
const REQUIRED_RULE_MARKERS: Record<string, string> = {
  "FR-1 one question per turn": "one question",
  "FR-2 depth-first traversal": "depth-first",
  "FR-3 resolve-before-ask": "resolve-before-ask",
  "FR-4 append-per-resolution": "append-per-resolution",
  "FR-5 qualified citation form": "#D-",
  "FR-6 decision-tree summary cadence": "decision-tree summary",
  "FR-7 two-phase mode": 'phase="WHAT"',
  "FR-8 hard exit gate": "do you confirm shared understanding",
  "FR-9 configurable cap": "25/25/8",
  "FR-10 issue mode constraints": "Issue Mode",
  "FR-11 assumption-testing reminder": "reproduces its own assumptions",
};

/** Story-level invariants (D-53..D-56) that MUST be reflected in the skill text. */
const REQUIRED_DECISION_MARKERS: Record<string, string> = {
  "D-53 no grill-me attribution": "grill-me",
  "D-54 conversation-only session state": "grill-state",
  "D-55 cap config in docs/tech.md": "docs/tech.md",
  "D-56 researcher budget precedence": "researcher",
};

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

describe("activity-grill skill — presence", () => {
  for (const relPath of SKILL_PATHS) {
    it(`exists at ${relPath}`, () => {
      expect(existsSync(resolve(ROOT, relPath)), `missing required file: ${relPath}`).toBe(true);
    });
  }
});

describe("activity-grill skill — behavioral parity", () => {
  it("all three trees have identical behavioural content (ignoring frontmatter)", () => {
    const contents = SKILL_PATHS.map((p) => stripFrontmatter(read(p)));
    expect(contents[0]).toBe(contents[1]);
    expect(contents[0]).toBe(contents[2]);
  });
});

describe("activity-grill skill — eleven operative rules declared", () => {
  for (const [label, marker] of Object.entries(REQUIRED_RULE_MARKERS)) {
    it(`declares ${label} in all three trees`, () => {
      for (const relPath of SKILL_PATHS) {
        const content = read(relPath);
        expect(
          content.toLowerCase().includes(marker.toLowerCase()),
          `${relPath} does not contain marker for ${label} ("${marker}")`,
        ).toBe(true);
      }
    });
  }
});

describe("activity-grill skill — story S-001 decision invariants declared", () => {
  for (const [label, marker] of Object.entries(REQUIRED_DECISION_MARKERS)) {
    it(`reflects ${label} in all three trees`, () => {
      for (const relPath of SKILL_PATHS) {
        const content = read(relPath);
        expect(
          content.toLowerCase().includes(marker.toLowerCase()),
          `${relPath} does not contain marker for ${label} ("${marker}")`,
        ).toBe(true);
      }
    });
  }
});

describe("activity-grill skill — no grill-me attribution anywhere (D-53)", () => {
  it("does not credit or link any grill-me implementation", () => {
    for (const relPath of SKILL_PATHS) {
      const content = read(relPath);
      // The only permitted occurrence of "grill-me" is the negative statement
      // that no attribution is added (D-53) — never a credit line or link.
      const lines = content.split("\n").filter((line) => /grill-me/i.test(line));
      for (const line of lines) {
        expect(
          /no .*grill-me.* attribution|no attribution/i.test(line),
          `${relPath} appears to credit grill-me instead of stating no attribution is added: "${line}"`,
        ).toBe(true);
      }
    }
  });
});

describe("activity-refine skill — presence (S-002)", () => {
  for (const relPath of REFINE_SKILL_PATHS) {
    it(`exists at ${relPath}`, () => {
      expect(existsSync(resolve(ROOT, relPath)), `missing required file: ${relPath}`).toBe(true);
    });
  }
});

describe("activity-refine skill — three-tree behavioral parity (S-002-AC-4)", () => {
  it("all three trees have identical behavioural content (ignoring frontmatter)", () => {
    const contents = REFINE_SKILL_PATHS.map((p) => stripFrontmatter(read(p)));
    expect(contents[0]).toBe(contents[1]);
    expect(contents[0]).toBe(contents[2]);
  });
});

/** Markers asserting activity-refine's activity-grill wiring (S-002 AC-1..AC-3). */
const REQUIRED_REFINE_MARKERS: Record<string, string> = {
  "S-002-AC-1 WHAT-phase invocation before drafting": 'activity-grill(phase="what"',
  "S-002-AC-1 no draft before exit gate (PRD)": "must not** produce any prd section",
  "S-002-AC-2 Issue Mode invocation": 'activity-grill(mode="issue"',
  "S-002-AC-2 Issue Mode cap": "cap.issue",
  "S-002-AC-2 prior-decision reuse in qualified form": "<other-feature>#d-nn",
  "S-002-AC-3 inline decision citation": "… (d-nn)",
  "S-002-AC-3 Decisions section": "## decisions",
};

describe("activity-refine skill — activity-grill wiring declared (S-002 AC-1..AC-3)", () => {
  for (const [label, marker] of Object.entries(REQUIRED_REFINE_MARKERS)) {
    it(`declares ${label} in all three trees`, () => {
      for (const relPath of REFINE_SKILL_PATHS) {
        const content = read(relPath);
        expect(
          content.toLowerCase().includes(marker.toLowerCase()),
          `${relPath} does not contain marker for ${label} ("${marker}")`,
        ).toBe(true);
      }
    });
  }
});

describe("activity-generate-spec skill — presence (S-003)", () => {
  for (const relPath of SPEC_SKILL_PATHS) {
    it(`exists at ${relPath}`, () => {
      expect(existsSync(resolve(ROOT, relPath)), `missing required file: ${relPath}`).toBe(true);
    });
  }
});

describe("activity-generate-spec skill — three-tree behavioral parity (S-003-AC-4)", () => {
  it("all three trees have identical behavioural content (ignoring frontmatter)", () => {
    const contents = SPEC_SKILL_PATHS.map((p) => stripFrontmatter(read(p)));
    expect(contents[0]).toBe(contents[1]);
    expect(contents[0]).toBe(contents[2]);
  });
});

/** Markers asserting activity-generate-spec's activity-grill wiring (S-003 AC-1..AC-3). */
const REQUIRED_SPEC_MARKERS: Record<string, string> = {
  "S-003-AC-1 HOW-phase invocation before drafting": 'activity-grill(phase="how"',
  "S-003-AC-1 no draft before exit gate (spec)": "must not** produce any specification section",
  "S-003-AC-2 pre-step researcher call sequenced before HOW phase": "conditional pre-step",
  "S-003-AC-2 researcher budget reuse (D-56)": "d-56",
  "S-003-AC-3 inline decision citation": "… (d-nn)",
  "S-003-AC-3 Decisions (HOW phase) section": "## decisions (how phase)",
};

describe("activity-generate-spec skill — activity-grill wiring declared (S-003 AC-1..AC-3)", () => {
  for (const [label, marker] of Object.entries(REQUIRED_SPEC_MARKERS)) {
    it(`declares ${label} in all three trees`, () => {
      for (const relPath of SPEC_SKILL_PATHS) {
        const content = read(relPath);
        expect(
          content.toLowerCase().includes(marker.toLowerCase()),
          `${relPath} does not contain marker for ${label} ("${marker}")`,
        ).toBe(true);
      }
    });
  }
});

describe("plan instruction — presence (S-004)", () => {
  for (const relPath of PLAN_INSTRUCTION_PATHS) {
    it(`exists at ${relPath}`, () => {
      expect(existsSync(resolve(ROOT, relPath)), `missing required file: ${relPath}`).toBe(true);
    });
  }
});

describe("plan instruction — three-tree behavioral parity (S-004-AC-3)", () => {
  it("all three trees have identical behavioural content (ignoring frontmatter)", () => {
    const contents = PLAN_INSTRUCTION_PATHS.map((p) => stripFrontmatter(read(p)));
    expect(contents[0]).toBe(contents[1]);
    expect(contents[0]).toBe(contents[2]);
  });
});

/** Markers asserting `plan`'s decision-citation output contract (S-004 AC-1..AC-2, FR-16). */
const REQUIRED_PLAN_MARKERS: Record<string, string> = {
  "S-004-AC-1 inline citation guidance": "(d-55)",
  "S-004-AC-1 Decisions Consumed section": "## decisions consumed",
  "S-004-AC-2 additive, no fabrication": "cite",
  "S-004-AC-2 unqualified D-NN form (no cross-feature qualification needed)": "unqualified `d-nn`",
};

describe("plan instruction — decision-citation contract declared (S-004 AC-1..AC-2)", () => {
  for (const [label, marker] of Object.entries(REQUIRED_PLAN_MARKERS)) {
    it(`declares ${label} in all three trees`, () => {
      for (const relPath of PLAN_INSTRUCTION_PATHS) {
        const content = read(relPath);
        expect(
          content.toLowerCase().includes(marker.toLowerCase()),
          `${relPath} does not contain marker for ${label} ("${marker}")`,
        ).toBe(true);
      }
    });
  }
});

describe("plan instruction — additive-only, does not require fabricating a citation (S-004-AC-2)", () => {
  it("states a task with no traceable decision cites none, not a fabricated one", () => {
    for (const relPath of PLAN_INSTRUCTION_PATHS) {
      const content = read(relPath).toLowerCase();
      expect(
        content.includes("must not** fabricate a citation"),
        `${relPath} does not state the no-fabrication invariant`,
      ).toBe(true);
    }
  });
});

describe("implement instruction — presence (S-006)", () => {
  for (const relPath of IMPLEMENT_INSTRUCTION_PATHS) {
    it(`exists at ${relPath}`, () => {
      expect(existsSync(resolve(ROOT, relPath)), `missing required file: ${relPath}`).toBe(true);
    });
  }
});

describe("implement instruction — three-tree behavioral parity (S-006-AC-4)", () => {
  it("all three trees have identical behavioural content (ignoring frontmatter)", () => {
    const contents = IMPLEMENT_INSTRUCTION_PATHS.map((p) => stripFrontmatter(read(p)));
    expect(contents[0]).toBe(contents[1]);
    expect(contents[0]).toBe(contents[2]);
  });
});

/** Markers asserting `implement`'s decision-log read step and citation contract (S-006 AC-1..AC-3). */
const REQUIRED_IMPLEMENT_MARKERS: Record<string, string> = {
  "S-006-AC-1 decision-log read step present": "workstream/decisions-<feature>.md` in full",
  "S-006-AC-1 alongside (not replacing) the issue-open check":
    "alongside (not replacing) the github-issue-open check",
  "S-006-AC-1 ordered before the branch gate": "ordered before the branch gate",
  "S-006-AC-2 commit/PR citation instruction": "follows d-nn",
  "S-006-AC-2 PR body references consumed decision IDs":
    "pr body **must** reference every consumed decision id",
  "S-006-AC-3 graceful-absence handling":
    "you **must** proceed without the read, noting its absence",
};

describe("implement instruction — decision-log read + citation contract declared (S-006 AC-1..AC-3)", () => {
  for (const [label, marker] of Object.entries(REQUIRED_IMPLEMENT_MARKERS)) {
    it(`declares ${label} in all three trees`, () => {
      for (const relPath of IMPLEMENT_INSTRUCTION_PATHS) {
        const content = read(relPath);
        expect(
          content.toLowerCase().includes(marker.toLowerCase()),
          `${relPath} does not contain marker for ${label} ("${marker}")`,
        ).toBe(true);
      }
    });
  }
});

describe("implement instruction — read step ordered before branch gate, not a hard gate itself (S-006-AC-1/AC-3)", () => {
  it("the decision-log read step appears before the branch-gate step in Before Starting Work", () => {
    for (const relPath of IMPLEMENT_INSTRUCTION_PATHS) {
      const content = read(relPath);
      const readIdx = content.indexOf("Decision-log read");
      const branchGateIdx = content.indexOf("Branch gate (hard requirement)");
      expect(readIdx, `${relPath} is missing the "Decision-log read" step`).toBeGreaterThan(-1);
      expect(
        branchGateIdx,
        `${relPath} is missing the "Branch gate (hard requirement)" step`,
      ).toBeGreaterThan(-1);
      expect(
        readIdx,
        `${relPath}: decision-log read step must be ordered before the branch gate`,
      ).toBeLessThan(branchGateIdx);
    }
  });

  it("a missing decision log never blocks starting work (S-006-AC-3, additive-only invariant)", () => {
    for (const relPath of IMPLEMENT_INSTRUCTION_PATHS) {
      const content = read(relPath).toLowerCase();
      expect(
        content.includes("this is an enrichment, never a hard gate"),
        `${relPath} does not state the graceful-absence / non-blocking invariant`,
      ).toBe(true);
    }
  });
});

/**
 * Story S-003 (issue #231): the `## Vocabulary` section in both output
 * structures, `activity-refine`'s pre-review check call and approval
 * append, and the negative invariant that none of this moved into
 * `activity-grill` (PT-2, PT-3, CT-11, D-61).
 *
 * The append is `activity-refine`'s write and nobody else's. D-61 put
 * it there deliberately: `activity-grill` runs while the user is still
 * deciding, and a skill that writes vocabulary mid-interview records
 * terms the user has not agreed to yet. The last test in this block is
 * the one that would catch that drift — it asserts `activity-grill`'s
 * Write Authority still names the decision log and nothing else.
 */

/** PT-2: `activity-refine`'s Vocabulary section, check call, and append (S-003 AC-1/3/4). */
const REQUIRED_REFINE_VOCABULARY_MARKERS: Record<string, string> = {
  "S-003-AC-1 Vocabulary section in the PRD Output Structure": "## vocabulary",
  "CT-11 column: Term": "| term |",
  "CT-11 column: Status in glossary": "status in glossary",
  "CT-11 column: Bounded context": "bounded context",
  "CT-11 column: Definition (proposals only)": "definition (proposals only)",
  "CT-11 column: Forbidden synonyms (proposals only)": "forbidden synonyms (proposals only)",
  "CT-11 status vocabulary": "existing \\| proposed \\| conflict → d-nn",
  "CT-11 sentinel line": "none — this prd introduces no domain concepts.",
  "S-003-AC-3 pre-review check call": "checkvocabularysection",
  "S-003-AC-3 finding reported by name (missing)": "vocabulary-missing",
  "S-003-AC-3 finding reported by name (incomplete)": "vocabulary-incomplete",
  "S-003-AC-4 append happens on approval": "when the user approves",
  "S-003-AC-4 append, never at draft time": "never when the prd is drafted",
  "S-003-AC-4 Origin is the PRD path": "origin` to the prd's path",
  "S-003-AC-4 Status: active": "status: active",
  "S-003-AC-4 +term changelog row": "+term",
  "S-003-AC-4 version bump": "bump the frontmatter `version`",
  "S-003-AC-4 status flip on first append": "unfilled` to `active",
  "S-003-AC-4 conflict marks the old term superseded": "superseded by",
  "S-003-AC-4 unresolvable context refuses the append (FR-63)":
    "you **must not** create the heading",
};

describe("activity-refine skill — Vocabulary section and approval append (S-003, PT-2)", () => {
  for (const [label, marker] of Object.entries(REQUIRED_REFINE_VOCABULARY_MARKERS)) {
    it(`declares ${label} in all three trees`, () => {
      for (const relPath of REFINE_SKILL_PATHS) {
        const content = read(relPath);
        expect(
          content.toLowerCase().includes(marker.toLowerCase()),
          `${relPath} does not contain marker for ${label} ("${marker}")`,
        ).toBe(true);
      }
    });
  }

  it("places Vocabulary after Decisions in the PRD Output Structure (S-003-AC-1, D-61)", () => {
    for (const relPath of REFINE_SKILL_PATHS) {
      const content = read(relPath);
      const decisions = content.indexOf("19. **Decisions**");
      const vocabulary = content.indexOf("20. **Vocabulary**");
      expect(
        decisions,
        `${relPath}: PRD Output Structure item 19 (Decisions) not found`,
      ).toBeGreaterThan(-1);
      expect(
        vocabulary,
        `${relPath}: PRD Output Structure item 20 (Vocabulary) not found`,
      ).toBeGreaterThan(-1);
      expect(vocabulary, `${relPath}: Vocabulary must follow Decisions`).toBeGreaterThan(decisions);
    }
  });
});

/** PT-3: `activity-generate-spec`'s Vocabulary section (S-003 AC-1, D-75). */
const REQUIRED_SPEC_VOCABULARY_MARKERS: Record<string, string> = {
  "S-003-AC-1 Vocabulary section in the Output Structure": "## vocabulary",
  "CT-11 column: Term": "| term |",
  "CT-11 column: Status in glossary": "status in glossary",
  "CT-11 column: Definition (proposals only)": "definition (proposals only)",
  "CT-11 column: Forbidden synonyms (proposals only)": "forbidden synonyms (proposals only)",
  "S-003-AC-7 pre-review check on specs (D-75)": "checkvocabularysection",
  "S-003-AC-7 finding reported by name": "vocabulary-incomplete",
  "F-6 sentinel names the document it is written in":
    "none — this specification introduces no domain concepts.",
  "F-1 sentinel is the section's only content": "only when nothing else stands beside it",
};

describe("activity-generate-spec skill — Vocabulary section (S-003, PT-3)", () => {
  for (const [label, marker] of Object.entries(REQUIRED_SPEC_VOCABULARY_MARKERS)) {
    it(`declares ${label} in all three trees`, () => {
      for (const relPath of SPEC_SKILL_PATHS) {
        const content = read(relPath);
        expect(
          content.toLowerCase().includes(marker.toLowerCase()),
          `${relPath} does not contain marker for ${label} ("${marker}")`,
        ).toBe(true);
      }
    });
  }

  it("does not tell specification authors to label their document a PRD (F-6)", () => {
    // The skill shipped instructing spec authors to write `None — this
    // PRD introduces no domain concepts.` in a specification. The check
    // accepts both wordings; the instruction should not ask an author
    // to mislabel the document they are writing.
    for (const relPath of SPEC_SKILL_PATHS) {
      expect(
        read(relPath).toLowerCase().includes("none — this prd introduces no domain concepts."),
        `${relPath} tells specification authors to write the PRD wording of the sentinel`,
      ).toBe(false);
    }
  });

  it("places Vocabulary after Decisions (HOW phase) in the Output Structure", () => {
    for (const relPath of SPEC_SKILL_PATHS) {
      const content = read(relPath);
      const decisions = content.indexOf("18. **Decisions (HOW phase)**");
      const vocabulary = content.indexOf("19. **Vocabulary**");
      expect(decisions, `${relPath}: Output Structure item 18 not found`).toBeGreaterThan(-1);
      expect(
        vocabulary,
        `${relPath}: Output Structure item 19 (Vocabulary) not found`,
      ).toBeGreaterThan(-1);
      expect(
        vocabulary,
        `${relPath}: Vocabulary must follow Decisions (HOW phase)`,
      ).toBeGreaterThan(decisions);
    }
  });
});

describe("activity-grill skill — the glossary append did not move here (S-003-AC-5, D-61)", () => {
  it("Write Authority still names the decision log and nothing else", () => {
    for (const relPath of SKILL_PATHS) {
      const content = read(relPath);
      const start = content.indexOf("## Write Authority");
      expect(start, `${relPath} has no Write Authority section`).toBeGreaterThan(-1);
      const section = content.slice(start, content.indexOf("\n## ", start + 1));
      expect(section).toContain("workstream/decisions-<feature>.md");
      expect(
        section.includes("Nothing else."),
        `${relPath}: Write Authority no longer closes the list`,
      ).toBe(true);
      expect(
        section.toLowerCase(),
        `${relPath}: activity-grill must not gain glossary write authority (D-61)`,
      ).not.toContain("ubiquitous-language");
    }
  });

  it("does not append terms, bump the glossary version, or flip its status", () => {
    for (const relPath of SKILL_PATHS) {
      const content = read(relPath).toLowerCase();
      for (const forbidden of [
        "docs/domain/ubiquitous-language.md",
        "+term",
        "checkvocabularysection",
      ]) {
        expect(
          content.includes(forbidden),
          `${relPath}: activity-grill must not reference "${forbidden}" — the append is activity-refine's write (D-61)`,
        ).toBe(false);
      }
    }
  });
});

describe("test/fixtures/grilling — S-003 scenario fixture (FX-2, FX-3)", () => {
  const FIXTURE = "test/fixtures/grilling/vocabulary-approval.md";

  it("exists and covers the approval append end to end", () => {
    expect(existsSync(resolve(ROOT, FIXTURE)), `missing required fixture: ${FIXTURE}`).toBe(true);
    const content = read(FIXTURE).toLowerCase();
    for (const marker of [
      "proposed",
      "existing",
      "+term",
      "status: active",
      "unfilled",
      "bounded context",
    ]) {
      expect(content.includes(marker), `${FIXTURE} does not walk "${marker}"`).toBe(true);
    }
  });

  it("is listed in the fixtures README (FX-3)", () => {
    const readme = read("test/fixtures/grilling/README.md");
    expect(readme).toContain("vocabulary-approval.md");
  });
});

/**
 * Phase 3 story S-004 (issue #232): `activity-grill`'s WHAT-phase FR-21
 * vocabulary-conflict rule (specification §8.5), the removal of the
 * Phase-3 placeholder hedges, and the unchanged Write Authority.
 *
 * Every assertion below runs per tree. That is deliberate rather than
 * incidental: a marker set checked against one tree passes while the
 * other two diverge, and three-tree parity is the only thing keeping
 * the Copilot and Kiro copies honest. The content-equality test above
 * would also catch divergence, but it reports "the files differ", not
 * which rule went missing — these say which.
 */

/** PT-1 positives: the FR-21 conflict rule (S-004-AC-1, AC-08). */
const REQUIRED_GRILL_CONFLICT_MARKERS: Record<string, string> = {
  "S-004-AC-1 rule cites FR-21": "fr-21",
  "S-004-AC-1 WHAT-phase concept question": "which domain concepts",
  "S-004-AC-1 check (a): same term, different definition": "different definition",
  "S-004-AC-1 check (b): forbidden synonym": "forbidden synonym",
  "S-004-AC-1 surfaced as a question": "surfaced as a question",
  // "recommendation" is deliberately NOT a whole-file marker: FR-1's
  // one-question-one-recommendation rule already uses the word four
  // times elsewhere in this skill, so a whole-file grep for it passes
  // even when the FR-21 rule drops the requirement entirely. It is
  // asserted against the rule's own section instead, below.
  "S-004-AC-1 never resolved silently": "never resolved silently",
  "S-004-AC-1 edge case: same definition is reused, not asked": "same definition",
  "S-004-AC-1 edge case: one question naming both owning terms": "naming both",
  "S-004-AC-2 read-only rule stands as written (Issue Mode)": "glossary is read-only",
};

/**
 * PT-1 negatives. Each of these shipped in Phase 2 as an explicit "this
 * is not real yet" hedge. Phase 3 makes the glossary real, so a hedge
 * left behind is not cosmetic — it tells the skill the rule above it is
 * inert. Asserting their absence is the only thing that distinguishes
 * "the rule was added" from "the rule was added and the contradiction
 * was removed".
 */
const FORBIDDEN_GRILL_PLACEHOLDERS: readonly string[] = [
  "once Phase 3 ships it",
  "moot until Phase 3",
  "until it exists",
  "Phase 3 ships the glossary",
];

/**
 * S-004-AC-3 snapshot. The Write Authority section must be byte-identical
 * to the text merged in Phase 2 — not merely "still mentions the decision
 * log". D-61 puts the glossary append in `activity-refine`; a widened
 * Write Authority here is the drift this catches, including a widening
 * that keeps the decision-log bullet intact.
 */
const WRITE_AUTHORITY_SNAPSHOT = `## Write Authority

- \`workstream/decisions-<feature>.md\` — append one row per resolved question, immediately (FR-4). Never batch writes to the end of a session.
- Nothing else. No PRD, spec, task list, code, or \`/DESIGN.md\` file may be created or modified by this skill.`;

describe("activity-grill skill — FR-21 vocabulary-conflict rule (S-004, PT-1)", () => {
  for (const [label, marker] of Object.entries(REQUIRED_GRILL_CONFLICT_MARKERS)) {
    it(`declares ${label} in all three trees`, () => {
      for (const relPath of SKILL_PATHS) {
        const content = read(relPath);
        expect(
          content.toLowerCase().includes(marker.toLowerCase()),
          `${relPath} does not contain marker for ${label} ("${marker}")`,
        ).toBe(true);
      }
    });
  }

  it("places the conflict rule in the WHAT phase, not Issue Mode (S-004-AC-1/AC-2)", () => {
    for (const relPath of SKILL_PATHS) {
      const content = read(relPath);
      const rule = content.indexOf("Vocabulary conflicts are questions");
      const issueMode = content.indexOf("### 10. Issue Mode constraints");
      expect(rule, `${relPath} is missing the FR-21 conflict rule heading`).toBeGreaterThan(-1);
      expect(issueMode, `${relPath} is missing the Issue Mode section`).toBeGreaterThan(-1);
      expect(
        rule,
        `${relPath}: the FR-21 conflict rule must precede Issue Mode — it is a WHAT-phase rule (spec §8.5)`,
      ).toBeLessThan(issueMode);
    }
  });

  /**
   * Spec §8.5 requires the conflict be "surfaced as a question with a
   * recommendation" — the recommendation is part of the rule, not an
   * inherited default. A whole-file grep cannot assert it: the word
   * appears throughout FR-1's section, so the rule can lose the
   * requirement outright and a file-scoped marker still passes. This
   * reads the rule's own section and nothing else.
   */
  it("requires the conflict question to carry a recommendation, in the rule itself (S-004-AC-1, spec §8.5)", () => {
    for (const relPath of SKILL_PATHS) {
      const content = read(relPath);
      const start = content.indexOf("### 3a. Vocabulary conflicts are questions");
      expect(start, `${relPath} is missing the FR-21 conflict rule heading`).toBeGreaterThan(-1);
      const end = content.indexOf("\n### ", start + 1);
      expect(
        end,
        `${relPath}: the FR-21 rule is not followed by another step heading`,
      ).toBeGreaterThan(start);
      const rule = content.slice(start, end).toLowerCase();
      expect(
        rule.includes("recommendation"),
        `${relPath}: the FR-21 conflict rule does not require a recommendation — spec §8.5 says a conflict is "surfaced as a question with a recommendation"`,
      ).toBe(true);
    }
  });

  /**
   * D-3 (verifier audit of #232): Issue Mode's read-only rule sends the
   * reader to "the conflict checks in step 3a", but step 3a scoped
   * itself to `phase="WHAT"` and `activity-refine` invokes Issue Mode
   * with `mode` and `cap` only — no `phase` at all. Read together, the
   * two statements contradict: the rule Issue Mode is pointed at
   * excludes Issue Mode. The resolution is that step 3a names both
   * vocabulary-settling callers explicitly.
   *
   * Section-scoped on purpose. `mode="issue"` appears in the Issue Mode
   * section too, so a whole-file `includes` passes even with step 3a's
   * clause reverted to WHAT-only — exactly the hole 7c1b190 closed for
   * the recommendation marker.
   */
  it("scopes the FR-21 rule to both vocabulary-settling callers — WHAT phase and Issue Mode (D-3)", () => {
    for (const relPath of SKILL_PATHS) {
      const content = read(relPath);
      const start = content.indexOf("### 3a. Vocabulary conflicts are questions");
      expect(start, `${relPath} is missing the FR-21 conflict rule heading`).toBeGreaterThan(-1);
      const end = content.indexOf("\n### ", start + 1);
      expect(
        end,
        `${relPath}: the FR-21 rule is not followed by another step heading`,
      ).toBeGreaterThan(start);
      const rule = content.slice(start, end).toLowerCase();
      expect(
        rule.includes('phase="what"'),
        `${relPath}: the FR-21 rule no longer names the WHAT phase (spec §8.5)`,
      ).toBe(true);
      expect(
        rule.includes('mode="issue"'),
        `${relPath}: the FR-21 rule does not name Issue Mode, but step 10 sends Issue Mode here for "the conflict checks in step 3a" — the two contradict (verifier D-3)`,
      ).toBe(true);
    }
  });

  /**
   * The other half of D-3: `## Invocation` documents `phase` as if every
   * caller passes one. Issue Mode does not. Scoped to the Invocation
   * section so that the statement cannot be satisfied by prose elsewhere.
   */
  it("records in ## Invocation that Issue Mode passes no phase (D-3)", () => {
    for (const relPath of SKILL_PATHS) {
      const content = read(relPath);
      const start = content.indexOf("## Invocation");
      expect(start, `${relPath} is missing the Invocation section`).toBeGreaterThan(-1);
      const end = content.indexOf("\n## ", start + 1);
      expect(end, `${relPath}: the Invocation section has no following section`).toBeGreaterThan(
        start,
      );
      const invocation = content.slice(start, end).toLowerCase();
      expect(
        invocation.includes("without a `phase`"),
        `${relPath}: ## Invocation does not state that Issue Mode is invoked without a \`phase\` argument — \`activity-refine\` passes \`mode\` and \`cap\` only (verifier D-3)`,
      ).toBe(true);
    }
  });
});

describe("activity-grill skill — Phase-3 placeholders removed (S-004-AC-2)", () => {
  for (const placeholder of FORBIDDEN_GRILL_PLACEHOLDERS) {
    it(`no longer hedges with "${placeholder}" in any tree`, () => {
      for (const relPath of SKILL_PATHS) {
        expect(
          read(relPath).toLowerCase().includes(placeholder.toLowerCase()),
          `${relPath} still carries the Phase-3 placeholder "${placeholder}" — the glossary exists now (spec §8.5)`,
        ).toBe(false);
      }
    });
  }

  it("keeps Issue Mode's read-only rule, stated without a hedge (S-004-AC-2)", () => {
    for (const relPath of SKILL_PATHS) {
      const content = read(relPath);
      const start = content.indexOf("### 10. Issue Mode constraints");
      expect(start, `${relPath} is missing the Issue Mode section`).toBeGreaterThan(-1);
      const section = content.slice(start, content.indexOf("\n### ", start + 1));
      expect(
        section.includes("**Glossary is read-only.**"),
        `${relPath}: Issue Mode lost its read-only rule`,
      ).toBe(true);
      expect(
        /moot|once phase|until it exists/i.test(section),
        `${relPath}: Issue Mode's read-only rule is still hedged`,
      ).toBe(false);
    }
  });
});

describe("activity-grill skill — Write Authority unchanged by S-004 (S-004-AC-3, D-61)", () => {
  it("matches the Phase 2 text exactly in all three trees", () => {
    for (const relPath of SKILL_PATHS) {
      const content = read(relPath);
      const start = content.indexOf("## Write Authority");
      expect(start, `${relPath} has no Write Authority section`).toBeGreaterThan(-1);
      const section = content.slice(start, content.indexOf("\n## ", start + 1)).trim();
      expect(
        section,
        `${relPath}: Write Authority changed — the glossary append belongs to activity-refine (D-61)`,
      ).toBe(WRITE_AUTHORITY_SNAPSHOT);
    }
  });
});

describe("test/fixtures/grilling — S-004 scenario fixture (FX-1, FX-3)", () => {
  const FIXTURE = "test/fixtures/grilling/vocabulary-conflict.md";

  it("exists and walks the forbidden-synonym collision end to end (S-004-AC-4)", () => {
    expect(existsSync(resolve(ROOT, FIXTURE)), `missing required fixture: ${FIXTURE}`).toBe(true);
    const content = read(FIXTURE).toLowerCase();
    for (const marker of [
      "forbidden synonym",
      "recommendation",
      // The resolved row cites the decision in FR-5's qualified form —
      // `conflict → <feature>#D-NN`, which `CONFLICT` in
      // `core/checks/glossary.ts` accepts alongside the bare `D-NN`.
      "conflict → doc-index#d-09",
      "foundation document",
      "product-context",
    ]) {
      expect(content.includes(marker), `${FIXTURE} does not walk "${marker}"`).toBe(true);
    }
  });

  it("shows the conflict resolved by the user, never by the skill (FR-21)", () => {
    const content = read(FIXTURE).toLowerCase();
    expect(
      content.includes("no write to the glossary"),
      `${FIXTURE} does not show that the grilling session leaves the glossary untouched (D-61)`,
    ).toBe(true);
  });

  it("covers both edge cases from the S-004 matrix", () => {
    const content = read(FIXTURE).toLowerCase();
    expect(
      content.includes("same definition"),
      `${FIXTURE} does not walk the same-term-same-definition case (no question fires)`,
    ).toBe(true);
    expect(
      content.includes("naming both"),
      `${FIXTURE} does not walk the synonym-forbidden-by-two-terms case (one question naming both)`,
    ).toBe(true);
  });

  it("is listed in the fixtures README (FX-3)", () => {
    const readme = read("test/fixtures/grilling/README.md");
    expect(readme).toContain("vocabulary-conflict.md");
  });
});
