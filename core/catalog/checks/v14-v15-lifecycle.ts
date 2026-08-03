/**
 * V14: lifecycle is a valid enum value.
 * V15: criticality is a valid enum value.
 */

import type { CheckFn, CheckViolation } from "../validate.js";
import { passCheck, failCheck } from "../validate.js";

const VALID_LIFECYCLES = new Set(["production", "beta", "deprecated", "decommissioned"]);
const VALID_CRITICALITIES = new Set(["tier-1", "tier-2", "tier-3"]);

const V14_ID = "V14";
const V14_DESC = "Component lifecycle is a valid enum value";

export const checkV14: CheckFn = (index) => {
  const violations: CheckViolation[] = [];

  for (const component of index.components) {
    if (!VALID_LIFECYCLES.has(component.lifecycle)) {
      violations.push({
        entity: component.id,
        message: `Invalid lifecycle "${component.lifecycle}" in "${component.id}"`,
        context: { lifecycle: component.lifecycle },
      });
    }
  }

  return violations.length === 0
    ? passCheck(V14_ID, V14_DESC, "error")
    : failCheck(V14_ID, V14_DESC, "error", violations);
};

const V15_ID = "V15";
const V15_DESC = "Component criticality is a valid enum value";

export const checkV15: CheckFn = (index) => {
  const violations: CheckViolation[] = [];

  for (const component of index.components) {
    if (!VALID_CRITICALITIES.has(component.criticality)) {
      violations.push({
        entity: component.id,
        message: `Invalid criticality "${component.criticality}" in "${component.id}"`,
        context: { criticality: component.criticality },
      });
    }
  }

  return violations.length === 0
    ? passCheck(V15_ID, V15_DESC, "error")
    : failCheck(V15_ID, V15_DESC, "error", violations);
};
