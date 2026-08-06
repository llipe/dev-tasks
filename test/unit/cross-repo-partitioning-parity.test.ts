/**
 * Structural parity check: verifies that the cross-repo partitioning (RF-63)
 * documentation is consistent across all three platform trees.
 *
 * This test ensures that the partitioning procedure, contract-as-interface,
 * producer-before-consumers ordering, and low-payload elevation guard are
 * documented consistently across .kiro/, .github/, and .claude/ trees.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";

const ROOT = resolve(__dirname, "../..");

function readAgent(path: string): string {
  return readFileSync(resolve(ROOT, path), "utf-8");
}

describe("cross-repo partitioning — AGENTS.md", () => {
  const agents = readAgent("AGENTS.md");

  it("defines the cross-repo partitioning section", () => {
    expect(agents).toContain("## Cross-Repo Partitioning (RF-63)");
  });

  it("documents the detection rule (>1 primary)", () => {
    expect(agents).toContain("`scope.primary` contains >1 component");
  });

  it("documents one sub-task per repo", () => {
    expect(agents).toContain("One sub-task per repo");
    expect(agents).toContain("scoped exclusively to that component's repository");
  });

  it("documents contract-as-interface", () => {
    expect(agents).toContain("### Contract-as-Interface");
    expect(agents).toContain("boundary contract");
    expect(agents).toContain("target version");
    expect(agents).toContain("the foreign repo's internal implementation");
  });

  it("documents ordering rule (producer-before-consumers)", () => {
    expect(agents).toContain("### Ordering Rule");
    expect(agents).toContain("producer-before-consumers");
    expect(agents).toContain("provider (producer) implements its contract first");
  });

  it("documents low-payload elevation guard", () => {
    expect(agents).toContain("### Low-Payload Elevation Guard");
    expect(agents).toContain("`payload_confidence: low`");
    expect(agents).toContain("raised to at least `medium`");
  });

  it("documents blocking behavior for low-payload", () => {
    expect(agents).toContain("MUST NOT** use it as an acceptance interface");
    expect(agents).toContain("MUST** block the sub-task");
  });

  it("documents single-primary no-partition case", () => {
    expect(agents).toContain("### Single-Primary");
    expect(agents).toContain("no partitioning is needed");
  });

  it("references the partition proposal from dt scope gate", () => {
    expect(agents).toContain("partition proposal");
    expect(agents).toContain("dt scope gate");
  });
});

describe("cross-repo partitioning — product-engineer parity", () => {
  const kiro = readAgent(".kiro/agents/product-engineer.md");
  const github = readAgent(".github/agents/product-engineer.agent.md");
  const claude = readAgent(".claude/commands/product-engineer.md");

  const expectedRule =
    "Cross-repo partitioning (RF-63):** When scope contains >1 `primary` component";

  it("kiro product-engineer contains the cross-repo partitioning rule", () => {
    expect(kiro).toContain(expectedRule);
  });

  it("github product-engineer contains the cross-repo partitioning rule", () => {
    expect(github).toContain(expectedRule);
  });

  it("claude product-engineer contains the cross-repo partitioning rule", () => {
    expect(claude).toContain(expectedRule);
  });

  const keyPhrases = [
    "one sub-task per repo",
    "boundary contract",
    "producer-before-consumers",
    "`payload_confidence: low`",
    "raised to `medium`",
    "partition proposal",
  ];

  for (const phrase of keyPhrases) {
    it(`all three trees contain "${phrase}"`, () => {
      expect(kiro).toContain(phrase);
      expect(github).toContain(phrase);
      expect(claude).toContain(phrase);
    });
  }
});

describe("cross-repo partitioning — developer parity", () => {
  const kiro = readAgent(".kiro/agents/developer.md");
  const github = readAgent(".github/agents/developer.agent.md");
  const claudeAgent = readAgent(".claude/agents/developer.md");
  const claudeCmd = readAgent(".claude/commands/developer.md");

  const expectedRule = "Cross-repo sub-task scope (RF-63):** When executing a per-repo sub-task";

  it("kiro developer contains the cross-repo scope rule", () => {
    expect(kiro).toContain(expectedRule);
  });

  it("github developer contains the cross-repo scope rule", () => {
    expect(github).toContain(expectedRule);
  });

  it("claude developer agent contains the cross-repo scope rule", () => {
    expect(claudeAgent).toContain(expectedRule);
  });

  it("claude developer command contains the cross-repo scope rule", () => {
    expect(claudeCmd).toContain(expectedRule);
  });

  it("all developer agents reference contract-based acceptance", () => {
    const agents = [kiro, github, claudeAgent, claudeCmd];
    for (const agent of agents) {
      expect(agent).toContain("boundary contract");
      expect(agent).toContain("not the foreign repo's implementation");
    }
  });

  it("all developer agents reference low-payload blocking", () => {
    const agents = [kiro, github, claudeAgent, claudeCmd];
    for (const agent of agents) {
      expect(agent).toContain("`payload_confidence: low`");
      expect(agent).toContain("raised to `medium`");
    }
  });
});

describe("cross-repo partitioning — planner parity", () => {
  const kiro = readAgent(".kiro/agents/planner.md");
  const github = readAgent(".github/agents/planner.agent.md");
  const claude = readAgent(".claude/commands/planner.md");

  const expectedPhrase = "cross-repo partitioned work";

  it("kiro planner contains cross-repo partitioning reference", () => {
    expect(kiro).toContain(expectedPhrase);
  });

  it("github planner contains cross-repo partitioning reference", () => {
    expect(github).toContain(expectedPhrase);
  });

  it("claude planner contains cross-repo partitioning reference", () => {
    expect(claude).toContain(expectedPhrase);
  });

  it("all planner agents reference producer-before-consumers ordering", () => {
    expect(kiro).toContain("producer-before-consumers");
    expect(github).toContain("producer-before-consumers");
    expect(claude).toContain("producer-before-consumers");
  });

  it("all planner agents reference low-payload blocking", () => {
    expect(kiro).toContain("`payload_confidence: low`");
    expect(github).toContain("`payload_confidence: low`");
    expect(claude).toContain("`payload_confidence: low`");
  });
});
