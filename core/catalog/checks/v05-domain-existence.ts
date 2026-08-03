/**
 * V05: Domain existence — every component's domain is declared in the domains list.
 */

import type { CheckFn, CheckViolation } from "../validate.js";
import { passCheck, failCheck } from "../validate.js";

const CHECK_ID = "V05";
const DESCRIPTION = "Every component domain exists in the domains list";

export const checkV05: CheckFn = (index) => {
  const declaredDomains = new Set(index.domains.map((d) => d.name));
  const violations: CheckViolation[] = [];

  for (const component of index.components) {
    if (!declaredDomains.has(component.domain)) {
      violations.push({
        entity: component.id,
        message: `Component "${component.id}" references undeclared domain "${component.domain}"`,
        context: { domain: component.domain },
      });
    }
  }

  return violations.length === 0
    ? passCheck(CHECK_ID, DESCRIPTION, "error")
    : failCheck(CHECK_ID, DESCRIPTION, "error", violations);
};
