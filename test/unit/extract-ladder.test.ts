/**
 * Unit tests for the extraction ladder runner.
 *
 * The ladder runs rungs in order (declared → observed → inferred)
 * and returns the first usable result with provenance metadata.
 */

import { describe, it, expect } from "vitest";
import { runLadder, type Rung, type RungKind } from "../../core/extract/ladder.js";

interface TestResult {
  data: string;
  confidence?: string;
}

function makeRung(
  kind: RungKind,
  result: TestResult | null,
  diagnostics: string[] = [],
): Rung<TestResult> {
  return {
    kind,
    name: `${kind}-rung`,
    execute: () => ({
      result,
      diagnostics,
    }),
  };
}

describe("runLadder", () => {
  it("stops at the first rung returning a usable result", () => {
    const declared = makeRung("declared", { data: "from-declared" });
    const observed = makeRung("observed", { data: "from-observed" });
    const inferred = makeRung("inferred", { data: "from-inferred" });

    const result = runLadder([declared, observed, inferred]);

    expect(result.result).toEqual({ data: "from-declared" });
    expect(result.winningRung).toBe("declared");
  });

  it("falls through on rung returning null (unavailable)", () => {
    const declared = makeRung("declared", null);
    const observed = makeRung("observed", { data: "from-observed" });
    const inferred = makeRung("inferred", { data: "from-inferred" });

    const result = runLadder([declared, observed, inferred]);

    expect(result.result).toEqual({ data: "from-observed" });
    expect(result.winningRung).toBe("observed");
  });

  it("falls through multiple unavailable rungs to inferred", () => {
    const declared = makeRung("declared", null);
    const observed = makeRung("observed", null);
    const inferred = makeRung("inferred", { data: "from-inferred" });

    const result = runLadder([declared, observed, inferred]);

    expect(result.result).toEqual({ data: "from-inferred" });
    expect(result.winningRung).toBe("inferred");
  });

  it("returns null result when all rungs are unavailable", () => {
    const declared = makeRung("declared", null);
    const observed = makeRung("observed", null);
    const inferred = makeRung("inferred", null);

    const result = runLadder([declared, observed, inferred]);

    expect(result.result).toBeNull();
    expect(result.winningRung).toBeNull();
  });

  it("forces confidence: low on results from inferred rungs", () => {
    const inferred = makeRung("inferred", { data: "from-inferred", confidence: "high" });

    const result = runLadder([inferred]);

    expect(result.confidence).toBe("low");
  });

  it("returns confidence: high for declared rung results", () => {
    const declared = makeRung("declared", { data: "from-declared" });

    const result = runLadder([declared]);

    expect(result.confidence).toBe("high");
  });

  it("returns confidence: high for observed rung results", () => {
    const observed = makeRung("observed", { data: "from-observed" });

    const result = runLadder([observed]);

    expect(result.confidence).toBe("high");
  });

  it("collects diagnostics from all rungs (including skipped)", () => {
    const declared = makeRung("declared", null, ["declared-not-found"]);
    const observed = makeRung("observed", { data: "from-observed" }, ["observed-partial"]);
    const inferred = makeRung("inferred", { data: "from-inferred" }, ["inferred-fallback"]);

    const result = runLadder([declared, observed, inferred]);

    // Diagnostics from declared (failed) and observed (winner) should be collected
    expect(result.diagnostics).toContain("declared-not-found");
    expect(result.diagnostics).toContain("observed-partial");
    // Inferred was never executed (observed won), so no diagnostics from it
    expect(result.diagnostics).not.toContain("inferred-fallback");
  });

  it("records provenance of the winning rung", () => {
    const declared = makeRung("declared", null);
    const observed = makeRung("observed", { data: "from-observed" });

    const result = runLadder([declared, observed]);

    expect(result.provenance).toEqual({
      rung: "observed",
      name: "observed-rung",
    });
  });

  it("handles rung that throws (treats as unavailable)", () => {
    const throwing: Rung<TestResult> = {
      kind: "declared",
      name: "throwing-rung",
      execute: () => {
        throw new Error("boom");
      },
    };
    const fallback = makeRung("observed", { data: "fallback" });

    const result = runLadder([throwing, fallback]);

    expect(result.result).toEqual({ data: "fallback" });
    expect(result.winningRung).toBe("observed");
    expect(result.diagnostics).toContain("throwing-rung failed: boom");
  });
});
