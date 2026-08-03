/**
 * V04: Referential integrity — every consumes[].contract resolves to
 * an existing provides[].id in the catalog.
 */

import type { CheckFn, CheckViolation } from "../validate.js";
import { passCheck, failCheck } from "../validate.js";

const CHECK_ID = "V04";
const DESCRIPTION = "Every consumes[].contract resolves to an existing provides[].id";

export const checkV04: CheckFn = (index) => {
  // Build set of all provides[].id across the catalog
  const allProvides = new Set<string>();
  for (const component of index.components) {
    for (const p of component.provides) {
      allProvides.add(p.id);
    }
  }

  const violations: CheckViolation[] = [];
  for (const component of index.components) {
    for (const c of component.consumes) {
      if (!allProvides.has(c.contract)) {
        violations.push({
          entity: component.id,
          message: `Unresolved contract "${c.contract}" consumed by "${component.id}"`,
          context: { contract: c.contract },
        });
      }
    }
  }

  return violations.length === 0
    ? passCheck(CHECK_ID, DESCRIPTION, "error")
    : failCheck(CHECK_ID, DESCRIPTION, "error", violations);
};
