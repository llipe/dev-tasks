/**
 * V17: Low-confidence component — >30% of tracked fields are low confidence.
 * Warning severity.
 */

import type { CheckFn, CheckViolation } from "../validate.js";
import { passCheck, failCheck } from "../validate.js";

const CHECK_ID = "V17";
const DESCRIPTION = "Components with >30% low-confidence fields are flagged";
const THRESHOLD = 0.3;

export const checkV17: CheckFn = (index) => {
  const violations: CheckViolation[] = [];

  for (const eq of index.extraction_quality.per_component) {
    const total = eq.counts.high + eq.counts.medium + eq.counts.low;
    if (total === 0) continue;

    const lowRatio = eq.counts.low / total;
    if (lowRatio > THRESHOLD) {
      violations.push({
        entity: eq.component_id,
        message: `Component "${eq.component_id}" has ${Math.round(lowRatio * 100)}% low-confidence fields (${eq.counts.low}/${total})`,
        context: {
          lowCount: eq.counts.low,
          totalFields: total,
          ratio: lowRatio,
        },
      });
    }
  }

  return violations.length === 0
    ? passCheck(CHECK_ID, DESCRIPTION, "warning")
    : failCheck(CHECK_ID, DESCRIPTION, "warning", violations);
};
