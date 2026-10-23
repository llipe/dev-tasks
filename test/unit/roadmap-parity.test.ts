/**
 * Parity checks for issue #254: `docs/roadmap.md`, the one-page index of
 * every PRD's phases or waves.
 *
 * A roadmap that agents are told to keep current but that nothing checks
 * goes stale the same way memo did (#253). So the rule is wired to three
 * agents with distinct jobs, and each tree must carry all three:
 *
 *   - product-engineer owns the rows and reads the page at session start;
 *   - planner reads it in Phase 0 and updates the delivered rows inside
 *     the consolidated PR, which is the only gate that cannot be skipped
 *     without leaving a visible gap in the PR;
 *   - verifier reports a mismatch with merged work, advisory only, the
 *     same as every other drift finding.
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");

function read(relPath: string): string {
  const full = resolve(ROOT, relPath);
  if (!existsSync(full)) throw new Error(`missing file: ${relPath}`);
  return readFileSync(full, "utf-8");
}

const PRODUCT_ENGINEER = [
  ".claude/commands/product-engineer.md",
  ".github/agents/product-engineer.agent.md",
  ".kiro/agents/product-engineer.md",
];

const PLANNER = [
  ".claude/commands/planner.md",
  ".github/agents/planner.agent.md",
  ".kiro/agents/planner.md",
];

const VERIFIER = [
  ".claude/agents/verifier.md",
  ".github/agents/verifier.agent.md",
  ".kiro/agents/verifier.md",
];

const STATUSES = ["Not started", "In progress", "Done"];

describe("product-engineer owns the roadmap", () => {
  it.each(PRODUCT_ENGINEER)("%s reads it at session start and adds rows per PRD phase", (f) => {
    const content = read(f);
    expect(content).toContain("## Roadmap Maintenance");
    expect(content).toMatch(/Read it at session start/);
    expect(content).toMatch(/one row per delivery phase or wave/);
    expect(content).toMatch(/Never mark a row `Done` yourself/);
  });
});

describe("planner reads the roadmap and updates it in the consolidated PR", () => {
  it.each(PLANNER)("%s reads it in Phase 0", (f) => {
    const phase0 = read(f).match(/## Phase 0 - Discover Task Source[\s\S]*?\n---\n/);
    expect(phase0).not.toBeNull();
    expect(phase0![0]).toContain("docs/roadmap.md");
  });

  it.each(PLANNER)(
    "%s makes the roadmap update a numbered Phase 5 step before the PR opens",
    (f) => {
      const phase5 = read(f).match(
        /## Phase 5 - Consolidated Pull Request[\s\S]*?Consolidated PR should include/,
      );
      expect(phase5).not.toBeNull();
      const steps = phase5![0].match(/^\d+\. .*$/gm) ?? [];
      const roadmap = steps.findIndex((s) => /Roadmap update \(mandatory\)/.test(s));
      const openPr = steps.findIndex((s) => /Open one consolidated PR/.test(s));
      expect(roadmap, "no roadmap step").toBeGreaterThanOrEqual(0);
      expect(roadmap, "roadmap step must precede opening the PR").toBeLessThan(openPr);
    },
  );

  it("planner's Phase 5 text is identical across platforms", () => {
    const sections = PLANNER.map(
      (f) => read(f).match(/^\d+\. \*\*Roadmap update \(mandatory\)\.\*\*.*$/m)?.[0],
    );
    expect(sections[0]).toBeDefined();
    for (const s of sections) expect(s).toBe(sections[0]);
  });
});

describe("roadmap prompt text is identical across platforms", () => {
  const section = (f: string, start: string, end: string): string | undefined =>
    read(f).match(new RegExp(`${start}[\\s\\S]*?${end}`))?.[0];
  it("product-engineer's Roadmap Maintenance section", () => {
    const s = PRODUCT_ENGINEER.map((f) => section(f, "## Roadmap Maintenance", "## memo-cli"));
    expect(s[0]).toBeDefined();
    for (const x of s) expect(x).toBe(s[0]);
  });
  it("verifier's Roadmap-Mismatch Finding section", () => {
    const s = VERIFIER.map((f) => section(f, "## Roadmap-Mismatch Finding", "\\n## "));
    expect(s[0]).toBeDefined();
    for (const x of s) expect(x).toBe(s[0]);
  });
});

// Rollup RD-2 (S-011 DR-3 residual; D-61, D-66): Phase 6 step 7 sets the row
// `Done` only when every story merged and the wave issue closed, otherwise it
// keeps `In progress`. Every other place that states the Phase 6 roadmap result
// must name the same conditional, and none may say the row always ends `Done`.
describe("the Phase 6 roadmap result is conditional everywhere it is stated", () => {
  const ALWAYS_DONE = [
    /roadmap row reads `Done`/,
    /to `Done` in Phase 6/,
    /Never leave the roadmap claiming `In progress` for a phase whose consolidated PR merged/,
    /Update roadmap row to Done/,
  ];
  const CONDITIONAL = [
    "`Done` when every story in the state table reads `✅ Merged`, every story issue reads closed and the wave issue, when there is one, reads closed",
    "otherwise keep `In progress` and list the unmerged stories and the open story issues in `What's missing`",
  ];
  const invariant = (f: string): string =>
    read(f).match(/^- The run is complete only after Phase 6 - Close-out:.*$/m)?.[0] ?? "";
  const maintenance = (f: string): string =>
    read(f).match(/## Roadmap Maintenance[\s\S]*?\n---\n/)?.[0] ?? "";

  it.each(PLANNER)("%s Invariant and Roadmap Maintenance name the conditional", (f) => {
    for (const [name, text] of [
      ["Invariant", invariant(f)],
      ["Roadmap Maintenance", maintenance(f)],
    ] as const) {
      expect(text, `${f}: ${name} not found`).not.toBe("");
      for (const c of CONDITIONAL) expect(text, `${f}: ${name} lacks ${c}`).toContain(c);
      for (const bad of ALWAYS_DONE)
        expect(text, `${f}: ${name} says always Done`).not.toMatch(bad);
    }
  });

  it("the Invariant and Roadmap Maintenance text is identical across planner copies", () => {
    const inv = PLANNER.map(invariant);
    const rm = PLANNER.map(maintenance);
    for (const x of inv) expect(x).toBe(inv[0]);
    for (const x of rm) expect(x).toBe(rm[0]);
  });

  it("docs/workflow-chains.md Phase 6 block names the conditional", () => {
    // The diagram wraps a step across `│` continuation lines; read it as one line.
    const block = (
      read("docs/workflow-chains.md").match(/planner Phase 6 - Close-out:[\s\S]*?```/)?.[0] ?? ""
    )
      .replace(/\n\s*│\s*/g, " ")
      .replace(/[ \t]+/g, " ");
    expect(block, "Phase 6 block not found").not.toBe("");
    expect(block).toMatch(/Done when every story in the state table reads ✅ Merged/);
    expect(block).toMatch(
      /and every story issue and the wave issue, when there is one, read closed/,
    );
    expect(block).toMatch(/otherwise keep In progress and list the unmerged stories/);
    for (const bad of ALWAYS_DONE) expect(block).not.toMatch(bad);
  });
});

