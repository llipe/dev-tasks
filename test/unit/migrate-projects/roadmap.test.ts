/**
 * S-014 AC-2; PRD AC-13 (first half): the migration reads the canonical
 * roadmap table with the one parser roadmap-parity uses (A-59), and a
 * repository without it is refused (D-86). MU-33 to MU-35.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as checks from "#core/checks/roadmap.js";
import {
  loadRoadmap,
  ROADMAP_CONVERSION_POINTER,
  roadmapRows,
  stateFileWave,
  waveId,
} from "#core/migrate-projects/roadmap.js";
import { loadModel } from "./helpers/fake-github.js";

const ROOT = resolve(import.meta.dirname, "../../..");

describe("roadmap.ts (MU-33 to MU-35)", () => {
  // MU-33
  it("this repository's roadmap parses, with the wave 3 row keyed by its link text", () => {
    const r = loadRoadmap(readFileSync(resolve(ROOT, "docs/roadmap.md"), "utf-8"));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.rows.length).toBeGreaterThanOrEqual(16);
    const wave3 = roadmapRows(r.rows, "projects-tracking", "3");
    expect(wave3).toHaveLength(1);
    expect(waveId(wave3[0])).toBe("projects-tracking 3");
  });

  // MU-34
  it.each([
    ["narrative only", "# Roadmap\n\nWave 1 shipped; wave 2 is next.\n"],
    [
      "five columns",
      "| PRD | Phase/Wave | Scope (one line) | Status | Issues/PRs |\n| --- | --- | --- | --- | --- |\n| a | 1 | x | Done | — |\n",
    ],
    [
      "Phase instead of Phase/Wave",
      "| PRD | Phase | Scope (one line) | Status | Issues/PRs | What's missing |\n| --- | --- | --- | --- | --- | --- |\n| a | 1 | x | Done | — | — |\n",
    ],
    [
      "a Paused status",
      "| PRD | Phase/Wave | Scope (one line) | Status | Issues/PRs | What's missing |\n| --- | --- | --- | --- | --- | --- |\n| a | 1 | x | Paused | — | — |\n",
    ],
  ])("%s: refused with the pointer to product-engineer's conversion", (_name, text) => {
    const r = loadRoadmap(text);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.message).toMatch(/^docs\/roadmap\.md has no canonical table \(/);
    expect(r.message).toContain(ROADMAP_CONVERSION_POINTER);
    expect(ROADMAP_CONVERSION_POINTER).toMatch(/product-engineer's roadmap conversion/);
  });

  it("a missing roadmap is refused the same way", () => {
    const r = loadRoadmap(null);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toBe(`docs/roadmap.md is missing; ${ROADMAP_CONVERSION_POINTER}`);
  });

  // MU-35, A-59: one definition shared by production and test.
  it("uses the exported roadmap-parity parser, and the AC-11 fixture roadmap passes it", () => {
    const text = loadModel("ac11").files["docs/roadmap.md"];
    const shared = checks.parseRoadmapTable(text);
    const mine = loadRoadmap(text);
    expect(shared.ok).toBe(true);
    expect(mine).toEqual(shared.ok ? { ok: true, rows: shared.rows } : null);
  });

  it("rows match a PRD key and a Phase/Wave cell exactly, `All` for a file without -phase-N", () => {
    const text =
      "| PRD | Phase/Wave | Scope (one line) | Status | Issues/PRs | What's missing |\n| --- | --- | --- | --- | --- | --- |\n" +
      "| [alpha](requirements/prd-alpha.md) | 2 | x | Done | — | — |\n" +
      "| [beta](requirements/prd-beta.md) | All | y | Not started | — | — |\n";
    const r = loadRoadmap(text);
    if (!r.ok) throw new Error(r.message);
    expect(roadmapRows(r.rows, "alpha", "2")).toHaveLength(1);
    for (const near of ["02", "2.0", "Wave 2", " 2"]) {
      expect(roadmapRows(r.rows, "alpha", near), near).toHaveLength(0);
    }
    expect(roadmapRows(r.rows, "alph", "2")).toHaveLength(0);
    expect(roadmapRows(r.rows, "beta", null)).toHaveLength(1);
    expect(roadmapRows(r.rows, "alpha", null)).toHaveLength(0);
  });

  it("a state file's plan id names a PRD and a wave (A-83)", () => {
    expect(stateFileWave("workstream/planner-state-alpha-phase-2.md")).toEqual({
      prd: "alpha",
      phase: "2",
    });
    expect(stateFileWave("workstream/planner-state-beta.md")).toEqual({ prd: "beta", phase: null });
    expect(stateFileWave("workstream/archive/planner-state-alpha-phase-2.md")).toBeNull();
    expect(stateFileWave("workstream/tasks-alpha.md")).toBeNull();
  });
});
