/**
 * V19: Domain membership consistency.
 * Every component listed in domains[].components must exist in the catalog,
 * and every component's domain field must match its entry in the domains list.
 */

import type { CheckFn, CheckViolation } from "../validate.js";
import { passCheck, failCheck } from "../validate.js";

const CHECK_ID = "V19";
const DESCRIPTION = "Domain membership is consistent with component declarations";

export const checkV19: CheckFn = (index) => {
  const violations: CheckViolation[] = [];
  const componentIds = new Set(index.components.map((c) => c.id));

  // Check that all components listed in domains actually exist
  for (const domain of index.domains) {
    for (const memberId of domain.components) {
      if (!componentIds.has(memberId)) {
        violations.push({
          entity: memberId,
          message: `Domain "${domain.name}" lists component "${memberId}" which does not exist in the catalog`,
          context: { domain: domain.name },
        });
      }
    }
  }

  // Check that each component's domain matches its domain list entry
  const domainMembership = new Map<string, string>();
  for (const domain of index.domains) {
    for (const memberId of domain.components) {
      domainMembership.set(memberId, domain.name);
    }
  }

  for (const component of index.components) {
    const listedDomain = domainMembership.get(component.id);
    if (!listedDomain) {
      violations.push({
        entity: component.id,
        message: `Component "${component.id}" is not listed in any domain's components array`,
        context: { declaredDomain: component.domain },
      });
    } else if (listedDomain !== component.domain) {
      violations.push({
        entity: component.id,
        message: `Component "${component.id}" declares domain "${component.domain}" but is listed under domain "${listedDomain}"`,
        context: {
          declaredDomain: component.domain,
          listedDomain,
        },
      });
    }
  }

  return violations.length === 0
    ? passCheck(CHECK_ID, DESCRIPTION, "error")
    : failCheck(CHECK_ID, DESCRIPTION, "error", violations);
};
