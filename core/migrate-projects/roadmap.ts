/**
 * The roadmap as the migration reads it (spec §8.2, §16a A-55, A-59, A-83;
 * D-86).
 *
 * The canonical table is defined once, in `core/checks/roadmap.ts`, which
 * roadmap-parity uses too; this file only adds what mapping needs: the
 * refusal when the table is missing, exact row lookup by PRD key and
 * `Phase/Wave` cell, and the plan id of a planner state file. Nothing here
 * is fuzzy: `alph` is not `alpha` and `02` is not `2` (D-18).
 */
import { parseRoadmapTable, ROADMAP_FILE, type RoadmapRow } from "../checks/roadmap.js";

export type { RoadmapRow } from "../checks/roadmap.js";

/** Where the user goes when the table is missing (D-86, spec §13). */
export const ROADMAP_CONVERSION_POINTER =
  "run product-engineer's roadmap conversion first (Roadmap Maintenance § Roadmap Conversion): it drafts the canonical table, which merges as its own docs PR before --plan runs (D-86)";

export type RoadmapLoad = { ok: true; rows: RoadmapRow[] } | { ok: false; message: string };

/** The canonical rows, or the refusal message `--plan` exits 2 with. */
export function loadRoadmap(text: string | null): RoadmapLoad {
  if (text === null) return { ok: false, message: `${ROADMAP_FILE} is missing; ${ROADMAP_CONVERSION_POINTER}` };
  const parsed = parseRoadmapTable(text);
  if (!parsed.ok) {
    return {
      ok: false,
      message: `${ROADMAP_FILE} has no canonical table (${parsed.reason}); ${ROADMAP_CONVERSION_POINTER}`,
    };
  }
  return { ok: true, rows: parsed.rows };
}

/** The wave id the plan prints and the owner answers with: `<PRD key> <Phase/Wave>`. */
export function waveId(row: Pick<RoadmapRow, "prd" | "phase">): string {
  return `${row.prd} ${row.phase}`;
}

/** The PRD keys in roadmap order, each once. */
export function roadmapPrds(rows: readonly RoadmapRow[]): string[] {
  return [...new Set(rows.map((r) => r.prd))];
}

/**
 * Rows whose PRD key is `prd` and whose `Phase/Wave` cell is `phase`,
 * exactly. `phase` `null` (a story file without `-phase-N`) matches the
 * PRD's `All` row (A-55).
 */
export function roadmapRows(
  rows: readonly RoadmapRow[],
  prd: string,
  phase: string | null,
): RoadmapRow[] {
  const cell = phase ?? "All";
  return rows.filter((r) => r.prd === prd && r.phase === cell);
}

const STATE_FILE = /^workstream\/planner-state-([A-Za-z0-9._-]+?)(?:-phase-([A-Za-z0-9.]+))?\.md$/;

/**
 * The PRD and wave an active planner state file names by its plan id
 * (`planner-state-<slug>-phase-<N>.md`, A-83); `null` for anything else,
 * including every file under `workstream/archive/`.
 */
export function stateFileWave(path: string): { prd: string; phase: string | null } | null {
  const m = path.match(STATE_FILE);
  return m ? { prd: m[1], phase: m[2] ?? null } : null;
}
