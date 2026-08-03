/**
 * V13: Orphan contracts — provides[] entries with no consumers.
 * Warning severity.
 */

import type { CheckFn, CheckViolation } from "../validate.js";
import { passCheck, failCheck } from "../validate.js";

const CHECK_ID = "V13";
const DESCRIPTION = "No orphan contracts (provides[] with no consumers)";

export const checkV13: CheckFn = (index) => {
  const violations: CheckViolation[] = [];

  // Build set of all consumed contracts
  const consumed = new Set<string>();
  for (const component of index.components) {
    for (const c of component.consumes) {
      consumed.add(c.contract);
    }
  }

  // Find provides[] that are not consumed by anyone
  for (const component of index.components) {
    for (const p of component.provides) {
      if (!consumed.has(p.id)) {
        violations.push({
          entity: component.id,
          message: `Contract "${p.id}" provided by "${component.id}" has no consumers`,
          context: { providesId: p.id },
        });
      }
    }
  }

  return violations.length === 0
    ? passCheck(CHECK_ID, DESCRIPTION, "warning")
    : failCheck(CHECK_ID, DESCRIPTION, "warning", violations);
};
