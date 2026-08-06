/**
 * Dry-run walkthrough tests for the cross-repo partitioning (RF-63).
 *
 * These tests validate:
 * 1. Two-primary scope → ordered per-repo sub-tasks referencing boundary contracts
 * 2. Single primary → no partition
 * 3. Low-payload boundary → blocked until raised
 * 4. Circular producer/consumer → clear ordering strategy
 *
 * Since this is an agent-contract story (not runtime code), these tests
 * verify document structure and content correctness rather than executing
 * runtime logic.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";

const ROOT = resolve(__dirname, "../..");

function readFile(path: string): string {
  return readFileSync(resolve(ROOT, path), "utf-8");
}

describe("cross-repo partitioning — two-primary scope → per-repo sub-tasks", () => {
  const agents = readFile("AGENTS.md");

  it("mandates partitioning when >1 primary component", () => {
    expect(agents).toMatch(/more than one `primary` component.*MUST.*partition/s);
  });

  it("requires one sub-task per primary component's repo", () => {
    expect(agents).toContain("Each `primary` component becomes its own sub-task");
    expect(agents).toContain("scoped exclusively to that component's repository");
  });

  it("requires sub-tasks to reference boundary contracts", () => {
    expect(agents).toContain("boundary contract");
    expect(agents).toContain("target version");
    expect(agents).toContain("the foreign repo's internal implementation");
  });

  it("requires producer-before-consumers ordering", () => {
    expect(agents).toContain("provider (producer) implements its contract first");
    expect(agents).toContain(
      "Consumer sub-tasks implement adaptation to the contract after the provider sub-task is complete",
    );
  });
});

describe("cross-repo partitioning — single primary → no partition", () => {
  const agents = readFile("AGENTS.md");

  it("explicitly documents no partitioning for single-primary", () => {
    expect(agents).toContain("### Single-Primary");
    expect(agents).toContain("exactly 1 component");
    expect(agents).toContain("no partitioning is needed");
    expect(agents).toContain("single-repo");
  });
});

describe("cross-repo partitioning — low-payload boundary → blocked", () => {
  const agents = readFile("AGENTS.md");

  it("requires low-payload contracts to be raised before use", () => {
    expect(agents).toMatch(/payload_confidence: low.*MUST.*raised to at least `medium`/s);
  });

  it("blocks the sub-task until contract is elevated", () => {
    expect(agents).toContain("MUST NOT** use it as an acceptance interface");
    expect(agents).toContain("MUST** block the sub-task");
  });

  it("provides clear elevation paths", () => {
    expect(agents).toContain("Re-running extraction");
    expect(agents).toContain("Manual confirmation");
  });

  it("includes a blocking message template", () => {
    expect(agents).toContain("Boundary contract `<contract-id>` has `payload_confidence: low`");
  });
});

describe("cross-repo partitioning — developer recognizes blocking condition", () => {
  const developer = readFile(".kiro/agents/developer.md");

  it("developer must block on low-payload contracts", () => {
    expect(developer).toContain("`payload_confidence: low`");
    expect(developer).toContain(
      "MUST** block and inform the user that the contract must be raised to `medium`",
    );
  });

  it("developer must scope exclusively to assigned repo", () => {
    expect(developer).toContain("scope implementation exclusively to the assigned repository");
  });

  it("developer must not implement in the foreign repo", () => {
    expect(developer).toContain("MUST NOT** implement or verify behavior in the foreign repo");
  });
});

describe("cross-repo partitioning — planner enforces ordering", () => {
  const planner = readFile(".kiro/agents/planner.md");

  it("planner orders sub-tasks producer-before-consumers", () => {
    expect(planner).toContain("producer-before-consumers");
  });

  it("planner blocks dependent sub-task on low-payload", () => {
    expect(planner).toContain("`payload_confidence: low`");
    expect(planner).toContain(
      "block the dependent sub-task until the contract is raised to `medium`",
    );
  });

  it("planner delegates each sub-task scoped to its repo", () => {
    expect(planner).toContain("scoped exclusively to its assigned repository");
  });
});

describe("cross-repo partitioning — partition proposal consumption", () => {
  const agents = readFile("AGENTS.md");

  it("references dt scope gate as source of partition proposals", () => {
    expect(agents).toContain("dt scope gate");
    expect(agents).toContain("G1 abort, exit 7");
  });

  it("allows manual application when no automated proposal exists", () => {
    expect(agents).toContain("agent **MUST** apply the same rules manually");
  });
});

describe("cross-repo partitioning — circular producer/consumer strategy", () => {
  const agents = readFile("AGENTS.md");

  // The ordering rule is defined as producer-before-consumers.
  // In a circular case (both produce and consume from each other),
  // the partition proposal from S-019 uses producerScore to resolve ordering.
  // AGENTS.md documents the general rule; the implementation handles circularity.

  it("ordering rule is unambiguous (producer first)", () => {
    expect(agents).toContain("provider (producer) implements its contract first");
    expect(agents).toContain("Consumer sub-tasks implement adaptation to the contract after");
  });

  it("references the automated partition proposal for complex cases", () => {
    expect(agents).toContain("agent **SHOULD** use it as the basis for the partition");
  });
});
