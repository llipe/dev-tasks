/**
 * V18: Low-payload contracts with consumers.
 * Warning when a contract has low payload_confidence but has active consumers.
 */

import type { CheckFn, CheckViolation } from "../validate.js";
import { passCheck, failCheck } from "../validate.js";

const CHECK_ID = "V18";
const DESCRIPTION = "Contracts with low payload confidence and active consumers are flagged";

export const checkV18: CheckFn = (index) => {
  const violations: CheckViolation[] = [];

  // Build consumed set
  const consumed = new Set<string>();
  for (const component of index.components) {
    for (const c of component.consumes) {
      consumed.add(c.contract);
    }
  }

  // Find provides with low payload_confidence that have consumers
  for (const component of index.components) {
    for (const p of component.provides) {
      if (p.payload_confidence === "low" && consumed.has(p.id)) {
        violations.push({
          entity: component.id,
          message: `Contract "${p.id}" from "${component.id}" has low payload confidence but has active consumers`,
          context: { providesId: p.id, payloadConfidence: "low" },
        });
      }
    }
  }

  return violations.length === 0
    ? passCheck(CHECK_ID, DESCRIPTION, "warning")
    : failCheck(CHECK_ID, DESCRIPTION, "warning", violations);
};
