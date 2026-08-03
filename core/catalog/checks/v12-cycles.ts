/**
 * V12: Undeclared dependency cycles.
 * Warning by default, error under --strict.
 * Supports allowed_cycles configuration to exclude known intentional cycles.
 */

import type { CheckFn, CheckViolation } from "../validate.js";
import { passCheck, failCheck } from "../validate.js";
import { buildGraph, detectCycles, isCycleAllowed } from "../graph.js";

const CHECK_ID = "V12";
const DESCRIPTION = "No undeclared dependency cycles";

export const checkV12: CheckFn = (index, options) => {
  const graph = buildGraph(index);
  const cycles = detectCycles(graph);

  const allowedCycles = options.allowedCycles ?? [];
  const undeclaredCycles = cycles.filter((c) => !isCycleAllowed(c, allowedCycles));

  if (undeclaredCycles.length === 0) {
    const severity = options.strict ? "error" : "warning";
    return passCheck(CHECK_ID, DESCRIPTION, severity);
  }

  const violations: CheckViolation[] = undeclaredCycles.map((cycle) => ({
    entity: cycle.members.join(" ↔ "),
    message: `Undeclared dependency cycle: ${cycle.members.join(" → ")} → ${cycle.members[0]}`,
    context: { members: cycle.members },
  }));

  // Under --strict, cycles are errors; otherwise warnings
  const severity = options.strict ? "error" : "warning";
  return failCheck(CHECK_ID, DESCRIPTION, severity, violations);
};
