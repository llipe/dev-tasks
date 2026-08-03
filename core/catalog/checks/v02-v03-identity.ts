/**
 * V02: No duplicate component id across the catalog.
 * V03: No duplicate provides[].id within a single component.
 */

import type { CheckFn, CheckViolation } from "../validate.js";
import { passCheck, failCheck } from "../validate.js";

const V02_ID = "V02";
const V02_DESC = "No duplicate component id across catalog";

const V03_ID = "V03";
const V03_DESC = "No duplicate provides[].id within a component";

/**
 * V02: Identity uniqueness — no duplicate component id across catalog.
 */
export const checkV02: CheckFn = (index) => {
  const seen = new Map<string, string[]>();

  for (const component of index.components) {
    const existing = seen.get(component.id);
    if (existing) {
      existing.push(component.repo);
    } else {
      seen.set(component.id, [component.repo]);
    }
  }

  const violations: CheckViolation[] = [];
  for (const [id, repos] of seen) {
    if (repos.length > 1) {
      violations.push({
        entity: id,
        message: `Duplicate component id "${id}" found in repos: ${repos.join(", ")}`,
        context: { repos },
      });
    }
  }

  return violations.length === 0
    ? passCheck(V02_ID, V02_DESC, "error")
    : failCheck(V02_ID, V02_DESC, "error", violations);
};

/**
 * V03: No duplicate provides[].id within a single component.
 */
export const checkV03: CheckFn = (index) => {
  const violations: CheckViolation[] = [];

  for (const component of index.components) {
    const seen = new Set<string>();
    for (const p of component.provides) {
      if (seen.has(p.id)) {
        violations.push({
          entity: component.id,
          message: `Duplicate provides[].id "${p.id}" within component "${component.id}"`,
          context: { providesId: p.id },
        });
      }
      seen.add(p.id);
    }
  }

  return violations.length === 0
    ? passCheck(V03_ID, V03_DESC, "error")
    : failCheck(V03_ID, V03_DESC, "error", violations);
};