describe("verifier reports roadmap drift as advisory", () => {
  it.each(VERIFIER)("%s carries the roadmap-mismatch finding and never blocks on it", (f) => {
    const content = read(f);
    const section = content.match(/## Roadmap-Mismatch Finding[\s\S]*?\n## /);
    expect(section).not.toBeNull();
    expect(section![0]).toMatch(/non-blocking to PR readiness and to issue completion/);
    expect(section![0]).toMatch(/Never hold a PR on it/);
  });
});

describe("the roadmap is registered and well-formed", () => {
  it.each(["AGENTS.md", "AGENTS.md.template", "CLAUDE.md", "CLAUDE.md.template", "docs/README.md"])(
    "%s references docs/roadmap.md",
    (f) => {
      expect(read(f)).toMatch(/roadmap\.md/);
    },
  );

  it("docs/roadmap.md exists with one table whose statuses are from the fixed set", () => {
    const table = read("docs/roadmap.md")
      .split("\n")
      .filter((l) => l.startsWith("|"));
    const cells = (l: string): string[] =>
      l
        .split("|")
        .slice(1, -1)
        .map((c) => c.trim());
    expect(cells(table[0])).toEqual([
      "PRD",
      "Phase/Wave",
      "Scope (one line)",
      "Status",
      "Issues/PRs",
      "What's missing",
    ]);
    const rows = table.slice(2); // header, separator, then data
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(cells(row), `wrong column count in: ${row}`).toHaveLength(6);
      expect(STATUSES, `bad status in: ${row}`).toContain(cells(row)[3]);
    }
  });

  it("every PRD in docs/requirements has at least one roadmap row", () => {
    const roadmap = read("docs/roadmap.md");
    const prds = readdirSync(resolve(ROOT, "docs/requirements")).filter((n) =>
      n.startsWith("prd-"),
    );
    for (const prd of prds) expect(roadmap, `${prd} has no row`).toContain(`requirements/${prd}`);
  });
});
