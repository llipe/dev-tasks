/**
 * Per-package reachability against the S-005 workspace fixtures
 * (S-006 AC-3, task 6.10).
 *
 * `activity-test-standards` is a prompt, not a program, so what is
 * exercised here is the part of its Part 3 procedure that is mechanical:
 * enumerate the packages, read each one's test command, and classify it.
 * The judgment the skill adds on top — whether the aggregate actually
 * reaches a package, whether CI invokes it — is a reading task.
 *
 * The distinction this protects is the one the skill calls out: a
 * package with **no test script** is a different finding from a package
 * that is **unreachable**. One needs a script written, the other needs
 * the aggregate wired. Collapsing them into "not covered" sends the
 * reader to the wrong fix, and a package with nothing to run is the one
 * that looks green while testing nothing.
 */
import { describe, it, expect } from "vitest";
import { resolve } from "node:path";

import { detectWorkspace } from "../../core/distribution/workspace.js";

const FIXTURES = resolve(import.meta.dirname, "../fixtures");

type Classification = "has-test-script" | "no-test-script";

interface ReachabilityRow {
  package: string;
  path: string;
  classification: Classification;
}

/** Steps 1-3 of the skill's per-package procedure, mechanically. */
function reachabilityTable(repoRoot: string): ReachabilityRow[] {
  return detectWorkspace(repoRoot).packages.map((pkg) => ({
    package: pkg.name ?? `(unnamed: ${pkg.path})`,
    path: pkg.path,
    classification: pkg.scripts.includes("test") ? "has-test-script" : "no-test-script",
  }));
}

describe("activity-test-standards per-package reachability (AC-3)", () => {
  it("produces one row per package in a monorepo", () => {
    const rows = reachabilityTable(resolve(FIXTURES, "workspace-mono"));
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.package).sort()).toEqual(["@mono/core", "@mono/web"]);
  });

  it("classifies every package in the monorepo fixture as having a test script", () => {
    const rows = reachabilityTable(resolve(FIXTURES, "workspace-mono"));
    expect(rows.every((r) => r.classification === "has-test-script")).toBe(true);
  });

  it("classifies a package with no test script separately from a covered one", () => {
    const rows = reachabilityTable(resolve(FIXTURES, "workspace-unnamed"));
    expect(rows).toHaveLength(1);
    expect(rows[0].classification).toBe<Classification>("no-test-script");
  });

  it("names an unnamed package by its path so the row is still actionable", () => {
    const rows = reachabilityTable(resolve(FIXTURES, "workspace-unnamed"));
    expect(rows[0].package).toContain("packages/anon");
  });

  it("produces the same one-row table for a single-package repository", () => {
    // The procedure is an extension of the single-package one, not a
    // parallel monorepo path — so the output shape is identical.
    const rows = reachabilityTable(resolve(FIXTURES, "workspace-single"));
    expect(rows).toEqual([{ package: "single-app", path: ".", classification: "has-test-script" }]);
  });

  it("produces a row for this repository, with a test script", () => {
    const rows = reachabilityTable(resolve(FIXTURES, "../.."));
    expect(rows).toHaveLength(1);
    expect(rows[0].classification).toBe<Classification>("has-test-script");
  });
});
